"""Rate-limiter regression tests.

The limiter used to seed a fresh bucket from the monotonic clock, so on a
recently-booted machine (uptime < limit/window) the FIRST request for a key
was rejected with 429. These tests pin correct token-bucket semantics:
new buckets start full; exhaustion happens only after `limit` rapid calls;
tokens refill as wall-time passes.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException

from app.security import rate_limit as rl


def fresh_key() -> str:
    return f"test:{uuid.uuid4()}"


def test_new_bucket_starts_full_first_request_allowed():
    """Regression: a fresh key must be allowed immediately, regardless of uptime."""
    key = fresh_key()
    rl.rate_limit(key, limit=3, window_seconds=3600)  # must NOT raise


def test_exhaustion_after_limit_rapid_calls():
    key = fresh_key()
    for _ in range(3):
        rl.rate_limit(key, limit=3, window_seconds=3600)
    with pytest.raises(HTTPException) as exc:
        rl.rate_limit(key, limit=3, window_seconds=3600)
    assert exc.value.status_code == 429
    assert exc.value.detail["error"]["code"] == "rate_limited"


def test_tokens_refill_over_time(monkeypatch):
    key = fresh_key()
    clock = [1000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: clock[0])
    for _ in range(3):
        rl.rate_limit(key, limit=3, window_seconds=3600)
    with pytest.raises(HTTPException):
        rl.rate_limit(key, limit=3, window_seconds=3600)
    # Advancing the clock by a full window refills the bucket.
    clock[0] += 3600.0
    rl.rate_limit(key, limit=3, window_seconds=3600)  # must NOT raise


def test_refill_is_gradual_not_instant(monkeypatch):
    key = fresh_key()
    clock = [2000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: clock[0])
    for _ in range(2):
        rl.rate_limit(key, limit=2, window_seconds=1000)
    with pytest.raises(HTTPException):
        rl.rate_limit(key, limit=2, window_seconds=1000)
    # Half a window later exactly one token has refilled: one call OK, next 429.
    clock[0] += 500.0
    rl.rate_limit(key, limit=2, window_seconds=1000)
    with pytest.raises(HTTPException):
        rl.rate_limit(key, limit=2, window_seconds=1000)
