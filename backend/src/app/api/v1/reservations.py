"""Reservation endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_current_member, get_db
from app.core.exceptions import PermissionDeniedError, parse_enum_or_raise
from app.models.enums import ReservationState
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.reservation import (
    ReservationCancel,
    ReservationCreate,
    ReservationDamageReport,
    ReservationDeny,
    ReservationForceReturn,
    ReservationResponse,
)
from app.services.reservation import ReservationService

router = APIRouter()


# ── Create ──────────────────────────────────────────────────────────────
@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    request_data: ReservationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Submit a reservation request for a tool."""
    service = ReservationService()
    reservation = await service.create_reservation(
        db,
        borrower=current_user,
        tool_id=request_data.tool_id,
        start_date=request_data.start_date,
        end_date=request_data.end_date,
    )
    return ReservationResponse.model_validate(reservation)


# ── Read ────────────────────────────────────────────────────────────────
@router.get("", response_model=PaginatedResponse[ReservationResponse])
async def list_reservations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
    role: Annotated[str | None, Query(description="Filter: 'borrower' or 'owner'")] = None,
    state: Annotated[str | None, Query(description="Filter by reservation state")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ReservationResponse]:
    """List reservations for the current user."""
    state_enum = ReservationState(parse_enum_or_raise(state, ReservationState, "state")) if state else None
    service = ReservationService()
    reservations, total = await service.list_reservations(
        db,
        user=current_user,
        role=role,
        state=state_enum,
        page=page,
        page_size=page_size,
    )
    items = [ReservationResponse.model_validate(r) for r in reservations]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Get a single reservation by ID.

    Access is restricted to the borrower, the tool owner, and admins. Other
    authenticated members get 403 to prevent enumeration / privacy leaks.
    """
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    is_borrower = reservation.borrower_id == current_user.id
    is_owner = reservation.tool.owner_id == current_user.id
    if not (is_borrower or is_owner or current_user.is_admin):
        raise PermissionDeniedError("You are not a party to this reservation")
    return ReservationResponse.model_validate(reservation)


# ── State transitions ──────────────────────────────────────────────────
@router.post("/{reservation_id}/approve", response_model=ReservationResponse)
async def approve_reservation(
    reservation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Approve a REQUESTED reservation."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.approve(db, reservation=reservation, owner=current_user)
    return ReservationResponse.model_validate(updated)


@router.post("/{reservation_id}/deny", response_model=ReservationResponse)
async def deny_reservation(
    reservation_id: uuid.UUID,
    request_data: ReservationDeny,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Deny a REQUESTED reservation with optional reason."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.deny(
        db, reservation=reservation, owner=current_user, reason=request_data.reason
    )
    return ReservationResponse.model_validate(updated)


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(
    reservation_id: uuid.UUID,
    request_data: ReservationCancel,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Cancel a REQUESTED or APPROVED reservation."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.cancel(
        db, reservation=reservation, actor=current_user, reason=request_data.reason
    )
    return ReservationResponse.model_validate(updated)


@router.post("/{reservation_id}/mark-picked-up", response_model=ReservationResponse)
async def mark_picked_up(
    reservation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Mark an APPROVED reservation as PICKED_UP."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.mark_picked_up(
        db, reservation=reservation, borrower=current_user
    )
    return ReservationResponse.model_validate(updated)


@router.post("/{reservation_id}/mark-returned", response_model=ReservationResponse)
async def mark_returned(
    reservation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Mark a PICKED_UP reservation as RETURNED."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.mark_returned(
        db, reservation=reservation, borrower=current_user
    )
    return ReservationResponse.model_validate(updated)


@router.post("/{reservation_id}/mark-damaged", response_model=ReservationResponse)
async def mark_damaged(
    reservation_id: uuid.UUID,
    request_data: ReservationDamageReport,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReservationResponse:
    """Report damage on a returned tool (7-day window)."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.mark_damaged(
        db, reservation=reservation, owner=current_user, description=request_data.description
    )
    return ReservationResponse.model_validate(updated)


@router.post("/{reservation_id}/admin-force-return", response_model=ReservationResponse)
async def admin_force_return(
    reservation_id: uuid.UUID,
    request_data: ReservationForceReturn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
) -> ReservationResponse:
    """Admin force-returns a PICKED_UP reservation."""
    service = ReservationService()
    reservation = await service.get_reservation(db, reservation_id=reservation_id)
    updated = await service.force_return(
        db, reservation=reservation, admin=current_user, reason=request_data.reason
    )
    return ReservationResponse.model_validate(updated)
