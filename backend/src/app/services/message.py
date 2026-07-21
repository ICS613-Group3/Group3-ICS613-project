"""Reservation messaging service (US22).

Messages can be sent while the reservation is in REQUESTED, APPROVED,
or PICKED_UP state.  Once RETURNED, DENIED, or CANCELLED, the thread
becomes read-only — new messages are rejected with a ConflictError.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.enums import ReservationState
from app.models.message import Message
from app.models.reservation import Reservation
from app.models.user import User


# States where messaging is allowed (active conversation).
ACTIVE_STATES = frozenset(
    {ReservationState.REQUESTED, ReservationState.APPROVED, ReservationState.PICKED_UP}
)


class MessageService:
    """Send and list messages in a reservation thread."""

    async def send_message(
        self,
        db: AsyncSession,
        *,
        sender: User,
        reservation_id: uuid.UUID,
        body: str,
    ) -> Message:
        """Send a message in a reservation thread.

        Only the borrower, tool owner, and admins (read-only parties) can
        post; however, admins typically moderate rather than participate.
        We allow admins to post (e.g. dispute-resolution messages) but
        require that non-admins be a party to the reservation.
        """
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

        # Permission: borrower, owner, or admin.
        is_borrower = reservation.borrower_id == sender.id
        is_owner = reservation.tool.owner_id == sender.id
        if not (is_borrower or is_owner or sender.is_admin):
            raise PermissionDeniedError("You are not a party to this reservation")

        # Thread is read-only for closed reservation states.
        if reservation.state not in ACTIVE_STATES:
            raise ConflictError(
                f"Cannot send messages for a reservation in {reservation.state.value} state"
            )

        message = Message(
            reservation_id=reservation_id,
            sender_id=sender.id,
            body=body.strip(),
        )
        db.add(message)
        await db.flush()
        # Eager-load sender for response serialization.
        await db.refresh(message, ["sender"])
        return message

    async def list_messages(
        self,
        db: AsyncSession,
        *,
        user: User,
        reservation_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        ) -> tuple[list[Message], int]:
        """List all messages in a reservation thread chronologically.

        Only the borrower, owner, and admins can read the thread.
        """
        result = await db.execute(
            select(Reservation)
            .where(Reservation.id == reservation_id)
            .options(selectinload(Reservation.tool))
        )
        reservation = result.scalar_one_or_none()
        if reservation is None:
            raise NotFoundError("Reservation not found")

        is_borrower = reservation.borrower_id == user.id
        is_owner = reservation.tool.owner_id == user.id
        if not (is_borrower or is_owner or user.is_admin):
            raise PermissionDeniedError("You are not a party to this reservation")

        count_q = select(func.count(Message.id)).where(
            Message.reservation_id == reservation_id
        )
        total = (await db.execute(count_q)).scalar() or 0

        query = (
            select(Message)
            .where(Message.reservation_id == reservation_id)
            .order_by(Message.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        msgs = list((await db.execute(query)).scalars().all())
        return msgs, total