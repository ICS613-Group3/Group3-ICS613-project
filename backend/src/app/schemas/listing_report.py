"""Listing report request/response schemas (US26/US27)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ReportReason, ReportStatus


class ReportCreate(BaseModel):
    """Member submits a report against a tool listing."""

    reason: ReportReason
    comment: str | None = Field(None, max_length=2000)


class ReportResolve(BaseModel):
    """Admin resolves a pending report."""

    # True = report is valid (listing deactivated + reservations auto-cancelled)
    # False = report is invalid (listing stays)
    valid: bool
    note: str | None = Field(None, max_length=2000)


class ReportResponse(BaseModel):
    """Single listing report view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tool_id: UUID
    tool_name: str | None = None
    reporter_id: UUID
    reporter_name: str | None = None
    reason: str
    comment: str | None
    status: ReportStatus
    resolved_by: UUID | None = None
    resolver_name: str | None = None
    resolved_at: datetime | None = None
    resolution_note: str | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _extract_names(cls, data):
        """Extract display names from ORM relationships before validation."""
        if isinstance(data, dict):
            return data
        try:
            from types import SimpleNamespace

            ns_data = {}
            for col in data.__class__.__table__.columns:
                ns_data[col.name] = getattr(data, col.name)

            tool = getattr(data, "tool", None)
            if tool is not None:
                ns_data["tool_name"] = getattr(tool, "name", None)
            reporter = getattr(data, "reporter", None)
            if reporter is not None:
                ns_data["reporter_name"] = getattr(reporter, "full_name", None) or getattr(
                    reporter, "email", None
                )
            resolver = getattr(data, "resolver", None)
            if resolver is not None:
                ns_data["resolver_name"] = getattr(resolver, "full_name", None) or getattr(
                    resolver, "email", None
                )
            return SimpleNamespace(**ns_data)
        except Exception:
            pass
        return data
