"""HealForge backend application assembly.

Middlewares:
- Request ID + security headers on all responses
- Session bootstrap (single-user dev mode) for /api/v1/*
- CSRF: SameSite=Strict cookie + same-origin/allowlist Origin validation on unsafe methods
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .api.routers import (
    account,
    activity,
    auth,
    health,
    patches,
    projects,
    records,
    scans,
)
from .config import Settings, settings
from .db import SessionLocal
from .security.idempotency import IdempotencyConflict
from .security.rbac import PermissionDenied
from .security.sessions import create_session, ensure_default_user, resolve_session

APP_VERSION = "1.1.0"


def validate_startup(s: Settings) -> None:
    """Fail-closed deployment guards. Called on application startup.

    1. Single-user bootstrap (shared unauthenticated dev owner) must NEVER run in
       production unless an operator sets the explicit, documented escape hatch.
    2. In-process job backend in production is disclosed loudly (not fatal): it is
       not a durable queue; interrupted jobs are honestly marked failed.
    """
    if s.healforge_single_user and s.healforge_env == "production" and not s.healforge_allow_single_user_in_production:
        raise RuntimeError(
            "REFUSING TO START: HEALFORGE_SINGLE_USER=true is enabled while HEALFORGE_ENV=production. "
            "The single-user bootstrap provisions a shared unauthenticated owner account and must "
            "not be exposed in production. Set HEALFORGE_SINGLE_USER=false (recommended) or, if you "
            "accept the risk, additionally set HEALFORGE_ALLOW_SINGLE_USER_IN_PRODUCTION=true."
        )
    if s.healforge_env == "production" and s.job_backend == "in_process":
        print(
            "[healforge] WARNING: job_backend=in_process in production. Background scans are NOT "
            "durable: jobs interrupted by a restart are marked failed (never silently resumed). "
            "Deploy a real broker/worker for durable production queues. See README 'Background jobs'.",
            flush=True,
        )


app = FastAPI(
    title="HealForge API",
    version=APP_VERSION,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# Exact-origin CORS (no wildcards with credentials).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID", "Accept"],
    max_age=600,
)


def _same_origin(request: Request, origin_header: str) -> bool:
    """Origin host matches the request Host header (covers the sandbox preview domain)."""
    try:
        from urllib.parse import urlparse

        o = urlparse(origin_header)
        if not o.netloc:
            return False
        host = request.headers.get("host", "")
        return o.netloc.lower() == host.lower()
    except Exception:  # noqa: BLE001
        return False


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id

        # CSRF defense for unsafe methods: same-origin OR explicit allowlist.
        if request.url.path.startswith("/api/") and request.method not in SAFE_METHODS:
            origin = request.headers.get("origin")
            if origin and not (_same_origin(request, origin) or origin in settings.cors_origin_list):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "origin_not_allowed",
                            "message": "Cross-origin request rejected.",
                            "request_id": request_id,
                        }
                    },
                )

        # Single-user session bootstrap: any /api/v1 request gets a session if none exists.
        # Auth routes (login/register/logout) manage sessions themselves — bootstrapping
        # them would OVERWRITE the freshly issued session cookie with the dev session.
        bootstrapped = None
        auth_route = request.url.path.startswith("/api/v1/auth/")
        if request.url.path.startswith("/api/v1") and settings.healforge_single_user and not auth_route:
            db = SessionLocal()
            try:
                if resolve_session(db, request) is None:
                    user = ensure_default_user(db)
                    void = _VoidResponse()
                    create_session(db, void, user, request)
                    bootstrapped = void
                    if void._cookies:
                        token = void._cookies[0][1]
                        # Make the new session visible to THIS request as well.
                        scope = request.scope
                        headers = {k: v for k, v in scope.get("headers", [])}
                        existing = headers.get(b"cookie", b"")
                        headers[b"cookie"] = (
                            (existing + b"; " if existing else b"") + b"healforge_session=" + token.encode()
                        )
                        scope["headers"] = list(headers.items())
            finally:
                db.close()

        try:
            response = await call_next(request)
        except Exception as exc:  # noqa: BLE001
            import traceback

            err_str = f"{type(exc).__name__}: {exc}"
            tb_str = traceback.format_exc()
            print(f"[healforge-500] Unhandled exception: {err_str}\n{tb_str}", flush=True)
            return JSONResponse(
                status_code=500,
                content={
                    "detail": str(exc) or err_str,
                    "error": {
                        "code": "internal_error",
                        "message": err_str,
                        "request_id": request_id,
                        "traceback": tb_str[:2000],
                    },
                },
                headers={
                    "X-Request-ID": request_id,
                    "X-Content-Type-Options": "nosniff",
                },
            )

        # Transfer bootstrapped session cookie onto the real response.
        if bootstrapped is not None:
            for key, value, kwargs in bootstrapped._cookies:
                response.set_cookie(key, value, **kwargs)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if bootstrapped:
            response.headers.setdefault("X-Session-Bootstrapped", "1")
        return response


class _VoidResponse:
    """create_session normally sets a cookie via Response; in middleware we set it on the real response."""

    def __init__(self):
        self._cookies: list[tuple[str, str, dict]] = []

    def set_cookie(self, key, value, **kwargs):
        self._cookies.append((key, value, kwargs))


app.add_middleware(SecurityMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    rid = getattr(_request.state, "request_id", "")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request validation failed.",
                "details": exc.errors()[:10],
                "request_id": rid,
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Uniform error envelope: {"error": {code, message, request_id}} for every error.

    api_error() raises HTTPException(detail={"error": {...}}) — that detail is
    flattened to the top level so clients see exactly one error shape.
    """
    rid = getattr(request.state, "request_id", "")
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        body = dict(detail["error"])
        body.setdefault("request_id", rid)
    else:
        body = {"code": f"http_{exc.status_code}", "message": str(detail), "request_id": rid}
    return JSONResponse(status_code=exc.status_code, content={"error": body}, headers=exc.headers)


@app.exception_handler(PermissionDenied)
async def permission_denied_handler(request: Request, exc: PermissionDenied):
    rid = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=403,
        content={
            "error": {
                "code": "permission_denied",
                "message": f"Your workspace role '{exc.role}' does not allow this action "
                f"(requires '{exc.permission}').",
                "request_id": rid,
            }
        },
    )


@app.exception_handler(IdempotencyConflict)
async def idempotency_conflict_handler(request: Request, exc: IdempotencyConflict):
    rid = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=409,
        content={"error": {"code": exc.code, "message": exc.message, "request_id": rid}},
    )


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):  # pragma: no cover
    import traceback

    rid = getattr(request.state, "request_id", "")
    err_str = f"{type(exc).__name__}: {exc}"
    tb_str = traceback.format_exc()
    print(f"[healforge-500] Unhandled exception: {err_str}\n{tb_str}", flush=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc) or err_str,
            "error": {
                "code": "internal_error",
                "message": err_str,
                "request_id": rid,
                "traceback": tb_str[:2000],
            },
        },
    )


API = "/api/v1"
app.include_router(health.router)
app.include_router(health.router, prefix=API)
app.include_router(auth.router, prefix=API)
app.include_router(projects.router, prefix=API)
app.include_router(scans.router, prefix=API)
app.include_router(patches.router, prefix=API)
app.include_router(activity.router, prefix=API)
app.include_router(records.router, prefix=API)
app.include_router(account.router, prefix=API)


@app.get("/")
def root() -> dict:
    return {
        "service": "healforge-backend",
        "version": APP_VERSION,
        "api": "/api/v1",
        "docs": "/api/docs",
        "time": datetime.now(UTC).isoformat(),
    }


@app.on_event("startup")
def on_startup() -> None:
    """Deployment guards + restart honesty + in-memory schema initialization."""
    from .db import init_db

    try:
        init_db()
    except Exception as exc:  # noqa: BLE001
        print(f"[healforge] startup init_db: {exc}", flush=True)

    validate_startup(settings)
    # Restart honesty: any scan job left queued/running by a previous process is
    # marked failed (the in-process job backend is not a durable queue).
    from .services.scan_pipeline import mark_stale_jobs_failed

    db = SessionLocal()
    try:
        marked = mark_stale_jobs_failed(db)
        if marked:
            print(f"[healforge] marked {marked} stale job(s) failed after restart", flush=True)
    finally:
        db.close()
