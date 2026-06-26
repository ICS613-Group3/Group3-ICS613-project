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
    """Return the rate-limit key for a request, preferring trusted proxy headers.

    In production behind a reverse proxy, the proxy's forwarded-for header
    carries the real client IP. We trust the leftmost entry (set by the
    edge load balancer). For dev / direct uvicorn, ``request.client.host``
    is used.
    """
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
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
