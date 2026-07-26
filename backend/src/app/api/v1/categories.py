"""Tool category endpoints (US28)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_current_member_read_only, get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryListResponse, CategoryResponse
from app.services.category import CategoryService

router = APIRouter()


# ── List categories (all members, read-only) ──────────────────────────
@router.get("", response_model=CategoryListResponse)
async def list_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_member_read_only)],
) -> CategoryListResponse:
    """List all allowed tool categories.

    Any authenticated member (including suspended) can view the category
    list — it populates the listing-creation dropdown.
    """
    service = CategoryService()
    categories = await service.list_categories(db)
    return CategoryListResponse(categories=[CategoryResponse.model_validate(c) for c in categories])


# ── Admin: add a new category (US28 Scenario 1) ────────────────────────
@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    request_data: CategoryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin_user)],
) -> CategoryResponse:
    """Admin-only: add a new allowed tool category (US28 Scenario 1).

    Records the admin ID and timestamp.
    """
    service = CategoryService()
    category = await service.create_category(
        db,
        admin=admin,
        name=request_data.name,
        description=request_data.description,
    )
    return CategoryResponse.model_validate(category)


# ── Admin: remove a category (US28 Scenarios 2 & 3) ─────────────────────
@router.delete(
    "/{category_id}",
    status_code=status.HTTP_200_OK,
)
async def remove_category(
    category_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(get_current_admin_user)],
) -> dict:
    """Admin-only: remove a category from the allowed list (US28 Scenarios 2 & 3).

    Blocked if ACTIVE tool listings use the category.
    Deactivated listings retain the old category string for history.
    """
    service = CategoryService()
    category = await service.remove_category(db, category_id=category_id)
    return {"message": f"Category '{category.name}' removed successfully"}
