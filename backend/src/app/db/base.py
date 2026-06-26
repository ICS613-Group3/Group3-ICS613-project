"""SQLAlchemy declarative base and shared mixins."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Async-compatible declarative base."""

    pass


# Common column types
UUID_PK = Annotated[uuid.UUID, mapped_column(primary_key=True, default=uuid.uuid4)]
CreatedAt = Annotated[
    datetime,
    mapped_column(
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
    ),
]
UpdatedAt = Annotated[
    datetime,
    mapped_column(
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=lambda: datetime.now(UTC),
    ),
]


class UUIDMixin:
    """Mixin that adds a UUID primary key."""

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
