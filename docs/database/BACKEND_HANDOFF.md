# HealForge Backend Integration & Handoff Guide

**Target Audience:** Backend Engineers, Security Infrastructure Developers, and Cloud Architects integrating with the HealForge database foundation.

---

## 1. Connecting to the Database

HealForge utilizes Supabase PostgreSQL with two distinct access channels depending on the operational context:

### A. The Dual-Client Architecture

```mermaid
flowchart TD
    subgraph Frontend["Frontend Clients (Browser / React)"]
        UserBrowser["User Browser Session"]
    end

    subgraph Backend["Backend Services (Node.js / Python / Go)"]
        APIHandler["API Web Route Handler"]
        WorkerQueue["Background Sandbox / Scan Workers"]
    end

    subgraph Supabase["Supabase PostgreSQL"]
        RLS["Row Level Security (RLS) Filter"]
        PostgresDB[("PostgreSQL Tables")]
    end

    UserBrowser -->|"User JWT (Bearer Auth)"| RLS
    APIHandler -->|"User Delegated JWT"| RLS
    RLS -->|"Permitted Tenant Rows"| PostgresDB
    WorkerQueue -->|"Service Role Key (Bypasses RLS)"| PostgresDB
```

1. **User-Delegated API Requests (RLS Enforced):**
   - For all HTTP API endpoints serving interactive frontend user requests, the backend should initialize a Supabase client configured with the incoming user's JWT (`Authorization: Bearer <token>`).
   - All queries executed through this client automatically obey PostgreSQL Row Level Security (RLS). Users cannot read, query, or mutate records outside their authorized workspaces.

2. **Trusted Background Worker Requests (Bypasses RLS):**
   - For background job runners (e.g. AST vulnerability scanners, LLM patch synthesis engines, gVisor microVM test runners), the backend initializes a client using the `SUPABASE_SERVICE_ROLE_KEY` or direct connection pooling with PostgreSQL `postgres` credentials.
   - This service client has elevated database privileges to orchestrate multi-tenant jobs, ingest findings, and insert immutable audit records.

### B. Connection Strings & Pooler Ports

When connecting directly via PostgreSQL drivers (`pg`, `asyncpg`, `sqlx`, Prisma, Drizzle):

| Target | Local Development | Hosted Supabase Production | Pooler Mode |
|:---|:---|:---|:---|
| **Direct Postgres** | `localhost:54322` | `db.<project>.supabase.co:5432` | Session / DDL migrations |
| **Transaction Pooler (Supavisor)** | `localhost:54329` | `aws-0-<region>.pooler.supabase.com:6543` | Transaction / High concurrency workers |

---

## 2. Environment Variables & Secret Boundary

### Required Environment Configuration

Create a local `.env` or inject these environment variables in containerized services:

```env
# ------------------------------------------------------------------------------
# SUPABASE PLATFORM CONNECTION
# ------------------------------------------------------------------------------
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...

# ------------------------------------------------------------------------------
# DIRECT POSTGRESQL POOL (For Backend ORMs / Migration Runners)
# ------------------------------------------------------------------------------
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable
DATABASE_POOL_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable

# ------------------------------------------------------------------------------
# SECRET VAULT & KMS BOUNDARY
# ------------------------------------------------------------------------------
VAULT_KEY_PATH=/secrets/healforge/master.key
ENCRYPTION_MASTER_KEY=base64:syntheticKeyForLocalDevOnlyNotForProd123456=
```

### The Credential Isolation Boundary

> [!CAUTION]
> **Zero Plaintext Secrets Rule:** The database tables (specifically `integration_connections`) must **NEVER** store plaintext GitHub access tokens, GitLab OAuth tokens, Anthropic/OpenAI API keys, or private SSH keys.

The column `integration_connections.secret_ref` is strictly a lookup reference:
- Local/Standard Supabase: Stored inside Supabase Vault (`vault.secrets`) referenced via UUID.
- Cloud Production: Reference ID pointing to an external secret store (e.g. AWS Secrets Manager ARN `arn:aws:secretsmanager:...` or HashiCorp Vault path `vault:secret/data/github-app-1`).
- The backend decrypts secrets into memory only immediately prior to executing external API calls, discarding them immediately afterward.

---

## 3. Workflow Implementation Specifications

### Workflow 1: Repository Onboarding & Webhook Ingestion

1. Frontend initiates repository connection.
2. Backend verifies repository permissions with GitHub App.
3. Backend records repository in `public.repositories`:
   ```sql
   INSERT INTO public.repositories (
       workspace_id, provider, external_repo_id, owner_name, name, url, default_branch, runtime
   ) VALUES (
       $1, 'github', $2, $3, $4, $5, 'main', 'Node.js'
   ) RETURNING id;
   ```
4. If a duplicate repository is registered for that workspace, PostgreSQL constraint `uq_repo_per_workspace` raises an exception (`SQLSTATE 23505`). Catch this and return an HTTP 409 Conflict.

---

### Workflow 2: Automated Code Security Scan Execution

1. Scan is queued: Insert into `public.analyses` with `status = 'queued'`.
2. Worker acquires job: Updates `status = 'running'`, `started_at = now()`.
3. Worker completes scan: Updates `status = 'completed'`, `duration_seconds`, summary counts, and safe diagnostic logs.

---

### Workflow 3: Deduplication & Finding Triage

To prevent findings from multiplying across repeated scans, use canonical fingerprinting:

```mermaid
flowchart LR
    ScanResults["Raw Scanner Output"] --> Hasher["Fingerprint Generator<br>SHA-256(repo_id + rule_id + file + sink)"]
    Hasher --> UpsertFinding["UPSERT Canonical Finding<br>(public.findings)"]
    UpsertFinding --> InsertOccurrence["INSERT Scan Occurrence<br>(public.analysis_findings)"]
```

#### Step 3A: Compute or Query Fingerprint
Call PostgreSQL helper function:
```sql
SELECT public.generate_finding_fingerprint($repo_id, $rule_id, $file_path, $normalized_sink);
```

#### Step 3B: Upsert Canonical Finding
```sql
INSERT INTO public.findings (
    workspace_id, repository_id, fingerprint, cve_id, cwe_id, title,
    description, severity, confidence, reachability, cvss_score,
    affected_file, start_line, end_line, scanner_name, rule_id,
    remediation_guidance, first_detected_analysis_id, latest_analysis_id, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $analysis_id, $analysis_id, 'open'
)
ON CONFLICT (repository_id, fingerprint) DO UPDATE SET
    latest_analysis_id = EXCLUDED.latest_analysis_id,
    start_line = EXCLUDED.start_line,
    end_line = EXCLUDED.end_line,
    updated_at = timezone('utc'::text, now())
RETURNING id;
```

#### Step 3C: Record Point-in-Time Occurrence
```sql
INSERT INTO public.analysis_findings (
    analysis_id, finding_id, file_path, start_line, end_line, evidence_snippet
) VALUES (
    $analysis_id, $finding_id, $file_path, $start_line, $end_line, $evidence_snippet
)
ON CONFLICT (analysis_id, finding_id) DO NOTHING;
```

---

### Workflow 4: Autonomous Patch Synthesis & Versioning

1. When the AI agent synthesizes a patch, create the parent record in `public.patches`:
   ```sql
   INSERT INTO public.patches (
       workspace_id, repository_id, finding_id, target_branch, status,
       title, explanation, rationale, model_provider, model_name,
       generation_prompt_tokens, generation_completion_tokens, current_version_number
   ) VALUES (
       $ws_id, $repo_id, $finding_id, $branch, 'ready_for_review',
       $title, $explanation, $rationale, 'anthropic', 'claude-3-5-sonnet-20241022',
       $prompt_tokens, $comp_tokens, 1
   ) RETURNING id;
   ```
2. Insert the immutable diff into `public.patch_versions`:
   ```sql
   INSERT INTO public.patch_versions (
       patch_id, version_number, diff_content, original_snippet,
       proposed_snippet, content_hash, generation_metadata
   ) VALUES (
       $patch_id, 1, $diff_content, $original, $proposed, $sha256_hash, $metadata
   ) RETURNING id;
   ```

> [!IMPORTANT]
> The database trigger `block_patch_version_alteration` will abort any `UPDATE` queries that attempt to modify `diff_content` or `content_hash`. All patch refinements must be recorded as an incremented `version_number`.

---

### Workflow 5: Human Peer Review

1. A human reviewer (Security Engineer or Admin) evaluates the patch version.
2. The review is recorded in `public.patch_reviews`:
   ```sql
   INSERT INTO public.patch_reviews (
       patch_version_id, reviewer_id, decision, comments
   ) VALUES (
       $version_id, auth.uid(), 'approved', 'Verified HMAC checks and constant-time string comparison.'
   );
   ```
3. Update `patches.status` to match the decision (`approved`, `rejected`, or `changes_requested`).

---

### Workflow 6: Isolated MicroVM Sandboxing & Verification

> [!WARNING]
> A patch is **never verified** by virtue of code synthesis or peer approval alone. Real verification occurs only upon successful execution of isolated test stages.

1. **Queue Sandbox Execution:**
   ```sql
   INSERT INTO public.sandbox_runs (
       workspace_id, repository_id, patch_version_id, execution_environment,
       isolation_config, network_policy, status
   ) VALUES (
       $ws_id, $repo_id, $version_id, 'gvisor_microvm',
       '{"runtime": "runsc", "memory_limit_mb": 2048, "cpu_quota": 2}'::jsonb,
       'deny_all', 'running'
   ) RETURNING id;
   ```
2. **Execute Individual Verification Check Stages:**
   For each test stage (`build_verification`, `vulnerability_replay`, `regression_test`, `post_patch_sast`):
   ```sql
   INSERT INTO public.verification_checks (
       sandbox_run_id, check_type, check_name, status, tests_passed, tests_failed, tests_total, evidence_reference
   ) VALUES (
       $sandbox_run_id, 'regression_test', 'Unit & Integration Regression Suite', 'passed', 42, 0, 42, 'evidence/junit-results.xml'
   );
   ```
3. **Record Cryptographic Attestation Digest:**
   When all stages pass, compute the SHA-256 digest of the execution log and update the sandbox run:
   ```sql
   UPDATE public.sandbox_runs SET
       status = 'passed',
       exit_code = 0,
       execution_summary = 'All test stages passed with zero regressions.',
       attestation_hash = $attestation_digest,
       completed_at = timezone('utc'::text, now())
   WHERE id = $sandbox_run_id;
   ```

---

### Workflow 7: Immutable Audit Logging

Backend services record significant security and configuration actions using `public.audit_logs`:

```sql
INSERT INTO public.audit_logs (
    workspace_id, actor_id, actor_email, category, action,
    entity_type, entity_id, ip_address, user_agent, status, metadata
) VALUES (
    $ws_id, $actor_id, $actor_email, 'patch', 'Patch Version Approved',
    'patch_version', $version_id, $client_ip::inet, $user_agent, 'success', $meta_json
);
```

> [!NOTE]
> Database trigger `block_audit_log_updates` blocks any `UPDATE` or `DELETE` statements on `public.audit_logs`. The table is strictly append-only.

---

## 4. Handling Transactions & Database Errors

1. **Atomic Transactions:**
   Always wrap multi-step operations (e.g. creating a patch and its initial patch version) in a transaction block:
   ```typescript
   // Example with Supabase Postgres RPC or Node-Postgres Client
   await client.query('BEGIN');
   try {
     const patch = await insertPatch(...);
     await insertPatchVersion(patch.id, ...);
     await client.query('COMMIT');
   } catch (err) {
     await client.query('ROLLBACK');
     throw err;
   }
   ```
2. **Known Constraint Error Codes:**
   - `23505 (unique_violation)`: Duplicate workspace slug, repository name, member assignment, or patch version sequence.
   - `23503 (foreign_key_violation)`: Invalid workspace, repository, or finding reference.
   - `P0001 (raise_exception)`: Custom trigger exception (e.g., self-privilege escalation attempt or audit log modification attempt).

---

## 5. What Remains for Backend Implementation

| Module | Responsibility Needed |
|:---|:---|
| **VCS Webhook Handler** | Receive GitHub/GitLab webhook events, verify HMAC signature, and queue an `analyses` row. |
| **AST Scanner Worker** | Pull repository code at target commit SHA, run Semgrep/AST taint engine, parse output, and upsert `findings`. |
| **LLM Synthesis Worker**| Fetch vulnerable code AST slice, call Anthropic/Gemini API, validate syntax, and insert into `patches` and `patch_versions`. |
| **MicroVM Runner Daemon**| Spawn ephemeral gVisor (`runsc`) container with `network_policy = deny_all`, execute test suite, record `verification_checks`. |
| **Attestation Signer** | Sign microVM execution trace with KMS private key, computing the `attestation_hash`. |
| **Secret Vault Integration** | Store OAuth tokens and API keys in Supabase Vault / AWS Secrets Manager; inject `secret_ref` pointers into `integration_connections`. |
