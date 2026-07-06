"""User Story 18 — Auto-Cancel Overdue Pickup.

The scheduler (`app/services/scheduler.py`) runs this as an hourly APScheduler
job in production; tests run it disabled (`DISABLE_SCHEDULER=true`) so these
tests invoke `SchedulerService().auto_cancel_overdue_pickups()` directly,
patched (see `helpers.patch_scheduler_session`) to share the test's DB
session/transaction instead of opening its own connection.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.services.scheduler import SchedulerService
from app.tests.acceptance.helpers import (
    auth_header,
    create_tool,
    patch_scheduler_session,
)
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


async def _make_approved_reservation(client, db_session, *, start_days_ago: int):
    owner = await UserFactory.create_async(db_session)
    borrower = await UserFactory.create_async(db_session)
    tool = await create_tool(client, owner)
    reservation = await ReservationFactory.create_async(
        db_session,
        tool_id=tool["id"],
        borrower_id=borrower.id,
        state=ReservationState.APPROVED,
        start_date=date.today() - timedelta(days=start_days_ago),
        end_date=date.today() + timedelta(days=5),
    )
    return owner, borrower, tool, reservation


class TestScenario1AutoCancelledAfterGracePeriod:
    async def test_reservation_cancelled_both_parties_notified_dates_freed(
        self, client, db_session: AsyncSession
    ) -> None:
        from sqlalchemy import select

        from app.models.notification import Notification

        owner, borrower, tool, reservation = await _make_approved_reservation(
            client, db_session, start_days_ago=4
        )

        with patch_scheduler_session(db_session):
            await SchedulerService().auto_cancel_overdue_pickups()

        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.CANCELLED

        borrower_notifications = (
            (
                await db_session.execute(
                    select(Notification).where(Notification.user_id == borrower.id)
                )
            )
            .scalars()
            .all()
        )
        assert len(borrower_notifications) >= 1

        # Dates are freed: a new request overlapping the cancelled reservation's
        # still-future end date now succeeds (start_date itself is in the past
        # by construction and can't be resubmitted -- new requests must start
        # today or later -- so this exercises the tail end of the freed range).
        new_borrower = await UserFactory.create_async(db_session)
        new_start = reservation.end_date - timedelta(days=1)
        new_request = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(new_start),
                "end_date": str(reservation.end_date),
            },
            headers=auth_header(new_borrower.id),
        )
        assert new_request.status_code == 201

    @pytest.mark.xfail(
        strict=True,
        reason="known gap: the doc requires BOTH borrower and owner be notified of "
        "the auto-cancellation, but SchedulerService.auto_cancel_overdue_pickups "
        "(app/services/scheduler.py) only calls NotificationService for the borrower.",
    )
    async def test_owner_is_also_notified(self, client, db_session: AsyncSession) -> None:
        from sqlalchemy import select

        from app.models.notification import Notification

        owner, borrower, tool, reservation = await _make_approved_reservation(
            client, db_session, start_days_ago=4
        )

        with patch_scheduler_session(db_session):
            await SchedulerService().auto_cancel_overdue_pickups()

        owner_notifications = (
            (await db_session.execute(select(Notification).where(Notification.user_id == owner.id)))
            .scalars()
            .all()
        )
        assert len(owner_notifications) >= 1


class TestScenario2NotAutoCancelledWithinGracePeriod:
    async def test_reservation_remains_approved(self, client, db_session: AsyncSession) -> None:
        owner, borrower, tool, reservation = await _make_approved_reservation(
            client, db_session, start_days_ago=2
        )

        with patch_scheduler_session(db_session):
            await SchedulerService().auto_cancel_overdue_pickups()

        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.APPROVED


class TestScenario3PickupWithinGracePeriodPreventsAutoCancellation:
    async def test_picked_up_reservation_is_not_touched_by_job(
        self, client, db_session: AsyncSession
    ) -> None:
        owner, borrower, tool, reservation = await _make_approved_reservation(
            client, db_session, start_days_ago=2
        )

        pickup_response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers=auth_header(borrower.id),
        )
        assert pickup_response.status_code == 200

        with patch_scheduler_session(db_session):
            await SchedulerService().auto_cancel_overdue_pickups()

        await db_session.refresh(reservation)
        assert reservation.state == ReservationState.PICKED_UP


class TestScenario4AutoCancelledReservationFreesDateRange:
    async def test_new_request_for_same_dates_accepted(
        self, client, db_session: AsyncSession
    ) -> None:
        owner, borrower, tool, reservation = await _make_approved_reservation(
            client, db_session, start_days_ago=5
        )

        with patch_scheduler_session(db_session):
            await SchedulerService().auto_cancel_overdue_pickups()

        new_borrower = await UserFactory.create_async(db_session)
        new_start = reservation.end_date - timedelta(days=1)
        response = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(new_start),
                "end_date": str(reservation.end_date),
            },
            headers=auth_header(new_borrower.id),
        )
        assert response.status_code == 201
        assert response.json()["state"] == "REQUESTED"


class TestScenario5GracePeriodTimerEvaluatedInHST:
    @pytest.mark.skip(
        reason="not implemented: the codebase has zero HST-specific date/time "
        "handling anywhere (confirmed by grepping for 'HST'/'Hawaii'/'Honolulu' -- "
        "no matches outside this test suite). auto_cancel_overdue_pickups "
        "(app/services/scheduler.py) uses plain `date.today()`, which is the "
        "server's local date, not an HST-anchored calendar date. On a server not "
        "running in Hawaii time, the grace-period cutoff would be computed against "
        "the wrong 'today'. See User Story 19 for the full scope of this gap."
    )
    async def test_grace_period_uses_hst_not_server_local_time(self) -> None:
        raise NotImplementedError
