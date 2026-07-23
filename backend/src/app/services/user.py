"""User service for profile operations."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enums import (
    CancellerType,
    DeactivationActor,
    NotificationType,
    ReservationState,
    UserStatus,
)
from app.models.reservation import Reservation
from app.models.tool import Tool
from app.models.user import User


def _anonymize_user(user: User) -> None:
    """Overwrite a user's PII in place. Does NOT mutate ``status`` or timestamps.

    The caller is responsible for setting ``status = UserStatus.DELETED`` and
    ``deleted_at``. Keeping this helper narrow means the same logic can be
    reused by both self-service (``UserService.soft_delete``) and admin hard-
    delete (``AdminService.delete_user``) without one side-effect slipping in.

    The display name (``full_name``) is preserved for history integrity —
    reviews and reservation history remain linked to a recognisable name.
    """
    user.email = f"deleted+{user.id}@example.com"
    user.hashed_password = ""
    user.bio = None
    user.neighborhood = None
    user.photo_url = None


# ── Shared deletion guard + cleanup ──────────────────────────────────────
# Used by both UserService.soft_delete (self-service) and
# AdminService.delete_user (admin hard-delete).  Keeping the logic in one
# place prevents the two from drifting apart when reservation-state rules
# change.

class DeletionBlockedError(ConflictError):
    """Deletion is blocked because of active reservations."""


class DeletionCleanupStats:
    """Returned by ``_guard_and_cleanup`` so callers can audit/log what happened."""

    tools_deactivated: int
    reservations_cancelled: int


async def _guard_and_cleanup(
    db: AsyncSession,
    user: User,
) -> DeletionCleanupStats:
    """Validate deletion preconditions, then deactivate tools and cancel pending reservations.

    Raises ``DeletionBlockedError`` if any hard blocker exists (the user has an
    active reservation as a borrower or one of their tools is currently
    PICKED_UP).  Otherwise deactivates all the user's active tools, cancels
    any pending reservations on them, and sends cancellation notifications.

    Returns a ``DeletionCleanupStats`` with counts of what was cleaned up,
    so the caller can include them in audit/notification messages.
    """
    from app.services.notification import NotificationService

    # ── Borrower obligations (always block) ──────────────────────────
    active_borrowed = await db.execute(
        select(Reservation.id)
        .where(
            Reservation.borrower_id == user.id,
            Reservation.state.in_(
                [ReservationState.REQUESTED, ReservationState.APPROVED, ReservationState.PICKED_UP]
            ),
        )
        .limit(1)
    )
    if active_borrowed.scalar_one_or_none() is not None:
        raise DeletionBlockedError(
            "Cannot delete account with active reservations. "
            "Please cancel or return borrowed tools first."
        )

    # ── Owner obligations: PICKED_UP (block) ─────────────────────────
    active_lent_picked_up = await db.execute(
        select(Reservation.id)
        .join(Tool, Reservation.tool_id == Tool.id)
        .where(
            Tool.owner_id == user.id,
            Reservation.state == ReservationState.PICKED_UP,
        )
        .limit(1)
    )
    if active_lent_picked_up.scalar_one_or_none() is not None:
        raise DeletionBlockedError(
            "Cannot delete account while your tools are out on loan. "
            "Please wait for their return or contact an admin."
        )

    stats = DeletionCleanupStats()
    stats.tools_deactivated = 0
    stats.reservations_cancelled = 0

    # ── Deactivate the user's active tools ───────────────────────────
    tools_result = await db.execute(
        select(Tool).where(
            Tool.owner_id == user.id,
            Tool.is_active.is_(True),
            Tool.deleted_at.is_(None),
        )
    )
    tools = tools_result.scalars().all()

    if tools:
        now = datetime.now(UTC)
        tool_ids = [t.id for t in tools]

        # Deactivate every tool (no need for per-tool guard — we already
        # confirmed no PICKED_UP reservations exist).
        for tool in tools:
            tool.is_active = False
            tool.deactivated_by = DeactivationActor.OWNER
            tool.deactivated_at = now
            tool.deactivation_reason = "Owner account deleted"
            tool.updated_at = now
            db.add(tool)
        stats.tools_deactivated = len(tools)

        # ── Auto-cancel APPROVED + REQUESTED reservations on those tools
        pending = await db.execute(
            select(Reservation).where(
                Reservation.tool_id.in_(tool_ids),
                Reservation.state.in_(
                    [ReservationState.REQUESTED, ReservationState.APPROVED]
                ),
            )
        )
        pending_reservations = pending.scalars().all()

        for r in pending_reservations:
            r.state = ReservationState.CANCELLED
            r.cancelled_by_type = CancellerType.SYSTEM.value
            r.cancelled_reason = "Tool owner account deleted — reservation auto-cancelled"
            r.updated_at = now
            db.add(r)

            # Notify the borrower
            await NotificationService().create(
                db,
                user_id=r.borrower_id,
                type_=NotificationType.RESERVATION_CANCELLED,
                title="Reservation cancelled",
                body=(
                    "A reservation you had for one of your borrowed tools was "
                    "automatically cancelled because the tool owner deleted "
                    "their account."
                ),
                payload={
                    "reservation_id": str(r.id),
                    "reason": "owner_account_deleted",
                },
            )

        stats.reservations_cancelled = len(pending_reservations)

    return stats


class UserService:
    """Business logic for user profiles."""

    async def get_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> User | None:
        """Fetch a non-deleted user by primary key."""
        result = await db.execute(
            select(User).where(
                User.id == user_id,
                User.deleted_at.is_(None),
            )
        )
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
        """Anonymize user PII, mark as DELETED, and clean up owned tools.

        Blocks if the user has active reservations as a borrower or tools
        currently out on loan (PICKED_UP).  Otherwise:
          - deactivates all active tool listings
          - auto-cancels REQUESTED + APPROVED reservations on those tools
          - notifies affected borrowers
          - anonymizes PII and marks status DELETED
        """
        cleanup = await _guard_and_cleanup(db, user)

        _anonymize_user(user)
        user.status = UserStatus.DELETED
        user.deleted_at = datetime.now(UTC)
        user.updated_at = datetime.now(UTC)
        db.add(user)
        await db.flush()
