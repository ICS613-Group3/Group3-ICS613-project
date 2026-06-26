"""Review request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    """Submit a review after a reservation is returned."""

    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=2000)


class ReviewUpdate(BaseModel):
    """Edit a review within the 24-hour window."""

    rating: int | None = Field(None, ge=1, le=5)
    comment: str | None = Field(None, max_length=2000)


class ReviewResponse(BaseModel):
    """Public review view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    reviewer_id: UUID
    reviewee_id: UUID
    rating: int
    comment: str | None
    created_at: datetime
    updated_at: datetime
