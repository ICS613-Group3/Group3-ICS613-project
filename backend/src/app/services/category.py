"""Category service — admin-managed tool categories (US28)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.category import Category
from app.models.tool import Tool
from app.models.user import User


class CategoryService:
    """Business logic for admin-managed tool categories (US28)."""

    async def list_categories(self, db: AsyncSession) -> list[Category]:
        """List all allowed tool categories, ordered by name."""
        result = await db.execute(
            select(Category).order_by(Category.name)
        )
        return list(result.scalars().all())

    async def create_category(
        self,
        db: AsyncSession,
        *,
        admin: User,
        name: str,
        description: str | None = None,
    ) -> Category:
        """Add a new allowed tool category.

        Raises:
          ConflictError: a category with the same name already exists.
        """
        name_stripped = name.strip()
        if not name_stripped:
            raise ValidationError("Category name is required")

        # Check for duplicates (case-insensitive to avoid confusing duplicates)
        existing = await db.execute(
            select(Category).where(
                func.lower(Category.name) == func.lower(name_stripped)
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictError(f"Category '{name_stripped}' already exists")

        category = Category(
            name=name_stripped,
            description=description,
            created_by=admin.id,
        )
        db.add(category)
        await db.flush()
        await db.refresh(category)
        return category

    async def remove_category(
        self,
        db: AsyncSession,
        *,
        category_id: uuid.UUID,
    ) -> Category:
        """Remove a category from the allowed list.

        Raises:
          NotFoundError: the category does not exist.
          ConflictError: one or more ACTIVE tool listings use this category.

        Per US28 Scenario 2: deactivated listings that used the category
        retain it for history (no cascade update needed since tools.category
        is a plain string — the category row is removed but deactivated tools
        keep their old string value).
        """
        category = await db.get(Category, category_id)
        if category is None:
            raise NotFoundError("Category not found")

        # Check for ACTIVE tools using this category
        active_count = await db.execute(
            select(func.count(Tool.id)).where(
                Tool.category == category.name,
                Tool.is_active.is_(True),
                Tool.deleted_at.is_(None),
            )
        )
        count = active_count.scalar() or 0
        if count > 0:
            raise ConflictError(
                f"Cannot remove category '{category.name}': "
                f"{count} active listing(s) are using it. "
                f"Deactivate or reassign those listings first."
            )

        await db.delete(category)
        await db.flush()
        return category

    async def validate_category_name(
        self,
        db: AsyncSession,
        *,
        name: str,
    ) -> str:
        """Validate that a category name exists in the allowed list.

        Used by ToolService when creating/updating a tool listing to ensure
        the category is in the admin-managed list.

        Returns the validated category name (stripped).
        Raises:
          ValidationError: the category is not in the allowed list.
        """
        name_stripped = name.strip()
        result = await db.execute(
            select(Category).where(Category.name == name_stripped)
        )
        if result.scalar_one_or_none() is None:
            raise ValidationError(
                f"Category '{name_stripped}' is not in the allowed categories list"
            )
        return name_stripped