"""Review endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member, get_db
from app.core.exceptions import NotFoundError
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse, ReviewUpdate
from app.services.review import ReviewService

router = APIRouter()


# ── Create ──────────────────────────────────────────────────────────────
@router.post(
    "/reservations/{reservation_id}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    reservation_id: uuid.UUID,
    request_data: ReviewCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReviewResponse:
    """Submit a review for a RETURNED reservation."""
    service = ReviewService()
    review = await service.create_review(
        db,
        reviewer=current_user,
        reservation_id=reservation_id,
        rating=request_data.rating,
        comment=request_data.comment,
    )
    return ReviewResponse.model_validate(review)


# ── Read ────────────────────────────────────────────────────────────────
@router.get(
    "/reservations/{reservation_id}/review",
    response_model=list[ReviewResponse],
)
async def get_reviews_for_reservation(
    reservation_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_member)],
) -> list[ReviewResponse]:
    """Get all reviews for a specific reservation."""
    service = ReviewService()
    reviews = await service.get_review_for_reservation(db, reservation_id=reservation_id)
    return [ReviewResponse.model_validate(r) for r in reviews]


# ── Update / Delete ────────────────────────────────────────────────────
@router.patch("/reviews/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: uuid.UUID,
    request_data: ReviewUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ReviewResponse:
    """Edit a review within the 24-hour window."""
    review = await db.get(Review, review_id)
    if review is None:
        raise NotFoundError("Review not found")
    service = ReviewService()
    updated = await service.update_review(
        db,
        review=review,
        reviewer=current_user,
        rating=request_data.rating,
        comment=request_data.comment,
    )
    return ReviewResponse.model_validate(updated)


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> None:
    """Delete a review within the 24-hour window."""
    review = await db.get(Review, review_id)
    if review is None:
        raise NotFoundError("Review not found")
    service = ReviewService()
    await service.delete_review(db, review=review, reviewer=current_user)
