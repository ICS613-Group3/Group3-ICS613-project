"""Auth-related coverage with no corresponding user story.

Kept separately from acceptance/ because these guard cross-cutting
security/authorization behavior (permission checks, rate limiting,
account-enumeration prevention, soft-delete visibility) rather than a
specific numbered user-story scenario. The happy-path behavior these
classes touch incidentally (invite creation, invite listing) is already
covered under acceptance/test_us_admin_invite.py.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.tests.factories import AdminFactory, InviteFactory, PendingUserFactory, UserFactory

pytestmark = pytest.mark.auxiliary


class TestCreateInvitePermissions:
    """POST /api/v1/auth/invites — non-admin rejection (admin happy path is
    covered by acceptance/test_us_admin_invite.py)."""

    async def test_non_admin_cannot_create_invite(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        response = await client.post(
            "/api/v1/auth/invites",
            json={"email": unique_email},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403


class TestListInvitesPermissionsAndOrdering:
    """GET /api/v1/auth/invites — non-admin rejection and ordering, neither
    of which acceptance/test_us_admin_invite.py exercises."""

    async def test_non_admin_cannot_list_invites(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        response = await client.get(
            "/api/v1/auth/invites",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_list_invites_newest_first(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        admin = await AdminFactory.create_async(db_session)
        first = await InviteFactory.create_async(db_session, created_by=admin.id)
        second = await InviteFactory.create_async(db_session, created_by=admin.id)
        token = create_access_token(admin.id)

        response = await client.get(
            "/api/v1/auth/invites",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        # Newest first: second invite should appear before first
        ids = [item["id"] for item in data]
        assert ids.index(str(second.id)) < ids.index(str(first.id))


class TestGetByEmailExcludesDeleted:
    """M9 regression coverage: ``UserService.get_by_email`` excludes soft-deleted users.

    Before this change, the service returned soft-deleted users and every
    caller had to remember to filter ``deleted_at IS NULL`` themselves.
    Moving the filter into the service means callers can't forget, and the
    service's contract is "active user lookup" by default.
    """

    async def test_active_user_is_returned(self, db_session: AsyncSession) -> None:
        from app.services.user import UserService

        await UserFactory.create_async(db_session, email="alive@example.com")
        result = await UserService().get_by_email(db_session, "alive@example.com")
        assert result is not None
        assert result.email == "alive@example.com"

    async def test_soft_deleted_user_is_excluded(self, db_session: AsyncSession) -> None:
        """A user with deleted_at set is no longer found by email."""
        from app.services.user import UserService

        user = await UserFactory.create_async(db_session, email="ghost@example.com")
        # Mark as soft-deleted by setting status and deleted_at; we do this
        # in-place to mimic what the soft_delete service does, but without
        # anonymizing the email (so we can still look it up by string).
        from datetime import UTC, datetime

        user.deleted_at = datetime.now(UTC)
        db_session.add(user)
        await db_session.flush()

        result = await UserService().get_by_email(db_session, "ghost@example.com")
        assert result is None


class TestRateLimiting:
    """Auth endpoints throttle excessive requests with 429."""

    async def test_login_returns_429_after_limit(self, client, db_session: AsyncSession) -> None:
        """After exceeding the per-minute login limit, further attempts 429."""
        from app.config import get_settings

        limit = get_settings().rate_limit_login_per_minute
        # First `limit` requests are allowed (they may fail with 401 since
        # we don't bother registering a user — we just need the request
        # to count against the limiter).
        for i in range(limit):
            await client.post(
                "/api/v1/auth/login",
                json={"email": f"nobody-{i}@example.com", "password": "x"},
            )
        # Next request must be denied with 429.
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody-overflow@example.com", "password": "x"},
        )
        assert response.status_code == 429, response.text
        assert response.json()["error_code"] == "TooManyRequestsError"

    async def test_forgot_password_returns_429_after_limit(
        self, client, db_session: AsyncSession
    ) -> None:
        """Same for forgot-password."""
        from app.config import get_settings

        limit = get_settings().rate_limit_forgot_password_per_minute
        for i in range(limit):
            await client.post(
                "/api/v1/auth/forgot-password",
                json={"email": f"nobody-{i}@example.com"},
            )
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nobody-overflow@example.com"},
        )
        assert response.status_code == 429, response.text


class TestLoginDoesNotLeakAccountState:
    """Regression: the login endpoint must not reveal whether an email exists.

    Originally the flow returned "Invalid email or password" for wrong creds
    but "Email address not verified" / "Account suspended" for valid emails
    with status issues, letting an attacker probe which addresses are
    registered. The fix is to always return "Invalid email or password" for
    any non-success outcome; users with status issues use the dedicated
    resend-verification / contact-admin flows.
    """

    async def test_unknown_email_returns_generic_message(
        self, client, db_session: AsyncSession
    ) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "ghost-nobody-here@example.com", "password": "whatever1!"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    async def test_wrong_password_returns_generic_message(
        self, client, db_session: AsyncSession
    ) -> None:
        await UserFactory.create_async(db_session, email="known@example.com")
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "known@example.com", "password": "WrongPassword1!"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    async def test_unverified_email_returns_generic_message(
        self, client, db_session: AsyncSession
    ) -> None:
        await PendingUserFactory.create_async(db_session, email="pending@example.com")
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "pending@example.com", "password": "Password123!"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    async def test_suspended_account_returns_generic_message(
        self, client, db_session: AsyncSession
    ) -> None:
        from app.models.enums import UserStatus

        user = await UserFactory.create_async(db_session, email="suspended@example.com")
        user.status = UserStatus.SUSPENDED
        db_session.add(user)
        await db_session.flush()

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "suspended@example.com", "password": "Password123!"},
        )
        # Suspended users can now log in (per the spec) to see a suspension notice.
        assert response.status_code == 200
        assert "access_token" in response.json()
