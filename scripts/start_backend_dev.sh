#!/bin/sh
# Start the HealForge backend for local development (daemonized).
# Single-user bootstrap is EXPLICITLY enabled here (local dev only — production
# deployments run multi-user with the fail-closed default; see README).
#
# Usage: backend/scripts/start_backend_dev.sh   (from anywhere; paths are resolved)
set -e
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"

export DATABASE_URL="${DATABASE_URL:-sqlite:///$BACKEND_DIR/healforge.db}"
export HEALFORGE_SINGLE_USER="${HEALFORGE_SINGLE_USER:-true}"
export HEALFORGE_ENV="${HEALFORGE_ENV:-local}"
PORT="${HEALFORGE_BACKEND_PORT:-8001}"

LOG="${HEALFORGE_LOG:-/tmp/healforge-backend.log}"

# Prefer the project venv, fall back to system python.
if [ -x "$BACKEND_DIR/.venv/bin/python" ]; then
  PY="$BACKEND_DIR/.venv/bin/python"
else
  PY="$(command -v python3)"
fi

nohup "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" >>"$LOG" 2>&1 &
PID=$!
sleep 3
if kill -0 "$PID" 2>/dev/null; then
  echo "backend started pid=$PID port=$PORT log=$LOG"
  echo "health: http://127.0.0.1:$PORT/api/v1/health"
else
  echo "backend failed to start; log tail:"
  tail -5 "$LOG"
  exit 1
fi
