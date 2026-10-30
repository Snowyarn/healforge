"""Shared API dependencies: auth context, request id, pagination."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..security.sessions import AuthContext, get_auth

DbDep = Annotated[Session, Depends(get_db)]


def get_request_id(request: Request) -> str:
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
    return rid


RequestIdDep = Annotated[str, Depends(get_request_id)]


def get_ctx(request: Request, db: DbDep) -> AuthContext:
    ctx = get_auth(db, request)
    if ctx is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "unauthorized", "message": "No valid session. Reload to start a session."}},
        )
    # Set PostgreSQL session-scoped RLS claims for this authenticated request
    if not str(db.bind.url).startswith("sqlite"):
        try:
            import json
            from sqlalchemy import text

            claims = json.dumps(
                {
                    "sub": str(ctx.user.id),
                    "role": "authenticated",
                    "email": ctx.user.email,
                }
            )
            db.execute(text("SELECT set_config('request.jwt.claims', :claims, false)"), {"claims": claims})
            db.execute(text("SET role = authenticated"))
        except Exception:
            pass
    return ctx


CtxDep = Annotated[AuthContext, Depends(get_ctx)]


def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})
