# HealForge — Production Backend Deployment Guide

> **Target Production Frontend URL (Protected & Unchanged):**  
> `https://healforge-beta.vercel.app`  
> *(Submitted to NVIDIA × Nebius Global AI Hackathon 2026. This URL must remain unchanged.)*

---

## 1. Executive Summary & Architecture

The deployed HealForge production frontend at `https://healforge-beta.vercel.app` serves the compiled Vite static SPA (`dist/`). When users interact with workspace features (session checking, authentication, project imports, scans, or patch reviews), the application communicates with `/api/v1/*`.

Because Vercel currently hosts only the static frontend bundle without an API reverse proxy or serverless Python function, requests to `/api/v1/*` currently return `HTTP 404 Not Found` (`x-vercel-error: NOT_FOUND`).

### Fail-Closed Security Posture (Phase 2 Implemented)
1. **Protected Workspace Locked:** When `/api/v1/auth/session` returns 404, 5xx, or network failure, the frontend renders a branded **Backend Connection Error Screen** with technical diagnostics and a "Retry Connection" button. The protected workspace screens (Dashboard, Vulnerabilities, Repositories, etc.) are **never unlocked**.
2. **Multi-User Authentication Required:** When `/api/v1/auth/session` returns HTTP 401 (`no_session`), the user is prompted with the **Sign In / Create Account** screen (`SignInScreen`).
3. **No Unintended Single-User Fallback:** In production (`HEALFORGE_ENV=production`), the hardcoded "Alex Vance" single-user dev fallback is strictly disabled and guarded by fail-closed runtime checks (`ensure_default_user` and `ensure_default_profile` raise `RuntimeError`). Authenticated users always resolve strictly to their real Supabase Auth credentials and profiles.

---

## 2. Production Deployment Options

There are two recommended architectures to connect the Vercel frontend to the backend container:

### Option A (Recommended): Vercel Reverse Proxy Rewrites
Deploy the backend Docker container to any container platform (Railway, Render, Fly.io, Cloud Run, AWS App Runner). Then configure `vercel.json` rewrites on Vercel.

**Advantages:**
- **Same-Origin Cookies:** The browser issues requests to `https://healforge-beta.vercel.app/api/v1/*`. Vercel securely proxies them to the backend container.
- **Zero Cross-Origin / Cookie Blocking:** `SameSite=Lax` HttpOnly cookies work seamlessly across all browsers (including Safari Intelligent Tracking Prevention).
- **No Frontend Rebuild Required:** The frontend uses relative paths (`/api/v1/*`), so no rebuild or domain hardcoding is required.

#### `vercel.json` Configuration:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<YOUR_DEPLOYED_BACKEND_HOST>/api/:path*"
    }
  ]
}
```
*(Replace `<YOUR_DEPLOYED_BACKEND_HOST>` with your actual deployed container domain, e.g. `https://healforge-api.up.railway.app`.)*

---

### Option B: Direct Cross-Origin API Host
Configure the frontend build environment variable `VITE_API_BASE_URL` pointing directly to the deployed backend container host:

```bash
VITE_API_BASE_URL=https://<YOUR_DEPLOYED_BACKEND_HOST>
```

**Requirements for Option B:**
1. Backend CORS must explicitly allow `https://healforge-beta.vercel.app` (already included by default in `backend/app/config.py`).
2. Backend cookies must use `COOKIE_SAMESITE=none` and `is_secure=True`.

---

## 3. Backend Container Readiness

The backend repository includes a production-ready `backend/Dockerfile` and entrypoint script:

- **Base Image:** `python:3.12-slim`
- **Security:** Non-root execution (`healforge` UID 10001, no home write access, `PYTHONDONTWRITEBYTECODE=1`).
- **Entrypoint:** `backend/docker-entrypoint.sh`
  - Validates schema and skips local Alembic migrations when targeting Supabase.
  - Dynamically binds to `$PORT` (default `8000` or cloud-assigned port).
  - Enables proxy headers: `--proxy-headers --forwarded-allow-ips='*'`.
- **Health Check Endpoints:**
  - `GET /health` (Root health probe for load balancers)
  - `GET /api/v1/health` (API health probe with database connectivity, AI status, and multi-user auth verification)

---

## 4. Required Environment Variables & Secrets

Configure the following environment variables in your container deployment platform:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `HEALFORGE_ENV` | `production` | **Critical:** Enforces multi-user posture, disables dev defaults, enables secure cookies. |
| `HEALFORGE_SINGLE_USER` | `false` | **Critical:** Fail-closed guard. Refuses startup if true in production. |
| `DATABASE_URL` | `postgresql+psycopg://postgres:<PASSWORD>@<HOST>:5432/postgres` | Authoritative PostgreSQL connection string (Supabase or managed DB). |
| `DATABASE_SCHEMA` | `public` | Supabase schema. |
| `SKIP_ALEMBIC_MIGRATIONS`| `true` | Skips local Alembic migrations to preserve Supabase schema. |
| `SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | Supabase API endpoint. |
| `SUPABASE_ANON_KEY` | `<SUPABASE_ANON_KEY>` | Supabase anon public API key. |
| `SUPABASE_JWT_SECRET` | `<SUPABASE_JWT_SECRET>` | Secret key for verifying and signing GoTrue Supabase JWTs (min 32 characters). |
| `AI_PROVIDER` | `nebius` | Primary AI provider for AST vulnerability remediation. |
| `NEBIUS_API_KEY` | `<NEBIUS_TOKEN_FACTORY_API_KEY>` | Nebius Token Factory API key. |
| `NEBIUS_BASE_URL` | `https://api.tokenfactory.nebius.com/v1` | Nebius Token Factory endpoint. |
| `NEBIUS_MODEL` | `nvidia/Llama-3.1-Nemotron-70B-Instruct-HF` | NVIDIA Nemotron 70B model hosted on Nebius Token Factory. |
| `NVIDIA_API_KEY` | *(Optional fallback)* | NVIDIA Build API key (if using `AI_PROVIDER=nvidia`). |
| `NVIDIA_MODEL_ID` | `nvidia/nemotron-3-super-120b-a12b` | NVIDIA Nemotron model ID. |
| `CORS_ORIGINS` | `https://healforge-beta.vercel.app` | Allowed CORS origins for the frontend application. |
| `COOKIE_SAMESITE` | `lax` *(Option A)* or `none` *(Option B)* | Cookie SameSite policy. |
| `SESSION_TTL_HOURS` | `168` | Session duration (7 days). |
| `RUNNER_VERIFIED` | `false` | Honest verification posture: execution disabled unless sandbox runner is deployed. |
| `MAX_ARCHIVE_BYTES` | `20971520` | Max ZIP archive upload size (20 MB). |
| `MAX_FILE_BYTES` | `262144` | Max single file size for static inspection (256 KB). |

---

## 5. Step-by-Step Deployment Guide (Using Railway / Render)

### Deploying the Backend on Railway:
1. Log in to [Railway.app](https://railway.app).
2. Create **New Project** → **Deploy from GitHub repo** (`Snowyarn/healforge`).
3. Under **Settings**:
   - **Root Directory:** `/backend`
   - **Dockerfile Path:** `Dockerfile`
4. Under **Variables**:
   - Add all variables from Section 4.
5. Under **Networking**:
   - Click **Generate Domain** (e.g. `healforge-production.up.railway.app`).
6. Test health check:
   ```bash
   curl -i https://healforge-production.up.railway.app/health
   # Expected: HTTP 200 {"status":"ok","service":"healforge-backend",...}
   ```

### Connecting to Vercel (Option A - Zero Downtime):
1. Create or update `vercel.json` in the root of the repository:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://healforge-production.up.railway.app/api/:path*"
       }
     ]
   }
   ```
2. Deploy the rewrite configuration to the existing Vercel project **without changing the production domain** (`healforge-beta.vercel.app`).
3. Verify proxy health through Vercel:
   ```bash
   curl -i https://healforge-beta.vercel.app/api/v1/health
   # Expected: HTTP 200 {"status":"ok","service":"healforge-backend",...}
   ```

---

## 6. End-to-End Verification Checklist

Once the backend is connected to `https://healforge-beta.vercel.app`:

- [ ] **Unauthenticated Session Check:**  
  Opening `https://healforge-beta.vercel.app/#dashboard` renders `SignInScreen` (Sign In / Create Account) instead of unlocking the workspace or showing Alex Vance.
- [ ] **Account Registration:**  
  Create a new user account with Email, Username, and Password. Verify that a unique workspace and profile are provisioned.
- [ ] **Sign In & Session:**  
  Sign in with the created credentials. The top bar shows the user's real initials and username.
- [ ] **Project Import:**  
  Open Workbench → Import Project → Upload a ZIP file (e.g., `tests/fixtures/sample_repo.zip`). The upload completes with HTTP 201.
- [ ] **Remediation & Patch Synthesis:**  
  Select a vulnerability and generate an AI-assisted patch using Nebius Token Factory (`nvidia/Llama-3.1-Nemotron-70B-Instruct-HF`). Verify that the AST diff and remediation proposal are returned.
- [ ] **Sign Out:**  
  Click user avatar → **Sign Out**. The session cookie is invalidated and the user is returned to `SignInScreen`.
- [ ] **URL Integrity:**  
  Confirm that `https://healforge-beta.vercel.app` remains the exact, unchanged production domain.
