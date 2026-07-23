"""Notification service — create and query in-app notifications."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.enums import NotificationType
from app.models.notification import Notification


class NotificationService:
    """Creates and queries in-app notifications."""

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        type_: NotificationType,
        title: str,
        body: str,
        payload: dict[str, Any] | None = None,
    ) -> Notification:
        """Create a notification for a user."""
        notification = Notification(
            user_id=user_id,
            type=type_.value,
            title=title,
            body=body,
            payload=payload,
        )
        db.add(notification)
        await db.flush()
        await db.refresh(notification)
        return notification

    async def list_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Notification], int, int]:
        """List notifications for a user, newest first.

        Returns (items, total, unread_count).
        """
        base = select(Notification).where(Notification.user_id == user_id)
        count_base = select(func.count(Notification.id)).where(Notification.user_id == user_id)

        if unread_only:
            base = base.where(Notification.read_at.is_(None))
            count_base = count_base.where(Notification.read_at.is_(None))

        # Total count (respects filter)
        count_result = await db.execute(count_base)
        total = count_result.scalar() or 0

        # Unread count (always unfiltered)
        unread_result = await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
            )
        )
        unread_count = unread_result.scalar() or 0

        # Paginated results
        query = (
            base.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        notifications = list(result.scalars().all())

        return notifications, total, unread_count

    async def mark_read(
        self,
        db: AsyncSession,
        *,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Notification:
        """Mark a single notification as read."""
        notification = await db.get(Notification, notification_id)
        if notification is None or notification.user_id != user_id:
            raise NotFoundError("Notification not found")
        notification.read_at = datetime.now(UTC)
        db.add(notification)
        await db.flush()
        return notification
