"""Admin audit log model — immutable record of moderation actions."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AdminAuditLog(Base):
    """Immutable record of every moderation action performed by an admin.

    Never updated — only inserted. Serves as the authoritative history
    for admin deactivations, reactivations, suspensions, and deletions.
    """

    __tablename__ = "admin_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g. "TOOL_DEACTIVATE", "TOOL_REACTIVATE", "USER_SUSPEND", "ACCOUNT_DELETE"
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "tool" or "user"
    target_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    # Relationships
    actor: Mapped["User | None"] = relationship("User", foreign_keys=[actor_id])
