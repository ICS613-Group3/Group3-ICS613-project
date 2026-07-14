"""Tests for admin endpoints."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import UserStatus
from app.tests.factories import AdminFactory, UserFactory


class TestAdminListUsers:
    """GET /api/v1/admin/users"""

    async def test_admin_lists_users(self, client, db_session: AsyncSession) -> None:
        """Admin can list all non-deleted users."""
        admin = await AdminFactory.create_async(db_session)
        await UserFactory.create_async(db_session, full_name="Alice Borrower")
        await UserFactory.create_async(db_session, full_name="Bob Owner")

        token = create_access_token(admin.id)
        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        # Includes the admin plus the two created users.
        assert data["total"] >= 3
        assert len(data["items"]) >= 3

    async def test_filter_by_status(self, client, db_session: AsyncSession) -> None:
        """Admin can filter the user list by status."""
        admin = await AdminFactory.create_async(db_session)
        suspended = await UserFactory.create_async(db_session, status=UserStatus.SUSPENDED)
        await UserFactory.create_async(db_session, status=UserStatus.ACTIVE)

        token = create_access_token(admin.id)
        response = await client.get(
            "/api/v1/admin/users",
            params={"status": "suspended"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        ids = {item["id"] for item in data["items"]}
        assert str(suspended.id) in ids
        assert all(item["status"] == "SUSPENDED" for item in data["items"])

    async def test_search_by_name_or_email(self, client, db_session: AsyncSession) -> None:
        """Admin can search users by email or full name."""
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session, full_name="Zephyr Unique")

        token = create_access_token(admin.id)
        response = await client.get(
            "/api/v1/admin/users",
            params={"search": "Zephyr"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        ids = {item["id"] for item in data["items"]}
        assert str(target.id) in ids

    async def test_non_admin_cannot_list_users(self, client, db_session: AsyncSession) -> None:
        """Non-admin users receive a 403 when listing users."""
        regular_user = await UserFactory.create_async(db_session)
        token = create_access_token(regular_user.id)

        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestAdminGetUser:
    """GET /api/v1/admin/users/{id}"""

    async def test_admin_gets_user(self, client, db_session: AsyncSession) -> None:
        """Admin can fetch a single user's profile by ID."""
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)

        token = create_access_token(admin.id)
        response = await client.get(
            f"/api/v1/admin/users/{target.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(target.id)
        assert data["email"] == target.email

    async def test_get_user_not_found(self, client, db_session: AsyncSession) -> None:
        """Fetching a nonexistent user returns 404."""
        import uuid

        admin = await AdminFactory.create_async(db_session)
        token = create_access_token(admin.id)

        response = await client.get(
            f"/api/v1/admin/users/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

    async def test_non_admin_cannot_get_user(self, client, db_session: AsyncSession) -> None:
        """Non-admin users receive a 403 when fetching a user by ID."""
        regular_user = await UserFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)
        token = create_access_token(regular_user.id)

        response = await client.get(
            f"/api/v1/admin/users/{target.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestAdminDeactivateUser:
    """POST /api/v1/admin/users/{id}/deactivate"""

    async def test_admin_deactivates_user(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Admin can suspend an active user account."""
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)

        token = create_access_token(admin.id)
        response = await client.post(
            f"/api/v1/admin/users/{target.id}/deactivate",
            json={"reason": "Violation of community guidelines"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User suspended successfully"

        # Verify the target user is now suspended.
        await db_session.refresh(target)
        assert target.status == UserStatus.SUSPENDED

    async def test_non_admin_cannot_deactivate(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-admin users receive a 403 when trying to deactivate."""
        regular_user = await UserFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)

        token = create_access_token(regular_user.id)
        response = await client.post(
            f"/api/v1/admin/users/{target.id}/deactivate",
            json={"reason": "Should not be allowed"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestAdminReactivateUser:
    """POST /api/v1/admin/users/{id}/reactivate"""

    async def test_admin_reactivates_suspended_user(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Admin can reactivate a suspended user."""
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session, status=UserStatus.SUSPENDED)

        token = create_access_token(admin.id)
        response = await client.post(
            f"/api/v1/admin/users/{target.id}/reactivate",
            json={"reason": "Admin reactivation"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User reactivated successfully"

        # Verify the target user is now active.
        await db_session.refresh(target)
        assert target.status == UserStatus.ACTIVE


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


class TestAdminAuditLog:
    """GET /api/v1/admin/audit-log"""

    async def test_audit_log_shows_admin_actions(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Audit log contains entries for admin moderation actions."""
        admin = await AdminFactory.create_async(db_session)
        target = await UserFactory.create_async(db_session)
        token = create_access_token(admin.id)

        # Perform an admin action to generate an audit entry.
        await client.post(
            f"/api/v1/admin/users/{target.id}/deactivate",
            json={"reason": "Testing audit log"},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Query the audit log as admin.
        response = await client.get(
            "/api/v1/admin/audit-log",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

        entry = data["items"][0]
        assert entry["action_type"] == "USER_SUSPEND"
        assert entry["target_type"] == "user"
        assert entry["target_id"] == str(target.id)

    async def test_audit_log_admin_only(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Non-admin users receive a 403 when accessing the audit log."""
        regular_user = await UserFactory.create_async(db_session)
        token = create_access_token(regular_user.id)

        response = await client.get(
            "/api/v1/admin/audit-log",
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
        assert notif.type == NotificationType.ACCOUNT_SUSPENDED
