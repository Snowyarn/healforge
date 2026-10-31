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

from app.main import app  # noqa: E402
