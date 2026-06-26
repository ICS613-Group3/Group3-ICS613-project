"""Review service — submit, edit, and manage reviews after reservations."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.models.enums import ReservationState
from app.models.reservation import Reservation
from app.models.review import Review
from app.models.tool import Tool
from app.models.user import User

REVIEW_WINDOW_DAYS = 30
EDIT_WINDOW_HOURS = 24


class ReviewService:
    """Business logic for reviews and ratings."""

    async def create_review(
        self,
        db: AsyncSession,
        *,
        reviewer: User,
        reservation_id: uuid.UUID,
        rating: int,
        comment: str | None = None,
    ) -> Review:
        """Submit a review for a RETURNED reservation.

        One review per reservation per reviewer.
        30-day window from return date.
        Self-review is blocked.
        """
        reservation = await db.get(Reservation, reservation_id)
        if reservation is None:
            raise NotFoundError("Reservation not found")

        # Validate reservation state
        if reservation.state != ReservationState.RETURNED:
            raise ConflictError("You can only review a completed (RETURNED) reservation")

        # 30-day window
        if reservation.returned_at is None:
            raise ValidationError("Cannot review before the tool is returned")
        if datetime.now(UTC) - reservation.returned_at > timedelta(days=REVIEW_WINDOW_DAYS):
            raise ValidationError(
                f"Review window has closed. Must submit within {REVIEW_WINDOW_DAYS} days of return."
            )

        # Only parties can review
        is_borrower = reservation.borrower_id == reviewer.id
        is_owner = reservation.tool.owner_id == reviewer.id
        if not is_borrower and not is_owner:
            raise PermissionDeniedError("Only the borrower or tool owner can leave a review")

        # Self-review blocked
        if is_owner and reservation.borrower_id == reviewer.id:
            raise ConflictError("You cannot review yourself")

        # Determine reviewee
        reviewee_id = reservation.borrower_id if is_owner else reservation.tool.owner_id

        review = Review(
            reservation_id=reservation_id,
            reviewer_id=reviewer.id,
            reviewee_id=reviewee_id,
            rating=rating,
            comment=comment,
        )
        db.add(review)
        try:
            await db.flush()
        except IntegrityError as err:
            await db.rollback()
            raise ConflictError("You have already reviewed this reservation") from err

        await db.refresh(review)
        await self._recalculate_ratings(db, reviewee_id, reservation.tool_id)
        return review

    async def get_reviews_for_user(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Review], int]:
        """Get reviews received by a user (newest first)."""
        count_result = await db.execute(
            select(func.count(Review.id)).where(Review.reviewee_id == user_id)
        )
        total = count_result.scalar() or 0

        query = (
            select(Review)
            .where(Review.reviewee_id == user_id)
            .order_by(Review.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        reviews = list(result.scalars().all())

        return reviews, total

    async def get_review_for_reservation(
        self,
        db: AsyncSession,
        *,
        reservation_id: uuid.UUID,
    ) -> list[Review]:
        """Get all reviews for a specific reservation."""
        result = await db.execute(
            select(Review).where(Review.reservation_id == reservation_id)
        )
        return list(result.scalars().all())

    async def update_review(
        self,
        db: AsyncSession,
        *,
        review: Review,
        reviewer: User,
        rating: int | None = None,
        comment: str | None = None,
    ) -> Review:
        """Edit a review within the 24-hour window."""
        if review.reviewer_id != reviewer.id:
            raise PermissionDeniedError("You can only edit your own reviews")

        if not self._within_edit_window(review):
            raise ValidationError(
                f"Edit window has closed. Reviews can only be edited within {EDIT_WINDOW_HOURS} hours."
            )

        if rating is not None:
            review.rating = rating
        if comment is not None:
            review.comment = comment
        review.updated_at = datetime.now(UTC)

        db.add(review)
        await db.flush()
        await db.refresh(review)

        # Recalculate ratings since rating may have changed
        await self._recalculate_ratings(db, review.reviewee_id, review.reservation.tool_id)
        return review

    async def delete_review(
        self,
        db: AsyncSession,
        *,
        review: Review,
        reviewer: User,
    ) -> None:
        """Delete a review within the 24-hour window."""
        if review.reviewer_id != reviewer.id:
            raise PermissionDeniedError("You can only delete your own reviews")

        if not self._within_edit_window(review):
            raise ValidationError(
                f"Delete window has closed. Reviews can only be deleted within {EDIT_WINDOW_HOURS} hours."
            )

        reviewee_id = review.reviewee_id
        tool_id = review.reservation.tool_id

        await db.delete(review)
        await db.flush()

        await self._recalculate_ratings(db, reviewee_id, tool_id)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _within_edit_window(review: Review) -> bool:
        now = datetime.now(UTC)
        return bool((now - review.created_at) < timedelta(hours=EDIT_WINDOW_HOURS))

    @staticmethod
    async def _recalculate_ratings(
        db: AsyncSession, user_id: uuid.UUID, tool_id: uuid.UUID
    ) -> None:
        """Recalculate avg_rating/rating_count for a tool and trust_score for a user."""
        # Tool rating
        tool_result = await db.execute(
            select(
                func.coalesce(func.avg(Review.rating), 0),
                func.count(Review.id),
            )
            .join(Reservation, Review.reservation_id == Reservation.id)
            .where(Reservation.tool_id == tool_id)
        )
        avg_rating, rating_count = tool_result.one()
        tool = await db.get(Tool, tool_id)
        if tool:
            tool.avg_rating = float(avg_rating)
            tool.rating_count = rating_count
            db.add(tool)

        # User trust_score (same as average received rating)
        user_result = await db.execute(
            select(func.coalesce(func.avg(Review.rating), 0)).where(
                Review.reviewee_id == user_id
            )
        )
        trust = user_result.scalar() or 0.0
        user = await db.get(User, user_id)
        if user:
            user.trust_score = float(trust)
            db.add(user)
