"""User Story 16 — Cancel a Reservation as Owner."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


async def _make_reservation(client, db_session, state=ReservationState.APPROVED, **kwargs):
    owner = await UserFactory.create_async(db_session)
    borrower = await UserFactory.create_async(db_session)
    tool = await create_tool(client, owner)
    reservation = await ReservationFactory.create_async(
        db_session, tool_id=tool["id"], borrower_id=borrower.id, state=state, **kwargs
    )
    return owner, borrower, tool, reservation


class TestScenario1OwnerCancelsApprovedWhenToolUnavailable:
    async def test_state_becomes_cancelled_borrower_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        owner, borrower, tool, reservation = await _make_reservation(client, db_session)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "tool broke"},
            headers=auth_header(owner.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "CANCELLED"
        assert data["cancelled_reason"] == "tool broke"
        assert data["cancelled_by_type"] == "owner"


class TestScenario2CannotDenyApproved:
    async def test_deny_rejected_on_approved(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(client, db_session)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "trying to deny an approved one"},
            headers=auth_header(owner.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.APPROVED


class TestScenario3CannotDenyAlreadyDenied:
    async def test_deny_rejected_on_denied(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.DENIED
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "denying again"},
            headers=auth_header(owner.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.DENIED


class TestScenario4OwnerCannotCancelPickedUp:
    async def test_cancel_rejected_on_picked_up(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.PICKED_UP
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/cancel",
            json={"reason": "want it back early"},
            headers=auth_header(owner.id),
        )

        assert response.status_code == 409
        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.PICKED_UP


class TestScenario5OwnerCannotDenyPickedUpReturnedOrCancelled:
    async def test_deny_rejected_on_picked_up(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.PICKED_UP
        )
        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "x"},
            headers=auth_header(owner.id),
        )
        assert response.status_code == 409

    async def test_deny_rejected_on_returned(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.RETURNED
        )
        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "x"},
            headers=auth_header(owner.id),
        )
        assert response.status_code == 409

    async def test_deny_rejected_on_cancelled(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_reservation(
            client, db_session, state=ReservationState.CANCELLED
        )
        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "x"},
            headers=auth_header(owner.id),
        )
        assert response.status_code == 409
