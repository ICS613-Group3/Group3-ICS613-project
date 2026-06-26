"""Reservation service — full lifecycle with state machine enforcement.

Double-booking prevention relies on a PostgreSQL GiST EXCLUDE constraint
on (tool_id, tsrange(start_date, end_date, '[]')). The service catches
IntegrityError and raises a user-friendly ConflictError (HTTP 409).
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.models.enums import CancellerType, NotificationType, ReservationState
from app.models.reservation import Reservation
from app.models.tool import Tool
from app.models.user import User
from app.services.notification import NotificationService


class ReservationService:
    """All reservation lifecycle operations."""

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    async def create_reservation(
        self,
        db: AsyncSession,
        *,
        borrower: User,
        tool_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> Reservation:
        """Submit a reservation request.

        Raises:
            ValidationError: if start_date is not before end_date or date is in the past.
            ConflictError: if borrower owns the tool or dates overlap.
            NotFoundError: if the tool is not active.
        """
        # Business rules
        if start_date >= end_date:
            raise ValidationError("start_date must be before end_date")
        if start_date < date.today():
            raise ValidationError("Cannot request a reservation starting in the past")

        tool = await db.get(Tool, tool_id)
        if tool is None or tool.deleted_at is not None or not tool.is_active:
            raise NotFoundError("Tool not found or unavailable")
        if tool.owner_id == borrower.id:
            raise ConflictError("You cannot reserve your own tool")

        reservation = Reservation(
            tool_id=tool_id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
            start_date=start_date,
            end_date=end_date,
        )
        db.add(reservation)
        try:
            await db.flush()
        except IntegrityError as err:
            await db.rollback()
            raise ConflictError(
                "This tool is already reserved for the requested dates. Please choose different dates."
            ) from err
        await db.refresh(reservation)

        # Notify the tool owner that a new request arrived.
        await NotificationService().create(
            db,
            user_id=tool.owner_id,
            type_=NotificationType.RESERVATION_REQUESTED,
            title="New reservation request",
            body=(
                f"{borrower.full_name or borrower.email} requested your tool "
                f"for {start_date} → {end_date}."
            ),
            payload={
                "reservation_id": str(reservation.id),
                "tool_id": str(tool_id),
                "borrower_id": str(borrower.id),
            },
        )
        return reservation

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    async def get_reservation(
        self, db: AsyncSession, *, reservation_id: uuid.UUID
    ) -> Reservation:
        """Fetch a reservation by id or raise NotFoundError."""
        result = await db.execute(
            select(Reservation)
            .where(Reservation.id == reservation_id)
            .options(
                selectinload(Reservation.tool),
                selectinload(Reservation.borrower),
            )
        )
        reservation = result.scalar_one_or_none()
        if reservation is None:
            raise NotFoundError("Reservation not found")
        return reservation

    async def list_reservations(
        self,
        db: AsyncSession,
        *,
        user: User,
        role: str | None = None,
        state: ReservationState | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Reservation], int]:
        """List reservations for a user filtered by role (borrower/owner) and state."""
        query = select(Reservation)
        count_query = select(func.count(Reservation.id))

        if role == "borrower":
            query = query.where(Reservation.borrower_id == user.id)
            count_query = count_query.where(Reservation.borrower_id == user.id)
        elif role == "owner":
            query = query.join(Tool, Reservation.tool_id == Tool.id).where(
                Tool.owner_id == user.id, Tool.deleted_at.is_(None)
            )
            count_query = count_query.join(Tool, Reservation.tool_id == Tool.id).where(
                Tool.owner_id == user.id, Tool.deleted_at.is_(None)
            )
        else:
            # Both roles
            query = query.where(
                or_(
                    Reservation.borrower_id == user.id,
                    Reservation.tool_id.in_(
                        select(Tool.id).where(
                            Tool.owner_id == user.id, Tool.deleted_at.is_(None)
                        )
                    ),
                )
            )
            count_query = count_query.where(
                or_(
                    Reservation.borrower_id == user.id,
                    Reservation.tool_id.in_(
                        select(Tool.id).where(
                            Tool.owner_id == user.id, Tool.deleted_at.is_(None)
                        )
                    ),
                )
            )

        if state is not None:
            query = query.where(Reservation.state == state)
            count_query = count_query.where(Reservation.state == state)

        # Total count
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        # Paginated results
        query = (
            query
            .options(
                selectinload(Reservation.tool),
                selectinload(Reservation.borrower),
            )
            .order_by(Reservation.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        reservations = list(result.scalars().unique())

        return reservations, total

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------
    async def approve(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        owner: User,
    ) -> Reservation:
        """Approve a REQUESTED reservation. Only the tool owner can approve."""
        self._require_owner(reservation, owner)
        self._require_state(reservation, ReservationState.REQUESTED)

        # Re-check overlap in case another reservation was approved in the meantime
        overlapping = await self._check_overlap(
            db, reservation.tool_id, reservation.start_date, reservation.end_date, exclude_id=reservation.id
        )
        if overlapping:
            raise ConflictError(
                "The requested dates are no longer available. Another reservation was approved."
            )

        reservation.state = ReservationState.APPROVED
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        await NotificationService().create(
            db,
            user_id=reservation.borrower_id,
            type_=NotificationType.RESERVATION_APPROVED,
            title="Reservation approved",
            body=f"Your reservation for {reservation.start_date} → {reservation.end_date} was approved.",
            payload={"reservation_id": str(reservation.id)},
        )
        return reservation

    async def deny(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        owner: User,
        reason: str | None = None,
    ) -> Reservation:
        """Deny a REQUESTED reservation."""
        self._require_owner(reservation, owner)
        self._require_state(reservation, ReservationState.REQUESTED)

        reservation.state = ReservationState.DENIED
        reservation.denied_reason = reason
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        await NotificationService().create(
            db,
            user_id=reservation.borrower_id,
            type_=NotificationType.RESERVATION_DENIED,
            title="Reservation denied",
            body=(
                f"Your reservation for {reservation.start_date} → {reservation.end_date} was denied."
                + (f" Reason: {reason}" if reason else "")
            ),
            payload={"reservation_id": str(reservation.id)},
        )
        return reservation

    async def cancel(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        actor: User,
        reason: str,
    ) -> Reservation:
        """Cancel a REQUESTED or APPROVED reservation.

        Borrower: can cancel REQUESTED or APPROVED.
        Owner: can cancel APPROVED only (deny is for REQUESTED).
        """
        if reservation.state not in (ReservationState.REQUESTED, ReservationState.APPROVED):
            raise ConflictError(
                f"Cannot cancel a reservation in {reservation.state.value} state"
            )

        is_borrower = reservation.borrower_id == actor.id
        is_owner = reservation.tool.owner_id == actor.id

        if not is_borrower and not is_owner:
            raise PermissionDeniedError("You are not a party to this reservation")

        # Owner cannot cancel REQUESTED (use deny instead)
        if is_owner and not is_borrower and reservation.state == ReservationState.REQUESTED:
            raise ConflictError(
                "Use the deny endpoint to decline a REQUESTED reservation"
            )

        reservation.state = ReservationState.CANCELLED
        reservation.cancelled_by_type = (
            CancellerType.BORROWER.value if is_borrower else CancellerType.OWNER.value
        )
        reservation.cancelled_reason = reason
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        # Notify the other party.
        recipient_id = (
            reservation.tool.owner_id if is_borrower else reservation.borrower_id
        )
        await NotificationService().create(
            db,
            user_id=recipient_id,
            type_=NotificationType.RESERVATION_CANCELLED,
            title="Reservation cancelled",
            body=(
                f"Reservation {reservation.id} was cancelled by the "
                f"{'borrower' if is_borrower else 'owner'}. Reason: {reason}"
            ),
            payload={"reservation_id": str(reservation.id)},
        )
        return reservation

    async def mark_picked_up(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        borrower: User,
    ) -> Reservation:
        """Mark an APPROVED reservation as PICKED_UP. Only the borrower."""
        if reservation.borrower_id != borrower.id:
            raise PermissionDeniedError("Only the borrower can mark pickup")
        self._require_state(reservation, ReservationState.APPROVED)

        today = date.today()
        if today < reservation.start_date:
            raise ValidationError(
                f"Cannot pick up before the reservation start date ({reservation.start_date})"
            )

        reservation.state = ReservationState.PICKED_UP
        reservation.picked_up_at = datetime.now(UTC)
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        await NotificationService().create(
            db,
            user_id=reservation.tool.owner_id,
            type_=NotificationType.RESERVATION_PICKED_UP,
            title="Tool picked up",
            body=(
                f"{borrower.full_name or borrower.email} picked up your tool. "
                f"Due back on {reservation.end_date}."
            ),
            payload={"reservation_id": str(reservation.id)},
        )
        return reservation

    async def mark_returned(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        borrower: User,
    ) -> Reservation:
        """Mark a PICKED_UP reservation as RETURNED."""
        if reservation.borrower_id != borrower.id:
            raise PermissionDeniedError("Only the borrower can mark return")
        self._require_state(reservation, ReservationState.PICKED_UP)

        reservation.state = ReservationState.RETURNED
        reservation.returned_at = datetime.now(UTC)
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        await NotificationService().create(
            db,
            user_id=reservation.tool.owner_id,
            type_=NotificationType.RESERVATION_RETURNED,
            title="Tool returned",
            body=f"Tool from reservation {reservation.id} was returned. You can now leave a review.",
            payload={"reservation_id": str(reservation.id)},
        )
        return reservation

    async def mark_damaged(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        owner: User,
        description: str,
    ) -> Reservation:
        """Report damage on a returned tool (7-day window from return)."""
        self._require_owner(reservation, owner)
        self._require_state(reservation, ReservationState.RETURNED)

        if reservation.returned_at is None:
            raise ValidationError("Cannot report damage before the tool is returned")

        days_since_return = (datetime.now(UTC) - reservation.returned_at).days
        if days_since_return > 7:
            raise ValidationError(
                f"Damage report window has closed. "
                f"Must report within 7 days (returned {days_since_return} days ago)"
            )

        reservation.damage_reported = True
        reservation.damage_description = description
        reservation.damage_reported_at = datetime.now(UTC)
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        # Auto-deactivate the tool
        tool = await db.get(Tool, reservation.tool_id)
        if tool:
            tool.is_active = False
            tool.deactivated_at = datetime.now(UTC)
            tool.deactivation_reason = f"Damage reported: {description[:200]}"
            tool.updated_at = datetime.now(UTC)
            db.add(tool)

            # Increment the owner's damage counter atomically. A read-modify-write
            # (``counter = counter + 1``) loses increments under concurrent calls;
            # the SQL ``SET col = col + 1`` is a single statement and atomic at
            # the row level. Refresh afterwards so callers see the new value.
            from sqlalchemy import update

            await db.execute(
                update(User)
                .where(User.id == tool.owner_id)
                .values(
                    damage_reported=User.damage_reported + 1,
                    updated_at=datetime.now(UTC),
                )
            )
            await db.refresh(owner)

            # Auto-cancel pending reservations
            pending = await db.execute(
                select(Reservation).where(
                    Reservation.tool_id == tool.id,
                    Reservation.state.in_(
                        [ReservationState.REQUESTED, ReservationState.APPROVED]
                    ),
                    Reservation.id != reservation.id,
                )
            )
            now = datetime.now(UTC)
            cancelled_reservation_ids: list[str] = []
            for r in pending.scalars().all():
                r.state = ReservationState.CANCELLED
                r.cancelled_by_type = CancellerType.OWNER.value
                r.cancelled_reason = "Tool deactivated due to damage report"
                r.updated_at = now
                db.add(r)
                cancelled_reservation_ids.append(str(r.id))

            # Notify the borrower of the original (RETURNED) reservation
            await NotificationService().create(
                db,
                user_id=reservation.borrower_id,
                type_=NotificationType.TOOL_DEACTIVATED,
                title="Damage reported on borrowed tool",
                body=(
                    f"The tool you borrowed ({tool.name}) has been deactivated "
                    f"due to a damage report."
                ),
                payload={"reservation_id": str(reservation.id), "tool_id": str(tool.id)},
            )
            # Notify the borrowers whose reservations were auto-cancelled
            for r in pending.scalars().all():
                await NotificationService().create(
                    db,
                    user_id=r.borrower_id,
                    type_=NotificationType.RESERVATION_CANCELLED,
                    title="Reservation cancelled (tool deactivated)",
                    body=(
                        f"Your pending reservation for {tool.name} was cancelled "
                        f"because the tool was deactivated due to a damage report."
                    ),
                    payload={"reservation_id": str(r.id), "tool_id": str(tool.id)},
                )

        return reservation

    async def force_return(
        self,
        db: AsyncSession,
        *,
        reservation: Reservation,
        admin: User,
        reason: str,
    ) -> Reservation:
        """Admin force-returns a PICKED_UP reservation (dispute resolution)."""
        if not admin.is_admin:
            raise PermissionDeniedError("Only admins can force-return a reservation")
        self._require_state(reservation, ReservationState.PICKED_UP)

        reservation.state = ReservationState.RETURNED
        reservation.returned_at = datetime.now(UTC)
        reservation.force_resolved_by = admin.id
        reservation.force_resolved_at = datetime.now(UTC)
        reservation.force_resolution_reason = reason
        reservation.updated_at = datetime.now(UTC)
        db.add(reservation)
        await db.flush()

        await NotificationService().create(
            db,
            user_id=reservation.borrower_id,
            type_=NotificationType.RESERVATION_RETURNED,
            title="Tool force-returned by admin",
            body=(
                f"An admin force-returned the tool from reservation {reservation.id}. "
                f"Reason: {reason}"
            ),
            payload={"reservation_id": str(reservation.id), "actor_id": str(admin.id)},
        )
        return reservation

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _require_state(reservation: Reservation, expected: ReservationState) -> None:
        if reservation.state != expected:
            raise ConflictError(
                f"Expected reservation state {expected.value}, but current state is {reservation.state.value}"
            )

    @staticmethod
    def _require_owner(reservation: Reservation, user: User) -> None:
        if reservation.tool.owner_id != user.id:
            raise PermissionDeniedError("Only the tool owner can perform this action")

    @staticmethod
    async def _check_overlap(
        db: AsyncSession,
        tool_id: uuid.UUID,
        start_date: date,
        end_date: date,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        """Check for overlapping active reservations."""
        active_states = [
            ReservationState.REQUESTED,
            ReservationState.APPROVED,
            ReservationState.PICKED_UP,
        ]
        query = select(Reservation.id).where(
            Reservation.tool_id == tool_id,
            Reservation.state.in_(active_states),
            Reservation.start_date < end_date,
            Reservation.end_date > start_date,
        )
        if exclude_id is not None:
            query = query.where(Reservation.id != exclude_id)
        result = await db.execute(query.limit(1))
        return result.scalar_one_or_none() is not None
