"""Listing report endpoints (US26/US27/US29)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_current_member, get_current_member_read_only, get_db
from app.core.exceptions import parse_enum_or_raise
from app.models.enums import ReportStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.listing_report import ReportCreate, ReportResolve, ReportResponse
from app.services.listing_report import ListingReportService

router = APIRouter()


# ── Member: submit a report (US26) ─────────────────────────────────────
@router.post(
    "/tools/{tool_id}/report",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_report(
    tool_id: uuid.UUID,
    request_data: ReportCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReportResponse:
    """Submit a report against a tool listing.

    Blocks: self-report, duplicate report, deactivated/non-existent listing.
    """
    service = ListingReportService()
    report = await service.submit_report(
        db,
        reporter=current_user,
        tool_id=tool_id,
        reason=request_data.reason.value,
        comment=request_data.comment,
    )
    return ReportResponse.model_validate(report)


# ── Admin: list + resolve reports (US27) ───────────────────────────────
@router.get(
    "/reports",
    response_model=PaginatedResponse[ReportResponse],
)
async def list_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(get_current_admin_user)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ReportResponse]:
    """Admin-only: list listing reports with optional status filter."""
    status_enum = None
    if status_filter:
        status_enum = ReportStatus(parse_enum_or_raise(status_filter, ReportStatus, "status"))

    service = ListingReportService()
    reports, total = await service.list_reports(
        db,
        status=status_enum,
        page=page,
        page_size=page_size,
    )
    items = [ReportResponse.model_validate(r) for r in reports]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )


@router.post(
    "/reports/{report_id}/resolve",
    response_model=ReportResponse,
)
async def resolve_report(
    report_id: uuid.UUID,
    request_data: ReportResolve,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin_user)],
) -> ReportResponse:
    """Admin resolves a pending listing report.

    If ``valid`` is True, the listing is deactivated and its pending
    reservations auto-cancelled. The owner's violation_count is incremented.
    """
    service = ListingReportService()
    report = await service.resolve_report(
        db,
        admin=admin,
        report_id=report_id,
        valid=request_data.valid,
        note=request_data.note,
    )
    return ReportResponse.model_validate(report)


# ── Member: view own submitted reports (read-only) ────────────────────
@router.get(
    "/reports/me",
    response_model=PaginatedResponse[ReportResponse],
)
async def list_my_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member_read_only)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ReportResponse]:
    """List reports submitted by the current member."""
    from sqlalchemy import func, select
    from app.models.listing_report import ListingReport

    query = select(ListingReport).where(ListingReport.reporter_id == current_user.id)
    count_q = select(func.count(ListingReport.id)).where(
        ListingReport.reporter_id == current_user.id
    )

    if status_filter:
        status_enum = ReportStatus(parse_enum_or_raise(status_filter, ReportStatus, "status"))
        query = query.where(ListingReport.status == status_enum)
        count_q = count_q.where(ListingReport.status == status_enum)

    total = (await db.execute(count_q)).scalar() or 0
    query = (
        query
        .order_by(ListingReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    reports = list((await db.execute(query)).scalars().all())

    items = [ReportResponse.model_validate(r) for r in reports]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, pages=pages
    )