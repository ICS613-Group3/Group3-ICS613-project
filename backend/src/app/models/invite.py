"""Invite token model."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import InviteStatus

if TYPE_CHECKING:
    from app.models.user import User


def _generate_token() -> str:
    """Generate a URL-safe invite token."""
    return secrets.token_urlsafe(32)


class InviteToken(Base):
    """Token used to invite a new member to the platform."""

    __tablename__ = "invite_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    token: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        default=_generate_token,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[InviteStatus] = mapped_column(
        ENUM(InviteStatus, name="invite_status"),
        nullable=False,
        default=InviteStatus.SENT,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC) + timedelta(days=7),
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    created_by_user: Mapped["User | None"] = relationship(
        "User",
        back_populates="created_invites",
        foreign_keys=[created_by],
    )
