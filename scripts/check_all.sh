#!/usr/bin/env bash
# HealForge — run every locally-runnable quality gate and print an honest PASS/FAIL matrix.
#
# Usage:  scripts/check_all.sh [backend|frontend|migrations]
#         (no argument = run everything)
#
# Gates intentionally NOT run here (documented, not silently skipped):
#   - Gitleaks/Semgrep: not installed in this environment (secret_scan.sh runs a
#     pattern-based fallback scan instead).
#   - GitHub Actions CI: no runner available here; .github/workflows/ci.yml runs
#     on push.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT/backend/.venv/bin/python"
ALEMBIC="$ROOT/backend/.venv/bin/alembic"
RUFF="$ROOT/backend/.venv/bin/ruff"
PASS=()
FAIL=()
NOTRUN=()

run_gate() {
  local name="$1"; shift
  echo ""
  echo "==================================================================="
  echo " GATE: $name"
  echo "==================================================================="
  if "$@"; then
    PASS+=("$name")
    echo ">> $name: PASS"
  else
    FAIL+=("$name")
    echo ">> $name: FAIL"
  fi
}

backend_pytest() {
  (cd "$ROOT/backend" && HEALFORGE_SINGLE_USER=true HEALFORGE_ENV=local "$PY" -m pytest tests/ -q)
}

backend_ruff() {
  (cd "$ROOT/backend" && "$RUFF" check . && "$RUFF" format --check .)
}

frontend_gates() {
  (cd "$ROOT" && npm run lint && npx tsc -b && npm test && npm run build)
}

supabase_ddl_gate() {
  (cd "$ROOT" && npm run test:db)
}

migrations_gate() {
  # Clean-DB upgrade -> downgrade -> upgrade (SQLite; PostgreSQL runs in CI).
  local db
  db="$(mktemp -u)/healforge-mig.db"
  mkdir -p "$(dirname "$db")"
  (cd "$ROOT/backend" && \
    DATABASE_URL="sqlite:///$db" "$ALEMBIC" upgrade head && \
    DATABASE_URL="sqlite:///$db" "$ALEMBIC" downgrade base && \
    DATABASE_URL="sqlite:///$db" "$ALEMBIC" upgrade head)
}

secret_scan_fallback() {
  bash "$ROOT/scripts/secret_scan.sh"
}

WHAT="${1:-all}"

if [[ "$WHAT" == "all" || "$WHAT" == "backend" ]]; then
  run_gate "backend: pytest" backend_pytest
  run_gate "backend: ruff check + format" backend_ruff
fi
if [[ "$WHAT" == "all" || "$WHAT" == "frontend" ]]; then
  run_gate "frontend: lint + tsc + test + build" frontend_gates
fi
if [[ "$WHAT" == "all" || "$WHAT" == "migrations" ]]; then
  run_gate "migrations: sqlite up/down/up" migrations_gate
  run_gate "database: supabase 15-table DDL + RLS static test suite" supabase_ddl_gate
fi
run_gate "secrets: pattern scan (Gitleaks NOT installed here)" secret_scan_fallback

NOTRUN+=("GitHub Actions CI (no runner in this environment)")
NOTRUN+=("PostgreSQL migration gate (no PostgreSQL/Docker in this environment — runs in CI)")
NOTRUN+=("Semgrep static scan (not installed in this environment)")

echo ""
echo "==================================================================="
echo " HONEST RESULT MATRIX"
echo "==================================================================="
if [[ ${#PASS[@]} -gt 0 ]]; then for g in "${PASS[@]}";  do echo " PASS    $g";  done; fi
if [[ ${#FAIL[@]} -gt 0 ]]; then for g in "${FAIL[@]}";  do echo " FAIL    $g";  done; fi
if [[ ${#NOTRUN[@]} -gt 0 ]]; then for g in "${NOTRUN[@]}"; do echo " NOT RUN $g"; done; fi
echo ""

if [[ ${#FAIL[@]} -gt 0 ]]; then
  echo "RESULT: ${#FAIL[@]} gate(s) FAILED"
  exit 1
fi
echo "RESULT: all locally-runnable gates passed; NOT RUN items are listed above honestly."
