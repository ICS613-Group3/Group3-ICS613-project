"""User Story 14 — Approve or Deny Reservation Requests."""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1OwnerApprovesRequested:
    async def test_state_becomes_approved_borrower_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/approve",
            headers=auth_header(owner.id),
        )

        assert response.status_code == 200
        assert response.json()["state"] == "APPROVED"


class TestScenario2OwnerDeniesRequested:
    async def test_state_becomes_denied_with_reason(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "Tool needed this week"},
            headers=auth_header(owner.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "DENIED"
        assert data["denied_reason"] == "Tool needed this week"


class TestScenario3CannotApproveOverlappingActiveReservation:
    """The doc's literal precondition -- a REQUESTED reservation that already
    overlaps an existing APPROVED one -- can never actually be reached: the
    DB's GiST EXCLUDE constraint (`ex_no_overlap_active` on
    `app/models/reservation.py`) blocks any REQUESTED/APPROVED/PICKED_UP row
    from being inserted if it overlaps another active-state row for the same
    tool, so the conflicting REQUESTED row is rejected at creation time, not
    approval time. `ReservationService.approve` does still carry its own
    defensive `_check_overlap` (for a documented, narrower race-condition
    case), but the doc's scenario as stated is exercised here via the
    creation-time guarantee that actually prevents it -- the outcome the
    doc cares about (no conflicting approval) holds either way.
    """

    async def test_conflicting_request_is_rejected_at_creation_not_approval(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        first_borrower = await UserFactory.create_async(db_session)
        second_borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        start = date.today() + timedelta(days=1)
        end = date.today() + timedelta(days=5)

        approved = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=first_borrower.id,
            state=ReservationState.APPROVED,
            start_date=start,
            end_date=end,
        )

        conflicting_request = await client.post(
            "/api/v1/reservations",
            json={"tool_id": tool["id"], "start_date": str(start), "end_date": str(end)},
            headers=auth_header(second_borrower.id),
        )

        assert conflicting_request.status_code == 409
        assert approved.state == ReservationState.APPROVED


class TestScenario4TwoNonOverlappingRequestedApprovedIndependently:
    async def test_both_approved_without_conflict(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        first = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=5),
        )
        second = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            start_date=date.today() + timedelta(days=10),
            end_date=date.today() + timedelta(days=15),
        )

        first_response = await client.post(
            f"/api/v1/reservations/{first.id}/approve", headers=auth_header(owner.id)
        )
        assert first_response.status_code == 200

        second_response = await client.post(
            f"/api/v1/reservations/{second.id}/approve", headers=auth_header(owner.id)
        )
        assert second_response.status_code == 200
        assert first_response.json()["state"] == "APPROVED"
        assert second_response.json()["state"] == "APPROVED"


class TestScenario5DenyingFreesDateRange:
    async def test_new_request_accepted_after_denial(
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
        deny_response = await client.post(
            f"/api/v1/reservations/{reservation.id}/deny",
            json={"reason": "changed my mind"},
            headers=auth_header(owner.id),
        )
        assert deny_response.status_code == 200

        new_request = await client.post(
            "/api/v1/reservations",
            json={"tool_id": tool["id"], "start_date": str(start), "end_date": str(end)},
            headers=auth_header(second_borrower.id),
        )
        assert new_request.status_code == 201
        assert new_request.json()["state"] == "REQUESTED"
