"""Test data factories."""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

import factory
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import (
    InviteStatus,
    ReservationState,
    ToolCategory,
    ToolCondition,
    UserStatus,
)
from app.models.invite import InviteToken
from app.models.reservation import Reservation
from app.models.review import Review
from app.models.tool import Tool
from app.models.user import User


class AsyncSQLAlchemyFactory(factory.Factory):
    """Base factory that works with async SQLAlchemy sessions."""

    class Meta:
        abstract = True

    @classmethod
    async def create_async(cls, db: AsyncSession, **kwargs: Any) -> Any:
        """Build and persist an instance asynchronously."""
        obj = cls.build(**kwargs)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj


class UserFactory(AsyncSQLAlchemyFactory):
    """Factory for User model."""

    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user+{n}@example.com")
    hashed_password = factory.LazyFunction(lambda: hash_password("Password123!"))
    full_name = factory.Faker("name")
    status = UserStatus.ACTIVE
    is_admin = False


class AdminFactory(UserFactory):
    """Factory for admin users."""

    is_admin = True
    status = UserStatus.ACTIVE
    email = factory.Sequence(lambda n: f"admin+{n}@example.com")


class PendingUserFactory(UserFactory):
    """Factory for users pending email verification."""

    status = UserStatus.EMAIL_PENDING


class InviteFactory(AsyncSQLAlchemyFactory):
    """Factory for InviteToken model."""

    class Meta:
        model = InviteToken

    email = factory.Sequence(lambda n: f"invite+{n}@example.com")
    token = factory.LazyFunction(lambda: uuid.uuid4().hex)
    status = InviteStatus.SENT
    expires_at = factory.LazyFunction(lambda: datetime.now(UTC) + timedelta(days=7))


class ToolFactory(AsyncSQLAlchemyFactory):
    """Factory for Tool model."""

    class Meta:
        model = Tool

    name = factory.Sequence(lambda n: f"Tool {n}")
    description = "A useful tool for sharing"
    category = ToolCategory.HAND_TOOLS
    condition = ToolCondition.GOOD
    is_active = True

    @classmethod
    async def create_async(cls, db: AsyncSession, **kwargs: Any) -> Tool:
        obj: Tool = cls.build(**kwargs)  # type: ignore[assignment]
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj


class ReservationFactory(AsyncSQLAlchemyFactory):
    """Factory for Reservation model."""

    class Meta:
        model = Reservation

    state = ReservationState.REQUESTED
    start_date = factory.LazyFunction(lambda: date.today())
    end_date = factory.LazyFunction(lambda: date.today() + timedelta(days=1))

    @classmethod
    async def create_async(cls, db: AsyncSession, **kwargs: Any) -> Reservation:
        obj: Reservation = cls.build(**kwargs)  # type: ignore[assignment]
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj


class ReviewFactory(AsyncSQLAlchemyFactory):
    """Factory for Review model."""

    class Meta:
        model = Review

    rating = 4
    comment = "Great experience!"

    @classmethod
    async def create_async(cls, db: AsyncSession, **kwargs: Any) -> Review:
        obj: Review = cls.build(**kwargs)  # type: ignore[assignment]
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj
