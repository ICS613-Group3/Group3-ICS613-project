"""User Story 33 — Admin Generates Community Moderation Reports.

Covers all four scenarios from the requirements packet:
  1. Admin generates a moderation report
  2. Admin exports a report as CSV
  3. Report has no matching data (empty result)
  4. Non-admin cannot access reports
"""

import pytest

from app.core.security import create_access_token
from app.models.admin_audit_log import AdminAuditLog
from app.tests.factories import AdminFactory, UserFactory


def _bearer(user) -> dict:
    """Return an Authorization header dict for *user*."""
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


class TestUS33ModerationReports:
    """Acceptance tests for US33 — Admin Generates Community Moderation Reports."""

    @pytest.mark.asyncio
    async def test_scenario1_admin_generates_report(self, client, db_session):
        """S1: Admin generates a moderation report with totals and records."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

        # Create an audit log entry so the report has data
        entry = AdminAuditLog(
            actor_id=admin.id,
            action_type="TOOL_DEACTIVATED",
            target_type="tool",
            target_id=admin.id,  # using admin.id as a stand-in target
            reason="Test deactivation",
        )
        db_session.add(entry)
        await db_session.flush()

        resp = await client.get("/api/v1/admin/reports/moderation", headers=token)
        assert resp.status_code == 200, resp.text
        body = resp.json()

        # Summary must have all expected keys
        summary = body["summary"]
        assert "total_reports" in summary
        assert "pending_reports" in summary
        assert "valid_reports" in summary
        assert "invalid_reports" in summary
        assert "total_suspensions" in summary
        assert "total_reactivations" in summary
        assert "total_tool_deactivations" in summary
        assert "total_tool_reactivations" in summary
        assert "total_account_deletions" in summary
        assert "total_reservations" in summary
        assert "active_reservations" in summary
        assert "completed_reservations" in summary

        # Records should include our audit log entry
        assert "records" in body
        records = body["records"]
        assert len(records) >= 1
        assert any(r["action_type"] == "TOOL_DEACTIVATED" for r in records)

        # Report type
        assert body["report_type"] == "moderation"

    @pytest.mark.asyncio
    async def test_scenario2_admin_exports_csv(self, client, db_session):
        """S2: Admin exports a report as CSV — contents match on-screen data."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

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
            headers=token,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert "csv" in body
        assert body["filename"] == "moderation_report.csv"
        assert body["content_type"] == "text/csv"

        csv_text = body["csv"]
        # CSV should have column headers
        assert "Metric" in csv_text
        assert "Value" in csv_text
        # CSV should include audit log records section
        assert "Audit Log Records" in csv_text
        assert "action_type" in csv_text
        # Should contain our test entry
        assert "USER_SUSPEND" in csv_text
        assert "Test suspension for CSV export" in csv_text

    @pytest.mark.asyncio
    async def test_scenario3_no_matching_data(self, client, db_session):
        """S3: Date range with no records -> empty records, zero totals."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

        # Use a future date range where no records exist
        resp = await client.get(
            "/api/v1/admin/reports/moderation"
            "?date_from=2099-01-01T00:00:00"
            "&date_to=2099-12-31T23:59:59",
            headers=token,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        # Summary totals should all be zero
        summary = body["summary"]
        assert summary["total_reports"] == 0
        assert summary["total_suspensions"] == 0
        assert summary["total_tool_deactivations"] == 0

        # Records should be empty
        assert body["records"] == []

    @pytest.mark.asyncio
    async def test_scenario4_non_admin_cannot_access(self, client, db_session):
        """S4: Non-admin gets 403 on both report endpoints."""
        user = await UserFactory.create_async(db_session)
        token = _bearer(user)

        # Report endpoint -> 403
        resp = await client.get("/api/v1/admin/reports/moderation", headers=token)
        assert resp.status_code == 403

        # Export endpoint -> 403
        resp = await client.get(
            "/api/v1/admin/reports/moderation/export",
            headers=token,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_date_range_filter_applied(self, client, db_session):
        """Extra: date range filter correctly narrows results."""
        admin = await AdminFactory.create_async(db_session)
        token = _bearer(admin)

        # Create an entry now
        entry = AdminAuditLog(
            actor_id=admin.id,
            action_type="TOOL_REACTIVATED",
            target_type="tool",
            target_id=admin.id,
            reason="Test reactivation within range",
        )
        db_session.add(entry)
        await db_session.flush()

        # Query with a wide date range that includes now
        resp = await client.get(
            "/api/v1/admin/reports/moderation"
            "?date_from=2000-01-01T00:00:00"
            "&date_to=2099-12-31T23:59:59",
            headers=token,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["summary"]["total_tool_reactivations"] >= 1
        assert any(r["action_type"] == "TOOL_REACTIVATED" for r in body["records"])
