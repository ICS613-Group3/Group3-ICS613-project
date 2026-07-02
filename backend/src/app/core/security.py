"""Security helpers: password hashing and JWT tokens."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings
from app.core.exceptions import AuthenticationError


def hash_password(plain_password: str) -> str:
    """Hash a plain text password with bcrypt (12 rounds)."""
    password_bytes = plain_password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def _now() -> datetime:
    return datetime.now(UTC)


def create_access_token(subject: uuid.UUID, extra_claims: dict[str, Any] | None = None) -> str:
    """Create a short-lived JWT access token.

    The token is bound to this service via the ``aud`` and ``iss`` claims,
    so a token minted by another service that happens to share the same
    ``SECRET_KEY`` cannot be replayed against this API.
    """
    settings = get_settings()
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = _now() + expires_delta
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "type": "access",
        "exp": expire,
        "iat": _now(),
        "jti": secrets.token_urlsafe(16),
        "aud": settings.jwt_audience,
        "iss": settings.jwt_issuer,
    }
    if extra_claims:
        to_encode.update(extra_claims)
    encoded: str = jwt.encode(
        to_encode, settings.secret_key.get_secret_value(), algorithm=settings.algorithm
    )
    return encoded


def create_refresh_token(subject: uuid.UUID) -> str:
    """Create a longer-lived JWT refresh token.

    Also carries ``aud``/``iss`` so refresh tokens can't be replayed across
    services that share a secret.
    """
    settings = get_settings()
    expires_delta = timedelta(days=settings.refresh_token_expire_days)
    expire = _now() + expires_delta
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "type": "refresh",
        "exp": expire,
        "iat": _now(),
        "jti": secrets.token_urlsafe(16),
        "aud": settings.jwt_audience,
        "iss": settings.jwt_issuer,
    }
    encoded: str = jwt.encode(
        to_encode, settings.secret_key.get_secret_value(), algorithm=settings.algorithm
    )
    return encoded


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises ``AuthenticationError`` on failure.

    Verifies ``aud`` and ``iss`` so a token minted by a different service
    (even with the same secret) is rejected.
    """
    settings = get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[settings.algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired token") from exc

    if payload.get("type") not in ("access", "refresh"):
        raise AuthenticationError("Invalid token type")

    return payload
