"""Admin moderation report response schemas (US33)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ModerationReportSummary(BaseModel):
    """Aggregate totals for a moderation report."""

    total_reports: int
    pending_reports: int
    valid_reports: int
    invalid_reports: int
    total_suspensions: int
    total_reactivations: int
    total_tool_deactivations: int
    total_tool_reactivations: int
    total_account_deletions: int
    total_reservations: int
    active_reservations: int
    completed_reservations: int
    date_from: datetime | None
    date_to: datetime | None


class ModerationReportItem(BaseModel):
    """A single entry in a moderation report (audit log line)."""

    id: UUID
    action_type: str
    target_type: str
    target_id: UUID
    reason: str
    actor_id: UUID | None
    created_at: datetime


class ModerationReportResponse(BaseModel):
    """Full moderation report: summary + detailed records."""

    summary: ModerationReportSummary
    records: list[ModerationReportItem]
    report_type: str
    date_from: datetime | None
    date_to: datetime | None