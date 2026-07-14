"""Tool listing endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_admin_user,
    get_current_member,
    get_current_member_read_only,
    get_db,
)
from app.core.exceptions import PermissionDeniedError, parse_enum_or_raise
from app.models.enums import ToolCategory, ToolCondition
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.tool import (
    ToolDeactivate,
    ToolResponse,
    ToolUpdate,
)
from app.services.tool import ToolService

router = APIRouter()


# ── Create ──────────────────────────────────────────────────────────────
@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def create_tool(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
    name: Annotated[str, Form(min_length=1, max_length=255)],
    category: Annotated[str, Form()],
    condition: Annotated[str, Form()],
    description: Annotated[str | None, Form(max_length=5000)] = None,
    photos: Annotated[list[UploadFile] | None, File()] = None,
) -> ToolResponse:
    """Create a new tool listing with optional photos (multipart form)."""
    service = ToolService()
    tool = await service.create_with_photos(
        db,
        owner=current_user,
        name=name,
        description=description,
        category=ToolCategory(parse_enum_or_raise(category, ToolCategory, "category")),
        condition=ToolCondition(parse_enum_or_raise(condition, ToolCondition, "condition")),
        photos=photos,
    )
    return ToolResponse.model_validate(tool)


# ── Read ────────────────────────────────────────────────────────────────
@router.get("", response_model=PaginatedResponse[ToolResponse])
async def list_tools(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member_read_only)],
    category: Annotated[str | None, Query(description="Filter by tool category")] = None,
    search: Annotated[str | None, Query(description="Search by name or description")] = None,
    available_start: Annotated[
        str | None, Query(description="Availability start date (YYYY-MM-DD)")
    ] = None,
    available_end: Annotated[
        str | None, Query(description="Availability end date (YYYY-MM-DD)")
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ToolResponse]:
    """List active tools with optional filters.

    Excludes tools owned by the current user so members never see
    their own listings in browse/search results.
    """
    from datetime import date

    cat_enum = (
        ToolCategory(parse_enum_or_raise(category, ToolCategory, "category")) if category else None
    )
    start = date.fromisoformat(available_start) if available_start else None
    end = date.fromisoformat(available_end) if available_end else None

    service = ToolService()
    tools, total = await service.list_tools(
        db,
        category=cat_enum,
        search=search,
        available_start=start,
        available_end=end,
        exclude_owner_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    items = [ToolResponse.model_validate(t) for t in tools]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/me", response_model=PaginatedResponse[ToolResponse])
async def list_my_tools(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member_read_only)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ToolResponse]:
    """List the current user's tool listings (including inactive)."""
    service = ToolService()
    tools, total = await service.list_my_tools(
        db, owner=current_user, page=page, page_size=page_size
    )
    items = [ToolResponse.model_validate(t) for t in tools]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/admin/all", response_model=PaginatedResponse[ToolResponse])
async def admin_list_all_tools(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(get_current_admin_user)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    category: Annotated[str | None, Query(description="Filter by tool category")] = None,
    search: Annotated[str | None, Query(description="Search by name or description")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ToolResponse]:
    """Admin-only: list all tool listings (active and inactive), with filters."""
    include_active = True
    include_inactive = True
    if status_filter == "active":
        include_inactive = False
    elif status_filter == "inactive":
        include_active = False

    cat_enum = (
        ToolCategory(parse_enum_or_raise(category, ToolCategory, "category")) if category else None
    )

    service = ToolService()
    tools, total = await service.list_all_tools(
        db,
        include_active=include_active,
        include_inactive=include_inactive,
        category=cat_enum,
        search=search,
        page=page,
        page_size=page_size,
    )
    items = [ToolResponse.model_validate(t) for t in tools]
    pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(
    tool_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    # Any authenticated member can view an active tool (read-only).
    # The dependency enforces auth; ownership is not required to read.
    _current_user: Annotated[User, Depends(get_current_member_read_only)],
) -> ToolResponse:
    """Get a single active tool by ID."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id)
    return ToolResponse.model_validate(tool)


# ── Update ──────────────────────────────────────────────────────────────
@router.patch("/{tool_id}", response_model=ToolResponse)
async def update_tool(
    tool_id: uuid.UUID,
    request_data: ToolUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ToolResponse:
    """Update a tool listing (partial). Blocked if PICKED_UP."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id, active_only=False)
    updated = await service.update_tool(
        db,
        tool=tool,
        owner=current_user,
        name=request_data.name,
        description=request_data.description,
        category=request_data.category,
        condition=request_data.condition,
    )
    return ToolResponse.model_validate(updated)


# ── Delete ──────────────────────────────────────────────────────────────
@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(
    tool_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> None:
    """Soft-delete a tool. Blocked if active reservations exist."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id, active_only=False)
    await service.delete_tool(db, tool=tool, owner=current_user)


# ── Photos ──────────────────────────────────────────────────────────────
@router.post("/{tool_id}/photos", response_model=ToolResponse)
async def add_photos(
    tool_id: uuid.UUID,
    photos: Annotated[list[UploadFile], File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ToolResponse:
    """Upload photos to a tool listing (1–5 limit)."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id, active_only=False)
    if tool.owner_id != current_user.id:
        raise PermissionDeniedError("You can only manage photos on your own tools")
    await service.add_photos(db, tool=tool, files=photos)
    await db.refresh(tool, ["photos"])
    return ToolResponse.model_validate(tool)


@router.delete("/{tool_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_photo(
    tool_id: uuid.UUID,
    photo_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> None:
    """Remove a photo from a tool. Cannot remove the last photo."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id, active_only=False)
    await service.remove_photo(db, tool=tool, photo_id=photo_id, owner=current_user)


# ── Deactivate / Reactivate ─────────────────────────────────────────────
@router.post("/{tool_id}/deactivate", response_model=ToolResponse)
async def deactivate_tool(
    tool_id: uuid.UUID,
    request_data: ToolDeactivate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_member)],
) -> ToolResponse:
    """Deactivate a tool listing with reason. Auto-cancels pending reservations."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id, active_only=False)
    updated = await service.deactivate_tool(
        db, tool=tool, actor=current_user, reason=request_data.reason
    )
    return ToolResponse.model_validate(updated)


@router.post("/{tool_id}/reactivate", response_model=ToolResponse)
async def reactivate_tool(
    tool_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin_user)],
) -> ToolResponse:
    """Admin reactivates a deactivated tool listing."""
    service = ToolService()
    tool = await service.get_tool(db, tool_id=tool_id, active_only=False)
    updated = await service.reactivate_tool(db, tool=tool, admin=current_user)
    return ToolResponse.model_validate(updated)
