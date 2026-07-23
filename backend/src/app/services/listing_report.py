"""Listing report service (US26/US27/US29).

Members report inappropriate listings; admins resolve reports. A VALID
resolution deactivates the listing and auto-cancels its pending
reservations, and increments the listing owner's violation_count.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.enums import (
    CancellerType,
    DeactivationActor,
    NotificationType,
    ReportStatus,
    ReservationState,
)
from app.models.listing_report import ListingReport
from app.models.reservation import Reservation
from app.models.tool import Tool
from app.models.user import User
from app.services.admin import AdminService
from app.services.notification import NotificationService


class ListingReportService:
    """Submit, resolve, and list listing reports."""

    # ------------------------------------------------------------------
    # Create (US26)
    # ------------------------------------------------------------------
    async def submit_report(
        self,
        db: AsyncSession,
        *,
        reporter: User,
        tool_id: uuid.UUID,
        reason: str,
        comment: str | None = None,
    ) -> ListingReport:
        """Submit a report against a tool listing.

        Blocks:
          - tool not found / deleted / inactive (S5: deactivated/non-existent)
          - self-report (owner reporting own listing)
          - duplicate (one report per tool per reporter — DB unique constraint)
        """
        tool = await db.get(Tool, tool_id)
        if tool is None or tool.deleted_at is not None:
            raise NotFoundError("Tool not found")
        if not tool.is_active:
            raise ConflictError("Cannot report a deactivated listing")

        if tool.owner_id == reporter.id:
            raise ConflictError("You cannot report your own listing")

        report = ListingReport(
            tool_id=tool_id,
            reporter_id=reporter.id,
            reason=reason,
            comment=comment,
            status=ReportStatus.PENDING,
        )
        db.add(report)
        try:
            await db.flush()
        except Exception:
            await db.rollback()
            raise ConflictError("You have already reported this listing") from None

        await db.refresh(report, ["tool", "reporter"])

        # Notify all admins that a new report was submitted (best-effort).
        admin_result = await db.execute(
            select(User).where(User.is_admin.is_(True), User.deleted_at.is_(None))
        )
        admin_ids = [a.id for a in admin_result.scalars().all()]
        for aid in admin_ids:
            await NotificationService().create(
                db,
                user_id=aid,
                type_=NotificationType.LISTING_REPORT_SUBMITTED,
                title="New listing report",
                body=f"A listing \"{tool.name}\" was reported. Reason: {reason}",
                payload={
                    "report_id": str(report.id),
                    "tool_id": str(tool_id),
                    "reporter_id": str(reporter.id),
                },
            )

        return report

    # ------------------------------------------------------------------
    # Resolve (US27)
    # ------------------------------------------------------------------
    async def resolve_report(
        self,
        db: AsyncSession,
        *,
        admin: User,
        report_id: uuid.UUID,
        valid: bool,
        note: str | None = None,
    ) -> ListingReport:
        """Admin resolves a pending report.

        If ``valid`` is True:
          - deactivate the tool listing
          - auto-cancel all REQUESTED + APPROVED reservations
          - increment the listing owner's violation_count (US29)
          - audit-log the action

        If ``valid`` is False:
          - listing stays active
          - no violation increment
        """
        if not admin.is_admin:
            raise PermissionDeniedError("Admin access required")

        result = await db.execute(
            select(ListingReport)
            .where(ListingReport.id == report_id)
            .options(
                selectinload(ListingReport.tool),
                selectinload(ListingReport.reporter),
            )
        )
        report = result.scalar_one_or_none()
        if report is None:
            raise NotFoundError("Report not found")

        if report.status != ReportStatus.PENDING:
            raise ConflictError("Report has already been resolved")

        report.status = ReportStatus.VALID if valid else ReportStatus.INVALID
        report.resolved_by = admin.id
        report.resolved_at = datetime.now(UTC)
        report.resolution_note = note
        report.updated_at = datetime.now(UTC)
        db.add(report)

        tool = report.tool

        if valid and tool is not None and tool.is_active:
            tool.is_active = False
            tool.deactivated_by = DeactivationActor.DAMAGE_REPORT
            tool.deactivated_at = datetime.now(UTC)
            tool.deactivation_reason = (
                f"Deactivated due to valid listing report: {report.reason}"
            )
            tool.updated_at = datetime.now(UTC)
            db.add(tool)

            # Auto-cancel pending reservations on the tool.
            pending = await db.execute(
                select(Reservation).where(
                    Reservation.tool_id == tool.id,
                    Reservation.state.in_(
                        [ReservationState.REQUESTED, ReservationState.APPROVED]
                    ),
                )
            )
            now = datetime.now(UTC)
            for r in pending.scalars().all():
                r.state = ReservationState.CANCELLED
                r.cancelled_by_type = CancellerType.ADMIN.value
                r.cancelled_reason = "Listing deactivated due to valid report"
                r.updated_at = now
                db.add(r)

                # Notify borrowers of auto-cancellation.
                await NotificationService().create(
                    db,
                    user_id=r.borrower_id,
                    type_=NotificationType.RESERVATION_CANCELLED,
                    title="Reservation auto-cancelled",
                    body=(
                        f"Your reservation for \"{tool.name}\" was cancelled "
                        f"because the listing was deactivated following an "
                        f"admin review."
                    ),
                    payload={
                        "reservation_id": str(r.id),
                        "tool_id": str(tool.id),
                    },
                )

            # Increment the owner's violation_count atomically (US29).
            from sqlalchemy import update

            await db.execute(
                update(User)
                .where(User.id == tool.owner_id)
                .values(
                    violation_count=User.violation_count + 1,
                    updated_at=datetime.now(UTC),
                )
            )

            # Audit-log the admin deactivation (US32 audit trail).
            await AdminService().record_tool_deactivation(
                db,
                actor=admin,
                tool_id=tool.id,
                reason=tool.deactivation_reason or "Valid listing report",
                actor_role="admin",
            )

        await db.flush()
        await db.refresh(report, ["tool", "reporter", "resolver"])

        # Notify the reporter of the resolution regardless of outcome.
        await NotificationService().create(
            db,
            user_id=report.reporter_id,
            type_=NotificationType.LISTING_REPORT_RESOLVED,
            title="Listing report resolved",
            body=(
                f"Your report on \"{tool.name if tool else 'a listing'}\" was "
                f"reviewed by an admin and marked as "
                f"{'valid' if valid else 'invalid'}."
            ),
            payload={
                "report_id": str(report.id),
                "tool_id": str(tool.id) if tool else None,
                "valid": valid,
            },
        )

        return report

    # ------------------------------------------------------------------
    # List (US27 admin view)
    # ------------------------------------------------------------------
    async def list_reports(
        self,
        db: AsyncSession,
        *,
        status: ReportStatus | None = None,
        page: int = 1,
        page_size: int = 20,
        ) -> tuple[list[ListingReport], int]:
        """Admin-only: list listing reports with optional status filter."""
        query = select(ListingReport)
        count_q = select(func.count(ListingReport.id))

        if status is not None:
            query = query.where(ListingReport.status == status)
            count_q = count_q.where(ListingReport.status == status)

        total = (await db.execute(count_q)).scalar() or 0

        query = (
            query
            .options(
                selectinload(ListingReport.tool),
                selectinload(ListingReport.reporter),
                selectinload(ListingReport.resolver),
            )
            .order_by(ListingReport.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        reports = list((await db.execute(query)).scalars().all())

        return reports, total