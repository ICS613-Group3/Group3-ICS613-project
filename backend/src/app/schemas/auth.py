"""Auth request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TokenPairResponse(BaseModel):
    """Access and refresh token pair returned on login/refresh/verify."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class InviteCreate(BaseModel):
    """Admin request to create an invite token."""

    email: EmailStr


class InviteResponse(BaseModel):
    """Invite token response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    token: str
    email: str
    status: str
    expires_at: datetime
    created_at: datetime


def _validate_full_name(v: str | None) -> str | None:
    """Validate a display name: strip whitespace, reject blank or overlong."""
    if v is not None:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Display name cannot be empty or whitespace-only")
        return stripped
    return v


class RegisterRequest(BaseModel):
    """Registration request using an invite token."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=255)
    invite_token: str = Field(..., min_length=1)

    _validate_name = field_validator("full_name", mode="before")(_validate_full_name)


class VerifyEmailRequest(BaseModel):
    """Email verification request."""

    token: str = Field(..., min_length=1)


class ResendRequest(BaseModel):
    """Resend verification email request."""

    email: EmailStr


class LoginRequest(BaseModel):
    """Login request."""

    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if isinstance(value, str):
            return value.lower().strip()
        return value


class RefreshRequest(BaseModel):
    """Refresh token request."""

    refresh_token: str = Field(..., min_length=1)


class ForgotPasswordRequest(BaseModel):
    """Forgot password request."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password with token request."""

    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)
