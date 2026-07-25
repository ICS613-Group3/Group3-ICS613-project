"""User Story 25 — View a Member's Review History.

Endpoint:
  GET /api/v1/users/{member_id}

Returns display name, bio, rating, review history, active listings,
and damage-report trust signal — matching the ADD Profile Components spec.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReservationState
from app.models.review import Review
from app.tests.acceptance.helpers import auth_header, create_tool
from app.tests.factories import ReservationFactory, UserFactory

pytestmark = pytest.mark.acceptance


class TestScenario1ViewAnotherMembersPublicProfile:
    async def test_public_profile_shows_display_name_bio_rating_listings(
        self, client, db_session: AsyncSession
    ) -> None:
        """Any authenticated member can view another member's public profile."""
        owner = await UserFactory.create_async(
            db_session, full_name="Tool Owner", bio="I love lending tools"
        )
        viewer = await UserFactory.create_async(db_session)

        # Create an active tool for the owner
        await create_tool(client, owner, name="Power Drill")

        response = await client.get(
            f"/api/v1/users/{owner.id}",
            headers=auth_header(viewer.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(owner.id)
        assert data["full_name"] == "Tool Owner"
        assert data["bio"] == "I love lending tools"
        assert data["active_tools"] is not None
        assert len(data["active_tools"]) >= 1
        assert data["active_tools"][0]["name"] == "Power Drill"


class TestScenario2ViewAllReviewsOnAnotherMembersProfile:
    async def test_reviews_shown_with_rating_comment_reviewer_name_date(
        self, client, db_session: AsyncSession
    ) -> None:
        """Public profile includes review history with rating, comment, and reviewer.

        Reviews are left by tool owners on borrowers. To see reviews on a
        profile, that user must be the borrower who was reviewed.
        """
        tool_owner = await UserFactory.create_async(db_session, full_name="Tool Owner Person")
        borrower = await UserFactory.create_async(db_session, full_name="Reviewed Borrower")
        viewer = await UserFactory.create_async(db_session)

        tool = await create_tool(client, tool_owner)
        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool["id"],
            borrower_id=borrower.id,
            state=ReservationState.RETURNED,
            returned_at=datetime.now(UTC),
        )

        # Tool owner reviews the borrower
        review_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 5, "comment": "Excellent tool, very well maintained"},
            headers=auth_header(tool_owner.id),
        )
        assert review_resp.status_code == 201

        # View the borrower's public profile (the reviewee)
        response = await client.get(
            f"/api/v1/users/{borrower.id}",
            headers=auth_header(viewer.id),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["review_count"] >= 1
        assert data["average_rating"] >= 4.0

        reviews = data["reviews"]
        assert len(reviews) >= 1
        assert reviews[0]["rating"] == 5
        assert reviews[0]["comment"] == "Excellent tool, very well maintained"
        assert reviews[0]["reviewer_name"] == "Tool Owner Person"


class TestScenario3DamageReportsAppearAsTrustSignal:
    async def test_damage_report_visible_on_public_profile(
        self, client, db_session: AsyncSession
    ) -> None:
        """Public profile includes damage_report_count as a trust signal."""
        owner = await UserFactory.create_async(db_session)
        viewer = await UserFactory.create_async(db_session)

        # Manually set damage_reported count
        owner.damage_reported = 3
        db_session.add(owner)
        await db_session.flush()

        response = await client.get(
            f"/api/v1/users/{owner.id}",
            headers=auth_header(viewer.id),
        )
        assert response.status_code == 200
        assert response.json()["damage_report_count"] == 3


class TestScenario4DeletedMembersReviewsPreserved:
    async def test_reviews_survive_reviewee_soft_deletion(
        self, client, db_session: AsyncSession
    ) -> None:
        """Account deletion is a soft delete (status=DELETED, PII anonymized,
        User row never removed -- see US7), so Review rows (FK to users.id)
        are never cascade-deleted either. This is testable at the data layer
        even without a public-profile endpoint to view them through.
        """
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
