"""Reservation message request/response schemas (US22)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    """Send a message in a reservation thread."""

    body: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    """Single message in a reservation thread."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    sender_id: UUID
    sender_name: str | None = None
    body: str
    created_at: datetime

    @classmethod
    def from_orm_with_sender_name(cls, msg) -> "MessageResponse":
        """Build response, extracting sender display name from the ORM relationship."""
        sender_name = None
        if msg.sender is not None:
            sender_name = msg.sender.full_name or msg.sender.email
        return cls(
            id=msg.id,
            reservation_id=msg.reservation_id,
            sender_id=msg.sender_id,
            sender_name=sender_name,
            body=msg.body,
            created_at=msg.created_at,
        )
