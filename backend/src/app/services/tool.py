"""Tool service — CRUD, photo management, deactivation/reactivation."""

import uuid
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

from fastapi import UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.models.enums import (
    CancellerType,
    DeactivationActor,
    ReservationState,
    ToolCategory,
    ToolCondition,
)
from app.models.photo import Photo
from app.models.reservation import Reservation
from app.models.tool import Tool
from app.models.user import User
from app.services.admin import AdminService
from app.services.photo_storage import MAX_PHOTOS_PER_TOOL, PhotoStorageService

if TYPE_CHECKING:
    pass


class ToolService:
    """Business logic for tool listings."""

    def __init__(self, photo_storage: PhotoStorageService | None = None) -> None:
        self.photo_storage = photo_storage or PhotoStorageService()

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    async def create_tool(
        self,
        db: AsyncSession,
        *,
        owner: User,
        name: str,
        description: str | None,
        category: ToolCategory,
        condition: ToolCondition,
    ) -> Tool:
        """Create a new tool listing."""
        tool = Tool(
            owner_id=owner.id,
            name=name.strip(),
            description=description,
            category=category,
            condition=condition,
            is_active=True,
        )
        db.add(tool)
        await db.flush()
        await db.refresh(tool)
        return tool

    async def add_photos(
        self,
        db: AsyncSession,
        *,
        tool: Tool,
        files: list[UploadFile],
    ) -> list[Photo]:
        """Upload photos to a tool listing. Enforces 1–5 limit."""
        current_count = await self._photo_count(db, tool.id)
        if current_count + len(files) > MAX_PHOTOS_PER_TOOL:
            raise ValidationError(
                f"Maximum {MAX_PHOTOS_PER_TOOL} photos per tool. "
                f"Currently {current_count}, adding {len(files)} would exceed the limit."
            )
        # Determine the next display order
        max_order_result = await db.execute(
            select(func.max(Photo.display_order)).where(Photo.tool_id == tool.id)
        )
        next_order = (max_order_result.scalar() or 0) + 1

        photos: list[Photo] = []
        for file in files:
            content = await file.read()
            content_type = file.content_type
            # Magic-byte validation: confirms the file contents actually match
            # the declared content-type, blocking header-spoofing attacks.
            PhotoStorageService.validate_image(content_type, len(content), content=content)

            url = await self.photo_storage.save(content, content_type or "image/jpeg")
            photo = Photo(
                tool_id=tool.id,
                url=url,
                display_order=next_order,
            )
            db.add(photo)
            photos.append(photo)
            next_order += 1

        await db.flush()
        return photos

    async def create_with_photos(
        self,
        db: AsyncSession,
        *,
        owner: User,
        name: str,
        description: str | None,
        category: ToolCategory,
        condition: ToolCondition,
        photos: list[UploadFile] | None = None,
    ) -> Tool:
        """Create a tool listing and optionally upload photos in one call."""
        tool = await self.create_tool(
            db,
            owner=owner,
            name=name,
            description=description,
            category=category,
            condition=condition,
        )
        if photos:
            await self.add_photos(db, tool=tool, files=photos)
        # Refresh the owner relationship so ToolResponse can serialize it
        # without a lazy load (which would fail under async).
        await db.refresh(tool, ["photos", "owner"])
        return tool

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    async def get_tool(
        self, db: AsyncSession, *, tool_id: uuid.UUID, active_only: bool = True
    ) -> Tool:
        """Fetch a tool by id. Raises NotFoundError if missing/deleted/inactive."""
        query = (
            select(Tool)
            .where(Tool.id == tool_id, Tool.deleted_at.is_(None))
            .options(selectinload(Tool.photos), selectinload(Tool.owner))
        )
        if active_only:
            query = query.where(Tool.is_active.is_(True))
        result = await db.execute(query)
        tool = result.scalar_one_or_none()
        if tool is None:
            raise NotFoundError("Tool not found")
        return tool

    async def list_tools(
        self,
        db: AsyncSession,
        *,
        category: ToolCategory | None = None,
        search: str | None = None,
        available_start: date | None = None,
        available_end: date | None = None,
        exclude_owner_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Tool], int]:
        """List active tools with optional filters and pagination.

        When ``exclude_owner_id`` is provided, tools owned by that user
        are filtered out so members never see their own listings in
        browse/search results.
        """
        query = select(Tool).where(
            Tool.is_active.is_(True),
            Tool.deleted_at.is_(None),
        )
        count_query = select(func.count(Tool.id)).where(
            Tool.is_active.is_(True),
            Tool.deleted_at.is_(None),
        )

        if exclude_owner_id is not None:
            query = query.where(Tool.owner_id != exclude_owner_id)
            count_query = count_query.where(Tool.owner_id != exclude_owner_id)

        if category is not None:
            query = query.where(Tool.category == category)
            count_query = count_query.where(Tool.category == category)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Tool.name.ilike(search_term),
                    Tool.description.ilike(search_term),
                )
            )
            count_query = count_query.where(
                or_(
                    Tool.name.ilike(search_term),
                    Tool.description.ilike(search_term),
                )
            )

        # Date-range availability: exclude tools with overlapping active reservations
        if available_start is not None and available_end is not None:
            overlapping = (
                select(Reservation.tool_id)
                .where(
                    Reservation.tool_id == Tool.id,
                    Reservation.state.in_(
                        [ReservationState.REQUESTED, ReservationState.APPROVED, ReservationState.PICKED_UP]
                    ),
                    Reservation.start_date < available_end,
                    Reservation.end_date > available_start,
                )
                .exists()
            )
            query = query.where(~overlapping)

        # Count
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        # Load with photos and owner
        query = (
            query
            .options(selectinload(Tool.photos), selectinload(Tool.owner))
            .order_by(Tool.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        tools = list(result.scalars().unique())

        return tools, total

    async def list_my_tools(
        self,
        db: AsyncSession,
        *,
        owner: User,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Tool], int]:
        """List a member's own tools (including inactive, excluding deleted)."""
        base_where = and_(
            Tool.owner_id == owner.id,
            Tool.deleted_at.is_(None),
        )
        count_result = await db.execute(
            select(func.count(Tool.id)).where(base_where)
        )
        total = count_result.scalar() or 0

        query = (
            select(Tool)
            .where(base_where)
            .options(selectinload(Tool.photos), selectinload(Tool.owner))
            .order_by(Tool.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        tools = list(result.scalars().unique())

        return tools, total

    async def list_all_tools(
        self,
        db: AsyncSession,
        *,
        include_active: bool = True,
        include_inactive: bool = True,
        category: ToolCategory | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Tool], int]:
        """List all tools (admin view). Includes inactive and active, excludes deleted."""
        conditions = [Tool.deleted_at.is_(None)]
        if include_active and not include_inactive:
            conditions.append(Tool.is_active.is_(True))
        elif include_inactive and not include_active:
            conditions.append(Tool.is_active.is_(False))

        base_where = and_(*conditions)

        count_query = select(func.count(Tool.id)).where(base_where)
        query = select(Tool).where(base_where)

        if category is not None:
            query = query.where(Tool.category == category)
            count_query = count_query.where(Tool.category == category)

        if search:
            search_term = f"%{search}%"
            search_filter = or_(
                Tool.name.ilike(search_term),
                Tool.description.ilike(search_term),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        query = (
            query
            .options(selectinload(Tool.photos), selectinload(Tool.owner))
            .order_by(Tool.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(query)
        tools = list(result.scalars().unique())

        return tools, total

    # ------------------------------------------------------------------
    # Update
    #
    # Every mutation method that returns a Tool for serialization must call
    # db.refresh(tool, ["photos", "owner"]) after flush, so Pydantic's
    # ToolResponse.model_validate() can walk the relationships without
    # triggering a lazy load (which would raise MissingGreenlet in async).
    # ------------------------------------------------------------------
    async def update_tool(
        self,
        db: AsyncSession,
        *,
        tool: Tool,
        owner: User,
        name: str | None = None,
        description: str | None = None,
        category: ToolCategory | None = None,
        condition: ToolCondition | None = None,
    ) -> Tool:
        """Update a tool listing. Blocked if any reservation is PICKED_UP."""
        if tool.owner_id != owner.id:
            raise PermissionDeniedError("You can only edit your own tool listings")

        # Block edit when any reservation is in PICKED_UP state
        active_pickup = await db.execute(
            select(Reservation.id).where(
                Reservation.tool_id == tool.id,
                Reservation.state == ReservationState.PICKED_UP,
            ).limit(1)
        )
        if active_pickup.scalar_one_or_none() is not None:
            raise ConflictError(
                "Cannot edit a tool listing while it is currently borrowed (PICKED_UP)"
            )

        if name is not None:
            tool.name = name.strip()
        if description is not None:
            tool.description = description
        if category is not None:
            tool.category = category
        if condition is not None:
            tool.condition = condition
        tool.updated_at = datetime.now(UTC)

        db.add(tool)
        await db.flush()
        await db.refresh(tool, ["photos", "owner"])
        return tool

    # ------------------------------------------------------------------
    # Delete / Deactivate / Reactivate
    # ------------------------------------------------------------------
    async def delete_tool(
        self,
        db: AsyncSession,
        *,
        tool: Tool,
        owner: User,
    ) -> None:
        """Soft-delete a tool. Blocked if active reservations exist."""
        if tool.owner_id != owner.id:
            raise PermissionDeniedError("You can only delete your own tool listings")

        active_reservation = await db.execute(
            select(Reservation.id).where(
                Reservation.tool_id == tool.id,
                Reservation.state.in_(
                    [ReservationState.REQUESTED, ReservationState.APPROVED, ReservationState.PICKED_UP]
                ),
            ).limit(1)
        )
        if active_reservation.scalar_one_or_none() is not None:
            raise ConflictError(
                "Cannot delete a tool with active or requested reservations"
            )

        # Delete photo files from disk
        for photo in tool.photos:
            self.photo_storage.delete(photo.url)

        tool.deleted_at = datetime.now(UTC)
        tool.is_active = False
        tool.updated_at = datetime.now(UTC)
        db.add(tool)
        await db.flush()

    async def deactivate_tool(
        self,
        db: AsyncSession,
        *,
        tool: Tool,
        actor: User,
        reason: str,
    ) -> Tool:
        """Deactivate a tool listing and auto-cancel all pending reservations.

        Can be called by the tool owner or an admin.
        """
        if tool.owner_id != actor.id and not actor.is_admin:
            raise PermissionDeniedError("You cannot deactivate this tool listing")

        if not tool.is_active:
            raise ConflictError("Tool is already deactivated")

        tool.is_active = False
        tool.deactivated_by = DeactivationActor.ADMIN if actor.is_admin else DeactivationActor.OWNER
        tool.deactivated_at = datetime.now(UTC)
        tool.deactivation_reason = reason
        tool.updated_at = datetime.now(UTC)

        # Auto-cancel all REQUESTED and APPROVED reservations for this tool
        canceled_states = [ReservationState.REQUESTED, ReservationState.APPROVED]
        pending = await db.execute(
            select(Reservation).where(
                Reservation.tool_id == tool.id,
                Reservation.state.in_(canceled_states),
            )
        )
        now = datetime.now(UTC)
        for res in pending.scalars().all():
            res.state = ReservationState.CANCELLED
            res.cancelled_by_type = CancellerType.OWNER.value
            res.cancelled_reason = f"Tool deactivated: {reason}"
            res.updated_at = now
            db.add(res)

        db.add(tool)
        await db.flush()

        # R1.C checklist: every deactivate (owner OR admin) is audit-logged.
        actor_role = "admin" if actor.is_admin else "owner"
        await AdminService().record_tool_deactivation(
            db,
            actor=actor,
            tool_id=tool.id,
            reason=reason,
            actor_role=actor_role,
        )
        await db.flush()

        await db.refresh(tool, ["photos", "owner"])
        return tool

    async def reactivate_tool(
        self,
        db: AsyncSession,
        *,
        tool: Tool,
        admin: User,
    ) -> Tool:
        """Admin reactivates a deactivated tool listing."""
        if not admin.is_admin:
            raise PermissionDeniedError("Only admins can reactivate tool listings")

        if tool.is_active:
            raise ConflictError("Tool is already active")

        tool.is_active = True
        tool.deactivated_by = None
        tool.deactivated_at = None
        tool.deactivation_reason = None
        tool.updated_at = datetime.now(UTC)

        db.add(tool)
        await db.flush()

        # R1.C checklist: every reactivate is audit-logged.
        await AdminService().record_tool_reactivation(
            db,
            admin=admin,
            tool_id=tool.id,
        )
        await db.flush()

        await db.refresh(tool, ["photos", "owner"])
        return tool

    # ------------------------------------------------------------------
    # Photo management
    # ------------------------------------------------------------------
    async def remove_photo(
        self,
        db: AsyncSession,
        *,
        tool: Tool,
        photo_id: uuid.UUID,
        owner: User,
    ) -> None:
        """Remove a photo from a tool. Cannot remove the last photo."""
        if tool.owner_id != owner.id:
            raise PermissionDeniedError("You can only manage photos on your own tools")

        photo = await db.get(Photo, photo_id)
        if photo is None or photo.tool_id != tool.id:
            raise NotFoundError("Photo not found")

        current_count = await self._photo_count(db, tool.id)
        if current_count <= 1:
            raise ValidationError("Cannot remove the last photo from a tool listing")

        self.photo_storage.delete(photo.url)
        await db.delete(photo)
        await db.flush()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    async def _photo_count(db: AsyncSession, tool_id: uuid.UUID) -> int:
        result = await db.execute(
            select(func.count(Photo.id)).where(Photo.tool_id == tool_id)
        )
        return result.scalar() or 0
