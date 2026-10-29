#!/bin/sh
# HealForge backend container entrypoint: migrate, then serve.
# Keeps the app non-root (set in the Dockerfile) and fails fast on bad config.
set -e

echo "[healforge] applying database migrations..."
alembic upgrade head

echo "[healforge] starting uvicorn on 0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
