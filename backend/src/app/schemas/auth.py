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


class RegisterRequest(BaseModel):
    """Registration request using an invite token."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=255)
    invite_token: str = Field(..., min_length=1)


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
