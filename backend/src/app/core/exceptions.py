"""Application-specific exception hierarchy.

All domain errors inherit from AppError. The API layer maps these to
appropriate HTTP status codes via exception handlers in app.main.
"""

from enum import Enum
from typing import Any


class AppError(Exception):
    """Base class for all application errors."""

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    """Requested resource does not exist."""

    pass


class PermissionDeniedError(AppError):
    """User does not have permission to perform the action."""

    pass


class ConflictError(AppError):
    """Request conflicts with current state."""

    pass


class ValidationError(AppError):
    """Input failed business validation."""

    pass


class AuthenticationError(AppError):
    """Authentication failed or token is invalid/expired."""

    pass


class VerifyTokenError(AppError):
    """Email verification token is invalid or expired.

    Attributes:
        resend_available: Whether the caller may request a new token.
    """

    def __init__(
        self,
        message: str,
        *,
        resend_available: bool = True,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, details=details)
        self.resend_available = resend_available


class TooManyRequestsError(AppError):
    """Rate limit exceeded for a given client / endpoint.

    The detail message is intended to be user-facing (e.g. "Too many login
    attempts. Please wait a minute and try again."). Mapped to HTTP 429 by
    the central ``_handle_app_error`` handler.
    """

    pass


def parse_enum_or_raise(value: str, enum_cls: type[Enum], field_name: str) -> str:
    """Parse a string into an enum value, or raise ``ValidationError`` (422).

    Catches ``ValueError`` from enum constructors (e.g. ``ToolCategory("bad")``)
    and re-raises as the project's ``ValidationError`` so the API returns a
    consistent 422 with valid-values hint instead of a raw 500.
    """
    try:
        enum_cls(value)  # validate; caller casts again for the actual enum instance
    except ValueError:
        valid = ", ".join(e.value for e in enum_cls)
        raise ValidationError(f"Invalid {field_name}: '{value}'. Valid values: {valid}") from None
    return value
