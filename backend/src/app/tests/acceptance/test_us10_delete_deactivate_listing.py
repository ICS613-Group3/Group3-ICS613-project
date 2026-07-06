"""User Story 10 — Delete or Deactivate a Tool Listing."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1DeleteWithNoActiveReservations:
    async def test_listing_soft_deleted_removed_from_search(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.delete(
            f"/api/v1/tools/{tool['id']}", headers=auth_header(owner.id)
        )
        assert response.status_code == 204

        other = await UserFactory.create_async(db_session)
        browse = await client.get("/api/v1/tools", headers=auth_header(other.id))
        assert not any(item["id"] == tool["id"] for item in browse.json()["items"])


class TestScenario2CannotDeleteWithActiveReservations:
    async def test_delete_rejected_status_unchanged(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.delete(
            f"/api/v1/tools/{tool['id']}", headers=auth_header(owner.id)
        )
        assert response.status_code == 409

        get_response = await client.get(
            f"/api/v1/tools/{tool['id']}", headers=auth_header(owner.id)
        )
        assert get_response.status_code == 200
        assert get_response.json()["is_active"] is True


class TestScenario3OwnerSelfDeactivatesWithNoPickedUpReservation:
    async def test_listing_hidden_pending_reservations_auto_cancelled(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "No longer sharing this tool"},
            headers=auth_header(owner.id),
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.CANCELLED

        other = await UserFactory.create_async(db_session)
        browse = await client.get("/api/v1/tools", headers=auth_header(other.id))
        assert not any(item["id"] == tool["id"] for item in browse.json()["items"])


class TestScenario4OwnerCannotDeactivateWhilePickedUp:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: ToolService.deactivate_tool (app/services/tool.py) never "
        "checks for a PICKED_UP reservation before deactivating -- only the *edit* path "
        "(update_tool) has that guard. A tool currently out on loan can be deactivated.",
    )
    async def test_deactivate_rejected_while_picked_up(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.PICKED_UP,
        )

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "trying to hide it mid-loan"},
            headers=auth_header(owner.id),
        )
        assert response.status_code == 409


class TestScenario5NonOwnerCannotDeleteOrDeactivate:
    async def test_delete_returns_403(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.delete(
            f"/api/v1/tools/{tool['id']}", headers=auth_header(other.id)
        )
        assert response.status_code == 403

    async def test_deactivate_returns_403(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        other = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate",
            json={"reason": "not my tool"},
            headers=auth_header(other.id),
        )
        assert response.status_code == 403


class TestScenario6UnauthenticatedCannotDeleteOrDeactivate:
    async def test_delete_returns_401(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.delete(f"/api/v1/tools/{tool['id']}")
        assert response.status_code == 401

    async def test_deactivate_returns_401(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/deactivate", json={"reason": "x"}
        )
        assert response.status_code == 401


class TestScenario7SoftDeletedListingCannotBeReactivated:
    async def test_reactivate_on_deleted_listing_fails(
        self, client, db_session: AsyncSession
    ) -> None:
        """Structural note: reactivate is admin-only (get_current_admin_user), so
        there is no owner-facing reactivate action to test at all -- an owner who
        isn't an admin gets 403 regardless of the listing's deleted state. This
        test uses an admin who owns the tool so the deleted-state check is what's
        actually exercised; ToolService.get_tool filters out deleted_at rows even
        with active_only=False, so the result is 404 rather than the doc's specific
        "deleted listings cannot be reactivated" message -- functionally blocked,
        just via a generic not-found rather than a targeted error.
        """
        admin_owner = await UserFactory.create_async(db_session, is_admin=True)
        tool = await create_tool(client, admin_owner)
        await client.delete(f"/api/v1/tools/{tool['id']}", headers=auth_header(admin_owner.id))

        response = await client.post(
            f"/api/v1/tools/{tool['id']}/reactivate", headers=auth_header(admin_owner.id)
        )
        assert response.status_code == 404
