"""Reservation request/response schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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
    borrower_id: UUID
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
