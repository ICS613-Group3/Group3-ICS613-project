"""User Story 26 — Member Reports an Inappropriate Tool Listing.

Endpoints:
  POST /api/v1/tools/{tool_id}/report  (submit report)
  GET  /api/v1/reports/me              (view own reports)

Blocks: self-report, duplicate report, deactivated/non-existent listing.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header, create_tool, make_admin
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1MemberSubmitsReport:
    async def test_report_saved_pending_review_admin_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        """Member submits a report against a tool listing."""
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={
                "reason": "INAPPROPRIATE_CONTENT",
                "comment": "This listing contains offensive language",
            },
            headers=auth_header(reporter.id),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["tool_id"] == tool["id"]
        assert data["reporter_id"] == str(reporter.id)
        assert data["reason"] == "INAPPROPRIATE_CONTENT"
        assert data["status"] == "PENDING"


class TestScenario2CannotReportSameListingTwiceWhilePending:
    async def test_duplicate_pending_report_blocked(self, client, db_session: AsyncSession) -> None:
        """Second report from same reporter on same tool is rejected."""
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        # First report succeeds
        resp1 = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "SCAM_OR_FRAUD"},
            headers=auth_header(reporter.id),
        )
        assert resp1.status_code == 201

        # Duplicate report from same reporter
        resp2 = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "SCAM_OR_FRAUD"},
            headers=auth_header(reporter.id),
        )
        assert resp2.status_code == 409


class TestScenario3UnauthenticatedCannotReport:
    async def test_returns_401(self, client, db_session: AsyncSession) -> None:
        """Unauthenticated user cannot submit a report."""
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "OTHER"},
        )
        assert response.status_code == 401


class TestScenario4ReportReasonRequired:
    async def test_missing_reason_rejected(self, client, db_session: AsyncSession) -> None:
        """Report without a reason field is rejected (422 validation error)."""
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"comment": "Missing the reason field"},
            headers=auth_header(reporter.id),
        )
        assert response.status_code == 422


class TestScenario5ReportOnNonExistentOrDeactivatedListingRejected:
    async def test_rejected_for_missing_or_deactivated_listing(
        self, client, db_session: AsyncSession
    ) -> None:
        """Report on a deactivated listing returns 409."""
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        # Deactivate the tool via direct DB manipulation
        from sqlalchemy import update

        from app.models.tool import Tool

        await db_session.execute(update(Tool).where(Tool.id == tool["id"]).values(is_active=False))
        await db_session.flush()

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(reporter.id),
        )
        assert response.status_code == 409


class TestScenario6CannotReportOwnListing:
    async def test_owner_reporting_own_listing_returns_409(
        self, client, db_session: AsyncSession
    ) -> None:
        """The tool owner cannot report their own listing."""
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(owner.id),
        )
        assert response.status_code == 409
        assert "own listing" in response.json()["detail"].lower()


class TestScenario7MemberViewsOwnSubmittedReports:
    """GET /api/v1/reports/me — a member's own report history."""

    async def test_lists_only_current_users_reports(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        other_reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner, name="Reported Tool")
        other_tool = await create_tool(client, owner, name="Other Reported Tool")

        await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "SCAM_OR_FRAUD"},
            headers=auth_header(reporter.id),
        )
        await client.post(
            f"/api/v1/tools/{other_tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(other_reporter.id),
        )

        response = await client.get("/api/v1/reports/me", headers=auth_header(reporter.id))
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["reason"] == "SCAM_OR_FRAUD"
        assert data["items"][0]["reporter_id"] == str(reporter.id)

    async def test_filterable_by_status(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        resolved_tool = await create_tool(client, owner, name="Resolved Tool")
        pending_tool = await create_tool(client, owner, name="Still Pending Tool")

        resolved_report = await client.post(
            f"/api/v1/tools/{resolved_tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(reporter.id),
        )
        await client.post(
            f"/api/v1/tools/{pending_tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(reporter.id),
        )
        await client.post(
            f"/api/v1/reports/{resolved_report.json()['id']}/resolve",
            json={"valid": False, "note": "investigated, no issue found"},
            headers=auth_header(admin.id),
        )

        response = await client.get(
            "/api/v1/reports/me?status=PENDING", headers=auth_header(reporter.id)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["tool_id"] == pending_tool["id"]

    async def test_requires_auth(self, client) -> None:
        response = await client.get("/api/v1/reports/me")
        assert response.status_code == 401
