"""User request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import UserStatus
from app.schemas.common import validate_full_name
from app.schemas.tool import ToolResponse


class UserUpdate(BaseModel):
    """Schema for updating a user's profile."""

    full_name: str | None = Field(None, max_length=255)
    bio: str | None = None
    neighborhood: str | None = None
    photo_url: str | None = None

    _validate_name = field_validator("full_name", mode="before")(validate_full_name)


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


class PublicMemberReview(BaseModel):
    """Review displayed on another member's public profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    reviewer_id: UUID
    reviewer_name: str | None
    rating: int
    comment: str | None
    reservation_date: str
    created_at: datetime


class PublicMemberProfileResponse(BaseModel):
    """Public-safe member profile — excludes email, admin status, PII."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None
    bio: str | None
    neighborhood: str | None
    photo_url: str | None
    status: UserStatus
    member_since: datetime
    average_rating: float
    review_count: int
    completed_loans_as_owner: int
    damage_report_count: int
    active_tools: list[ToolResponse]
    reviews: list[PublicMemberReview]
