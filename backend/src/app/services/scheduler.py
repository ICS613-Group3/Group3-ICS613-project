"""Scheduler service — periodic background jobs using APScheduler.

Jobs:
  - auto_cancel_overdue_pickups: cancels APPROVED reservations not picked up
    within 3 days of the start date.
  - auto_escalate_overdue_returns: notifies the borrower about PICKED_UP
    reservations past the 7-day return window, then hard-resolves them
    (force_return) after 14 days to prevent infinite notification loops.
  - cleanup_expired_tokens: deletes verification / password-reset / invite
    tokens that have been expired for more than 30 days (bounds table growth).
"""

from datetime import UTC, date, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, select

from app.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_session
from app.models.email_verification import EmailVerificationToken
from app.models.enums import (
    CancellerType,
    NotificationType,
    ReservationState,
)
from app.models.invite import InviteToken
from app.models.notification import Notification
from app.models.password_reset import PasswordResetToken
from app.models.reservation import Reservation
from app.services.notification import NotificationService

logger = get_logger(__name__)

# Scheduler timing thresholds are read from Settings each tick so operators
# can tune the job behavior via env without a code change. Defaults match
# the previous hard-coded module constants.


class SchedulerService:
    """Wrapper around APScheduler for periodic background jobs."""

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler(timezone=UTC)
        self._disabled = get_settings().disable_scheduler

    def start(self) -> None:
        """Start the scheduler if not disabled."""
        if self._disabled:
            logger.info("Scheduler disabled via TOOLSHARING_DISABLE_SCHEDULER")
            return
        self.scheduler.add_job(
            self.auto_cancel_overdue_pickups,
            "interval",
            hours=1,
            id="auto_cancel_overdue_pickups",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self.auto_escalate_overdue_returns,
            "interval",
            hours=1,
            id="auto_escalate_overdue_returns",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self.cleanup_expired_tokens,
            "interval",
            hours=24,
            id="cleanup_expired_tokens",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("Scheduler started")

    def shutdown(self) -> None:
        """Stop the scheduler if running."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    # ------------------------------------------------------------------
    # Jobs
    # ------------------------------------------------------------------
    async def auto_cancel_overdue_pickups(self) -> None:
        """Cancel APPROVED reservations that started more than grace-period days ago.

        Uses strict less-than (``start_date < cutoff``) so a reservation whose
        start_date is *exactly* the grace window ago still gets the full
        window before being cancelled. The grace period is read from Settings
        on each tick so the operator can change it without redeploying.
        """
        settings = get_settings()
        grace_days = settings.scheduler_grace_period_days
        cutoff = date.today() - timedelta(days=grace_days)
        async with get_session() as db:
            result = await db.execute(
                select(Reservation).where(
                    Reservation.state == ReservationState.APPROVED,
                    Reservation.start_date < cutoff,
                )
            )
            overdue = result.scalars().all()
            now = datetime.now(UTC)
            for res in overdue:
                res.state = ReservationState.CANCELLED
                res.cancelled_by_type = CancellerType.SYSTEM.value
                res.cancelled_reason = (
                    f"Auto-cancelled: not picked up within {grace_days} days "
                    f"of start date ({res.start_date})"
                )
                res.updated_at = now
                db.add(res)

                # Notify borrower
                await NotificationService().create(
                    db,
                    user_id=res.borrower_id,
                    type_=NotificationType.RESERVATION_CANCELLED,
                    title="Reservation auto-cancelled",
                    body=(
                        f"Your reservation for tool {res.tool_id} was automatically "
                        f"cancelled because it was not picked up by {res.start_date}."
                    ),
                    payload={"reservation_id": str(res.id)},
                )
            if overdue:
                logger.info("Auto-cancelled %d overdue pickups", len(overdue))

    async def auto_escalate_overdue_returns(self) -> None:
        """Handle PICKED_UP reservations past the return window.

        Two-phase escalation so we don't loop forever:
          1. **Soft** (after escalation_days): notify the borrower once per
             ``escalation_interval_hours`` window (defaults to 24 h, i.e. one
             notification per day). Deduped by querying for an existing
             notification of the same type on the same reservation.
          2. **Hard** (after hard_escalation_days): force-resolve the
             reservation via the same path admins use for dispute resolution.
             This releases the tool and stops future notifications.
        """
        settings = get_settings()
        escalation_days = settings.scheduler_escalation_days
        hard_escalation_days = settings.scheduler_hard_escalation_days
        soft_cutoff = date.today() - timedelta(days=escalation_days)
        hard_cutoff = date.today() - timedelta(days=hard_escalation_days)
        async with get_session() as db:
            # Hard-resolve anything that has been overdue too long.
            hard_result = await db.execute(
                select(Reservation).where(
                    Reservation.state == ReservationState.PICKED_UP,
                    Reservation.end_date < hard_cutoff,
                )
            )
            now = datetime.now(UTC)
            hard_count = 0
            for res in hard_result.scalars().all():
                res.state = ReservationState.RETURNED
                res.returned_at = now
                res.force_resolved_at = now
                res.force_resolution_reason = (
                    f"Auto force-returned after {hard_escalation_days} days overdue"
                )
                res.updated_at = now
                db.add(res)
                hard_count += 1

                await NotificationService().create(
                    db,
                    user_id=res.borrower_id,
                    type_=NotificationType.RESERVATION_RETURNED,
                    title="Tool auto-returned",
                    body=(
                        f"Tool {res.tool_id} was auto-returned because it was "
                        f"overdue by more than {hard_escalation_days} days. "
                        "Please contact an admin if this is wrong."
                    ),
                    payload={"reservation_id": str(res.id), "auto": True},
                )

            # Soft-notify anything that just crossed the soft window
            # (and is not already in the hard list). Deduped per user: skip
            # if a RESERVATION_OVERDUE notification was already sent to this
            # user within the dedup window. (Per-reservation dedup would
            # need a JSON-path query on the payload column; per-user is
            # good enough because a user with multiple overdue reservations
            # typically sees the same email anyway.)
            dedup_cutoff = now - timedelta(hours=settings.scheduler_notification_dedup_hours)
            soft_result = await db.execute(
                select(Reservation).where(
                    Reservation.state == ReservationState.PICKED_UP,
                    Reservation.end_date < soft_cutoff,
                    Reservation.end_date >= hard_cutoff,
                )
            )
            soft_count = 0
            for res in soft_result.scalars().all():
                # Dedup: any recent RESERVATION_OVERDUE notification for this user?
                existing = await db.execute(
                    select(Notification.id).where(
                        Notification.user_id == res.borrower_id,
                        Notification.type == NotificationType.RESERVATION_OVERDUE,
                        Notification.created_at >= dedup_cutoff,
                    ).limit(1)
                )
                if existing.scalar_one_or_none() is not None:
                    continue

                res.updated_at = now
                db.add(res)
                soft_count += 1

                await NotificationService().create(
                    db,
                    user_id=res.borrower_id,
                    type_=NotificationType.RESERVATION_OVERDUE,
                    title="Tool return overdue",
                    body=(
                        f"Tool {res.tool_id} was due back on {res.end_date}. "
                        f"Please return it within "
                        f"{hard_escalation_days - escalation_days} days to "
                        "avoid automatic return."
                    ),
                    payload={"reservation_id": str(res.id)},
                )

            if hard_count:
                logger.info("Auto force-returned %d severely overdue items", hard_count)
            if soft_count:
                logger.info("Soft-escalated %d overdue returns", soft_count)

    async def cleanup_expired_tokens(self) -> None:
        """Delete tokens that have been expired for more than the retention window.

        Bounded growth for the email_verification_tokens, password_reset_tokens,
        and invite_tokens tables. Already-used tokens (``used_at IS NOT NULL``)
        are kept longer for audit purposes; only genuinely expired-and-unused
        tokens are removed. The retention window is read from Settings.
        """
        settings = get_settings()
        cutoff = datetime.now(UTC) - timedelta(days=settings.scheduler_token_retention_days)
        async with get_session() as db:
            for model, name in [
                (EmailVerificationToken, "email verification"),
                (PasswordResetToken, "password reset"),
                (InviteToken, "invite"),
            ]:
                result = await db.execute(
                    delete(model).where(
                        model.expires_at < cutoff,
                        model.used_at.is_(None),
                    )
                )
                count = result.rowcount or 0
                if count:
                    logger.info("Cleaned up %d expired %s tokens", count, name)
