"""Tool category request/response schemas (US28)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    """Admin creates a new tool category."""

    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)


class CategoryResponse(BaseModel):
    """A single tool category."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    created_by: UUID | None
    created_at: datetime


class CategoryListResponse(BaseModel):
    """All allowed tool categories."""

    categories: list[CategoryResponse]