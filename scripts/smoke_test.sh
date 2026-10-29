#!/usr/bin/env bash
# Extraction + startup smoke test for both distribution ZIPs.
# Runs the EXACT commands documented in the READMEs against the extracted
# archives — nothing is taken on faith from the build tree.
set -euo pipefail

OUT="/home/z/my-project/download"
SMOKE="$(mktemp -d)"
trap 'rm -rf "$SMOKE"' EXIT
LOG(){ echo; echo "===== $* ====="; }

LOG "1. Extract both archives"
unzip -q "$OUT/healforge-backend.zip"  -d "$SMOKE/be"
unzip -q "$OUT/healforge-complete.zip" -d "$SMOKE/full"

LOG "2. Backend contents identical between the two ZIPs (checksums)"
diff -r "$SMOKE/be/healforge-backend" "$SMOKE/full/healforge/backend" \
  && echo "IDENTICAL: backend payload matches in both archives"

LOG "3. Complete archive: required root files present"
cd "$SMOKE/full/healforge"
for f in README.md docker-compose.yml dev.sh .env.example .gitignore \
         backend/Dockerfile backend/docker-entrypoint.sh backend/requirements.txt \
         backend/alembic.ini backend/app/main.py backend/tests/conftest.py \
         frontend/package.json frontend/package-lock.json frontend/vite.config.ts \
         frontend/src/services/api.ts frontend/src/services/__tests__/api.test.ts \
         docs/FEATURE_MAP.md scripts/migration_gate.py; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
done
echo "all required files present"

LOG "4. Backend smoke: fresh venv + pinned install (README commands)"
python3 -m venv "$SMOKE/venv"
"$SMOKE/venv/bin/pip" install -q --upgrade pip
"$SMOKE/venv/bin/pip" install -q -r "$SMOKE/be/healforge-backend/requirements.txt"
echo "pip install OK"

LOG "5. Backend smoke: clean-DB migration (README command)"
cd "$SMOKE/be/healforge-backend"
DATABASE_URL="sqlite:///./smoke.db" "$SMOKE/venv/bin/alembic" upgrade head
[ -f smoke.db ] || { echo "smoke.db not created"; exit 1; }
echo "migration OK (smoke.db created)"

LOG "6. Backend smoke: full pytest suite from the extracted archive"
"$SMOKE/venv/bin/python" -m pytest tests/ -q 2>&1 | tail -2

LOG "7. Backend smoke: uvicorn boot + health check"
DATABASE_URL="sqlite:///./smoke.db" "$SMOKE/venv/bin/python" -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8901 > "$SMOKE/uvicorn.log" 2>&1 &
UVPID=$!
for i in $(seq 1 20); do
  if curl -sf -m 2 http://127.0.0.1:8901/api/v1/health -o "$SMOKE/health.json" 2>/dev/null; then break; fi
  sleep 1
done
python3 -c "
import json
d = json.load(open('$SMOKE/health.json'))
assert d['status'] == 'ok', d
assert d['database'] == 'connected', d
print('health OK:', d['status'], '| db:', d['database'])
"
kill $UVPID 2>/dev/null || true

LOG "8. Frontend smoke: npm ci + production build + unit tests (README commands)"
cd "$SMOKE/full/healforge/frontend"
npm ci --silent
npm run build 2>&1 | grep -E "built in|error" | tail -1
[ -d dist ] && [ -f dist/index.html ] && echo "dist/index.html built OK"
npm test 2>&1 | grep -E "Test Files|Tests " | head -2

echo
echo "SMOKE TEST: ALL STEPS PASSED"
