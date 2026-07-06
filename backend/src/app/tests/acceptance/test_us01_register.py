"""User Story 1 — Register with Invite Token."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import InviteStatus, UserStatus
from app.models.user import User
from app.services.email import EmailService
from app.tests.acceptance.helpers import invite_email, make_admin, unique_email
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1RegisterWithValidInviteToken:
    async def test_account_created_email_pending_invite_used(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        email = unique_email()
        token = await invite_email(db_session, email, admin)

        with patch.object(EmailService, "send_verification_email", AsyncMock()) as mock_send:
            response = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "Password123!",
                    "full_name": "New Member",
                    "invite_token": token,
                },
            )

        assert response.status_code == 201
        assert "check your email" in response.json()["message"].lower()
        mock_send.assert_called_once()

        user = (
            await db_session.execute(select(User).where(User.email == email.lower()))
        ).scalar_one()
        assert user.status == UserStatus.EMAIL_PENDING

        from app.models.invite import InviteToken

        invite = (
            await db_session.execute(
                select(InviteToken).where(InviteToken.token == token)
            )
        ).scalar_one()
        assert invite.status == InviteStatus.USED


class TestScenario2RegisterWithInvalidOrUsedToken:
    async def test_invalid_token_is_rejected(self, client) -> None:
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email(),
                "password": "Password123!",
                "invite_token": "not-a-real-token",
            },
        )
        assert response.status_code == 422

    async def test_already_used_token_is_rejected(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        email = unique_email()
        token = await invite_email(db_session, email, admin)

        with patch.object(EmailService, "send_verification_email", AsyncMock()):
            first = await client.post(
                "/api/v1/auth/register",
                json={"email": email, "password": "Password123!", "invite_token": token},
            )
        assert first.status_code == 201

        second = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email(),
                "password": "Password123!",
                "invite_token": token,
            },
        )
        assert second.status_code == 422


class TestScenario3RegisterWithEmailAlreadyInUse:
    async def test_rejected_and_invite_token_not_consumed(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        existing = await UserFactory.create_async(db_session)
        # Invite is issued for the *existing* user's email — a data-entry
        # mistake by the admin, or a race with a separate signup.
        token = await invite_email(db_session, existing.email, admin)

        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": existing.email,
                "password": "Password123!",
                "invite_token": token,
            },
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

        from app.models.invite import InviteToken

        invite = (
            await db_session.execute(
                select(InviteToken).where(InviteToken.token == token)
            )
        ).scalar_one()
        assert invite.status == InviteStatus.SENT, "invite must remain valid for another email"
