"""User Story 33 — Admin Generates Community Moderation Reports.

Endpoints:
  GET /api/v1/admin/reports/moderation          (report data)
  GET /api/v1/admin/reports/moderation/export   (CSV export)

Covers all four scenarios from the requirements packet:
  1. Admin generates a moderation report
  2. Admin exports a report as CSV
  3. Report has no matching data (empty result)
  4. Non-admin cannot access reports
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog
from app.tests.acceptance.helpers import auth_header, make_admin
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminGeneratesReport:
    async def test_admin_generates_moderation_report(
        self, client, db_session: AsyncSession
    ) -> None:
        """S1: Admin generates a moderation report with totals and records."""
        admin = await make_admin(db_session)

        # Create an audit log entry so the report has data
        entry = AdminAuditLog(
            actor_id=admin.id,
            action_type="TOOL_DEACTIVATED",
            target_type="tool",
            target_id=admin.id,  # stand-in target
            reason="Test deactivation",
        )
        db_session.add(entry)
        await db_session.flush()

        resp = await client.get(
            "/api/v1/admin/reports/moderation",
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        summary = body["summary"]
        assert "total_reports" in summary
        assert "pending_reports" in summary
        assert "total_suspensions" in summary
        assert "total_reactivations" in summary
        assert "total_tool_deactivations" in summary
        assert "total_account_deletions" in summary

        records = body["records"]
        assert len(records) >= 1
        assert any(r["action_type"] == "TOOL_DEACTIVATED" for r in records)
        assert body["report_type"] == "moderation"


class TestScenario2AdminExportsCsv:
    async def test_admin_exports_moderation_report_as_csv(
        self, client, db_session: AsyncSession
    ) -> None:
        """S2: Admin exports a report as CSV — contents match on-screen data."""
        admin = await make_admin(db_session)

        entry = AdminAuditLog(
            actor_id=admin.id,
            action_type="USER_SUSPEND",
            target_type="user",
            target_id=admin.id,
            reason="Test suspension for CSV export",
        )
        db_session.add(entry)
        await db_session.flush()

        resp = await client.get(
            "/api/v1/admin/reports/moderation/export",
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert "csv" in body
        assert body["filename"] == "moderation_report.csv"
        assert body["content_type"] == "text/csv"

        csv_text = body["csv"]
        assert "Metric" in csv_text
        assert "Value" in csv_text
        assert "USER_SUSPEND" in csv_text


class TestScenario3NoMatchingData:
    async def test_date_range_with_no_records(self, client, db_session: AsyncSession) -> None:
        """S3: Date range with no records -> empty records, zero totals."""
        admin = await make_admin(db_session)

        resp = await client.get(
            "/api/v1/admin/reports/moderation"
            "?date_from=2099-01-01T00:00:00"
            "&date_to=2099-12-31T23:59:59",
            headers=auth_header(admin.id),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        summary = body["summary"]
        assert summary["total_reports"] == 0
        assert summary["total_suspensions"] == 0
        assert summary["total_tool_deactivations"] == 0
        assert body["records"] == []


class TestScenario4NonAdminCannotAccess:
    async def test_non_admin_gets_403_on_both_endpoints(
        self, client, db_session: AsyncSession
    ) -> None:
        """S4: Non-admin gets 403 on both report endpoints."""
        user = await UserFactory.create_async(db_session)

        resp = await client.get(
            "/api/v1/admin/reports/moderation",
            headers=auth_header(user.id),
        )
        assert resp.status_code == 403

        resp2 = await client.get(
            "/api/v1/admin/reports/moderation/export",
            headers=auth_header(user.id),
        )
        assert resp2.status_code == 403
