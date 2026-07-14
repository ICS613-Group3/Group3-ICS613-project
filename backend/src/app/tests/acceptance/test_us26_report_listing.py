"""User Story 26 — Member Reports an Inappropriate Tool Listing.

No backend implementation exists: no Report model, no report endpoint
anywhere in `src/app/api/v1/` or `src/app/models/`.
"""

import pytest

pytestmark = pytest.mark.acceptance

_REASON = (
    "not implemented: no Report model, schema, or endpoint exists anywhere in "
    "the backend for reporting a tool listing."
)


class TestScenario1MemberSubmitsReport:
    @pytest.mark.skip(reason=_REASON)
    async def test_report_saved_pending_review_admin_notified(self) -> None:
        raise NotImplementedError


class TestScenario2CannotReportSameListingTwiceWhilePending:
    @pytest.mark.skip(reason=_REASON)
    async def test_duplicate_pending_report_blocked(self) -> None:
        raise NotImplementedError


class TestScenario3UnauthenticatedCannotReport:
    @pytest.mark.skip(reason=_REASON)
    async def test_returns_401(self) -> None:
        raise NotImplementedError


class TestScenario4ReportReasonRequired:
    @pytest.mark.skip(reason=_REASON)
    async def test_missing_reason_rejected(self) -> None:
        raise NotImplementedError


class TestScenario5ReportOnNonExistentOrDeactivatedListingRejected:
    @pytest.mark.skip(reason=_REASON)
    async def test_rejected_for_missing_or_deactivated_listing(self) -> None:
        raise NotImplementedError
