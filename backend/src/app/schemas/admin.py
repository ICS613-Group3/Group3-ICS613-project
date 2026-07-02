"""Admin request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AdminUserDeactivate(BaseModel):
    """Admin deactivates a user account."""

    reason: str = Field(..., min_length=1, max_length=2000)


class AdminUserDelete(BaseModel):
    """Admin hard-deletes a user account."""

    reason: str = Field(..., min_length=1, max_length=2000)


class AuditLogResponse(BaseModel):
    """Single audit log entry."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    actor_id: UUID | None
    action_type: str
    target_type: str
    target_id: UUID
    reason: str
    metadata_: dict | None = Field(None, serialization_alias="metadata")
    created_at: datetime
