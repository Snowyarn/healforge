"""Persisted idempotency for retried writes.

Design (reservation pattern):
1. `idempotency_begin` — called BEFORE the operation executes:
   - no Idempotency-Key header  -> no-op guard (operation runs normally)
   - key seen + same payload hash + completed -> returns the stored response (replay)
   - key seen + same payload hash + in_flight -> 409 (concurrent duplicate, retry later)
   - key seen + different payload hash          -> 409 (key reuse with different body)
   - expired record                             -> deleted, fresh execution proceeds
   - unseen key                                 -> INSERT reservation (unique constraint
     makes concurrent double-insert impossible; the loser gets 409 in_flight)
2. the operation runs
3. `idempotency_store` — persists the response + expiry on the reservation.
4. on operation failure the reservation is released so a clean retry is possible.

Scope: (user_id, workspace_id, operation, key) — identical keys under different
users/workspaces are independent. Payload hash is computed from the parsed body
(serialized deterministically) so header noise does not cause false conflicts.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import IdempotencyRecord
from ..models.base import new_id, utcnow
from ..security.sessions import AuthContext

MAX_KEY_LENGTH = 128
TTL_HOURS = 24


class IdempotencyConflict(Exception):
    """409: key reused with a different payload, or an identical request is in flight."""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass
class IdemGuard:
    key: str | None
    request_hash: str
    replay: dict | None = None  # non-None -> return this instead of executing
    replay_status: int = 0
    reservation_id: str | None = None


def _hash_payload(payload) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _lookup(db: Session, ctx: AuthContext, operation: str, key: str) -> IdempotencyRecord | None:
    return (
        db.query(IdempotencyRecord)
        .filter(
            IdempotencyRecord.user_id == ctx.user.id,
            IdempotencyRecord.workspace_id == ctx.workspace.id,
            IdempotencyRecord.operation == operation,
            IdempotencyRecord.idempotency_key == key,
        )
        .first()
    )


def _expired(rec: IdempotencyRecord, now: datetime) -> bool:
    expires = rec.expires_at
    if expires is None:
        return False
    return expires.replace(tzinfo=expires.tzinfo or now.tzinfo) < now


def idempotency_begin(db: Session, ctx: AuthContext, operation: str, key_header: str | None, payload) -> IdemGuard:
    key = (key_header or "").strip()[:MAX_KEY_LENGTH]
    request_hash = _hash_payload(payload)
    if not key:
        return IdemGuard(key=None, request_hash=request_hash)

    now = datetime.now().astimezone()
    existing = _lookup(db, ctx, operation, key)

    if existing is not None and _expired(existing, now):
        db.delete(existing)
        db.commit()
        existing = None

    if existing is not None:
        if existing.request_hash != request_hash:
            raise IdempotencyConflict(
                "idempotency_key_conflict",
                "This Idempotency-Key was already used with a different request body.",
            )
        if existing.state == "completed" and existing.response_body is not None:
            return IdemGuard(
                key=key,
                request_hash=request_hash,
                replay=existing.response_body,
                replay_status=existing.response_status,
            )
        raise IdempotencyConflict(
            "idempotency_request_in_flight",
            "An identical request with this Idempotency-Key is still in flight; retry shortly.",
        )

    reservation = IdempotencyRecord(
        id=new_id("idm"),
        user_id=ctx.user.id,
        workspace_id=ctx.workspace.id,
        operation=operation,
        idempotency_key=key,
        request_hash=request_hash,
        state="in_flight",
        expires_at=now + timedelta(hours=TTL_HOURS),
    )
    db.add(reservation)
    try:
        db.commit()
    except IntegrityError as exc:  # concurrent duplicate inserted first
        db.rollback()
        raise IdempotencyConflict(
            "idempotency_request_in_flight",
            "An identical request with this Idempotency-Key is still in flight; retry shortly.",
        ) from exc
    return IdemGuard(key=key, request_hash=request_hash, reservation_id=reservation.id)


def idempotency_store(db: Session, guard: IdemGuard, status_code: int, response: dict) -> None:
    """Persist the response on the reservation (only for successful executions)."""
    if guard.reservation_id is None:
        return
    rec = db.get(IdempotencyRecord, guard.reservation_id)
    if rec is None:
        return
    rec.state = "completed"
    rec.response_status = status_code
    rec.response_body = response
    db.commit()


def idempotency_release(db: Session, guard: IdemGuard) -> None:
    """Release the reservation after a failed operation so the client can retry cleanly."""
    if guard.reservation_id is None:
        return
    rec = db.get(IdempotencyRecord, guard.reservation_id)
    if rec is not None:
        db.delete(rec)
        db.commit()


def prune_expired(db: Session) -> int:
    """Remove expired records (housekeeping; returns count)."""
    now = datetime.now().astimezone()
    stale = [r for r in db.query(IdempotencyRecord).all() if _expired(r, now)]
    for r in stale:
        db.delete(r)
    if stale:
        db.commit()
    return len(stale)


_ = utcnow  # re-exported symbol kept for callers that patch this module in tests
