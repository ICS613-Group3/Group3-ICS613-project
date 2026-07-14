"""User Story 33 — Admin Generates Community Moderation Reports.

No `/admin/reports` (or similar) endpoint, no report-generation service, and
no CSV export exists anywhere in the backend. `GET /admin/audit-log`
(User Story 32) is a raw log listing, not an aggregated report with totals
by type/date-range, and has no export option.
"""

import pytest

pytestmark = pytest.mark.acceptance

_REASON = (
    "not implemented: no report-generation endpoint, aggregation service, or "
    "CSV export exists anywhere in the backend."
)


class TestScenario1AdminGeneratesModerationReport:
    @pytest.mark.skip(reason=_REASON)
    async def test_report_shows_totals_for_selected_criteria(self) -> None:
        raise NotImplementedError


class TestScenario2AdminExportsReportAsCSV:
    @pytest.mark.skip(reason=_REASON)
    async def test_csv_download_matches_on_screen_data(self) -> None:
        raise NotImplementedError


class TestScenario3ReportHasNoMatchingData:
    @pytest.mark.skip(reason=_REASON)
    async def test_no_matching_records_message_shown(self) -> None:
        raise NotImplementedError


class TestScenario4NonAdminCannotAccessReports:
    @pytest.mark.skip(reason=_REASON)
    async def test_returns_403(self) -> None:
        raise NotImplementedError
