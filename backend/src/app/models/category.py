"""Tool category model — admin-managed allowed categories (US28)."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Category(Base):
    """An admin-managed tool category.

    Replaces the hardcoded ``ToolCategory`` enum so admins can add or remove
    categories at runtime (US28).  The ``name`` is unique and stored
    case-sensitively; tool listings reference it via ``Tool.category`` (plain
    ``VARCHAR``).
    """

    __tablename__ = "tool_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    # Relationships
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
