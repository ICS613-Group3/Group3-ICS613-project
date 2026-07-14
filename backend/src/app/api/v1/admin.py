"""Admin endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_db
from app.models.user import User
from app.schemas.admin import (
    AdminUserDeactivate,
    AdminUserDelete,
    AdminUserReactivate,
    AuditLogResponse,
)
from app.schemas.common import PaginatedResponse
from app.schemas.user import UserProfile
from app.services.admin import AdminService

router = APIRouter()


# ── User listing ────────────────────────────────────────────────────────
@router.get("/users", response_model=PaginatedResponse[UserProfile])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PaginatedResponse[UserProfile]:
    """Admin-only: list all non-deleted users with optional filters."""
    service = AdminService()
    users, total = await service.list_users(
        db,
        status=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )
    items = [UserProfile.model_validate(u) for u in users]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/users/{user_id}", response_model=UserProfile)
async def get_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
) -> UserProfile:
    """Admin-only: get a single user by ID."""
    user = await AdminService().get_user(db, user_id=user_id)
    return UserProfile.model_validate(user)


# ── User management ────────────────────────────────────────────────────
@router.post("/users/{user_id}/deactivate", status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: uuid.UUID,
    request_data: AdminUserDeactivate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
) -> dict:
    """Admin deactivates (suspends) a member account."""
    await AdminService().deactivate_user(
        db, admin=current_user, target_user_id=user_id, reason=request_data.reason
    )
    return {"message": "User suspended successfully"}


@router.post("/users/{user_id}/reactivate", status_code=status.HTTP_200_OK)
async def reactivate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    request_data: AdminUserReactivate = AdminUserReactivate(),
) -> dict:
    """Admin reactivates a suspended member account."""
    await AdminService().reactivate_user(
        db, admin=current_user, target_user_id=user_id, reason=request_data.reason
    )
    return {"message": "User reactivated successfully"}


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: uuid.UUID,
    request_data: AdminUserDelete,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
) -> dict:
    """Admin hard-deletes a user account."""
    await AdminService().delete_user(
        db, admin=current_user, target_user_id=user_id, reason=request_data.reason
    )
    return {"message": "User deleted successfully"}


# ── Audit log ──────────────────────────────────────────────────────────
@router.get("/audit-log", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_log(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
    action_type: Annotated[str | None, Query()] = None,
    target_type: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PaginatedResponse[AuditLogResponse]:
    """Query the admin audit log with optional filters."""
    entries, total = await AdminService().list_audit_log(
        db,
        action_type=action_type,
        target_type=target_type,
        page=page,
        page_size=page_size,
    )
    items = [AuditLogResponse.model_validate(e) for e in entries]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)
