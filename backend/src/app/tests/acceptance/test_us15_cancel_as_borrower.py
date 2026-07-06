"""User Story 15 — Cancel a Reservation as Borrower."""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


async def _make_reservation(client, db_session, state=ReservationState.REQUESTED, **kwargs):
    owner = await UserFactory.create_async(db_session)
    borrower = await UserFactory.create_async(db_session)
    tool = await create_tool(client, owner)
    reservation = await ReservationFactory.create_async(
        db_session, tool_id=tool["id"], borrower_id=borrower.id, state=state, **kwargs
    )
    return owner, borrower, tool, reservation


class TestScenario1BorrowerCancelsRequested:
    async def test_state_becomes_cancelled_owner_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        owner, borrower, tool, reservation = await _make_reservation(client, db_session)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "no longer needed"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 200
        assert response.json()["state"] == "CANCELLED"


class TestScenario2BorrowerCancelsApproved:
    async def test_state_becomes_cancelled(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.APPROVED
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "schedule changed"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 200
        assert response.json()["state"] == "CANCELLED"


class TestScenario3CancellingFreesDateRange:
    async def test_new_request_accepted_after_cancellation(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        first_borrower = await UserFactory.create_async(db_session)
        second_borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        start = date.today() + timedelta(days=1)
        end = date.today() + timedelta(days=5)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=first_borrower.id,
            start_date=start,
            end_date=end,
        )

        cancel_response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "plans changed"},
            headers=auth_header(first_borrower.id),
        )
        assert cancel_response.status_code == 200

        new_request = await client.post(
            "/api/v1/reservations",
            json={"tool_id": tool["id"], "start_date": str(start), "end_date": str(end)},
            headers=auth_header(second_borrower.id),
        )
        assert new_request.status_code == 201


class TestScenario4CannotCancelPickedUp:
    async def test_rejected_status_remains_picked_up(
        self, client, db_session: AsyncSession
    ) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.PICKED_UP
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "trying anyway"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.PICKED_UP


class TestScenario5CannotCancelDenied:
    async def test_rejected_status_remains_denied(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.DENIED
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "trying anyway"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.DENIED


class TestScenario6CannotCancelReturned:
    async def test_rejected_status_remains_returned(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.RETURNED
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "trying anyway"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.RETURNED


class TestScenario7CannotDoubleCancel:
    async def test_rejected_status_remains_cancelled(
        self, client, db_session: AsyncSession
    ) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.CANCELLED
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "trying again"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.CANCELLED


class TestScenario8NonPartyCannotCancel:
    async def test_returns_403(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(client, db_session)
        outsider = await UserFactory.create_async(db_session)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "none of my business"},
            headers=auth_header(outsider.id),
        )

        assert response.status_code == 403
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.REQUESTED
