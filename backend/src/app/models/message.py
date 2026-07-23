"""Reservation message model — threaded messaging between borrower and owner.

Messages are attached to a reservation and can only be sent while the
reservation is in an active state (REQUESTED, APPROVED, PICKED_UP).
Once the reservation is RETURNED or CANCELLED, the thread becomes read-only.
"""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.reservation import Reservation
    from app.models.user import User


class Message(Base):
    """A single message in a reservation thread."""

    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_reservation_id", "reservation_id"),
        Index("ix_messages_sender_id", "sender_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=False,
        # index=False: handled by explicit Index in __table_args__
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        # index=False: handled by explicit Index in __table_args__
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    # Relationships
    reservation: Mapped["Reservation"] = relationship(
        "Reservation", back_populates="messages", lazy="selectin"
    )
    sender: Mapped["User"] = relationship(
        "User", foreign_keys=[sender_id], lazy="selectin"
    )