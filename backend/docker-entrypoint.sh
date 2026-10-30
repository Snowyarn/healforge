#!/bin/sh
# HealForge backend container entrypoint: conditional migration, then serve.
# When targeting the authoritative Supabase database (or when DATABASE_SCHEMA=public),
# local Alembic migrations are skipped to preserve the managed Supabase schema.
set -e

if [ "$SKIP_ALEMBIC_MIGRATIONS" = "true" ] || [ "$SKIP_MIGRATIONS" = "true" ] || [ "${DATABASE_SCHEMA:-public}" = "public" ]; then
    echo "[healforge] Supabase authoritative schema in use (schema: ${DATABASE_SCHEMA:-public}). Skipping local Alembic migrations."
elif [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -Eq 'supabase|\.pooler\.supabase\.com'; then
    echo "[healforge] Hosted Supabase database detected. Skipping local Alembic migrations."
else
    echo "[healforge] applying database migrations for local development database..."
    alembic upgrade head || echo "[healforge] Warning: Alembic migrations encountered an issue; continuing startup."
fi

PORT="${PORT:-8000}"
echo "[healforge] starting uvicorn on 0.0.0.0:$PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips='*'
