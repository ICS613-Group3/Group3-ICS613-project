"""Admin moderation report service (US33).

Aggregates data from the admin audit log, listing reports, and
reservations to produce a community moderation report with totals and
detailed records, optionally filtered by date range.
"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog
from app.models.enums import ReportStatus, ReservationState
from app.models.listing_report import ListingReport
from app.models.reservation import Reservation


class ModerationReportService:
    """Generate community moderation reports (US33)."""

    # Action types tracked in the audit log that are relevant to moderation.
    ACTION_TOOL_DEACTIVATED = "TOOL_DEACTIVATED"
    ACTION_TOOL_REACTIVATED = "TOOL_REACTIVATED"
    ACTION_USER_SUSPEND = "USER_SUSPEND"
    ACTION_USER_REACTIVATE = "USER_REACTIVATE"
    ACTION_ACCOUNT_DELETE = "ACCOUNT_DELETE"

    async def generate_report(
        self,
        db: AsyncSession,
        *,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict:
        """Generate a community moderation report with summary + records.

        Returns:
            A dict with:
              - ``summary``: aggregate totals
              - ``records``: list of audit log entries in the date range
              - ``date_from`` / ``date_to``: the applied filter
        """
        summary = await self._build_summary(db, date_from, date_to)
        records = await self._build_records(db, date_from, date_to)

        return {
            "summary": summary,
            "records": records,
            "date_from": date_from,
            "date_to": date_to,
        }

    async def _build_summary(
        self,
        db: AsyncSession,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> dict:
        """Build the aggregate totals for the report."""

        # --- Audit log action counts ---
        audit_query = select(
            AdminAuditLog.action_type,
            func.count(AdminAuditLog.id),
        ).group_by(AdminAuditLog.action_type)

        if date_from:
            audit_query = audit_query.where(AdminAuditLog.created_at >= date_from)
        if date_to:
            audit_query = audit_query.where(AdminAuditLog.created_at <= date_to)

        audit_result = await db.execute(audit_query)
        audit_counts = {row[0]: row[1] for row in audit_result}

        # --- Listing report counts ---
        report_query = select(
            ListingReport.status,
            func.count(ListingReport.id),
        ).group_by(ListingReport.status)

        if date_from:
            report_query = report_query.where(ListingReport.created_at >= date_from)
        if date_to:
            report_query = report_query.where(ListingReport.created_at <= date_to)

        report_result = await db.execute(report_query)
        report_counts = {row[0]: row[1] for row in report_result}

        # --- Reservation counts ---
        res_total_q = select(func.count(Reservation.id))
        if date_from:
            res_total_q = res_total_q.where(Reservation.start_date >= date_from.date())
        if date_to:
            res_total_q = res_total_q.where(Reservation.start_date <= date_to.date())
        total_reservations = (await db.execute(res_total_q)).scalar() or 0

        active_states = [
            ReservationState.REQUESTED,
            ReservationState.APPROVED,
            ReservationState.PICKED_UP,
        ]
        res_active_q = select(func.count(Reservation.id)).where(
            Reservation.state.in_(active_states)
        )
        if date_from:
            res_active_q = res_active_q.where(Reservation.start_date >= date_from.date())
        if date_to:
            res_active_q = res_active_q.where(Reservation.start_date <= date_to.date())
        active_reservations = (await db.execute(res_active_q)).scalar() or 0

        completed_states = [ReservationState.RETURNED]
        res_completed_q = select(func.count(Reservation.id)).where(
            Reservation.state.in_(completed_states)
        )
        if date_from:
            res_completed_q = res_completed_q.where(Reservation.start_date >= date_from.date())
        if date_to:
            res_completed_q = res_completed_q.where(Reservation.start_date <= date_to.date())
        completed_reservations = (await db.execute(res_completed_q)).scalar() or 0

        # --- Build summary dict ---
        total_reports = sum(report_counts.values())
        return {
            "total_reports": total_reports,
            "pending_reports": report_counts.get(ReportStatus.PENDING, 0),
            "valid_reports": report_counts.get(ReportStatus.VALID, 0),
            "invalid_reports": report_counts.get(ReportStatus.INVALID, 0),
            "total_suspensions": audit_counts.get(self.ACTION_USER_SUSPEND, 0),
            "total_reactivations": audit_counts.get(self.ACTION_USER_REACTIVATE, 0),
            "total_tool_deactivations": audit_counts.get(self.ACTION_TOOL_DEACTIVATED, 0),
            "total_tool_reactivations": audit_counts.get(self.ACTION_TOOL_REACTIVATED, 0),
            "total_account_deletions": audit_counts.get(self.ACTION_ACCOUNT_DELETE, 0),
            "total_reservations": total_reservations,
            "active_reservations": active_reservations,
            "completed_reservations": completed_reservations,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        }

    async def _build_records(
        self,
        db: AsyncSession,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[AdminAuditLog]:
        """Fetch the audit log records for the date range."""
        query = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())

        if date_from:
            query = query.where(AdminAuditLog.created_at >= date_from)
        if date_to:
            query = query.where(AdminAuditLog.created_at <= date_to)

        result = await db.execute(query)
        return list(result.scalars().all())