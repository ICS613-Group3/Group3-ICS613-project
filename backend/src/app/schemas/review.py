"""Review request/response schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.exc import SQLAlchemyError


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
    reviewer_name: str | None = None
    reviewee_id: UUID
    reviewee_name: str | None = None
    rating: int
    comment: str | None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _extract_names(cls, data: Any) -> Any:
        """Extract display names from ORM relationships before validation."""
        if isinstance(data, dict):
            return data
        try:
            reviewer = getattr(data, "reviewer", None)
            if reviewer is not None:
                data.reviewer_name = getattr(reviewer, "full_name", None) or getattr(
                    reviewer, "email", None
                )
            reviewee = getattr(data, "reviewee", None)
            if reviewee is not None:
                data.reviewee_name = getattr(reviewee, "full_name", None) or getattr(
                    reviewee, "email", None
                )
        except SQLAlchemyError:
            # Relationship not loaded / instance detached from its session --
            # fall back to the base data without the enriched display names.
            pass
        return data
