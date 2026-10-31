"""Vercel Serverless Function entry point for HealForge FastAPI backend.

Routes requests handled by @vercel/python into the FastAPI application.
"""

from __future__ import annotations

import os
import sys

# Ensure backend directory is in sys.path so 'app.*' imports resolve cleanly
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND = os.path.join(_ROOT, "backend")

if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402

__all__ = ["app"]

# Ensure all in-memory database tables are created on Vercel cold starts before requests
try:
    init_db()
except Exception as exc:  # noqa: BLE001
    print(f"[api/index.py] init_db on cold start: {exc}", flush=True)
