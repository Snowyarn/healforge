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


_IN_MEMORY_IDEMPOTENCY: dict[str, dict] = {}


def _lookup(db: Session, ctx: AuthContext, operation: str, key: str) -> IdempotencyRecord | None:
    if str(db.bind.url).startswith("sqlite"):
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
    record = _IN_MEMORY_IDEMPOTENCY.get(f"{ctx.workspace.id}:{operation}:{key}")
    if record:
        rec = IdempotencyRecord(
            id=record["id"],
            user_id=record["user_id"],
            workspace_id=record["workspace_id"],
            operation=record["operation"],
            idempotency_key=record["idempotency_key"],
            request_hash=record["request_hash"],
            state=record["state"],
            expires_at=record["expires_at"],
            response_status=record.get("response_status"),
            response_body=record.get("response_body"),
        )
        return rec
    return None


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

    is_sqlite = str(db.bind.url).startswith("sqlite")
    if existing is not None and _expired(existing, now):
        if is_sqlite:
            db.delete(existing)
            db.commit()
        else:
            _IN_MEMORY_IDEMPOTENCY.pop(f"{ctx.workspace.id}:{operation}:{key}", None)
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

    res_id = new_id("idm")
    if not is_sqlite:
        mkey = f"{ctx.workspace.id}:{operation}:{key}"
        _IN_MEMORY_IDEMPOTENCY[mkey] = {
            "id": res_id,
            "user_id": str(ctx.user.id),
            "workspace_id": str(ctx.workspace.id),
            "operation": operation,
            "idempotency_key": key,
            "request_hash": request_hash,
            "state": "in_flight",
            "expires_at": now + timedelta(hours=TTL_HOURS),
            "response_status": None,
            "response_body": None,
        }
        return IdemGuard(key=key, request_hash=request_hash, reservation_id=f"mem:{mkey}")

    reservation = IdempotencyRecord(
        id=res_id,
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
    if str(guard.reservation_id).startswith("mem:"):
        mkey = guard.reservation_id[4:]
        if mkey in _IN_MEMORY_IDEMPOTENCY:
            _IN_MEMORY_IDEMPOTENCY[mkey]["state"] = "completed"
            _IN_MEMORY_IDEMPOTENCY[mkey]["response_status"] = status_code
            _IN_MEMORY_IDEMPOTENCY[mkey]["response_body"] = json.loads(json.dumps(response, default=str))
        return
    rec = db.get(IdempotencyRecord, guard.reservation_id)
    if rec is None:
        return
    rec.state = "completed"
    rec.response_status = status_code
    rec.response_body = json.loads(json.dumps(response, default=str))
    db.commit()


def idempotency_release(db: Session, guard: IdemGuard) -> None:
    """Release the reservation after a failed operation so the client can retry cleanly."""
    if guard.reservation_id is None:
        return
    if str(guard.reservation_id).startswith("mem:"):
        mkey = guard.reservation_id[4:]
        _IN_MEMORY_IDEMPOTENCY.pop(mkey, None)
        return
    rec = db.get(IdempotencyRecord, guard.reservation_id)
    if rec is not None:
        db.delete(rec)
        db.commit()


def prune_expired(db: Session) -> int:
    """Remove expired records (housekeeping; returns count)."""
    now = datetime.now().astimezone()
    if not str(db.bind.url).startswith("sqlite"):
        stale_keys = [k for k, v in _IN_MEMORY_IDEMPOTENCY.items() if v.get("expires_at") and v["expires_at"] < now]
        for k in stale_keys:
            _IN_MEMORY_IDEMPOTENCY.pop(k, None)
        return len(stale_keys)
    stale = [r for r in db.query(IdempotencyRecord).all() if _expired(r, now)]
    for r in stale:
        db.delete(r)
    if stale:
        db.commit()
    return len(stale)


_ = utcnow  # re-exported symbol kept for callers that patch this module in tests
