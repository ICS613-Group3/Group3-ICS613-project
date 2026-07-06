"""User Story 34 — Admin Views All Active Reservations.

No dedicated admin reservations-overview endpoint exists. The only
reservation-listing endpoint, `GET /api/v1/reservations`
(app/api/v1/reservations.py -> ReservationService.list_reservations),
always filters by the CALLING user's own borrower/owner relationship --
it never checks `current_user.is_admin` to grant a platform-wide view.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header, create_tool, make_admin
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1AdminViewsAllActiveReservations:
    @pytest.mark.xfail(
        strict=True,
        reason="known gap: ReservationService.list_reservations "
        "(app/services/reservation.py) has no admin-wide-view branch -- an "
        "admin calling GET /reservations only ever sees reservations where "
        "they themselves are the borrower or a tool owner, same as any member.",
    )
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

        response = await client.get("/api/v1/reservations", headers=auth_header(admin.id))

        assert response.status_code == 200
        items = response.json()["items"]
        assert any(i["id"] == str(reservation.id) for i in items)


class TestScenario2AdminFiltersReservationsByStatusMemberOrDate:
    @pytest.mark.skip(
        reason="not implemented: there is no admin reservations-overview "
        "endpoint to filter at all (see Scenario 1)."
    )
    async def test_filters_apply_to_platform_wide_view(self) -> None:
        raise NotImplementedError


class TestScenario3NonAdminCannotAccessReservationsOverview:
    @pytest.mark.skip(
        reason="not implemented: there is no separate reservations-overview "
        "page/endpoint to restrict -- GET /reservations is available to any "
        "authenticated member by design (it's their own reservation list, not "
        "an admin view), so a 403-for-non-admin check doesn't apply to it."
    )
    async def test_returns_403_for_non_admin(self) -> None:
        raise NotImplementedError
