"""User Story 2 — Verify Email Address."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification import EmailVerificationToken
from app.models.user import User
from app.services.email import EmailService
from app.tests.acceptance.helpers import invite_email, make_admin, register_and_verify, unique_email

pytestmark = pytest.mark.acceptance


class TestScenario1VerifyWithValidToken:
    async def test_account_activated_and_logged_in(self, client, db_session: AsyncSession) -> None:
        from sqlalchemy import select

        from app.models.enums import UserStatus
        from app.models.user import User

        admin = await make_admin(db_session)
        email = unique_email()
        token = await invite_email(db_session, email, admin)

        with patch.object(EmailService, "send_verification_email", MagicMock()):
            await client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "Password123!",  # pragma: allowlist secret
                    "invite_token": token,
                },
            )

        user = (
            await db_session.execute(select(User).where(User.email == email.lower()))
        ).scalar_one()
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
        assert data["access_token"] and data["refresh_token"]

        await db_session.refresh(user)
        assert user.status == UserStatus.ACTIVE
        # "Redirected to profile setup page" is a frontend routing concern,
        # not independently API-testable; verified via the frontend E2E flow.


class TestScenario2VerifyWithExpiredOrInvalidToken:
    async def test_invalid_token_returns_4xx_with_resend_option(self, client) -> None:
        response = await client.post(
            "/api/v1/auth/verify-email",
            json={"token": uuid.uuid4().hex},
        )
        assert 400 <= response.status_code < 500
        assert response.json().get("resend_available") is True

    async def test_expired_token_returns_4xx_with_resend_option(
        self, client, db_session: AsyncSession
    ) -> None:
        from app.tests.factories import PendingUserFactory

        user = await PendingUserFactory.create_async(db_session)
        expired = EmailVerificationToken(
            user_id=user.id,
            expires_at=datetime.now(UTC) - timedelta(hours=1),
        )
        db_session.add(expired)
        await db_session.flush()

        response = await client.post(
            "/api/v1/auth/verify-email",
            json={"token": expired.token},
        )
        assert 400 <= response.status_code < 500
        assert response.json().get("resend_available") is True


class TestScenario3ResendVerificationEmail:
    """POST /api/v1/auth/resend-verification.

    Always returns 200 (no account-enumeration leak) regardless of whether
    the email exists; only an EMAIL_PENDING account actually gets a new
    token and email.
    """

    async def test_resend_issues_new_token_and_invalidates_old(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        email = unique_email()
        token = await invite_email(db_session, email, admin)

        with patch.object(EmailService, "send_verification_email", MagicMock()):
            await client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "Password123!",  # pragma: allowlist secret
                    "invite_token": token,
                },
            )

        user = (
            await db_session.execute(select(User).where(User.email == email.lower()))
        ).scalar_one()
        old_token = (
            await db_session.execute(
                select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
            )
        ).scalar_one()

        with patch.object(EmailService, "send_verification_email", MagicMock()) as mock_send:
            response = await client.post(
                "/api/v1/auth/resend-verification",
                json={"email": email},
            )

        assert response.status_code == 200
        mock_send.assert_called_once()

        await db_session.refresh(old_token)
        assert old_token.expires_at <= datetime.now(UTC)

        tokens = (
            (
                await db_session.execute(
                    select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
                )
            )
            .scalars()
            .all()
        )
        assert len(tokens) == 2, "expect the original (now-expired) token plus a fresh one"

    async def test_resend_for_unknown_email_returns_200_without_sending(self, client) -> None:
        with patch.object(EmailService, "send_verification_email", MagicMock()) as mock_send:
            response = await client.post(
                "/api/v1/auth/resend-verification",
                json={"email": "nobody-resend-us2@example.com"},
            )

        assert response.status_code == 200
        mock_send.assert_not_called()

    async def test_resend_for_already_active_user_is_a_noop(
        self, client, db_session: AsyncSession
    ) -> None:
        email = unique_email()
        await register_and_verify(client, db_session, email=email)

        with patch.object(EmailService, "send_verification_email", MagicMock()) as mock_send:
            response = await client.post(
                "/api/v1/auth/resend-verification",
                json={"email": email},
            )

        assert response.status_code == 200
        mock_send.assert_not_called()
