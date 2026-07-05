"""Tool listing model."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DeactivationActor, ToolCategory, ToolCondition

if TYPE_CHECKING:
    from app.models.photo import Photo
    from app.models.reservation import Reservation
    from app.models.user import User


class Tool(Base):
    """A tool listed for sharing by a member."""

    __tablename__ = "tools"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[ToolCategory] = mapped_column(
        ENUM(ToolCategory, name="tool_category"),
        nullable=False,
        index=True,
    )
    condition: Mapped[ToolCondition] = mapped_column(
        ENUM(ToolCondition, name="tool_condition"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )
    # deactivation audit
    deactivated_by: Mapped[DeactivationActor | None] = mapped_column(
        ENUM(DeactivationActor, name="deactivation_actor"),
        nullable=True,
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deactivation_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    # rating aggregates (populated on review changes)
    avg_rating: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    rating_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    # soft-delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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
    owner: Mapped["User"] = relationship("User", back_populates="tools")
    photos: Mapped[list["Photo"]] = relationship(
        "Photo",
        back_populates="tool",
        cascade="all, delete-orphan",
        order_by="Photo.display_order",
        lazy="selectin",
    )
    reservations: Mapped[list["Reservation"]] = relationship(
        "Reservation", back_populates="tool", lazy="selectin"
    )
