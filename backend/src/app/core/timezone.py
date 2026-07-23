"""HST (Hawaii Standard Time) timezone utilities.

HST is UTC-10, no daylight saving time. This module provides helpers for
converting between UTC and HST for display purposes.
"""

from datetime import UTC, datetime, timedelta

# HST is UTC-10, no DST
HST_OFFSET = timedelta(hours=-10)
HST = UTC.__class__("HST")  # type: ignore[call-arg]


def utc_to_hst(dt: datetime) -> datetime:
    """Convert a UTC datetime to HST (UTC-10).

    Args:
        dt: A timezone-aware UTC datetime.

    Returns:
        A datetime object adjusted to HST.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC) + HST_OFFSET


def hst_to_utc(dt: datetime) -> datetime:
    """Convert an HST datetime to UTC.

    Args:
        dt: A datetime in HST (assumed to be HST if naive).

    Returns:
        A timezone-aware UTC datetime.
    """
    if dt.tzinfo is None:
        # Assume the input is HST
        dt = dt.replace(tzinfo=UTC) - HST_OFFSET
    return dt.astimezone(UTC)


def normalize_hst(dt: datetime | None) -> datetime | None:
    """Normalize a datetime to HST for display.

    If the input is None, returns None. Otherwise converts to HST.

    Args:
        dt: A datetime object (timezone-aware or naive).

    Returns:
        The datetime in HST, or None if input was None.
    """
    if dt is None:
        return None
    return utc_to_hst(dt)


def format_hst(dt: datetime | None, fmt: str = "%Y-%m-%d %H:%M") -> str | None:
    """Format a datetime in HST.

    Args:
        dt: A datetime object, or None.
        fmt: The strftime format string.

    Returns:
        Formatted string in HST, or None if input was None.
    """
    if dt is None:
        return None
    normalized = normalize_hst(dt)
    if normalized is None:
        return None
    return normalized.strftime(fmt)
