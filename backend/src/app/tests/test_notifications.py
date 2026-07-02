"""Tests for notification endpoints."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import NotificationType
from app.services.notification import NotificationService
from app.tests.factories import UserFactory


class TestListNotifications:
    """Tests for GET /api/v1/notifications."""

    async def test_empty_list_for_new_user(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """A newly created user has no notifications."""
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        response = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["unread_count"] == 0
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["pages"] == 1

    async def test_unread_only_filter(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Filtering by unread_only=True returns only unread notifications."""
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        # Create an unread notification.
        unread = await NotificationService().create(
            db_session,
            user_id=user.id,
            type_=NotificationType.RESERVATION_APPROVED,
            title="Unread",
            body="This one is unread.",
        )

        # Create a read notification by setting read_at manually.
        read_notif = await NotificationService().create(
            db_session,
            user_id=user.id,
            type_=NotificationType.RESERVATION_APPROVED,
            title="Read",
            body="This one is already read.",
        )
        read_notif.read_at = datetime.now(UTC)
        db_session.add(read_notif)
        await db_session.flush()

        # With unread_only=True we should see only the unread notification.
        response = await client.get(
            "/api/v1/notifications",
            params={"unread_only": True},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["unread_count"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["id"] == str(unread.id)

        # Without filter we should see both.
        response_all = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
        data_all = response_all.json()
        assert data_all["total"] == 2
        assert data_all["unread_count"] == 1


class TestCreateAndList:
    """Test creating a notification via the service and listing it."""

    async def test_create_via_service_and_verify_in_list(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """A notification created via the service appears in the list endpoint."""
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        notif = await NotificationService().create(
            db_session,
            user_id=user.id,
            type_=NotificationType.INVITE_SENT,
            title="Welcome!",
            body="You have been invited to the platform.",
            payload={"inviter": "admin"},
        )

        response = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["unread_count"] == 1
        assert len(data["items"]) == 1

        item = data["items"][0]
        assert item["id"] == str(notif.id)
        assert item["type"] == "INVITE_SENT"
        assert item["title"] == "Welcome!"
        assert item["body"] == "You have been invited to the platform."
        assert item["payload"] == {"inviter": "admin"}
        assert item["read_at"] is None
        assert item["created_at"] is not None


class TestMarkRead:
    """Tests for POST /api/v1/notifications/{id}/read."""

    async def test_mark_notification_as_read(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """Marking a notification sets read_at and reduces unread_count."""
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        notif = await NotificationService().create(
            db_session,
            user_id=user.id,
            type_=NotificationType.TOOL_DEACTIVATED,
            title="Tool removed",
            body="A tool has been deactivated.",
        )

        response = await client.post(
            f"/api/v1/notifications/{notif.id}/read",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(notif.id)
        assert data["read_at"] is not None

        # Verify unread count is now 0.
        list_resp = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
        list_data = list_resp.json()
        assert list_data["unread_count"] == 0
        assert list_data["items"][0]["read_at"] is not None

    async def test_mark_nonexistent_notification_returns_404(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """POST /read with a random UUID returns 404."""
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)
        fake_id = uuid.uuid4()

        response = await client.post(
            f"/api/v1/notifications/{fake_id}/read",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

    async def test_mark_someone_elses_notification_returns_404(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        """A user cannot mark another user's notification as read."""
        user1 = await UserFactory.create_async(db_session)
        user2 = await UserFactory.create_async(db_session)

        # Create a notification that belongs to user1.
        notif = await NotificationService().create(
            db_session,
            user_id=user1.id,
            type_=NotificationType.RESERVATION_REQUESTED,
            title="Reservation",
            body="Your reservation has been requested.",
        )

        # User2 tries to mark user1's notification as read.
        token_user2 = create_access_token(user2.id)
        response = await client.post(
            f"/api/v1/notifications/{notif.id}/read",
            headers={"Authorization": f"Bearer {token_user2}"},
        )

        assert response.status_code == 404
