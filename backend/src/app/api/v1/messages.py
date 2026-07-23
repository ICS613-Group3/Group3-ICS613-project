"""Reservation messaging endpoints (US22)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_current_member, get_current_member_read_only, get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.message import MessageCreate, MessageResponse
from app.services.message import MessageService

router = APIRouter()


@router.post(
    "/reservations/{reservation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    reservation_id: uuid.UUID,
    request_data: MessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> MessageResponse:
    """Send a message in a reservation thread.

    Only the borrower, tool owner, or an admin can send. The thread is
    read-only once the reservation is RETURNED, DENIED, or CANCELLED.
    """
    service = MessageService()
    msg = await service.send_message(
        db,
        sender=current_user,
        reservation_id=reservation_id,
        body=request_data.body,
    )
    return MessageResponse.from_orm_with_sender_name(msg)


@router.get(
    "/reservations/{reservation_id}/messages",
    response_model=PaginatedResponse[MessageResponse],
)
async def list_messages(
    reservation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member_read_only)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[MessageResponse]:
    """List all messages in a reservation thread chronologically.

    Only the borrower, tool owner, and admins can read the thread.
    """
    service = MessageService()
    messages, total = await service.list_messages(
        db,
        user=current_user,
        reservation_id=reservation_id,
        page=page,
        page_size=page_size,
    )
    items = [MessageResponse.from_orm_with_sender_name(m) for m in messages]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )