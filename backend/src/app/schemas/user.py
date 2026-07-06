"""User request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import UserStatus


def _validate_full_name(v: str | None) -> str | None:
    """Validate a display name: strip whitespace, reject blank or overlong."""
    if v is not None:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Display name cannot be empty or whitespace-only")
        return stripped
    return v


class UserUpdate(BaseModel):
    """Schema for updating a user's profile."""

    full_name: str | None = Field(None, max_length=255)
    bio: str | None = None
    neighborhood: str | None = None
    photo_url: str | None = None

    _validate_name = field_validator("full_name", mode="before")(_validate_full_name)


class UserProfile(BaseModel):
    """Own profile view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None
    bio: str | None
    neighborhood: str | None
    photo_url: str | None
    status: UserStatus
    trust_score: float
    damage_reported: int
    violation_count: int
    created_at: datetime
    is_admin: bool
