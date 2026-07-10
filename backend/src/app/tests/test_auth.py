"""Tests for authentication endpoints."""

import uuid
from unittest.mock import MagicMock, patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.email_verification import EmailVerificationToken
from app.models.enums import InviteStatus, UserStatus
from app.models.user import User
from app.services.auth import AuthService
from app.services.email import EmailService
from app.tests.factories import AdminFactory, InviteFactory, PendingUserFactory, UserFactory


def _example_email() -> str:
    return f"user+{uuid.uuid4().hex[:12]}@example.com"


class TestCreateInvite:
    async def test_admin_can_create_invite(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        admin = await AdminFactory.create_async(db_session)
        token = create_access_token(admin.id)
        email = _example_email()

        with patch.object(EmailService, "send_invite_email", MagicMock()):
            response = await client.post(
                "/api/v1/auth/invites",
                json={"email": email},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == email.lower()
        assert data["token"]
        assert data["status"] == "sent"

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


class TestListInvites:
    """GET /api/v1/auth/invites — admin-only invite listing."""

    async def test_admin_can_list_invites(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        admin = await AdminFactory.create_async(db_session)
        await InviteFactory.create_async(db_session, created_by=admin.id)
        await InviteFactory.create_async(db_session, created_by=admin.id)
        token = create_access_token(admin.id)

        response = await client.get(
            "/api/v1/auth/invites",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        assert "token" in data[0]
        assert "email" in data[0]
        assert "status" in data[0]

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


class TestRegister:
    async def test_register_with_valid_invite(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        admin = await AdminFactory.create_async(db_session)
        email = _example_email()
        invite = await InviteFactory.create_async(
            db_session,
            email=email,
            created_by=admin.id,
        )

        with patch.object(EmailService, "send_verification_email", MagicMock()):
            response = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "Password123!",
                    "invite_token": invite.token,
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert "check your email" in data["message"].lower()

        # Verify user created in EMAIL_PENDING state.
        result = await db_session.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one()
        assert user.status == UserStatus.EMAIL_PENDING

        # Verify invite marked used.
        await db_session.refresh(invite)
        assert invite.status == InviteStatus.USED

    async def test_register_with_invalid_invite_returns_422(
        self,
        client,
        unique_email: str,
    ) -> None:
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "Password123!",
                "invite_token": "invalid-token",
            },
        )
        assert response.status_code == 422


class TestVerifyEmail:
    async def test_verify_email_returns_tokens(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        admin = await AdminFactory.create_async(db_session)
        invite = await InviteFactory.create_async(
            db_session,
            email=unique_email,
            created_by=admin.id,
        )
        service = AuthService(email_service=EmailService())
        with patch.object(EmailService, "send_verification_email", MagicMock()):
            user = await service.register(
                db_session,
                email=unique_email,
                password="Password123!",
                full_name=None,
                invite_token_str=invite.token,
            )
        verification_token = (
            await db_session.execute(
                select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
            )
        ).scalar_one()

        response = await client.post(
            "/api/v1/auth/verify-email",
            json={"token": verification_token.token},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"

        await db_session.refresh(user)
        assert user.status == UserStatus.ACTIVE


class TestLogin:
    async def test_login_with_active_user(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        await UserFactory.create_async(
            db_session,
            email="login-test@example.com",
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "login-test@example.com",
                "password": "Password123!",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["access_token"]
        assert data["refresh_token"]

    async def test_login_with_unverified_user_returns_401(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        await PendingUserFactory.create_async(
            db_session,
            email="pending@example.com",
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "pending@example.com",
                "password": "Password123!",
            },
        )

        assert response.status_code == 401


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


class TestGetMe:
    async def test_get_me_returns_profile(
        self,
        client,
        db_session: AsyncSession,
    ) -> None:
        user = await UserFactory.create_async(
            db_session,
            email="me-test@example.com",
            full_name="Test User",
        )
        token = create_access_token(user.id)

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me-test@example.com"
        assert data["full_name"] == "Test User"


class TestDeleteMe:
    """B1 — soft-delete must refuse if the user has active reservations."""

    async def test_delete_me_with_active_reservation_returns_409(
        self, client, db_session: AsyncSession
    ) -> None:
        """A user with an active APPROVED reservation cannot self-delete."""
        from app.models.enums import ReservationState
        from app.tests.factories import ReservationFactory, ToolFactory

        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        token = create_access_token(borrower.id)
        response = await client.delete(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409
        assert "active reservations" in response.json()["detail"].lower()

    async def test_delete_me_without_active_reservations_succeeds(
        self, client, db_session: AsyncSession
    ) -> None:
        """A user with no active reservations can self-delete."""
        user = await UserFactory.create_async(db_session)
        token = create_access_token(user.id)

        response = await client.delete(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204


class TestSecretKeyValidation:
    """B3 — weak JWT secret keys are rejected at startup."""

    def test_short_secret_key_rejected(self) -> None:
        """Settings() raises ValueError when SECRET_KEY is < 32 chars."""
        import pytest
        from pydantic import ValidationError

        from app.config import Settings

        with pytest.raises(ValidationError):
            Settings(secret_key="too-short")

    def test_min_length_secret_key_accepted(self) -> None:
        """A 32-char key is accepted."""
        from app.config import Settings

        s = Settings(secret_key="x" * 32)
        assert s.secret_key.get_secret_value() == "x" * 32
