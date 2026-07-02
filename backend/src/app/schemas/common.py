"""Common response schemas."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class MessageResponse(BaseModel):
    """Generic success message response."""

    message: str


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response.

    Shared contract for every list endpoint. The generic parameter ``T`` is
    resolved at usage site (e.g. ``PaginatedResponse[ToolResponse]``).
    """

    model_config = ConfigDict(from_attributes=True)

    items: list[T]  #: List of items for the current page.
    total: int  #: Total number of items matching the query (across all pages).
    page: int  #: Current page number (1-indexed).
    page_size: int  #: Number of items per page.
    pages: int  #: Total number of pages (``ceil(total / page_size)``).
