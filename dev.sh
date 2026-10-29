#!/usr/bin/env bash
# HealForge — local development quick start (no Docker required).
#
# Starts the FastAPI backend on :8001 and the Vite dev server on :3000.
# The dev server proxies /api -> backend, so the browser stays same-origin.
#
# First run:  ./dev.sh setup   (python venv + npm ci)
# Then:       ./dev.sh         (or ./dev.sh backend|frontend for just one)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-/opt/homebrew/bin/python3.12}"
VENV="$ROOT/backend/.venv"
PORT_BACKEND="${HEALFORGE_BACKEND_PORT:-8001}"
PORT_FRONTEND="${HEALFORGE_FRONTEND_PORT:-3000}"

command_available() { command -v "$1" >/dev/null 2>&1; }

setup() {
  echo "==> Backend: creating venv + installing pinned dependencies"
  if ! command_available "$PY"; then PY="python3"; fi
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip >/dev/null
  "$VENV/bin/pip" install -r "$ROOT/backend/requirements.txt"
  echo "==> Backend: applying migrations (SQLite dev database)"
  (cd "$ROOT/backend" && "$VENV/bin/alembic" upgrade head)
  echo "==> Frontend: npm install"
  (cd "$ROOT" && npm install)
  echo "==> Setup complete. Copy backend/.env.example to backend/.env if you"
  echo "    want to set NEBIUS_API_KEY / NVIDIA_API_KEY (server-side only)."
}

run_backend() {
  cd "$ROOT/backend"
  exec "$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port "$PORT_BACKEND"
}

run_frontend() {
  cd "$ROOT"
  export HEALFORGE_API_URL="http://127.0.0.1:$PORT_BACKEND"
  exec npm run dev -- --port "$PORT_FRONTEND"
}

case "${1:-all}" in
  setup)  setup ;;
  backend)  run_backend ;;
  frontend) run_frontend ;;
  all)
    if [ ! -d "$VENV" ]; then echo "Run ./dev.sh setup first" >&2; exit 1; fi
    trap 'kill 0' EXIT
    run_backend &
    run_frontend &
    wait
    ;;
  *) echo "Usage: $0 [setup|backend|frontend|all]" >&2; exit 2 ;;
esac
