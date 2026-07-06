"""User Story — Admin Invites a New Member.

Source: User Stories doc, Section 1, "Admin Invites a New Member (New Added)".
"""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.email import EmailService
from app.tests.acceptance.helpers import auth_header, make_admin, unique_email
from app.tests.factories import InviteFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminInvitesNewMember:
    """Admin invites a new member (one-click)."""

    async def test_invite_is_created_and_emailed(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        email = unique_email()

        with patch.object(EmailService, "send_invite_email", AsyncMock()) as mock_send:
            response = await client.post(
                "/api/v1/auth/invites",
                json={"email": email},
                headers=auth_header(admin.id),
            )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == email.lower()
        assert data["status"] == "sent"
        mock_send.assert_called_once()


class TestScenario2AdminViewsAllInvites:
    """Admin views all invites and their status."""

    async def test_invite_list_shows_status(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        await InviteFactory.create_async(db_session, created_by=admin.id)

        response = await client.get(
            "/api/v1/auth/invites",
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all("status" in item and "email" in item for item in data)


class TestScenario3AdminRevokesUnusedInvite:
    """Admin revokes an unused invite."""

    @pytest.mark.skip(
        reason="not implemented: no revoke-invite endpoint or AuthService.revoke_invite "
        "exists yet (auth.py only exposes GET/POST /invites)."
    )
    async def test_revoked_invite_can_no_longer_be_used(
        self, client, db_session: AsyncSession
    ) -> None:
        raise NotImplementedError


class TestScenario4CannotInviteExistingMember:
    """Cannot invite an email that already belongs to a member."""

    async def test_invite_rejected_for_existing_member_email(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        existing = await UserFactory.create_async(db_session)

        response = await client.post(
            "/api/v1/auth/invites",
            json={"email": existing.email},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()
