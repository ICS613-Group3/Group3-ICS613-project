"""User Story 34 — Admin Views All Active Reservations.

Endpoint: GET /api/v1/admin/reservations (app/api/v1/admin.py).

Correction to prior test-suite history: earlier versions of this file
tested ``GET /api/v1/reservations`` (the member-facing endpoint in
app/api/v1/reservations.py, which is scoped to the caller's own
borrower/owner relationships) and concluded the admin-wide view didn't
exist. That was testing the wrong endpoint — ``AdminService.list_all_reservations``
(app/services/admin.py) and its route ``GET /api/v1/admin/reservations``
were already fully implemented, with state/member_id/date-range filters
and an admin-only permission gate, but had zero test coverage anywhere in
the suite.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool, make_admin
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminViewsAllActiveReservations:
    async def test_admin_sees_reservations_they_are_not_a_party_to(
        self, client, db_session: AsyncSession
    ) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.get("/api/v1/admin/reservations", headers=auth_header(admin.id))

        assert response.status_code == 200
        items = response.json()["items"]
        assert any(i["id"] == str(reservation.id) for i in items)


class TestScenario2AdminFiltersReservationsByStatusMemberOrDate:
    async def test_filter_by_state(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        requested = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,
        )
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.CANCELLED,
        )

        response = await client.get(
            "/api/v1/admin/reservations",
            params={"state": "REQUESTED"},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert any(i["id"] == str(requested.id) for i in items)
        assert all(i["state"] == "REQUESTED" for i in items)

    async def test_filter_by_member(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        borrower_a = await UserFactory.create_async(db_session)
        borrower_b = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        reservation_a = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower_a.id
        )
        reservation_b = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower_b.id,
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=32),
        )

        response = await client.get(
            "/api/v1/admin/reservations",
            params={"member_id": str(borrower_a.id)},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        ids = [i["id"] for i in response.json()["items"]]
        assert str(reservation_a.id) in ids
        assert str(reservation_b.id) not in ids

    async def test_filter_by_member_matches_tool_owner_too(
        self, client, db_session: AsyncSession
    ) -> None:
        """member_id matches either the borrower or the tool's owner."""
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.get(
            "/api/v1/admin/reservations",
            params={"member_id": str(owner.id)},
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        ids = [i["id"] for i in response.json()["items"]]
        assert str(reservation.id) in ids

    async def test_filter_by_date_range(self, client, db_session: AsyncSession) -> None:
        admin = await make_admin(db_session)
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        near = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
        )
        far = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            start_date=date.today() + timedelta(days=60),
            end_date=date.today() + timedelta(days=62),
        )

        response = await client.get(
            "/api/v1/admin/reservations",
            params={
                "date_from": str(date.today()),
                "date_to": str(date.today() + timedelta(days=10)),
            },
            headers=auth_header(admin.id),
        )

        assert response.status_code == 200
        ids = [i["id"] for i in response.json()["items"]]
        assert str(near.id) in ids
        assert str(far.id) not in ids


class TestScenario3NonAdminCannotAccessReservationsOverview:
    async def test_returns_403(self, client, db_session: AsyncSession) -> None:
        non_admin = await UserFactory.create_async(db_session)

        response = await client.get("/api/v1/admin/reservations", headers=auth_header(non_admin.id))

        assert response.status_code == 403
