"""Tests for review endpoints and lifecycle.

Covers:
  1. Create review (happy path — requires RETURNED reservation)
  2. Create review on non-RETURNED reservation (409)
  3. Create duplicate review (409 — unique constraint)
  4. Create review by non-party (403)
  5. Get reviews for a reservation
  6. Edit review within the 24-hour window
  7. Delete review within the 24-hour window
"""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token
from app.models.enums import ReservationState
from app.models.reservation import Reservation
from app.models.review import Review
from app.tests.factories import ReservationFactory, ToolFactory, UserFactory

# ── helpers ────────────────────────────────────────────────────────────────


async def _create_returned_reservation(
    db_session: AsyncSession,
    *,
    owner_email: str,
    borrower_email: str,
):
    """Create two users, a tool, and a RETURNED reservation.

    Returns (owner, borrower, tool, reservation).

    The reservation is pre-loaded with its ``tool`` relationship so the
    review service (which calls ``db.get(Reservation, …)`` and then
    accesses ``reservation.tool.owner_id``) does not hit an async
    lazy-load error.
    """
    owner = await UserFactory.create_async(db_session, email=owner_email)
    borrower = await UserFactory.create_async(db_session, email=borrower_email)
    tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

    reservation = await ReservationFactory.create_async(
        db_session,
        tool_id=tool.id,
        borrower_id=borrower.id,
        state=ReservationState.RETURNED,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=1),
    )

    # The review service requires ``returned_at`` to be set.
    reservation.returned_at = datetime.now(UTC)
    db_session.add(reservation)
    await db_session.flush()

    # Pre-load with selectinload so identity map has the relationship
    # populated when the service later does db.get(Reservation, …).
    result = await db_session.execute(
        select(Reservation)
        .where(Reservation.id == reservation.id)
        .options(selectinload(Reservation.tool))
    )
    reservation = result.scalar_one()

    return owner, borrower, tool, reservation


# ══════════════════════════════════════════════════════════════════════════
# Create
# ══════════════════════════════════════════════════════════════════════════


class TestCreateReview:
    """POST /api/v1/reservations/{reservation_id}/review"""

    async def test_create_review_happy_path(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """Borrower submits a review on a RETURNED reservation."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        token = create_access_token(borrower.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 5, "comment": "Excellent tool, very helpful!"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 201, response.text
        data = response.json()
        assert data["rating"] == 5
        assert data["comment"] == "Excellent tool, very helpful!"
        assert data["reservation_id"] == str(reservation.id)
        assert data["reviewer_id"] == str(borrower.id)
        assert data["reviewee_id"] == str(owner.id)
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    async def test_owner_can_also_review(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """Tool owner submits a review on a RETURNED reservation."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        token = create_access_token(owner.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 4, "comment": "Borrower returned it on time."},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 201, response.text
        data = response.json()
        assert data["rating"] == 4
        assert data["reviewer_id"] == str(owner.id)
        assert data["reviewee_id"] == str(borrower.id)

    async def test_create_review_non_returned_reservation(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """409 when trying to review a reservation that is not RETURNED."""
        owner = await UserFactory.create_async(db_session, email=unique_email)
        borrower = await UserFactory.create_async(
            db_session, email=f"b+{uuid.uuid4().hex[:12]}@example.com"
        )
        tool = await ToolFactory.create_async(db_session, owner_id=owner.id)

        reservation = await ReservationFactory.create_async(
            db_session,
            tool_id=tool.id,
            borrower_id=borrower.id,
            state=ReservationState.REQUESTED,  # NOT returned
            start_date=date.today(),
            end_date=date.today() + timedelta(days=1),
        )

        token = create_access_token(borrower.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 3},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 409, response.text
        detail = response.json()["detail"]
        assert "RETURNED" in detail.upper() or "completed" in detail.lower()

    async def test_create_duplicate_review(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """409 when the same reviewer tries to review the same reservation twice."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        token = create_access_token(borrower.id)

        # First review — ok
        resp1 = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp1.status_code == 201, resp1.text

        # Second review — conflict
        resp2 = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 3},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 409, resp2.text
        assert "already reviewed" in resp2.json()["detail"].lower()

    async def test_create_review_by_non_party(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """403 when a user who is not the borrower or owner tries to review."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        # Third-party user with no stake in the reservation
        stranger = await UserFactory.create_async(
            db_session, email=f"s+{uuid.uuid4().hex[:12]}@example.com"
        )
        token = create_access_token(stranger.id)

        response = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 2},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403, response.text
        detail = response.json()["detail"]
        assert "only the borrower" in detail.lower() or "owner" in detail.lower()


# ══════════════════════════════════════════════════════════════════════════
# Read
# ══════════════════════════════════════════════════════════════════════════


class TestGetReviews:
    """GET /api/v1/reservations/{reservation_id}/review"""

    async def test_get_reviews_for_reservation(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """Returns all reviews attached to a reservation."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        # Borrower submits a review
        b_token = create_access_token(borrower.id)
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 4, "comment": "Good"},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert create_resp.status_code == 201

        # Owner submits a review too (both parties)
        o_token = create_access_token(owner.id)
        create_resp2 = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 5, "comment": "Great borrower!"},
            headers={"Authorization": f"Bearer {o_token}"},
        )
        assert create_resp2.status_code == 201

        # Any authenticated user can list reviews for a reservation
        response = await client.get(
            f"/api/v1/reservations/{reservation.id}/review",
            headers={"Authorization": f"Bearer {b_token}"},
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        ratings = {r["rating"] for r in data}
        assert ratings == {4, 5}

    async def test_get_reviews_empty_reservation(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """Returns an empty list when no reviews exist yet."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        token = create_access_token(borrower.id)
        response = await client.get(
            f"/api/v1/reservations/{reservation.id}/review",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data == []


# ══════════════════════════════════════════════════════════════════════════
# Update
# ══════════════════════════════════════════════════════════════════════════


class TestUpdateReview:
    """PATCH /api/v1/reviews/{review_id}"""

    async def test_edit_review_within_24h(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """Reviewer can edit their own review within the 24-hour window."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        token = create_access_token(borrower.id)

        # Create a review
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 3, "comment": "It was ok."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201, create_resp.text
        review_id = create_resp.json()["id"]

        # Pre-load the review with its reservation relationship so that
        # the update service can access ``review.reservation.tool_id``
        # without an async lazy-load error.
        await db_session.execute(
            select(Review).where(Review.id == review_id).options(selectinload(Review.reservation))
        )

        # Edit the review
        patch_resp = await client.patch(
            f"/api/v1/reviews/{review_id}",
            json={"rating": 5, "comment": "Actually, it was great!"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert patch_resp.status_code == 200, patch_resp.text
        data = patch_resp.json()
        assert data["rating"] == 5
        assert data["comment"] == "Actually, it was great!"
        assert data["id"] == review_id

    async def test_edit_review_by_non_author(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """403 when someone other than the reviewer tries to edit."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        # Borrower creates a review
        b_token = create_access_token(borrower.id)
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 4},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert create_resp.status_code == 201, create_resp.text
        review_id = create_resp.json()["id"]

        # Pre-load for the service call
        await db_session.execute(
            select(Review).where(Review.id == review_id).options(selectinload(Review.reservation))
        )

        # Owner tries to edit the borrower's review
        o_token = create_access_token(owner.id)
        patch_resp = await client.patch(
            f"/api/v1/reviews/{review_id}",
            json={"rating": 2},
            headers={"Authorization": f"Bearer {o_token}"},
        )

        assert patch_resp.status_code == 403, patch_resp.text
        assert "only edit your own" in patch_resp.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════
# Delete
# ══════════════════════════════════════════════════════════════════════════


class TestDeleteReview:
    """DELETE /api/v1/reviews/{review_id}"""

    async def test_delete_review_within_24h(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """Reviewer can delete their own review within the 24-hour window."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        token = create_access_token(borrower.id)

        # Create a review
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 4, "comment": "Decent tool."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201, create_resp.text
        review_id = create_resp.json()["id"]

        # Pre-load the review with its reservation relationship for the
        # service's ``review.reservation.tool_id`` access.
        await db_session.execute(
            select(Review).where(Review.id == review_id).options(selectinload(Review.reservation))
        )

        # Delete
        delete_resp = await client.delete(
            f"/api/v1/reviews/{review_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert delete_resp.status_code == 204, delete_resp.text

        # Verify it's gone
        get_resp = await client.get(
            f"/api/v1/reservations/{reservation.id}/review",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_resp.status_code == 200
        assert get_resp.json() == []

    async def test_delete_review_by_non_author(
        self,
        client,
        db_session: AsyncSession,
        unique_email: str,
    ) -> None:
        """403 when someone other than the reviewer tries to delete."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        # Borrower creates a review
        b_token = create_access_token(borrower.id)
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 3},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert create_resp.status_code == 201, create_resp.text
        review_id = create_resp.json()["id"]

        # Pre-load for the service call
        await db_session.execute(
            select(Review).where(Review.id == review_id).options(selectinload(Review.reservation))
        )

        # Owner tries to delete the borrower's review
        o_token = create_access_token(owner.id)
        delete_resp = await client.delete(
            f"/api/v1/reviews/{review_id}",
            headers={"Authorization": f"Bearer {o_token}"},
        )

        assert delete_resp.status_code == 403, delete_resp.text
        assert "only delete your own" in delete_resp.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════
# My review history (R1.B US25)
# ══════════════════════════════════════════════════════════════════════════


class TestListMyReviews:
    """GET /api/v1/users/me/reviews?role=received|given"""

    async def test_received_default(
        self, client, db_session: AsyncSession, unique_email: str
    ) -> None:
        """Default role=received returns reviews left for the current user."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        # Borrower leaves a review for the owner.
        b_token = create_access_token(borrower.id)
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 5, "comment": "Great tool!"},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert create_resp.status_code == 201

        # Owner asks for their received reviews.
        o_token = create_access_token(owner.id)
        response = await client.get(
            "/api/v1/users/me/reviews",
            headers={"Authorization": f"Bearer {o_token}"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == 1
        assert data["pages"] == 1
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert item["reviewee_id"] == str(owner.id)
        assert item["reviewer_id"] == str(borrower.id)
        assert item["rating"] == 5
        assert item["comment"] == "Great tool!"

    async def test_given_returns_reviews_i_left(
        self, client, db_session: AsyncSession, unique_email: str
    ) -> None:
        """role=given returns reviews the current user has left for others."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        b_token = create_access_token(borrower.id)
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 4},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert create_resp.status_code == 201

        # Borrower asks for reviews they have given.
        response = await client.get(
            "/api/v1/users/me/reviews?role=given",
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["reviewer_id"] == str(borrower.id)
        assert data["items"][0]["reviewee_id"] == str(owner.id)

    async def test_received_and_given_dont_cross_contaminate(
        self, client, db_session: AsyncSession, unique_email: str
    ) -> None:
        """The two roles are independent queries — owner and borrower each
        see their own perspective on the same single review."""
        owner, borrower, tool, reservation = await _create_returned_reservation(
            db_session,
            owner_email=unique_email,
            borrower_email=f"b+{uuid.uuid4().hex[:12]}@example.com",
        )

        # Borrower reviews the owner.
        b_token = create_access_token(borrower.id)
        create_resp = await client.post(
            f"/api/v1/reservations/{reservation.id}/review",
            json={"rating": 3, "comment": "ok"},
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert create_resp.status_code == 201

        # From the owner's perspective, it's "received" — 1 item.
        o_token = create_access_token(owner.id)
        recv = await client.get(
            "/api/v1/users/me/reviews?role=received",
            headers={"Authorization": f"Bearer {o_token}"},
        )
        assert recv.json()["total"] == 1

        # From the owner's perspective, "given" is empty.
        given = await client.get(
            "/api/v1/users/me/reviews?role=given",
            headers={"Authorization": f"Bearer {o_token}"},
        )
        assert given.json()["total"] == 0

        # And the borrower's mirror: 1 given, 0 received.
        b_given = await client.get(
            "/api/v1/users/me/reviews?role=given",
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert b_given.json()["total"] == 1
        b_recv = await client.get(
            "/api/v1/users/me/reviews?role=received",
            headers={"Authorization": f"Bearer {b_token}"},
        )
        assert b_recv.json()["total"] == 0

    async def test_empty_history(self, client, db_session: AsyncSession, unique_email: str) -> None:
        """A user with no reviews gets an empty paginated response."""
        user = await UserFactory.create_async(db_session, email=unique_email)
        token = create_access_token(user.id)

        for role in ("received", "given"):
            response = await client.get(
                f"/api/v1/users/me/reviews?role={role}",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 0
            assert data["items"] == []
            assert data["pages"] == 1  # at least 1 page even when empty

    async def test_invalid_role_returns_422(
        self, client, db_session: AsyncSession, unique_email: str
    ) -> None:
        """role=other is rejected by FastAPI's pattern validation."""
        user = await UserFactory.create_async(db_session, email=unique_email)
        token = create_access_token(user.id)

        response = await client.get(
            "/api/v1/users/me/reviews?role=other",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    async def test_unauthenticated_returns_401(self, client, db_session: AsyncSession) -> None:
        """No Authorization header → 401."""
        response = await client.get("/api/v1/users/me/reviews")
        assert response.status_code == 401

    async def test_pagination(self, client, db_session: AsyncSession, unique_email: str) -> None:
        """Pagination works: page_size=2 of 5 reviews returns 2 items, total=5, pages=3."""
        # Create 5 distinct returned reservations, each with a review
        # from borrower → owner. So owner receives 5 reviews.
        owner = await UserFactory.create_async(db_session, email=unique_email)
        owner_token = create_access_token(owner.id)

        for _ in range(5):
            borrower = await UserFactory.create_async(
                db_session, email=f"b+{uuid.uuid4().hex[:12]}@example.com"
            )
            tool = await ToolFactory.create_async(db_session, owner_id=owner.id)
            reservation = await ReservationFactory.create_async(
                db_session,
                tool_id=tool.id,
                borrower_id=borrower.id,
                state=ReservationState.RETURNED,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
            reservation.returned_at = datetime.now(UTC)
            db_session.add(reservation)
            await db_session.flush()
            result = await db_session.execute(
                select(Reservation)
                .where(Reservation.id == reservation.id)
                .options(selectinload(Reservation.tool))
            )
            reservation = result.scalar_one()

            b_token = create_access_token(borrower.id)
            resp = await client.post(
                f"/api/v1/reservations/{reservation.id}/review",
                json={"rating": 5},
                headers={"Authorization": f"Bearer {b_token}"},
            )
            assert resp.status_code == 201

        # Page 1
        response = await client.get(
            "/api/v1/users/me/reviews?role=received&page=1&page_size=2",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == 5
        assert data["pages"] == 3
        assert len(data["items"]) == 2

        # Page 3 has just 1 item
        response = await client.get(
            "/api/v1/users/me/reviews?role=received&page=3&page_size=2",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 1
