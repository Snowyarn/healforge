"""Health + provider status routes (no secrets exposed)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import text

from ...config import settings
from ...db import engine
from ...services import ai_provider, nvidia

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    ai_stat = ai_provider.status()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "healforge-backend",
        "version": "1.1.0",
        "time": datetime.now(UTC).isoformat(),
        "database": "connected" if db_ok else "unavailable",
        "auth": {
            "mode": "single-user (local development)" if settings.healforge_single_user else "multi-user",
            "single_user_bootstrap": settings.healforge_single_user,
            "env": settings.healforge_env,
        },
        "jobs": {
            # Honest disclosure: the only job backend is an in-process thread pool.
            # It is NOT durable: jobs interrupted by a restart are marked failed.
            # A real broker/worker is a documented production prerequisite.
            "backend": settings.job_backend,
            "mode": "in_process_local_dev",
            "durable": False,
            "restart_behavior": "interrupted_jobs_marked_failed",
            "retry_endpoint": "POST /api/v1/scans/{id}/retry",
        },
        "ai": ai_stat,
        "nvidia": nvidia.status(),
        "runner": {
            "execution_available": settings.runner_verified,
            "host_execution_forbidden": True,
        },
    }


@router.get("/ai/status")
def get_ai_status() -> dict:
    return ai_provider.status()


@router.get("/ai/models")
def get_ai_models() -> dict:
    """List available models from Nebius Token Factory when configured."""
    if not settings.nebius_configured:
        return {
            "configured": False,
            "provider": "nebius",
            "models": [],
            "note": "NEBIUS_API_KEY is not configured.",
        }
    try:
        models = ai_provider.list_nebius_models()
        return {
            "configured": True,
            "provider": "nebius",
            "models": models,
            "selected_model": settings.nebius_model,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "configured": True,
            "provider": "nebius",
            "error": str(exc),
            "models": [],
            "selected_model": settings.nebius_model,
        }


@router.get("/nvidia/status")
def nvidia_status() -> dict:
    return nvidia.status()
