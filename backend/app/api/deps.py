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
    return ctx


CtxDep = Annotated[AuthContext, Depends(get_ctx)]


def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})
