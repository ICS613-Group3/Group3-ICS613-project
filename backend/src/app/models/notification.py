"""Notification model — in-app notification system.

Notifications are created by the service layer when domain events occur
(reservation state changes, tool deactivation, admin actions, etc.).
They are in-app only per the course project scope — no push/email channel.

``type`` is stored as a plain string (not a PG ENUM) so adding new
notification types doesn't require an ALTER TYPE on the database.
The service layer validates against the Python ``NotificationType`` enum.
A CHECK constraint at the DB level keeps invalid values out.
"""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import NotificationType

if TYPE_CHECKING:
    from app.models.user import User

# Build the list of valid notification type values for the CHECK constraint.
# This list must be kept in sync with the NotificationType enum.
_VALID_NOTIFICATION_TYPES = ", ".join(
    f"'{e.value}'" for e in NotificationType
)


class Notification(Base):
    """A notification delivered to a user."""

    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            f"type IN ({_VALID_NOTIFICATION_TYPES})",
            name="ck_notifications_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
