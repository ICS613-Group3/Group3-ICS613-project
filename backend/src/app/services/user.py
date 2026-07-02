"""User service for profile operations."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enums import ReservationState, UserStatus
from app.models.reservation import Reservation
from app.models.user import User


def _anonymize_user(user: User) -> None:
    """Overwrite a user's PII in place. Does NOT mutate ``status`` or timestamps.

    The caller is responsible for setting ``status = UserStatus.DELETED`` and
    ``deleted_at``. Keeping this helper narrow means the same logic can be
    reused by both self-service (``UserService.soft_delete``) and admin hard-
    delete (``AdminService.delete_user``) without one side-effect slipping in.
    """
    user.email = f"deleted+{user.id}@example.com"
    user.hashed_password = ""
    user.full_name = "Deleted User"
    user.bio = None
    user.neighborhood = None
    user.photo_url = None


class UserService:
    """Business logic for user profiles."""

    async def get_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> User | None:
        """Fetch a user by primary key."""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        """Fetch a *non-deleted* user by email address.

        Soft-deleted users (deleted_at IS NOT NULL) are excluded.
        Callers that need the deleted row (e.g. an audit path)
        can use ``db.get(User, uuid.UUID(...))`` directly. Filtering at
        the service layer prevents every caller from forgetting the
        ``deleted_at IS NULL`` clause.

        Note: this returns users of any status (ACTIVE, EMAIL_PENDING,
        SUSPENDED) — it only excludes soft-deleted rows. Callers that
        need to enforce an active-status-only lookup should use
        ``require_user_status`` or check ``user.status`` after the call.
        """
        result = await db.execute(
            select(User).where(
                User.email == email.lower(),
                User.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def require_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> User:
        """Fetch a user or raise NotFoundError."""
        user = await self.get_by_id(db, user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def update_profile(
        self,
        db: AsyncSession,
        user: User,
        *,
        full_name: str | None = None,
        bio: str | None = None,
        neighborhood: str | None = None,
        photo_url: str | None = None,
    ) -> User:
        """Update a user's profile fields."""
        if full_name is not None:
            user.full_name = full_name
        if bio is not None:
            user.bio = bio
        if neighborhood is not None:
            user.neighborhood = neighborhood
        if photo_url is not None:
            user.photo_url = photo_url
        user.updated_at = datetime.now(UTC)
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def soft_delete(self, db: AsyncSession, user: User) -> None:
        """Anonymize user PII and mark as DELETED.

        Refuses if the user has any active reservation as a borrower (REQUESTED,
        APPROVED, or PICKED_UP). Owners can still soft-delete: their tools
        remain listed but are owned by a deleted account (visible only to admins).
        """
        active = await db.execute(
            select(Reservation.id)
            .where(
                Reservation.borrower_id == user.id,
                Reservation.state.in_(
                    [
                        ReservationState.REQUESTED,
                        ReservationState.APPROVED,
                        ReservationState.PICKED_UP,
                    ]
                ),
            )
            .limit(1)
        )
        if active.scalar_one_or_none() is not None:
            raise ConflictError(
                "Cannot delete account with active reservations. "
                "Please cancel or return borrowed tools first."
            )

        _anonymize_user(user)
        user.status = UserStatus.DELETED
        user.deleted_at = datetime.now(UTC)
        user.updated_at = datetime.now(UTC)
        db.add(user)
        await db.flush()
