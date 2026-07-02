"""User model."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UserStatus

if TYPE_CHECKING:
    from app.models.email_verification import EmailVerificationToken
    from app.models.invite import InviteToken
    from app.models.notification import Notification
    from app.models.password_reset import PasswordResetToken
    from app.models.reservation import Reservation
    from app.models.review import Review
    from app.models.tool import Tool


class User(Base):
    """A platform member account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    neighborhood: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[UserStatus] = mapped_column(
        ENUM(UserStatus, name="user_status"),
        nullable=False,
        default=UserStatus.EMAIL_PENDING,
        index=True,
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    trust_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    damage_reported: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    violation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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
    created_invites: Mapped[list["InviteToken"]] = relationship(
        "InviteToken",
        back_populates="created_by_user",
        foreign_keys="InviteToken.created_by",
    )
    verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship(
        "EmailVerificationToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    tools: Mapped[list["Tool"]] = relationship(
        "Tool",
        back_populates="owner",
        order_by="Tool.created_at.desc()",
        lazy="selectin",
    )
    borrowed_reservations: Mapped[list["Reservation"]] = relationship(
        "Reservation",
        foreign_keys="Reservation.borrower_id",
        back_populates="borrower",
        lazy="selectin",
    )
    written_reviews: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewer_id",
        back_populates="reviewer",
        lazy="selectin",
    )
    received_reviews: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.reviewee_id",
        back_populates="reviewee",
        lazy="selectin",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Notification.created_at.desc()",
        lazy="selectin",
    )
