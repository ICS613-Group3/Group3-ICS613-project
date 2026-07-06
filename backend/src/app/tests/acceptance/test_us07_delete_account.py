"""User Story 7 — Delete Account.

Scenario numbering follows the doc exactly, including its gap: scenarios are
1, 2, 3, 5, 4 in document order (there is no missing "Scenario 4" between 3
and 5 -- the doc's own numbering jumps).
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState, UserStatus
from app.tests.acceptance.helpers import auth_header
from app.tests.factories import ReservationFactory, ToolFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1DeleteWithNoActiveReservations:
    async def test_account_soft_deleted_and_pii_removed(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(
            db_session,
            bio="my bio",
            neighborhood="Kaimuki",
            photo_url="https://example.com/p.jpg",
        )

        response = await client.delete("/api/v1/auth/me", headers=auth_header(user.id))
        assert response.status_code == 204

        await db_session.refresh(user)
        assert user.status == UserStatus.DELETED
        assert user.deleted_at is not None
        assert user.bio is None
        assert user.neighborhood is None
        assert user.photo_url is None
        assert user.email != "user+original@example.com"  # anonymized, not the real address


class TestScenario2ActiveReservationsBlockDeletion:
    async def test_active_reservation_as_borrower_blocks_deletion(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        response = await client.delete("/api/v1/auth/me", headers=auth_header(borrower.id))
        assert response.status_code == 409
        assert "active reservations" in response.json()["detail"].lower()

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: UserService.soft_delete (app/services/user.py) only checks "
        "reservations where the caller is the BORROWER. Its own docstring says 'Owners "
        "can still soft-delete' -- but the doc requires blocking deletion when the "
        "member's OWN LISTINGS have REQUESTED/APPROVED/PICKED_UP reservations on them "
        "too, so a borrower mid-loan is currently left stranded if the owner deletes.",
    )
    async def test_active_reservation_on_owned_listing_blocks_deletion(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.delete("/api/v1/auth/me", headers=auth_header(owner.id))
        assert response.status_code == 409


class TestScenario3ReservationHistoryIntegrityPreserved:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: _anonymize_user (app/services/user.py) overwrites full_name "
        "with the literal string 'Deleted User', destroying the display name entirely. "
        "The doc requires the display name be the one PII field PRESERVED, specifically "
        "so past reservation history and reviews still show who they were with.",
    )
    async def test_display_name_is_preserved_after_deletion(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(db_session, full_name="Taylor Reed")

        response = await client.delete("/api/v1/auth/me", headers=auth_header(user.id))
        assert response.status_code == 204

        await db_session.refresh(user)
        assert user.full_name == "Taylor Reed"


class TestScenario5SuspendedMemberCanStillDelete:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: DELETE /auth/me is gated by get_current_member "
        "(app/dependencies.py), which requires status == ACTIVE and raises "
        "403 PermissionDeniedError for any other status -- including SUSPENDED. "
        "The doc explicitly requires suspended members retain the ability to "
        "request account deletion.",
    )
    async def test_suspended_member_can_delete_account(
        self, client, db_session: AsyncSession
    ) -> None:
        user = await UserFactory.create_async(db_session, status=UserStatus.SUSPENDED)

        response = await client.delete("/api/v1/auth/me", headers=auth_header(user.id))
        assert response.status_code == 204


class TestScenario4DeletedAccountCannotLogIn:
    async def test_login_after_deletion_is_rejected(self, client, db_session: AsyncSession) -> None:
        user = await UserFactory.create_async(db_session, email="us7-scenario4@example.com")

        delete_response = await client.delete("/api/v1/auth/me", headers=auth_header(user.id))
        assert delete_response.status_code == 204

        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "us7-scenario4@example.com", "password": "Password123!"},
        )
        assert login_response.status_code == 401


class TestScenario4ReRegistrationRequiresConfirmation:
    @pytest.mark.skip(
        reason="not implemented: there is no explicit 'acknowledge the previous account "
        "is gone' confirmation step anywhere in the register flow. In practice, "
        "soft-delete anonymizes the email (see Scenario 1), which frees the original "
        "address for a brand-new invite+register with no special handling -- the doc's "
        "required confirmation UX does not exist."
    )
    async def test_reregistration_requires_explicit_confirmation(self) -> None:
        raise NotImplementedError
