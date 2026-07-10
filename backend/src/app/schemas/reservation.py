"""Reservation request/response schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ReservationState


class ReservationCreate(BaseModel):
    """Submit a reservation request for a tool."""

    tool_id: UUID
    start_date: date
    end_date: date


class ReservationResponse(BaseModel):
    """Reservation detail view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tool_id: UUID
    tool_name: str | None = None
    borrower_id: UUID
    borrower_name: str | None = None
    owner_name: str | None = None
    state: ReservationState
    start_date: date
    end_date: date
    cancelled_by_type: str | None = None
    cancelled_reason: str | None = None
    denied_reason: str | None = None
    picked_up_at: datetime | None = None
    returned_at: datetime | None = None
    damage_reported: bool = False
    damage_description: str | None = None
    damage_reported_at: datetime | None = None
    force_resolved_by: UUID | None = None
    force_resolved_at: datetime | None = None
    force_resolution_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _extract_names(cls, data):
        """Extract display names from ORM relationships before validation."""
        if isinstance(data, dict):
            return data
        # data is an ORM object with from_attributes=True
        try:
            tool = getattr(data, "tool", None)
            if tool is not None:
                data.tool_name = getattr(tool, "name", None)
                owner = getattr(tool, "owner", None)
                if owner is not None:
                    data.owner_name = getattr(owner, "full_name", None) or getattr(
                        owner, "email", None
                    )
            borrower = getattr(data, "borrower", None)
            if borrower is not None:
                data.borrower_name = getattr(borrower, "full_name", None) or getattr(
                    borrower, "email", None
                )
        except Exception:
            pass
        return data


class ReservationDeny(BaseModel):
    """Deny a reservation request with optional reason."""

    reason: str | None = Field(None, max_length=2000)


class ReservationCancel(BaseModel):
    """Cancel a reservation with required reason."""

    reason: str = Field(..., min_length=1, max_length=2000)


class ReservationDamageReport(BaseModel):
    """Report damage to a tool."""

    description: str = Field(..., min_length=1, max_length=2000)


class ReservationForceReturn(BaseModel):
    """Admin force-return of a PICKED_UP reservation."""

    reason: str = Field(..., min_length=1, max_length=2000)
