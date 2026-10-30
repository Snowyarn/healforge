"""In-memory token-bucket rate limiter (per key). Deployment should front this with a distributed limiter."""

from __future__ import annotations

import time
from collections import defaultdict

# A bucket is (tokens_remaining, last_refill_monotonic). Unseen keys start FULL
# (standard token-bucket semantics) — never derived from the monotonic clock,
# which would make behaviour depend on machine uptime.
_BUCKETS: dict[str, tuple[float, float]] = defaultdict(lambda: (float("inf"), 0.0))
_LAST_SWEEP = [0.0]


def rate_limit(key: str, limit: float, window_seconds: float) -> None:
    """Raise HTTP 429 when the bucket for `key` is exhausted."""
    from fastapi import HTTPException

    now = time.monotonic()
    tokens, updated = _BUCKETS[key]
    if tokens == float("inf"):
        # First use of this key: the bucket starts full.
        tokens = float(limit)
    else:
        refill_rate = limit / window_seconds
        tokens = min(limit, tokens + (now - updated) * refill_rate)
    if tokens < 1.0:
        _BUCKETS[key] = (tokens, now)
        _sweep(now)
        raise HTTPException(
            status_code=429, detail={"error": {"code": "rate_limited", "message": "Too many requests — slow down."}}
        )
    _BUCKETS[key] = (tokens - 1.0, now)
    _sweep(now)


def _sweep(now: float) -> None:
    if now - _LAST_SWEEP[0] < 300:
        return
    _LAST_SWEEP[0] = now
    stale = [k for k, (_t, u) in _BUCKETS.items() if now - u > 3600]
    for k in stale:
        _BUCKETS.pop(k, None)
