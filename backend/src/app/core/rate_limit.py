"""In-memory fixed-window rate limiter.

A minimal sliding-window rate limiter used to throttle auth endpoints
(login, forgot-password, resend-verification) against credential stuffing
and email bombing. State is per-process, which is fine for a single-worker
deployment (the common case for dev / class demo); a multi-worker
deployment would need a shared store (Redis) to enforce the limit across
processes.

If a future deployment runs multiple workers behind a load balancer, swap
this implementation for a Redis-backed one with the same interface.
"""

import time
from collections import deque
from threading import Lock
from typing import Final


class RateLimiter:
    """Fixed-window rate limiter keyed by an arbitrary string (typically the client IP).

    Each key has a deque of recent request timestamps. On each ``check``:
      1. Drop timestamps older than ``window_seconds`` ago.
      2. If the deque is at or above ``max_requests``, deny.
      3. Otherwise append now and allow.

    Thread-safe (uses a single ``Lock``; fine for the per-process scale of
    FastAPI request handlers).
    """

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        if max_requests < 1:
            raise ValueError("max_requests must be >= 1")
        if window_seconds < 1:
            raise ValueError("window_seconds must be >= 1")
        self.max_requests: Final = max_requests
        self.window_seconds: Final = window_seconds
        self._buckets: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> bool:
        """Return True if the request is allowed, False if it is over the limit.

        Side effect: appends the current timestamp to the key's bucket on
        success. A denied request does NOT add a timestamp — denied
        requests should not push the recovery window further out.
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            bucket = self._buckets.setdefault(key, deque())
            # Drop expired entries from the left.
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True

    def reset(self, key: str | None = None) -> None:
        """Clear stored state. Pass a key to clear one, or no arg to clear all.

        Used by tests to keep the limiter state from leaking between cases.
        """
        with self._lock:
            if key is None:
                self._buckets.clear()
            else:
                self._buckets.pop(key, None)
