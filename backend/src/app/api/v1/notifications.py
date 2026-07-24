"""Notification endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member, get_current_member_read_only, get_db
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.notification import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member_read_only)],
    unread_only: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> NotificationListResponse:
    """List notifications for the current user with unread count."""
    notifications, total, unread_count = await NotificationService().list_for_user(
        db,
        user_id=current_user.id,
        unread_only=unread_only,
        page=page,
        page_size=page_size,
    )
    items = [NotificationResponse.model_validate(n) for n in notifications]
    pages = max(1, (total + page_size - 1) // page_size)
    return NotificationListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post("/read-all")
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> dict:
    """Mark all unread notifications as read for the current user."""
    from datetime import UTC, datetime

    from sqlalchemy import update

    from app.models.notification import Notification

    now = datetime.now(UTC)
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    await db.flush()
    return {"message": "All notifications marked as read"}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> NotificationResponse:
    """Mark a notification as read."""
    notification = await NotificationService().mark_read(
        db, notification_id=notification_id, user_id=current_user.id
    )
    return NotificationResponse.model_validate(notification)
