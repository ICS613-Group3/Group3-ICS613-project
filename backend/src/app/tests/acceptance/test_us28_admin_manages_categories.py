"""User Story 28 — Admin Manages Tool Categories.

`ToolCategory` (app/models/enums.py) is a fixed Python enum -- HAND_TOOLS,
POWER_TOOLS, GARDEN_TOOLS, CLEANING_TOOLS, OUTDOOR_GEAR -- with no DB-backed,
admin-editable list, no add/remove endpoints, and no admin/timestamp audit
trail for category changes. None of this story exists.
"""

import pytest

pytestmark = pytest.mark.acceptance

_REASON = (
    "not implemented: ToolCategory is a fixed Python enum with no admin-editable "
    "category list, no add/remove endpoints, and no category-management audit "
    "trail anywhere in the backend."
)


class TestScenario1AdminAddsNewCategory:
    @pytest.mark.skip(reason=_REASON)
    async def test_new_category_appears_in_dropdown_and_is_audited(self) -> None:
        raise NotImplementedError


class TestScenario2AdminRemovesExistingCategory:
    @pytest.mark.skip(reason=_REASON)
    async def test_category_removed_deactivated_listings_retain_it(self) -> None:
        raise NotImplementedError


class TestScenario3AdminCannotRemoveCategoryInUseByActiveListings:
    @pytest.mark.skip(reason=_REASON)
    async def test_removal_rejected_lists_active_listings(self) -> None:
        raise NotImplementedError


class TestScenario4NonAdminCannotManageCategories:
    @pytest.mark.skip(reason=_REASON)
    async def test_returns_403(self) -> None:
        raise NotImplementedError
