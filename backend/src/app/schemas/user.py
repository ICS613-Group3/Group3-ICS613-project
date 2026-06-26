"""User request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserStatus


class UserUpdate(BaseModel):
    """Schema for updating a user's profile."""

    full_name: str | None = None
    bio: str | None = None
    neighborhood: str | None = None
    photo_url: str | None = None


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
