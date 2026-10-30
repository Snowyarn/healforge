# HealForge Backend

FastAPI + SQLAlchemy 2 + Alembic backend for the HealForge security workbench.
Real static analysis (SAST + secrets + SBOM advisories + container audit),
NVIDIA-only model inference (NIM / API Catalog), human-in-the-loop patch
review, honest verification states, and auditable reports.

## Requirements

- Python **3.12+**
- (Deployment) PostgreSQL 14+ — local dev falls back to SQLite automatically

## Setup (local development)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # optional; defaults are sane for local dev
alembic upgrade head               # create the schema (SQLite: ./healforge.db)

uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Health check: `curl http://127.0.0.1:8001/api/v1/health`

> **Where to put the NVIDIA key (never in chat, Git, or the browser):**
> edit `backend/.env` and set `NVIDIA_API_KEY=nvapi-...`. The key is loaded
> server-side only. `/api/v1/nvidia/status` reports `configured: true/false`
> without ever exposing the key.

## Tests

```bash
python -m pytest tests/            # 67 tests
ruff check .                       # lint
ruff format --check .              # formatting
```

The suite covers: auth/session/CSRF, tenant isolation, upload attacks
(zip-slip, symlink, path traversal, bombs, limits), scan pipeline end-to-end,
secret redaction, NVIDIA missing-key + provider-failure paths (mocked),
restart honesty, TOTP vectors, rate-limiter semantics, and an AST-level proof
that no runtime module ever shells out to execute untrusted code.

## Migrations

```bash
alembic upgrade head        # apply
alembic downgrade -1        # roll back one revision
alembic history             # inspect
```

`alembic/env.py` reads `DATABASE_URL` from the environment / `.env`.
Switching to PostgreSQL is a one-line change:

```env
DATABASE_URL=postgresql+psycopg://healforge:PASSWORD@localhost:5432/healforge
```

(and `pip install "psycopg[binary]>=3.2"` — the Docker image does this for you).

## Docker

```bash
docker build -t healforge-backend .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql+psycopg://user:pass@host:5432/healforge \
  -e NVIDIA_API_KEY=nvapi-... \
  healforge-backend
```

The image is non-root, runs `alembic upgrade head` on start (see
`docker-entrypoint.sh`), and never contains the NVIDIA key — it is injected
at runtime.

## Configuration

All settings are environment-driven (`app/config.py`, template:
`.env.example`). Key groups:

| Group | Variables | Notes |
|---|---|---|
| Database | `DATABASE_URL` | SQLite locally, PostgreSQL in deployment |
| NVIDIA | `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL_ID`, `NVIDIA_TIMEOUT_SECONDS` | server-side only; honest `not_configured` state when unset |
| Auth | `HEALFORGE_SINGLE_USER`, `HEALFORGE_DEFAULT_USER_EMAIL`, `SESSION_TTL_HOURS` | single-user bootstrap is for local dev only |
| Verification | `RUNNER_VERIFIED` | execution-based verification stays **disabled** (`verification_unavailable`) unless an isolated, ephemeral runner (gVisor or equivalent) is deployed and proven. There is **no host fallback**. |
| Uploads | `MAX_ARCHIVE_BYTES`, `MAX_ARCHIVE_ENTRIES`, `MAX_FILE_BYTES`, `MAX_TOTAL_TEXT_BYTES` | enforced server-side |
| CORS | `CORS_ORIGINS` | exact origins, comma separated |

## Layout

```
app/
  api/routers/     route handlers (auth, projects, scans, patches, account, ...)
  api/serializers.py  row -> DTO serialization
  models/          SQLAlchemy tables (account, workbench)
  services/        scan_pipeline, static_engine, secret_engine, nvidia,
                   verification, reports, pdfgen, upload, audit
  security/        sessions, passwords, totp, rate_limit, origin (CSRF)
alembic/           reviewed migrations
tests/             67 pytest tests
```

## Operational notes

- **Jobs** run in an in-process worker pool with full state persistence in the
  database; on restart, stale `running` jobs are honestly marked `failed`
  (never silently resumed). Swap in Celery/RQ by replacing the pool in
  `app/jobs/` if you need cross-process durability.
- **Backups**: back up the PostgreSQL volume (`pg_dump`) or the SQLite file
  (use `sqlite3 .backup` while the server is stopped or in WAL mode).
- **Rollback**: `alembic downgrade` reverses schema changes; application
  releases are stateless, so redeploying the previous image is the app-level
  rollback.
- **Logs**: structured request logs with `X-Request-ID` correlation; audit
  events are persisted in the `audit_events` table.
