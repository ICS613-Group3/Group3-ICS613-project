"""User Story 21 — View Reservation History."""

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1MemberViewsReservationsAsBorrower:
    async def test_borrower_role_filter_shows_own_reservations(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.get(
            "/api/v1/reservations",
            params={"role": "borrower"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert any(i["id"] == str(reservation.id) for i in items)
        listing = next(i for i in items if i["id"] == str(reservation.id))
        assert listing["state"] == "REQUESTED"
        assert listing["start_date"] and listing["end_date"]

    async def test_listing_includes_tool_name_and_owner_name(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session, full_name="Sam Rivera")
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner, name="Chainsaw")
        await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.get(
            "/api/v1/reservations",
            params={"role": "borrower"},
            headers=auth_header(borrower.id),
        )
        listing = response.json()["items"][0]
        assert listing.get("tool_name") == "Chainsaw"
        assert listing.get("owner_name") == "Sam Rivera"


class TestScenario2MemberViewsReservationsAsOwner:
    async def test_owner_role_filter_shows_reservations_on_own_listings(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.get(
            "/api/v1/reservations",
            params={"role": "owner"},
            headers=auth_header(owner.id),
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert any(i["id"] == str(reservation.id) for i in items)


class TestScenario3PastReturnedReservationsRemainVisible:
    async def test_returned_reservation_visible_to_both_parties(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC),
        )

        borrower_view = await client.get("/api/v1/reservations", headers=auth_header(borrower.id))
        owner_view = await client.get("/api/v1/reservations", headers=auth_header(owner.id))

        assert any(i["id"] == str(reservation.id) for i in borrower_view.json()["items"])
        assert any(i["id"] == str(reservation.id) for i in owner_view.json()["items"])
        matching = next(i for i in borrower_view.json()["items"] if i["id"] == str(reservation.id))
        assert matching["state"] == "RETURNED"
        assert matching["returned_at"] is not None
