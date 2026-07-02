"""Tool request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import DeactivationActor, ToolCategory, ToolCondition


class PhotoOut(BaseModel):
    """Photo in a tool response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    url: str
    display_order: int


class OwnerSummary(BaseModel):
    """Minimal owner info embedded in tool responses.

    Per User Story 12 (browse + detail), each listing shows the owner's
    name and the detail view shows an owner profile link / photo.
    Kept narrow (no email, no PII) for list-view safety.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None
    photo_url: str | None


class ToolUpdate(BaseModel):
    """Update an existing tool listing (partial)."""

    name: str | None = None
    description: str | None = None
    category: ToolCategory | None = None
    condition: ToolCondition | None = None


class ToolResponse(BaseModel):
    """Public tool listing view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    owner: OwnerSummary
    name: str
    description: str | None
    category: ToolCategory
    condition: ToolCondition
    is_active: bool
    deactivated_by: DeactivationActor | None = None
    deactivated_at: datetime | None = None
    deactivation_reason: str | None = None
    avg_rating: float
    rating_count: int
    photos: list[PhotoOut] = []
    created_at: datetime
    updated_at: datetime


class ToolDeactivate(BaseModel):
    """Deactivate a tool listing."""

    reason: str
