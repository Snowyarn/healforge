#!/usr/bin/env bash
# Secret & artifact scan of the HealForge repository.
# Fails loudly if any real secret shape or forbidden artifact is found.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Scanning HealForge repository at $ROOT"

echo "  -- Checking for forbidden secret patterns --"
# Allowed test placeholders:
#   * AKIAIOSFODNN7EXAMPLE - AWS docs example
#   * nvapi-TESTKEYdoNOTuseEVERinPROD - synthetic test key
#   * neb-TESTKEYdoNOTuseEVERinPROD12345 - synthetic test key
#   * ghp_TESTTOKENdoNOTuseEVERinPROD123456789 - synthetic test key
MATCHES=$(git -C "$ROOT" grep -I -n -E '(nvapi-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,})' 2>/dev/null \
  | grep -v 'AKIAIOSFODNN7EXAMPLE' \
  | grep -v 'nvapi-TESTKEYdoNOTuseEVERinPROD' \
  | grep -v 'neb-TESTKEYdoNOTuseEVERinPROD12345' \
  | grep -v 'ghp_TESTTOKENdoNOTuseEVERinPROD123456789' \
  | grep -v 'scripts/secret_scan.sh' || true)

if [ -n "$MATCHES" ]; then
  echo "FATAL: Potential credentials detected in tracked files:"
  echo "$MATCHES"
  exit 1
fi

echo "  -- Checking for VITE_ secret leaks --"
VITELEAK=$(git -C "$ROOT" grep -I -n -E 'VITE_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)' 2>/dev/null | grep -v 'VITE_SUPABASE_ANON_KEY' || true)
if [ -n "$VITELEAK" ]; then
  echo "FATAL: Secrets detected in VITE_ frontend variables:"
  echo "$VITELEAK"
  exit 1
fi

echo "  -- Checking template placeholders in .env.example --"
NONEMPTY=$(grep -rInE '^(NVIDIA_API_KEY|NEBIUS_API_KEY|POSTGRES_PASSWORD)=(.+)$' "$ROOT" --include='.env.example' 2>/dev/null | grep -v 'CHANGE_ME' || true)
if [ -n "$NONEMPTY" ]; then
  echo "FATAL: Real secrets detected in .env.example:"
  echo "$NONEMPTY"
  exit 1
fi

echo "SECRET SCAN OK: 0 secrets leaked, 0 VITE_ leaks, templates verified."
