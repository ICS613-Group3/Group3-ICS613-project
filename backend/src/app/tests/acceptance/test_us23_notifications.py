"""User Story 23 — Receive Notifications About Reservations."""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1OwnerNotifiedOfNewRequest:
    async def test_notification_created_on_request(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session, full_name="Pat Owner")
        borrower = await UserFactory.create_async(db_session, full_name="Alex Borrower")
        tool = await create_tool(client, owner, name="Impact Driver")

        await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=1)),
                "end_date": str(date.today() + timedelta(days=2)),
            },
            headers=auth_header(borrower.id),
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(owner.id))
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) >= 1
        assert "Alex Borrower" in items[0]["body"]

    async def test_notification_includes_tool_name(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner, name="Impact Driver")

        await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=1)),
                "end_date": str(date.today() + timedelta(days=2)),
            },
            headers=auth_header(borrower.id),
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(owner.id))
        assert "Impact Driver" in response.json()["items"][0]["body"]


class TestScenario2BorrowerNotifiedOfApprovalOrDenial:
    async def test_approval_notification_created(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        await client.post(
            f"/api/v1/reservations/{reservation.id}/approve", headers=auth_header(owner.id)
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(borrower.id))
        items = response.json()["items"]
        assert any("approved" in i["body"].lower() for i in items)

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: the approve/deny notification bodies (app/services/"
        "reservation.py) mention only the reservation's dates -- never the tool "
        "name or the owner's display name, both of which the doc requires.",
    )
    async def test_approval_notification_includes_tool_name_and_owner_name(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session, full_name="Pat Owner")
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner, name="Impact Driver")
        reservation = await ReservationFactory.create_async(
            db_session, tool_id=tool["id"], borrower_id=borrower.id
        )

        await client.post(
            f"/api/v1/reservations/{reservation.id}/approve", headers=auth_header(owner.id)
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(borrower.id))
        body = response.json()["items"][0]["body"]
        assert "Impact Driver" in body
        assert "Pat Owner" in body


class TestScenario3BothPartiesNotifiedOfPickupAndReturn:
    async def test_owner_notified_on_pickup(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        from app.models.enums import ReservationState

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=2),
        )

        await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers=auth_header(borrower.id),
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(owner.id))
        assert any("picked up" in i["body"].lower() for i in response.json()["items"])

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: ReservationService.mark_picked_up and mark_returned "
        "(app/services/reservation.py) only notify the OTHER party -- the "
        "borrower who performs the action gets no confirmation notification of "
        "their own pickup/return. The doc says 'both the borrower and owner "
        "receive in-app notifications.'",
    )
    async def test_borrower_also_notified_on_pickup(self, client, db_session: AsyncSession) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        from app.models.enums import ReservationState

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=2),
        )

        await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers=auth_header(borrower.id),
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(borrower.id))
        assert len(response.json()["items"]) >= 1


class TestScenario4UnreadNotificationBadgeCount:
    async def test_unread_count_reflects_unread_notifications(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=1)),
                "end_date": str(date.today() + timedelta(days=2)),
            },
            headers=auth_header(borrower.id),
        )

        response = await client.get("/api/v1/notifications", headers=auth_header(owner.id))
        assert response.status_code == 200
        data = response.json()
        assert data["unread_count"] >= 1

        notification_id = data["items"][0]["id"]
        mark_read = await client.post(
            f"/api/v1/notifications/{notification_id}/read", headers=auth_header(owner.id)
        )
        assert mark_read.status_code == 200
        assert mark_read.json()["read_at"] is not None

        after = await client.get("/api/v1/notifications", headers=auth_header(owner.id))
        assert after.json()["unread_count"] == data["unread_count"] - 1
