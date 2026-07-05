"""Notification request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import NotificationType


class NotificationResponse(BaseModel):
    """Single notification view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: NotificationType
    title: str
    body: str
    payload: dict | None = Field(
        default=None,
        description="Free-form structured data attached to the notification.",
    )
    read_at: datetime | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Paginated list of notifications plus the user's unread count.

    The ``unread_count`` is always the total unread across all pages — it
    does not change based on the current filter. This matches what the UI
    needs to render the bell badge.
    """

    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    pages: int
