"""User Story 27 — Admin Reviews Reported Listings.

Endpoints:
  GET  /api/v1/reports                  (admin: list reports)
  POST /api/v1/reports/{report_id}/resolve  (admin: resolve report)

When resolved as VALID: tool deactivated, pending reservations auto-cancelled,
owner's violation_count incremented, both parties notified.
When resolved as INVALID: listing stays active.
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header, create_tool, make_admin
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminViewsPendingReportedListings:
    async def test_pending_reports_listed_with_details(
        self, client, db_session: AsyncSession
    ) -> None:
        """Admin can list all pending reports with reporter/tool details."""
        from app.tests.acceptance.helpers import make_admin

        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        # Submit a report
        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "MISLEADING_LISTING", "comment": "Tool photos are fake"},
            headers=auth_header(reporter.id),
        )
        assert report_resp.status_code == 201

        # Admin lists reports
        list_resp = await client.get(
            "/api/v1/reports",
            headers=auth_header(admin.id),
        )
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert data["total"] >= 1
        reports = data["items"]
        assert any(r["tool_id"] == tool["id"] for r in reports)


class TestScenario2AdminMarksReportValidAndHidesListing:
    async def test_listing_deactivated_reservations_cancelled_owner_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        """Resolving a report as VALID deactivates the tool and cancels pending reservations."""
        from sqlalchemy import select

        from app.models.enums import ReservationState
        from app.models.tool import Tool
        from app.tests.acceptance.helpers import make_admin

        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        # Create a pending reservation on the tool
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        # Submit a report
        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "PROHIBITED_ITEM"},
            headers=auth_header(reporter.id),
        )
        report_id = report_resp.json()["id"]

        # Admin resolves as valid
        resolve_resp = await client.post(
            f"/api/v1/reports/{report_id}/resolve",
            json={"valid": True, "note": "Confirmed prohibited item"},
            headers=auth_header(admin.id),
        )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["status"] == "VALID"

        # Tool should be deactivated (query ORM object, not the dict from create_tool)
        tool_result = await db_session.execute(select(Tool).where(Tool.id == tool["id"]))
        db_tool = tool_result.scalar_one()
        assert db_tool.is_active is False

        # Reservation should be auto-cancelled
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.CANCELLED

        # Owner's violation_count should be incremented
        await db_session.refresh(owner)
        assert owner.violation_count >= 1

        # Owner should be notified that their listing was deactivated
        from app.models.enums import NotificationType
        from app.models.notification import Notification

        owner_notif = await db_session.execute(
            select(Notification).where(
                Notification.user_id == owner.id,
                Notification.type == NotificationType.TOOL_DEACTIVATED.value,
            )
        )
        assert owner_notif.scalar_one_or_none() is not None


class TestScenario3AdminMarksReportInvalidListingStaysActive:
    async def test_report_resolved_invalid_listing_unaffected(
        self, client, db_session: AsyncSession
    ) -> None:
        """Resolving a report as INVALID leaves the listing active."""
        from app.tests.acceptance.helpers import make_admin

        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        # Submit a report
        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "SCAM_OR_FRAUD"},
            headers=auth_header(reporter.id),
        )
        report_id = report_resp.json()["id"]

        # Admin resolves as invalid
        resolve_resp = await client.post(
            f"/api/v1/reports/{report_id}/resolve",
            json={"valid": False, "note": "Investigated, no issue found"},
            headers=auth_header(admin.id),
        )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["status"] == "INVALID"

        # Tool should still be active
        from sqlalchemy import select

        from app.models.tool import Tool

        refreshed = await db_session.execute(select(Tool).where(Tool.id == tool["id"]))
        db_tool = refreshed.scalar_one()
        assert db_tool.is_active is True


class TestScenario4NonAdminCannotAccessReportedListingReview:
    async def test_returns_403(self, client, db_session: AsyncSession) -> None:
        """Non-admin gets 403 on report list and resolve endpoints."""
        user = await UserFactory.create_async(db_session)
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        # Submit a report (as the user)
        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(user.id),
        )
        assert report_resp.status_code == 201
        report_id = report_resp.json()["id"]

        # Non-admin tries to list reports -> 403
        list_resp = await client.get(
            "/api/v1/reports",
            headers=auth_header(user.id),
        )
        assert list_resp.status_code == 403

        # Non-admin tries to resolve a report -> 403
        resolve_resp = await client.post(
            f"/api/v1/reports/{report_id}/resolve",
            json={"valid": True},
            headers=auth_header(user.id),
        )
        assert resolve_resp.status_code == 403


class TestScenario5CannotResolveAReportTwice:
    async def test_second_resolution_returns_409(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "OTHER"},
            headers=auth_header(reporter.id),
        )
        report_id = report_resp.json()["id"]

        first = await client.post(
            f"/api/v1/reports/{report_id}/resolve",
            json={"valid": False, "note": "checked out fine"},
            headers=auth_header(admin.id),
        )
        assert first.status_code == 200

        second = await client.post(
            f"/api/v1/reports/{report_id}/resolve",
            json={"valid": True, "note": "changed my mind"},
            headers=auth_header(admin.id),
        )
        assert second.status_code == 409
        assert "already" in second.json()["detail"].lower()


class TestScenario6ResolvingNonexistentReportReturns404:
    async def test_returns_404(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)

        response = await client.post(
            f"/api/v1/reports/{uuid.uuid4()}/resolve",
            json={"valid": True},
            headers=auth_header(admin.id),
        )
        assert response.status_code == 404


class TestScenario7AdminFiltersReportsByStatus:
    async def test_status_filter_narrows_results(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        resolved_tool = await create_tool(client, owner, name="Already Resolved Tool")
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
            json={"valid": False, "note": "fine"},
            headers=auth_header(admin.id),
        )

        response = await client.get(
            "/api/v1/reports", params={"status": "PENDING"}, headers=auth_header(admin.id)
        )
        assert response.status_code == 200
        data = response.json()
        assert all(r["status"] == "PENDING" for r in data["items"])
        assert any(r["tool_id"] == pending_tool["id"] for r in data["items"])
        assert not any(r["tool_id"] == resolved_tool["id"] for r in data["items"])
