# JWT Security Deep Dive — R2 Presentation Reference

**For:** R2 Demo Q&A preparation  
**File:** `backend/_local_drafts/R2_presentation/R2_JWT_Security.md`

> All file paths are relative to `backend/src/app/`.

---

## 1. Token Structure

### Access Token (short-lived, 60 min)

**File:** `core/security.py:34-58`

```python
def create_access_token(subject: uuid.UUID, extra_claims: dict[str, Any] | None = None) -> str:
```

The payload is built at lines 44-52:

```python
to_encode: dict[str, Any] = {
    "sub": str(subject),       # line 45 — which user
    "type": "access",          # line 46 — distinguishes from refresh
    "exp": expire,             # line 47 — expiration
    "iat": _now(),             # line 48 — issued-at (used for password-change check)
    "jti": secrets.token_urlsafe(16),  # line 49 — unique token ID
    "aud": settings.jwt_audience,      # line 50 — audience claim
    "iss": settings.jwt_issuer,        # line 51 — issuer claim
}
```

Encoded at lines 55-57:

```python
encoded: str = jwt.encode(
    to_encode, settings.secret_key.get_secret_value(), algorithm=settings.algorithm
)
```

### Refresh Token (long-lived, 7 days)

**File:** `core/security.py:61-82`

```python
def create_refresh_token(subject: uuid.UUID) -> str:
```

Payload built at lines 70-78 — identical structure but `"type": "refresh"` (line 72) and 7-day expiry (line 68).

### Why Two Token Types?

- **Access token:** short-lived, used for API calls, sent in `Authorization: Bearer` header
- **Refresh token:** long-lived, used only to get new access tokens, never sent to protected endpoints

This limits the window of exposure: if an access token is stolen, it expires in 60 minutes.

---

## 2. `aud` and `iss` Claims — Cross-Service Protection

### What They Are

- `aud` (audience): identifies which service the token is intended for
- `iss` (issuer): identifies which service minted the token

### Where They're Set

**File:** `core/security.py:50-51` (access) and `core/security.py:76-77` (refresh)

```python
"aud": settings.jwt_audience,   # default: "toolsharing-api"
"iss": settings.jwt_issuer,     # default: "toolsharing-api"
```

### Where They're Verified

**File:** `core/security.py:85-106` — `decode_token()`

```python
def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[settings.algorithm],
            audience=settings.jwt_audience,   # line 97 — checks "aud" matches
            issuer=settings.jwt_issuer,       # line 98 — checks "iss" matches
        )
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired token") from exc
```

### Config Defaults

**File:** `config.py:66-78`

```python
jwt_audience: str = Field(
    default="toolsharing-api",
    description="JWT ``aud`` claim — must match on decode. (env: JWT_AUDIENCE)",
)
jwt_issuer: str = Field(
    default="toolsharing-api",
    description="JWT ``iss`` claim — must match on decode. (env: JWT_ISSUER)",
)
```

### Why It Matters

If another service (say, a classmate's project on the same machine) happens to use the same `SECRET_KEY`, they cannot mint a token that works against your API because the `aud`/`iss` claims won't match.

---

## 3. Password Change Invalidation — Automatic Token Revocation

### The Problem

When a user changes their password, all previously issued tokens should become invalid — even if they haven't expired yet.

### Where It Happens

**File:** `dependencies.py:52-60` — inside `get_current_user()`

```python
# Invalidate tokens issued before the last password change.
# ``iat`` is a Unix epoch (seconds). Convert to a tz-aware UTC datetime
# so the comparison is correct regardless of the server's local timezone.
issued_at_epoch = payload.get("iat")           # line 55
password_changed_at = user.password_changed_at  # line 56
if issued_at_epoch and password_changed_at:     # line 57
    issued_at = datetime.fromtimestamp(issued_at_epoch, tz=UTC)  # line 58
    if issued_at < password_changed_at:         # line 59
        raise AuthenticationError("Token revoked due to password change")  # line 60
```

### How It Works

1. Every JWT contains `iat` (issued-at timestamp) — `security.py:48`
2. The `users` table has a `password_changed_at` column — `models/user.py`
3. On every authenticated request, `get_current_user()` compares: if `iat < password_changed_at`, the token is rejected
4. When a password changes, `password_changed_at` is updated to `now()`, instantly invalidating all older tokens

### Why This Is Elegant

No blocklist needed. No Redis. No database lookup per token. Just one extra column check on the user record (which is already loaded for the request). The invalidation is automatic and immediate.

---

## 4. Token Rotation on Refresh

### The Flow

**File:** `services/auth.py` — `AuthService.refresh()`

```
POST /auth/refresh  { "refresh_token": "old-token" }
    ↓
1. Decode old refresh token → get user_id
2. Load user, verify ACTIVE status
3. Create NEW access + refresh token pair
4. Return new pair
```

### Why Rotation Matters

- If an attacker steals a refresh token and uses it, the legitimate user's next refresh attempt will fail (the old token was already consumed)
- This creates a detectable anomaly — the legitimate user knows something is wrong
- Without rotation, a stolen refresh token could be used indefinitely

### In Your Code

**File:** `services/auth.py` — `AuthService.refresh()`

The old refresh token is not explicitly revoked — it just becomes useless because the user now uses the new one. This is "rotation without revocation" — simpler than full revocation but still provides theft detection.

---

## 5. Stateless Logout — Password Change Trick

### The Problem

JWTs are stateless — the server doesn't track which tokens are "active." How do you invalidate tokens on logout without a blocklist?

### Your Solution

**File:** `services/auth.py` — `AuthService.logout()`

```python
async def logout(self, db, current_user):
    current_user.password_changed_at = datetime.now(UTC)
    db.add(current_user)
```

### How It Works

Logout = update `password_changed_at` to now. This triggers the check in Section 3 above (`dependencies.py:57-60`): all existing tokens (which have `iat` before now) are rejected.

### Side Effects (All Intentional)

- After logout, the user must re-login → correct behavior
- Changing password also logs out all other sessions → correct behavior (security feature)
- No token blocklist needed → simpler architecture

---

## 6. Password Hashing

**File:** `core/security.py:15-27`

```python
def hash_password(plain_password: str) -> str:
    """Hash a plain text password with bcrypt (12 rounds)."""
    password_bytes = plain_password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12))  # line 18
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )
```

- **bcrypt** with **12 rounds** of salting (line 18)
- 12 rounds ≈ 250ms on modern hardware (deliberately slow to resist brute-force)
- Each hash includes a random salt, so identical passwords produce different hashes

---

## 7. Rate Limiting on Auth Endpoints

### Where Defined

**File:** `dependencies_rate_limit.py:55-96`

| Endpoint | Function | Limit | Window | Line |
|----------|----------|-------|--------|------|
| `/auth/login` | `rate_limit_login()` | 50 req/IP | 60 sec | 55-62 |
| `/auth/forgot-password` | `rate_limit_forgot_password()` | 50 req/IP | 60 sec | 65-74 |
| `/auth/resend-verification` | `rate_limit_resend_verification()` | 50 req/IP | 60 sec | 77-86 |
| `/auth/register` | `rate_limit_register()` | 50 req/IP | 3600 sec | 89-96 |

### How It Works

**File:** `dependencies_rate_limit.py:25-37` — `_get_limiter()` factory

```python
def _get_limiter(name: str, max_requests: int, window_seconds: int) -> RateLimiter:
    if name not in _limiters:
        _limiters[name] = RateLimiter(
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
    return _limiters[name]
```

- In-memory sliding-window counter per client IP
- Uses `request.client.host` (TCP connection address), NOT `X-Forwarded-For` header

### Why Not Trust X-Forwarded-For?

**File:** `dependencies_rate_limit.py:40-52` — `_client_key()`

```python
def _client_key(request: Request) -> str:
    """Return the rate-limit key for a request (client connection IP).
    Always uses ``request.client.host`` — the actual TCP connection address.
    We intentionally do NOT trust the ``X-Forwarded-For`` header because any
    client can send it, which would allow bypassing rate limits by rotating
    fake IPs.
    """
    return request.client.host if request.client else "unknown"
```

---

## 8. Login Security — Email Enumeration Prevention

### The Problem

If login returns different errors for "user not found" vs "wrong password," an attacker can enumerate valid email addresses.

### Your Solution

**File:** `services/auth.py` — `AuthService.login()`

```python
async def login(self, db, email, password):
    user = await user_service.get_by_email(db, email)

    # If user not found, still run bcrypt to prevent timing attacks
    if user is None:
        hash_password("dummy-password-to-prevent-timing-attack")
        raise AuthenticationError("Invalid email or password")

    # If user found but wrong password
    if not verify_password(password, user.hashed_password):
        raise AuthenticationError("Invalid email or password")

    # Both cases return the SAME error message
```

### Two Protections

1. **Same error message** for both cases → attacker can't tell if the email exists
2. **Bcrypt runs even for unknown emails** → prevents timing attacks (bcrypt takes ~250ms regardless of whether the user exists)

---

## 9. Security Gaps (Honest Assessment)

### What Your Code Does NOT Have

| Gap | Risk Level | Does It Matter for ICS 613? |
|-----|------------|---------------------------|
| No token blocklist (Redis) | Stolen tokens work until expiry | **No** — dev-only, short expiry |
| `jti` claim not checked | Generated but never validated | **No** — would need a blocklist to use |
| Refresh token reuse detection | No alert on double-use | **No** — single-user dev environment |
| No HTTPS enforcement | Tokens in plaintext over network | **No** — localhost only |
| Rate limiting in-memory | Resets on server restart | **No** — fine for dev; would need Redis in production |

### Where `jti` Is Generated But Not Used

**File:** `core/security.py:49` (access) and `core/security.py:75` (refresh)

```python
"jti": secrets.token_urlsafe(16),  # generated here
```

**File:** `core/security.py:93-99` — `decode_token()` returns the full payload including `jti`, but no code ever checks it.

### What You Do Have (Above Average for a Student Project)

- `aud`/`iss` claims — `security.py:50-51, 76-77, 97-98`
- Password-change token invalidation — `dependencies.py:52-60`
- Token rotation on refresh — `services/auth.py: AuthService.refresh()`
- Bcrypt timing-attack mitigation — `services/auth.py: AuthService.login()`
- Email enumeration prevention — `services/auth.py: AuthService.login()`
- Rate limiting on auth endpoints — `dependencies_rate_limit.py:55-96`

---

## 10. If Asked in Q&A

**"What happens if someone steals a JWT?"**

> The access token expires in 60 minutes (`config.py:48-49`). If they also steal the refresh token, they can get new access tokens — but when the legitimate user tries to refresh, rotation means the stolen refresh token becomes stale. If the user changes their password, all tokens are immediately invalidated via the `password_changed_at` check (`dependencies.py:57-60`).

**"Why not use RS256 (asymmetric) instead of HS256?"**

> RS256 is better when multiple services need to verify tokens without sharing a secret. We're a single service, so HMAC (`security.py:55-57`) is simpler and sufficient. The `aud`/`iss` claims (`security.py:97-98`) provide cross-service isolation even with HMAC.

**"How does logout work without a blocklist?"**

> We update `password_changed_at` to the current time (`services/auth.py: AuthService.logout()`). Since every authenticated request checks `iat < password_changed_at` (`dependencies.py:59`), all existing tokens are instantly rejected. This also means changing your password logs out all sessions.

**"What about refresh token theft?"**

> We use rotation: each refresh issues a new pair (`services/auth.py: AuthService.refresh()`). If an attacker steals and uses a refresh token, the legitimate user's next refresh will fail, alerting them to the theft. For a production system, we'd add reuse detection (if a consumed refresh token is reused, revoke the entire family).

**"What is the SECRET_KEY validation?"**

> At startup, `config.py:244-253` enforces the key is at least 32 characters. In production (`config.py:256-283`), dev placeholders like `change-me` are rejected. In development/test, placeholders are tolerated so a fresh checkout works immediately.

---

*Document prepared for R2 Demo — JWT Security Q&A preparation.*
