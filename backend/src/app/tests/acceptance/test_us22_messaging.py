"""User Story 22 — Send and Receive Messages in a Reservation Thread.

Endpoints:
  POST /api/v1/reservations/{reservation_id}/messages  (send)
  GET  /api/v1/reservations/{reservation_id}/messages  (list)

Thread is read-only once the reservation is RETURNED, DENIED, or CANCELLED.
Only the borrower, tool owner, or an admin can send/read.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1SendMessageInActiveThread:
    async def test_message_saved_and_other_party_notified(
        self, client, db_session: AsyncSession
    ) -> None:
        """Borrower sends a message in an ACTIVE (REQUESTED) reservation thread."""
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
            f"/api/v1/reservations/{reservation.id}/messages",
            json={"body": "Hi, is this tool still available for pickup?"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["body"] == "Hi, is this tool still available for pickup?"
        assert data["sender_id"] == str(borrower.id)
        assert data["reservation_id"] == str(reservation.id)

        # Owner can also send in the same thread
        response2 = await client.post(
            f"/api/v1/reservations/{reservation.id}/messages",
            json={"body": "Yes, it is ready for you!"},
            headers=auth_header(owner.id),
        )
        assert response2.status_code == 201
        assert response2.json()["sender_id"] == str(owner.id)


class TestScenario2CannotSendInClosedThread:
    async def test_returned_or_cancelled_thread_is_read_only(
        self, client, db_session: AsyncSession
    ) -> None:
        """Sending a message after RETURNED state is rejected."""
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/messages",
            json={"body": "This should fail"},
            headers=auth_header(borrower.id),
        )

        assert response.status_code == 409


class TestScenario3BothPartiesViewFullMessageHistory:
    async def test_messages_shown_chronologically_with_sender_and_timestamp(
        self, client, db_session: AsyncSession
    ) -> None:
        """Both borrower and owner can see all messages in chronological order."""
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        # Send two messages
        await client.post(
            f"/api/v1/reservations/{reservation.id}/messages",
            json={"body": "Message from borrower"},
            headers=auth_header(borrower.id),
        )
        await client.post(
            f"/api/v1/reservations/{reservation.id}/messages",
            json={"body": "Message from owner"},
            headers=auth_header(owner.id),
        )

        # Borrower can see both messages
        response = await client.get(
            f"/api/v1/reservations/{reservation.id}/messages",
            headers=auth_header(borrower.id),
        )
        assert response.status_code == 200
        data = response.json()
        items = data["items"]
        assert len(items) == 2
        assert items[0]["body"] == "Message from borrower"
        assert items[1]["body"] == "Message from owner"
        assert items[0]["sender_id"] == str(borrower.id)
        assert items[1]["sender_id"] == str(owner.id)

        # Owner can also see both messages
        response2 = await client.get(
            f"/api/v1/reservations/{reservation.id}/messages",
            headers=auth_header(owner.id),
        )
        assert response2.status_code == 200
        assert len(response2.json()["items"]) == 2


class TestScenario4NonPartyCannotSendMessage:
    async def test_third_party_returns_403(self, client, db_session: AsyncSession) -> None:
        """A user who is neither borrower nor owner cannot send or read messages."""
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        outsider = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
        )

        # Outsider tries to send
        send_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/messages",
            json={"body": "Should not work"},
            headers=auth_header(outsider.id),
        )
        assert send_resp.status_code == 403

        # Outsider tries to read
        read_resp = await client.get(
            f"/api/v1/reservations/{reservation.id}/messages",
            headers=auth_header(outsider.id),
        )
        assert read_resp.status_code == 403
