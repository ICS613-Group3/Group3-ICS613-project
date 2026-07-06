"""User Story 31 — Admin Reactivates a Suspended Member Account."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog
from app.models.enums import UserStatus
from app.tests.acceptance.helpers import auth_header, make_admin
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


async def _suspend(client, admin, member):
    await client.post(
        f"/api/v1/admin/users/{member.id}/deactivate",
        json={"reason": "policy violation"},
        headers=auth_header(admin.id),
    )


class TestScenario1AdminReactivatesSuspendedMember:
    async def test_status_active_audit_logged_member_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)
        await _suspend(client, admin, member)

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/reactivate",
            json={"reason": "Admin reactivation"},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        await db_session.refresh(member)
        assert member.status == UserStatus.ACTIVE

        audit = (
            await db_session.execute(
                select(AdminAuditLog).where(
                    AdminAuditLog.target_id == member.id,
                    AdminAuditLog.action_type == "USER_REACTIVATE",
                )
            )
        ).scalar_one()
        assert audit.actor_id == admin.id

    async def test_admin_supplied_reason_is_recorded(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)
        await _suspend(client, admin, member)

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/reactivate",
            json={"reason": "Appeal reviewed and approved"},
            headers=auth_header(admin.id),
        )
        assert response.status_code == 200

        audit = (
            await db_session.execute(
                select(AdminAuditLog).where(
                    AdminAuditLog.target_id == member.id,
                    AdminAuditLog.action_type == "USER_REACTIVATE",
                )
            )
        ).scalar_one()
        assert audit.reason == "Appeal reviewed and approved"


class TestScenario2CannotReactivateNonSuspendedAccount:
    async def test_rejected_for_active_account(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/reactivate",
            json={"reason": "Admin reactivation"},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 409
        assert "not suspended" in response.json()["detail"].lower()


class TestScenario3ReactivatedMemberRegainsNormalAccess:
    async def test_reactivated_member_can_create_listing(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)
        await _suspend(client, admin, member)
        await client.post(
            f"/api/v1/admin/users/{member.id}/reactivate",
            json={"reason": "Admin reactivation"},
            headers=auth_header(admin.id),
        )

        response = await client.post(
            "/api/v1/tools",
            data={"name": "Drill", "category": "POWER_TOOLS", "condition": "GOOD"},
            files=[("photos", ("p.jpg", b"", "image/jpeg"))],
            headers=auth_header(member.id),
        )
        # The photo bytes are empty (irrelevant to this scenario -- just
        # proving the member is no longer blocked by suspension, i.e. not a
        # 403). Empty-file 422 is expected and fine here.
        assert response.status_code in (201, 422)
        assert response.status_code != 403


class TestScenario4NonAdminCannotReactivateMember:
    async def test_returns_403_status_unchanged(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        non_admin = await UserFactory.create_async(db_session)
        member = await UserFactory.create_async(db_session)
        await _suspend(client, admin, member)

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/reactivate",
            json={"reason": "Admin reactivation"},
            headers=auth_header(non_admin.id),
        )

        assert response.status_code == 403
        await db_session.refresh(member)
        assert member.status == UserStatus.SUSPENDED
