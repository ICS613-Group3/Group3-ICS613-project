"""Public user profile endpoint."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_member_read_only, get_db
from app.models.enums import ReservationState
from app.models.reservation import Reservation
from app.models.review import Review
from app.models.tool import Tool
from app.models.user import User
from app.schemas.tool import ToolResponse
from app.schemas.user import PublicMemberProfileResponse

router = APIRouter()


@router.get("/{member_id}", response_model=PublicMemberProfileResponse)
async def get_public_profile(
    member_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_member_read_only)],
) -> PublicMemberProfileResponse:
    """Get a member's public profile.

    Any authenticated member can view another member's public profile.
    Excludes private info (email, admin status, violation data).
    """
    # Fetch user (non-deleted only)
    result = await db.execute(select(User).where(User.id == member_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Active tools owned by this member
    tools_result = await db.execute(
        select(Tool)
        .where(
            Tool.owner_id == member_id,
            Tool.is_active.is_(True),
            Tool.deleted_at.is_(None),
        )
        .options(selectinload(Tool.photos), selectinload(Tool.owner))
        .order_by(Tool.created_at.desc())
    )
    active_tools = [ToolResponse.model_validate(t) for t in tools_result.scalars().all()]

    # Reviews where this user is the reviewee
    reviews_result = await db.execute(
        select(Review)
        .where(Review.reviewee_id == member_id)
        .options(selectinload(Review.reviewer))
        .order_by(Review.created_at.desc())
    )
    reviews_data = []
    for r in reviews_result.scalars().all():
        reviews_data.append(
            {
                "id": r.id,
                "reservation_id": r.reservation_id,
                "reviewer_id": r.reviewer_id,
                "reviewer_name": r.reviewer.full_name if r.reviewer else None,
                "rating": r.rating,
                "comment": r.comment,
                "reservation_date": str(r.reservation.start_date) if r.reservation else "",
                "created_at": r.created_at,
            }
        )

    # Aggregate: average rating
    avg_rating_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.reviewee_id == member_id)
    )
    avg_rating = avg_rating_result.scalar() or 0.0

    # Count: review count
    review_count_result = await db.execute(
        select(func.count(Review.id)).where(Review.reviewee_id == member_id)
    )
    review_count = review_count_result.scalar() or 0

    # Count: completed loans as owner (RETURNED reservations on their tools)
    completed_loans_result = await db.execute(
        select(func.count(Reservation.id))
        .join(Tool, Reservation.tool_id == Tool.id)
        .where(Tool.owner_id == member_id, Reservation.state == ReservationState.RETURNED)
    )
    completed_loans = completed_loans_result.scalar() or 0

    return PublicMemberProfileResponse(
        id=user.id,
        full_name=user.full_name,
        bio=user.bio,
        neighborhood=user.neighborhood,
        photo_url=user.photo_url,
        status=user.status,
        member_since=user.created_at,
        average_rating=round(float(avg_rating), 2),
        review_count=review_count,
        completed_loans_as_owner=completed_loans,
        damage_report_count=user.damage_reported,
        active_tools=active_tools,
        reviews=reviews_data,
    )
