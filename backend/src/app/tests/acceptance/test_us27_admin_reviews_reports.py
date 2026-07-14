"""User Story 27 — Admin Reviews Reported Listings.

Depends entirely on User Story 26's Report model/endpoints, none of which
exist (see test_us26_report_listing.py).
"""

import pytest

pytestmark = pytest.mark.acceptance

_REASON = (
    "not implemented: depends on the Report model/endpoints from User Story "
    "26, none of which exist."
)


class TestScenario1AdminViewsPendingReportedListings:
    @pytest.mark.skip(reason=_REASON)
    async def test_pending_reports_listed_with_details(self) -> None:
        raise NotImplementedError


class TestScenario2AdminMarksReportValidAndHidesListing:
    @pytest.mark.skip(reason=_REASON)
    async def test_listing_deactivated_reservations_cancelled_owner_notified(self) -> None:
        raise NotImplementedError


class TestScenario3AdminMarksReportInvalidListingStaysActive:
    @pytest.mark.skip(reason=_REASON)
    async def test_report_resolved_invalid_listing_unaffected(self) -> None:
        raise NotImplementedError


class TestScenario4NonAdminCannotAccessReportedListingReview:
    @pytest.mark.skip(reason=_REASON)
    async def test_returns_403(self) -> None:
        raise NotImplementedError
