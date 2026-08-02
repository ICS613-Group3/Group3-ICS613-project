"""User Story 29 — Admin Tracks Member Listing Violations.

Violation tracking is wired through the report-review flow (US26/US27):
resolving a report as VALID increments the listing owner's violation_count
(`ListingReportService.resolve_report`), and `GET
/api/v1/admin/users/{user_id}/moderation` (app/api/v1/admin.py) exposes it
alongside the owner's violation history to admins.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header, create_tool, make_admin
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminViewsMemberViolationCount:
    async def test_moderation_profile_shows_violation_history(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "MISLEADING_LISTING", "comment": "Not as described"},
            headers=auth_header(reporter.id),
        )
        assert report_resp.status_code == 201
        report_id = report_resp.json()["id"]

        resolve_resp = await client.post(
            f"/api/v1/reports/{report_id}/resolve",
            json={"valid": True, "note": "Confirmed misleading"},
            headers=auth_header(admin.id),
        )
        assert resolve_resp.status_code == 200

        profile_resp = await client.get(
            f"/api/v1/admin/users/{owner.id}/moderation",
            headers=auth_header(admin.id),
        )
        assert profile_resp.status_code == 200
        data = profile_resp.json()
        assert data["violation_count"] == 1
        assert any(entry["report_id"] == report_id for entry in data["violation_history"])


class TestScenario2ViolationCountIncreasesAfterConfirmedViolation:
    async def test_count_increments_on_valid_report(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "SCAM_OR_FRAUD", "comment": "Reported as a scam"},
            headers=auth_header(reporter.id),
        )
        assert report_resp.status_code == 201

        resolve_resp = await client.post(
            f"/api/v1/reports/{report_resp.json()['id']}/resolve",
            json={"valid": True},
            headers=auth_header(admin.id),
        )
        assert resolve_resp.status_code == 200

        me_resp = await client.get("/api/v1/auth/me", headers=auth_header(owner.id))
        assert me_resp.json()["violation_count"] == 1


class TestScenario3InvalidReportDoesNotIncreaseCount:
    async def test_count_unchanged_on_invalid_report(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        reporter = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        report_resp = await client.post(
            f"/api/v1/tools/{tool['id']}/report",
            json={"reason": "MISLEADING_LISTING", "comment": "Actually fine"},
            headers=auth_header(reporter.id),
        )
        assert report_resp.status_code == 201

        resolve_resp = await client.post(
            f"/api/v1/reports/{report_resp.json()['id']}/resolve",
            json={"valid": False, "note": "Listing checked out fine"},
            headers=auth_header(admin.id),
        )
        assert resolve_resp.status_code == 200

        me_resp = await client.get("/api/v1/auth/me", headers=auth_header(owner.id))
        assert me_resp.json()["violation_count"] == 0


class TestScenario4MemberWithNoViolationsShowsZero:
    async def test_new_member_violation_count_defaults_to_zero(
        self, client, db_session: AsyncSession
    ) -> None:
        """A new member's violation_count defaults to 0 and is exposed on
        their own profile (see Scenario 1 for the admin-facing view)."""
        user = await UserFactory.create_async(db_session)

        response = await client.get("/api/v1/auth/me", headers=auth_header(user.id))

        assert response.status_code == 200
        assert response.json()["violation_count"] == 0
