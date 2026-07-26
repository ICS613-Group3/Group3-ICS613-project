"""Review request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    def _extract_names(cls, data: dict) -> dict:
        """Extract display names from ORM relationships before validation."""
        if isinstance(data, dict):
            return data
        try:
            from types import SimpleNamespace

            ns_data = {}
            for col in data.__class__.__table__.columns:
                ns_data[col.name] = getattr(data, col.name)

            reviewer = getattr(data, "reviewer", None)
            if reviewer is not None:
                ns_data["reviewer_name"] = getattr(reviewer, "full_name", None) or getattr(
                    reviewer, "email", None
                )
            reviewee = getattr(data, "reviewee", None)
            if reviewee is not None:
                ns_data["reviewee_name"] = getattr(reviewee, "full_name", None) or getattr(
                    reviewee, "email", None
                )
            return SimpleNamespace(**ns_data)
        except Exception:
            pass
        return data
