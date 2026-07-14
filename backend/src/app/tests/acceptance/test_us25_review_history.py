"""User Story 25 — View a Member's Review History.

There is no public-profile endpoint at all: `grep` over `src/app/api/v1/` for
a route resembling `GET /users/{id}` (a public profile view) finds nothing --
`GET /users/me/reviews` (reviews.py) is self-only, and admin.py's
`/users/{user_id}/...` routes are all admin actions (deactivate/reactivate/
delete), not a public profile read. So most of this story is unimplemented,
not partially implemented.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance

_NO_PUBLIC_PROFILE_REASON = (
    "not implemented: there is no public member-profile endpoint (e.g. "
    "GET /users/{id}) anywhere in the API -- only GET /users/me/reviews "
    "(self-only) and admin user-management actions exist."
)


class TestScenario1ViewAnotherMembersPublicProfile:
    @pytest.mark.skip(reason=_NO_PUBLIC_PROFILE_REASON)
    async def test_public_profile_shows_display_name_bio_rating_listings(self) -> None:
        raise NotImplementedError


class TestScenario2ViewAllReviewsOnAnotherMembersProfile:
    @pytest.mark.skip(reason=_NO_PUBLIC_PROFILE_REASON)
    async def test_reviews_shown_with_rating_comment_reviewer_name_date(self) -> None:
        raise NotImplementedError


class TestScenario3DamageReportsAppearAsTrustSignal:
    @pytest.mark.skip(reason=_NO_PUBLIC_PROFILE_REASON)
    async def test_damage_report_visible_on_public_profile(self) -> None:
        raise NotImplementedError


class TestScenario4DeletedMembersReviewsPreserved:
    async def test_reviews_survive_reviewee_soft_deletion(
        self, client, db_session: AsyncSession
    ) -> None:
        """Account deletion is a soft delete (status=DELETED, PII anonymized,
        User row never removed -- see US7), so Review rows (FK to users.id)
        are never cascade-deleted either. This is testable at the data layer
        even without a public-profile endpoint to view them through.
        """
        from sqlalchemy import select

        from app.models.review import Review

        owner = await UserFactory.create_async(db_session)
        borrower = await UserFactory.create_async(db_session, full_name="Jordan Kim")
        tool = await create_tool(client, owner)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC),
        )

        review_response = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 5, "comment": "Great borrower"},
            headers=auth_header(owner.id),
        )
        assert review_response.status_code == 201

        delete_response = await client.delete("/api/v1/auth/me", headers=auth_header(borrower.id))
        assert delete_response.status_code == 204

        reviews = (
            (await db_session.execute(select(Review).where(Review.reviewee_id == borrower.id)))
            .scalars()
            .all()
        )
        assert len(reviews) == 1
        assert reviews[0].comment == "Great borrower"
