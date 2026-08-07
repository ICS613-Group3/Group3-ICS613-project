"""Standalone tests for HST timezone normalization helpers.

D14: US19's HST behavior was previously tested only indirectly (via the
US13/US18 acceptance tests that happen to call ``utc_to_hst``). This
module unit-tests ``app/core/timezone.py`` directly so the conversion
contract (UTC-10, no DST, naive-input handling, round-trip) is pinned
independently of any user-story scenario.

No user story covers these helpers in isolation, so this module lives
under auxiliary/ rather than acceptance/.
"""

from datetime import UTC, datetime, timedelta

from app.core.timezone import (
    HST,
    HST_OFFSET,
    format_hst,
    hst_to_utc,
    normalize_hst,
    utc_to_hst,
)


class TestHstOffset:
    def test_hst_is_utc_minus_10(self) -> None:
        assert timedelta(hours=-10) == HST_OFFSET

    def test_hst_has_no_dst(self) -> None:
        # HST (Hawaii) does not observe daylight saving time: the offset
        # is the same in January and July.
        winter = datetime(2026, 1, 15, 12, 0, tzinfo=HST)
        summer = datetime(2026, 7, 15, 12, 0, tzinfo=HST)
        assert winter.utcoffset() == timedelta(hours=-10)
        assert summer.utcoffset() == timedelta(hours=-10)
        assert winter.utcoffset() == summer.utcoffset()


class TestUtcToHst:
    def test_converts_utc_to_hst(self) -> None:
        utc_dt = datetime(2026, 8, 6, 20, 0, tzinfo=UTC)
        hst_dt = utc_to_hst(utc_dt)
        assert hst_dt.hour == 10  # 20:00 UTC - 10h = 10:00 HST
        assert hst_dt.tzinfo == HST

    def test_naive_input_assumed_utc(self) -> None:
        naive = datetime(2026, 8, 6, 20, 0)
        hst_dt = utc_to_hst(naive)
        assert hst_dt.hour == 10
        assert hst_dt.tzinfo == HST

    def test_crosses_midnight_backwards(self) -> None:
        # 05:00 UTC = 19:00 HST the *previous* day.
        utc_dt = datetime(2026, 8, 7, 5, 0, tzinfo=UTC)
        hst_dt = utc_to_hst(utc_dt)
        assert hst_dt.day == 6
        assert hst_dt.hour == 19


class TestHstToUtc:
    def test_converts_hst_to_utc(self) -> None:
        hst_dt = datetime(2026, 8, 6, 10, 0, tzinfo=HST)
        utc_dt = hst_to_utc(hst_dt)
        assert utc_dt.hour == 20  # 10:00 HST + 10h = 20:00 UTC
        assert utc_dt.tzinfo == UTC

    def test_naive_input_assumed_hst(self) -> None:
        naive = datetime(2026, 8, 6, 10, 0)
        utc_dt = hst_to_utc(naive)
        assert utc_dt.hour == 20
        assert utc_dt.tzinfo == UTC


class TestRoundTrip:
    def test_utc_hst_utc_round_trip(self) -> None:
        original = datetime(2026, 8, 6, 20, 0, 30, tzinfo=UTC)
        assert hst_to_utc(utc_to_hst(original)) == original

    def test_hst_utc_hst_round_trip(self) -> None:
        original = datetime(2026, 8, 6, 10, 0, tzinfo=HST)
        assert utc_to_hst(hst_to_utc(original)) == original


class TestNormalizeHst:
    def test_none_returns_none(self) -> None:
        assert normalize_hst(None) is None

    def test_converts_aware_datetime(self) -> None:
        utc_dt = datetime(2026, 8, 6, 20, 0, tzinfo=UTC)
        normalized = normalize_hst(utc_dt)
        assert normalized is not None
        assert normalized.hour == 10


class TestFormatHst:
    def test_none_returns_none(self) -> None:
        assert format_hst(None) is None

    def test_formats_in_hst(self) -> None:
        utc_dt = datetime(2026, 8, 6, 20, 0, tzinfo=UTC)
        assert format_hst(utc_dt) == "2026-08-06 10:00"

    def test_custom_format(self) -> None:
        utc_dt = datetime(2026, 8, 6, 20, 0, tzinfo=UTC)
        assert format_hst(utc_dt, "%Y-%m-%d") == "2026-08-06"
