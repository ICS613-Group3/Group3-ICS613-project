"""FastAPI dependencies for rate limiting auth endpoints.

Each throttled endpoint has its own :class:`RateLimiter` instance, sized
per ``Settings.rate_limit_*``. Limiters are lazily created on first
request via :func:`_get_limiter` and reset between tests via
:func:`reset_all_limiters`.

The rate-limit dependency is added inline to each route (rather than
globally) so only the auth endpoints are throttled — internal API calls
between services aren't.
"""

from fastapi import Request

from app.config import get_settings
from app.core.exceptions import TooManyRequestsError
from app.core.rate_limit import RateLimiter

# Lazy-singleton limiters, one per throttled endpoint. Keyed by a logical
# name (e.g. ``"login"``). The :func:`_get_limiter` factory creates the
# underlying RateLimiter on first call and reuses it thereafter.
_limiters: dict[str, RateLimiter] = {}


def _get_limiter(name: str, max_requests: int, window_seconds: int) -> RateLimiter:
    """Return the named limiter, creating it on first call.

    The settings are read on first access; subsequent calls reuse the
    cached instance. Tests call :func:`reset_all_limiters` to clear state
    between cases.
    """
    if name not in _limiters:
        _limiters[name] = RateLimiter(
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
    return _limiters[name]


def _client_key(request: Request) -> str:
    """Return the rate-limit key for a request (client connection IP).

    Always uses ``request.client.host`` — the actual TCP connection address.
    We intentionally do NOT trust the ``X-Forwarded-For`` header because any
    client can send it, which would allow bypassing rate limits by rotating
    fake IPs.

    When deployed behind a trusted reverse proxy (nginx, Cloudflare, etc.),
    start uvicorn with ``--proxy-headers`` so ``request.client.host`` already
    reflects the real client IP from the proxy's trusted forwarded header.
    """
    return request.client.host if request.client else "unknown"


async def rate_limit_login(request: Request) -> None:
    """Throttle ``/auth/login`` per client IP. Raises 429 on limit."""
    s = get_settings()
    limiter = _get_limiter("login", s.rate_limit_login_per_minute, 60)
    if not limiter.check(_client_key(request)):
        raise TooManyRequestsError(
            "Too many login attempts. Please wait a minute and try again."
        )


async def rate_limit_forgot_password(request: Request) -> None:
    """Throttle ``/auth/forgot-password`` per client IP. Raises 429 on limit."""
    s = get_settings()
    limiter = _get_limiter(
        "forgot_password", s.rate_limit_forgot_password_per_minute, 60
    )
    if not limiter.check(_client_key(request)):
        raise TooManyRequestsError(
            "Too many password-reset requests. Please wait a minute and try again."
        )


async def rate_limit_resend_verification(request: Request) -> None:
    """Throttle ``/auth/resend-verification`` per client IP. Raises 429 on limit."""
    s = get_settings()
    limiter = _get_limiter(
        "resend_verification", s.rate_limit_resend_verification_per_minute, 60
    )
    if not limiter.check(_client_key(request)):
        raise TooManyRequestsError(
            "Too many resend-verification requests. Please wait a minute and try again."
        )


async def rate_limit_register(request: Request) -> None:
    """Throttle ``/auth/register`` per client IP. Raises 429 on limit."""
    s = get_settings()
    limiter = _get_limiter("register", s.rate_limit_register_per_hour, 3600)
    if not limiter.check(_client_key(request)):
        raise TooManyRequestsError(
            "Too many registration attempts from this client. Please try again later."
        )


def reset_all_limiters() -> None:
    """Reset all rate limiters. Called by test fixtures to keep state from leaking."""
    for limiter in _limiters.values():
        limiter.reset()
