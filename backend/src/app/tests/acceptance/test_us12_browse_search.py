"""User Story 12 — Browse and Search for Available Tools."""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1BrowseAllActiveTools:
    async def test_active_listings_show_required_fields(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session, full_name="Jamie Lee")
        await create_tool(client, owner, name="Hedge Trimmer", category="GARDEN_TOOLS")

        viewer = await UserFactory.create_async(db_session)
        response = await client.get("/api/v1/tools", headers=auth_header(viewer.id))

        assert response.status_code == 200
        items = response.json()["items"]
        listing = next(i for i in items if i["name"] == "Hedge Trimmer")
        assert listing["photos"][0]["url"]
        assert listing["owner"]["full_name"] == "Jamie Lee"
        assert listing["condition"]
        assert listing["avg_rating"] == 0.0
        assert listing["category"] == "GARDEN_TOOLS"

    @pytest.mark.skip(
        reason="not implemented: ToolResponse (app/schemas/tool.py) has no per-listing "
        "'availability status' field (e.g. currently available vs out on loan) -- only "
        "is_active exists, which reflects whether the LISTING is active, not whether the "
        "tool is presently borrowed. Also no latest_return_time field exists (see US8)."
    )
    async def test_availability_status_and_latest_return_time_shown(self) -> None:
        raise NotImplementedError


class TestScenario2SearchByNameOrKeyword:
    async def test_search_matches_name_or_description(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        await create_tool(client, owner, name="Cordless Drill", description="18V drill")
        await create_tool(client, owner, name="Lawn Mower", description="Push mower")

        viewer = await UserFactory.create_async(db_session)
        response = await client.get(
            "/api/v1/tools", params={"search": "drill"}, headers=auth_header(viewer.id)
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert all(
            "drill" in i["name"].lower() or "drill" in (i["description"] or "").lower()
            for i in items
        )
        assert any(i["name"] == "Cordless Drill" for i in items)
        assert not any(i["name"] == "Lawn Mower" for i in items)

    @pytest.mark.skip(
        reason="not implemented: ToolService.list_tools (app/services/tool.py) orders "
        "search results by created_at desc, not by textual relevance -- there is no "
        "relevance/ranking scoring between a name match and a description match."
    )
    async def test_results_sorted_by_relevance(self) -> None:
        raise NotImplementedError


class TestScenario3FilterByCategory:
    async def test_category_filter_excludes_other_categories(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        await create_tool(client, owner, name="Drill", category="POWER_TOOLS")
        await create_tool(client, owner, name="Rake", category="GARDEN_TOOLS")

        viewer = await UserFactory.create_async(db_session)
        response = await client.get(
            "/api/v1/tools",
            params={"category": "POWER_TOOLS"},
            headers=auth_header(viewer.id),
        )

        items = response.json()["items"]
        assert all(i["category"] == "POWER_TOOLS" for i in items)
        assert any(i["name"] == "Drill" for i in items)
        assert not any(i["name"] == "Rake" for i in items)


class TestScenario4FilterByDateRangeAvailability:
    async def test_listing_with_overlapping_reservation_excluded(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner, name="Pressure Washer")
        start = date.today() + timedelta(days=5)
        end = date.today() + timedelta(days=10)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=start,
            end_date=end,
        )

        viewer = await UserFactory.create_async(db_session)
        response = await client.get(
            "/api/v1/tools",
            params={
                "available_start": str(start + timedelta(days=1)),
                "available_end": str(end - timedelta(days=1)),
            },
            headers=auth_header(viewer.id),
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert not any(i["id"] == tool["id"] for i in items)

    async def test_non_overlapping_range_still_shows_listing(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session)
        tool = await create_tool(client, owner, name="Ladder")
        reserved_start = date.today() + timedelta(days=5)
        reserved_end = date.today() + timedelta(days=10)
        await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.APPROVED,
            start_date=reserved_start,
            end_date=reserved_end,
        )

        viewer = await UserFactory.create_async(db_session)
        free_start = reserved_end + timedelta(days=1)
        free_end = reserved_end + timedelta(days=3)
        response = await client.get(
            "/api/v1/tools",
            params={"available_start": str(free_start), "available_end": str(free_end)},
            headers=auth_header(viewer.id),
        )

        items = response.json()["items"]
        assert any(i["id"] == tool["id"] for i in items)


class TestScenario5ViewDetailedInformation:
    async def test_detail_view_shows_gallery_description_owner_rating(
        self, client, db_session: AsyncSession
    ) -> None:
        owner = await UserFactory.create_async(db_session)
        tool = await create_tool(
            client, owner, name="Table Saw", description="10-inch table saw", num_photos=2
        )

        viewer = await UserFactory.create_async(db_session)
        response = await client.get(f"/api/v1/tools/{tool['id']}", headers=auth_header(viewer.id))

        assert response.status_code == 200
        data = response.json()
        assert len(data["photos"]) == 2
        assert data["description"] == "10-inch table saw"
        assert data["condition"]
        assert data["category"]
        assert data["owner"]["id"] == str(owner.id)
        assert data["avg_rating"] == 0.0

    @pytest.mark.skip(
        reason="not implemented: no latest_return_time / lending_rules / notes-for-"
        "borrowers fields exist (see US8), and there is no 'upcoming availability "
        "calendar' endpoint or field -- ToolResponse exposes no reservation dates at all."
    )
    async def test_lending_rules_return_time_and_availability_calendar_shown(self) -> None:
        raise NotImplementedError
