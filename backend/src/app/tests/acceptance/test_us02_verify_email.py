"""User Story 2 — Verify Email Address."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification import EmailVerificationToken
from app.services.email import EmailService
from app.tests.acceptance.helpers import invite_email, make_admin, unique_email

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
                json={"email": email, "password": "Password123!", "invite_token": token},
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
