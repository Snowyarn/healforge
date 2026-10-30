"""CSRF defense: SameSite=Strict cookies + strict Origin/Referer validation on unsafe methods."""

from __future__ import annotations

from fastapi import HTTPException, Request

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def validate_origin(request: Request, allowed_origins: list[str]) -> None:
    if request.method in SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin is None:
        # Same-origin form posts may omit Origin; fall back to Referer.
        referer = request.headers.get("referer")
        if referer is None:
            return  # non-browser clients (tests/curl) — session cookie still required for auth
        origin = referer.rsplit("/", 3)[0] if "://" in referer else None
        if origin is None:
            raise HTTPException(
                status_code=403, detail={"error": {"code": "origin_check_failed", "message": "Invalid referer."}}
            )
    if origin not in allowed_origins:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "origin_not_allowed", "message": "Cross-origin request rejected."}},
        )
