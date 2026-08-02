"""Admin-user-management coverage with no corresponding user story.

Deactivate/reactivate-a-member and the audit log are already exercised by
acceptance/test_us30_admin_suspends_member.py,
acceptance/test_us31_admin_reactivates_member.py, and
acceptance/test_us32_moderation_history.py. Hard-delete of another user's
account (an admin-only endpoint, distinct from the self-service US7 delete)
and the self-protection guardrails have no story mapping at all.
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import UserStatus
from app.tests.factories import AdminFactory, UserFactory

pytestmark = pytest.mark.auxiliary


class TestAdminDeleteUser:
    """DELETE /api/v1/admin/users/{id}"""

    async def test_admin_deletes_user(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Admin can hard-delete a user account."""
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)

        token = create_access_token(admin.id)
        response = await client.request(
            "DELETE",
            f"/api/v1/admin/users/{target.id}",
            json={"reason": "Requested by user"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User deleted successfully"

        # Verify the target user is now marked as deleted.
        await db_session.refresh(target)
        assert target.status == UserStatus.DELETED
        # Display name is preserved for history integrity; email is anonymized.
        assert target.full_name is not None
        assert target.full_name != "Deleted User"
        assert "deleted+" in target.email

    async def test_non_admin_cannot_delete(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-admin users receive a 403 when trying to delete."""
        regular_user = await UserFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)

        token = create_access_token(regular_user.id)
        response = await client.request(
            "DELETE",
            f"/api/v1/admin/users/{target.id}",
            json={"reason": "Should not be allowed"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestAdminSelfProtection:
    """M3 — admins cannot suspend / delete themselves or other admins."""

    async def test_admin_cannot_suspend_self(self, client, db_session: AsyncSession) -> None:
        """POST /api/v1/admin/users/{admin.id}/deactivate returns 409."""
        admin = await AdminFactory.create_async(db_session)
        token = create_access_token(admin.id)

        response = await client.post(
            f"/api/v1/admin/users/{admin.id}/deactivate",
            json={"reason": "self-suspend attempt"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
        assert "yourself" in response.json()["detail"].lower()

    async def test_admin_cannot_suspend_another_admin(
        self, client, db_session: AsyncSession
    ) -> None:
        """An admin cannot suspend a different admin (prevents lock-out)."""
        admin1 = await AdminFactory.create_async(db_session)
        admin2 = await AdminFactory.create_async(db_session)
        token = create_access_token(admin1.id)

        response = await client.post(
            f"/api/v1/admin/users/{admin2.id}/deactivate",
            json={"reason": "internal politics"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
        assert "another admin" in response.json()["detail"].lower()

    async def test_admin_cannot_delete_self(self, client, db_session: AsyncSession) -> None:
        """DELETE /api/v1/admin/users/{admin.id} returns 409 for self."""
        admin = await AdminFactory.create_async(db_session)
        token = create_access_token(admin.id)

        response = await client.request(
            "DELETE",
            f"/api/v1/admin/users/{admin.id}",
            json={"reason": "self-delete attempt"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
        assert "yourself" in response.json()["detail"].lower()

    async def test_user_suspension_creates_notification(
        self, client, db_session: AsyncSession
    ) -> None:
        """M8 — suspending a user creates an in-app notification for them."""
        from sqlalchemy import select

        from app.models.enums import NotificationType
        from app.models.notification import Notification

        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)
        token = create_access_token(admin.id)

        response = await client.post(
            f"/api/v1/admin/users/{target.id}/deactivate",
            json={"reason": "violation"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

        # Refresh and verify the notification was created.
        result = await db_session.execute(
            select(Notification).where(Notification.user_id == target.id)
        )
        notif = result.scalar_one()
        assert notif.type == NotificationType.ACCOUNT_SUSPENDED.value


class TestAdminDeleteUserEdgeCases:
    async def test_deleting_nonexistent_user_returns_404(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await AdminFactory.create_async(db_session)
        token = create_access_token(admin.id)

        response = await client.request(
            "DELETE",
            f"/api/v1/admin/users/{uuid.uuid4()}",
            json={"reason": "no such user"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_admin_cannot_delete_another_admin(
        self, client, db_session: AsyncSession
    ) -> None:
        admin1 = await AdminFactory.create_async(db_session)
        admin2 = await AdminFactory.create_async(db_session)
        token = create_access_token(admin1.id)

        response = await client.request(
            "DELETE",
            f"/api/v1/admin/users/{admin2.id}",
            json={"reason": "internal politics"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
        assert "another admin" in response.json()["detail"].lower()


class TestAdminUserDirectory:
    """GET /api/v1/admin/users (list) and GET /api/v1/admin/users/{id}
    (single-user detail) — the plain admin user-directory views. Distinct
    from the /moderation variant (test_us29_track_violations.py), which
    exposes violation history rather than the base UserProfile."""

    async def test_admin_can_list_users(self, client, db_session: AsyncSession) -> None:
        admin = await AdminFactory.create_async(db_session)
        await UserFactory.create_async(db_session, email="directory-member@example.com")
        token = create_access_token(admin.id)

        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2
        emails = {u["email"] for u in data["items"]}
        assert "directory-member@example.com" in emails

    async def test_list_users_filterable_by_status(self, client, db_session: AsyncSession) -> None:
        admin = await AdminFactory.create_async(db_session)
        suspended = await UserFactory.create_async(
            db_session, email="suspended-directory@example.com", status=UserStatus.SUSPENDED
        )
        token = create_access_token(admin.id)

        response = await client.get(
            "/api/v1/admin/users",
            params={"status": "SUSPENDED"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        ids = {u["id"] for u in data["items"]}
        assert str(suspended.id) in ids
        assert all(u["status"] == "SUSPENDED" for u in data["items"])

    async def test_list_users_searchable_by_email(self, client, db_session: AsyncSession) -> None:
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session, email="findme-search@example.com")
        await UserFactory.create_async(db_session, email="someone-else@example.com")
        token = create_access_token(admin.id)

        response = await client.get(
            "/api/v1/admin/users",
            params={"search": "findme"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        ids = {u["id"] for u in response.json()["items"]}
        assert str(target.id) in ids

    async def test_non_admin_cannot_list_users(self, client, db_session: AsyncSession) -> None:
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_admin_can_get_single_user(self, client, db_session: AsyncSession) -> None:
        admin = await AdminFactory.create_async(db_session)
        member = await UserFactory.create_async(db_session, email="single-detail@example.com")
        token = create_access_token(admin.id)

        response = await client.get(
            f"/api/v1/admin/users/{member.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["email"] == "single-detail@example.com"

    async def test_get_nonexistent_user_returns_404(self, client, db_session: AsyncSession) -> None:
        admin = await AdminFactory.create_async(db_session)
        token = create_access_token(admin.id)

        response = await client.get(
            f"/api/v1/admin/users/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_non_admin_cannot_get_single_user(self, client, db_session: AsyncSession) -> None:
        user = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        response = await client.get(
            f"/api/v1/admin/users/{other.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
