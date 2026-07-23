"""Listing report model — members report inappropriate tool listings.

A report is submitted by a member against a tool listing. An admin
reviews it and marks it VALID (listing deactivated + reservations
auto-cancelled) or INVALID (listing stays). The reporter's identity is
visible to admins but not to the listing owner.
"""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ReportStatus

if TYPE_CHECKING:
    from app.models.tool import Tool
    from app.models.user import User


class ListingReport(Base):
    """A member-submitted report of an inappropriate tool listing."""

    __tablename__ = "listing_reports"
    __table_args__ = (
        UniqueConstraint("tool_id", "reporter_id", name="uq_listing_report_tool_reporter"),
        Index("ix_listing_reports_status", "status"),
        Index("ix_listing_reports_tool_id", "tool_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tools.id", ondelete="CASCADE"),
        nullable=False,
        # index=False: handled by explicit Index in __table_args__
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        # index=False: no query path needs it; tool_id and status are indexed
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        ENUM(ReportStatus, name="report_status"),
        nullable=False,
        default=ReportStatus.PENDING,
        # index=False: handled by explicit Index in __table_args__
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    tool: Mapped["Tool"] = relationship("Tool", lazy="selectin")
    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id], lazy="selectin")
    resolver: Mapped["User | None"] = relationship(
        "User", foreign_keys=[resolved_by], lazy="selectin"
    )
