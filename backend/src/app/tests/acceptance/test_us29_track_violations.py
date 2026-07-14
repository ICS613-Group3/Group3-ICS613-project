"""User Story 29 — Admin Tracks Member Listing Violations.

`User.violation_count` (app/models/user.py) exists as a column and is exposed
in `UserProfile` (app/schemas/user.py), but it is never written to anywhere
in the service layer -- confirmed by grepping the whole backend for
`violation_count` outside tests: only the model column and schema field
exist. It's a dead field. This is consistent with User Story 26/27 (report
review, which would be what increments it) being entirely unimplemented.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.tests.acceptance.helpers import auth_header
from app.tests.factories import UserFactory

pytestmark = pytest.mark.acceptance

_REASON = (
    "not implemented: violation tracking depends on the report-review flow "
    "(User Story 27), which doesn't exist, so violation_count is never "
    "incremented anywhere -- there is no moderation-profile view either."
)


class TestScenario1AdminViewsMemberViolationCount:
    @pytest.mark.skip(reason=_REASON)
    async def test_moderation_profile_shows_violation_history(self) -> None:
        raise NotImplementedError


class TestScenario2ViolationCountIncreasesAfterConfirmedViolation:
    @pytest.mark.skip(reason=_REASON)
    async def test_count_increments_on_valid_report(self) -> None:
        raise NotImplementedError


class TestScenario3InvalidReportDoesNotIncreaseCount:
    @pytest.mark.skip(reason=_REASON)
    async def test_count_unchanged_on_invalid_report(self) -> None:
        raise NotImplementedError


class TestScenario4MemberWithNoViolationsShowsZero:
    async def test_new_member_violation_count_defaults_to_zero(
        self, client, db_session: AsyncSession
    ) -> None:
        """The one part of this story that IS observable: the column defaults
        to 0 and is exposed on the member's own profile (there's no admin-
        facing moderation-profile view to check it from the admin's side)."""
        user = await UserFactory.create_async(db_session)

        response = await client.get("/api/v1/auth/me", headers=auth_header(user.id))

        assert response.status_code == 200
        assert response.json()["violation_count"] == 0
