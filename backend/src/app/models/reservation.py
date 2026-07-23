"""Reservation model with EXCLUDE GiST constraint for double-booking prevention."""

import uuid
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ReservationState

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.tool import Tool
    from app.models.user import User


class Reservation(Base):
    """A reservation for a tool during a specific date range.

    Double-booking is prevented at the database level by a GiST EXCLUDE
    constraint on (tool_id, tsrange(start_date, end_date, '[]')).
    """

    __tablename__ = "reservations"
    __table_args__: Any = (
        Index("ix_reservations_tool_id", "tool_id"),
        Index("ix_reservations_borrower_id", "borrower_id"),
        Index("ix_reservations_state", "state"),
        Index("ix_reservations_tool_state", "tool_id", "state"),
        Index("ix_reservations_date_range", "tool_id", "start_date", "end_date"),
        # Constrain cancelled_by_type to the documented enum values. The column
        # itself is a free-form string (not a PG enum) so adding new values
        # doesn't require an Alembic migration.
        CheckConstraint(
            "cancelled_by_type IS NULL OR cancelled_by_type IN "
            "('borrower', 'owner', 'system', 'admin')",
            name="ck_reservations_cancelled_by_type",
        ),
        # GiST EXCLUDE: prevent overlapping date ranges for the same tool
        # Only active states (REQUESTED, APPROVED, PICKED_UP) are checked
        ExcludeConstraint(
            # Group by tool. Only rows for the same tool are checked against each other. 
            # Reserving a hammer doesn't conflict with reserving a drill.
            ("tool_id", "="),                                               # (1) same tool#
            # PostgreSQL range type. '[]' means inclusive on both ends 
            # — the date range includes both the start and end days. 
            # So July 24 → July 26 and July 26 → July 28 do conflict on the 26th (touching ranges collide).
            # "&&" means "overlaps" in PostgreSQL range types. So this checks for overlapping date ranges.
            (text("tsrange(start_date, end_date, '[]')"), "&&"),            # (2) overlapping dates
            # Only check active reservations (REQUESTED, APPROVED, PICKED_UP) for overlap. 
            # Canceled or denied reservations don't block new reservations.
            where=text("state IN ('REQUESTED', 'APPROVED', 'PICKED_UP')"),  # (3) active states only
            using="gist",
            name="ex_no_overlap_active",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tools.id", ondelete="CASCADE"),
        nullable=False,
    )
    borrower_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    state: Mapped[ReservationState] = mapped_column(
        ENUM(ReservationState, name="reservation_state"),
        nullable=False,
        default=ReservationState.REQUESTED,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Cancellation audit
    cancelled_by_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # CancellerType value
    cancelled_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Denial audit
    denied_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Pickup / return timestamps
    picked_up_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Damage report
    damage_reported: Mapped[bool] = mapped_column(
        default=False, nullable=False
    )
    damage_description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    damage_reported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Admin force-resolution audit
    force_resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    force_resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    force_resolution_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    tool: Mapped["Tool"] = relationship(
        "Tool", back_populates="reservations", lazy="selectin"
    )
    borrower: Mapped["User"] = relationship(
        "User", foreign_keys=[borrower_id], back_populates="borrowed_reservations"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="selectin",
    )
