"""User Story 19 — Timezone and Date Normalization for Reservations.

Update: `app/core/timezone.py` now provides real HST conversion helpers
(`utc_to_hst`, `hst_to_utc`, `normalize_hst`, `format_hst`), and
`app/services/scheduler.py` uses `utc_to_hst` to compute the grace-period and
escalation cutoffs (see User Story 18 Scenario 5, which now verifies this).
That closes the scheduler's half of this story.

The *request path* is still not HST-aware, though:

- Reservation `start_date`/`end_date` are plain `Date` columns (no time
  component at all) submitted and compared as-is
  (`app/services/reservation.py`) -- there is no HST conversion step when a
  member submits or reads reservation dates.
- `picked_up_at`/`returned_at`/etc. are stored as `datetime.now(UTC)` with no
  HST conversion applied on the way back out to the API response
  (`ReservationResponse` just serializes the raw UTC datetime).

Because overlap/date-range checks are day-granular (`Date` columns, not
`DateTime`), most of the *day-boundary* scenarios below happen to produce the
right answer regardless of server timezone, purely because there's no
time-of-day to get wrong -- but the doc's explicit requirement (store in UTC,
display in HST, evaluate "today" in HST) is not implemented as a deliberate
behavior in the request path; it's an accident of using date-only columns.
The two scenarios below that depend on real HST time-of-day handling in that
path (request-time conversion, locale-independent date display) are still
gaps.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AllSubmittedDatesNormalizedToHSTOnServer:
    @pytest.mark.skip(
        reason="not implemented: there is no HST conversion step anywhere in the "
        "request path (see module docstring) -- dates are stored and compared as "
        "plain calendar dates with no timezone tagging at all."
    )
    async def test_dates_converted_hst_to_utc_and_back(self) -> None:
        raise NotImplementedError


class TestScenario2ReservationWindowSpansFullDayInHST:
    async def test_pickup_allowed_on_start_date_regardless_of_time_of_day(
        self, client, db_session: AsyncSession
    ) -> None:
        """The day-granular Date column means pickup is allowed any time on
        start_date -- this happens to hold, but only because there's no
        time-of-day concept at all, not because HST is deliberately applied.
        """
        from app.models.enums import ReservationState
        from app.tests.factories import ReservationFactory

        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=2),
        )

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/mark-picked-up",
            headers=auth_header(borrower.id),
        )
        assert response.status_code == 200


class TestScenario3OverlapDetectionUsesDayGranularBoundaries:
    async def test_shared_boundary_day_counts_as_overlap(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        first_borrower = await UserFactory.create_async(db_session)
        second_borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        first = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=10)),
                "end_date": str(date.today() + timedelta(days=14)),
            },
            headers=auth_header(first_borrower.id),
        )
        assert first.status_code == 201

        second = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=14)),
                "end_date": str(date.today() + timedelta(days=16)),
            },
            headers=auth_header(second_borrower.id),
        )
        assert second.status_code == 409


class TestScenario4NonOverlappingRangesAccepted:
    async def test_adjacent_non_overlapping_range_accepted(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        first_borrower = await UserFactory.create_async(db_session)
        second_borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)

        first = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=1)),
                "end_date": str(date.today() + timedelta(days=5)),
            },
            headers=auth_header(first_borrower.id),
        )
        assert first.status_code == 201

        second = await client.post(
            "/api/v1/reservations",
            json={
                "tool_id": tool["id"],
                "start_date": str(date.today() + timedelta(days=6)),
                "end_date": str(date.today() + timedelta(days=10)),
            },
            headers=auth_header(second_borrower.id),
        )
        assert second.status_code == 201


class TestScenario5OneDayRentalHandledCorrectly:
    async def test_start_equals_end_accepted_as_single_day(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner)
        one_day = date.today() + timedelta(days=1)

        response = await client.post(
            "/api/v1/reservations",
            json={"tool_id": tool["id"], "start_date": str(one_day), "end_date": str(one_day)},
            headers=auth_header(borrower.id),
        )
        assert response.status_code == 201


class TestScenario6DateInputAssumedHSTRegardlessOfBrowserLocale:
    @pytest.mark.skip(
        reason="not implemented: since dates are submitted and stored as plain "
        "ISO calendar dates (YYYY-MM-DD) with no timezone component, there is no "
        "conversion to get wrong for the date *portion* -- but there is also no "
        "explicit 'these are HST dates' contract or UI note; it's untested/"
        "unspecified behavior rather than a deliberate HST guarantee."
    )
    async def test_date_only_input_has_no_locale_dependent_conversion(self) -> None:
        raise NotImplementedError
