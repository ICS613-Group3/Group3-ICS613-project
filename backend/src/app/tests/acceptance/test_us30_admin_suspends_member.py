"""User Story 30 — Admin Suspends a Member Account."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog
from app.models.enums import UserStatus
from app.models.notification import Notification
from app.tests.acceptance.helpers import auth_header, make_admin
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminSuspendsMember:
    async def test_status_suspended_audit_logged_member_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "Repeated policy violations"},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        await db_session.refresh(member)
        assert member.status == UserStatus.SUSPENDED

        audit = (
            await db_session.execute(
                select(AdminAuditLog).where(
                    AdminAuditLog.target_id == member.id,
                    AdminAuditLog.action_type == "USER_SUSPEND",
                )
            )
        ).scalar_one()
        assert audit.actor_id == admin.id
        assert audit.reason == "Repeated policy violations"

        notifications = (
            await db_session.execute(
                select(Notification).where(Notification.user_id == member.id)
            )
        ).scalars().all()
        assert len(notifications) >= 1


class TestScenario2SuspendedMemberCannotUseRestrictedFeatures:
    async def test_suspended_member_blocked_from_creating_listing(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)
        await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "policy violation"},
            headers=auth_header(admin.id),
        )

        response = await client.post(
            "/api/v1/tools",
            data={"name": "Drill", "category": "POWER_TOOLS", "condition": "GOOD"},
            headers=auth_header(member.id),
        )
        assert response.status_code == 403

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: get_current_member (app/dependencies.py) requires "
        "status == ACTIVE for EVERY member-gated route, including read-only ones "
        "-- GET /tools (browse) and GET /reservations (own history). The doc "
        "explicitly requires suspended members retain read-only browse access "
        "and can still view their own reservation history; today they get 403 "
        "on those too, not just the write actions the doc means to restrict.",
    )
    async def test_suspended_member_can_still_browse_read_only(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)
        await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "policy violation"},
            headers=auth_header(admin.id),
        )

        response = await client.get("/api/v1/tools", headers=auth_header(member.id))
        assert response.status_code == 200


class TestScenario3SuspendedMemberCanStillLogIn:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: AuthService.login (app/services/auth.py) rejects any "
        "user whose status != ACTIVE with the same generic 'Invalid email or "
        "password' error used for wrong credentials -- a suspended member cannot "
        "log in at all today, let alone see a suspension notice. The doc "
        "requires login to succeed and show the suspension notice/status.",
    )
    async def test_suspended_member_login_succeeds(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session, email="suspended-us30@example.com")
        await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "policy violation"},
            headers=auth_header(admin.id),
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "suspended-us30@example.com", "password": "Password123!"},
        )
        assert response.status_code == 200


class TestScenario4NonAdminCannotSuspendMember:
    async def test_returns_403_status_unchanged(
        self, client, db_session: AsyncSession
    ) -> None:
        non_admin = await UserFactory.create_async(db_session)
        member = await UserFactory.create_async(db_session)

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "trying anyway"},
            headers=auth_header(non_admin.id),
        )

        assert response.status_code == 403
        await db_session.refresh(member)
        assert member.status == UserStatus.ACTIVE


class TestScenario5CannotSuspendAlreadySuspendedMember:
    async def test_rejected_with_conflict(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        member = await UserFactory.create_async(db_session)
        await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "first suspension"},
            headers=auth_header(admin.id),
        )

        response = await client.post(
            f"/api/v1/admin/users/{member.id}/deactivate",
            json={"reason": "second attempt"},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 409
        assert "already suspended" in response.json()["detail"].lower()
