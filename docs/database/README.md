# HealForge Database Foundation

Welcome to the HealForge Database Foundation. This directory and the accompanying `supabase/` directory contain the complete relational schema, Row Level Security (RLS) policies, database triggers, seed demonstration data, automated test suites, and backend integration specifications for the **HealForge Autonomous Code Security Analysis and Remediation Workbench**.

---

## 1. Quick Overview

- **Engine:** PostgreSQL 15+ (via Supabase)
- **Primary Schema:** `public`
- **Isolation Model:** Multi-tenant Workspace Isolation with strict Row Level Security (RLS)
- **Role Hierarchy:** Owner (50) → Admin (40) → Security Engineer (30) → Developer (20) → Viewer (10)
- **Core Tables:** 13 primary domain entities + 2 audit/occurrence extensions (`audit_logs`, `saved_reports`, `analysis_findings`)
- **Type Generation:** Full TypeScript definitions exported at [`src/types/database.types.ts`](../../src/types/database.types.ts)

---

## 2. Directory Structure

```text
healforge/
├── supabase/
│   ├── config.toml                     # Supabase project configuration
│   ├── seed.sql                        # Synthetic demonstration dataset
│   ├── migrations/
│   │   ├── 20261027120000_core_schema.sql            # Tables, compound keys, indexes, enums
│   │   ├── 20261027120100_functions_and_triggers.sql # RBAC, immutability, updated_at, dedup
│   │   └── 20261027120200_row_level_security.sql     # RLS policies across all tables
│   └── tests/
│       ├── 01_schema_structure.test.sql             # pgTAP schema & constraint tests
│       ├── 02_security_rls.test.sql                 # pgTAP RLS enablement & helper tests
│       ├── 03_immutability_and_dedup.test.sql       # pgTAP immutability & dedup tests
│       └── 04_behavioral_security.test.sql          # pgTAP live behavioral tests (escalation, isolation, last-owner)
├── scripts/
│   └── test-database.cjs               # Offline static DDL, constraint & contract pre-flight validator
├── docs/database/
│   ├── README.md                       # This setup & operations guide
│   ├── SCHEMA.md                       # Detailed table dictionary & lifecycle models
│   ├── ERD.md                          # Mermaid Entity-Relationship diagrams
│   ├── BACKEND_HANDOFF.md              # Teammate integration guide & operational workflows
│   └── SECURITY.md                     # Security boundaries, RLS policies & credential isolation
└── src/types/
    └── database.types.ts               # Generated TypeScript database types
```

---

## 3. Prerequisites

### Essential
- **Node.js**: v20+ / v22+ (LTS)
- **npm**: v10+

### Recommended for Local Containerized PostgreSQL
- **Docker Desktop** or **Podman** / **OrbStack** (required by Supabase CLI to start the local PostgreSQL daemon and Studio locally).
- If Docker is not installed on the development machine, all SQL migrations, structural rules, seed data, and TypeScript types can still be validated using the built-in offline test suite (`npm run test:db`).

---

## 4. Local Development & Setup

### Step A: Initialize and Start Supabase (When Docker is present)

1. Verify Docker is running:
   ```bash
   docker info
   ```

2. Start the local Supabase stack:
   ```bash
   npx supabase start
   ```
   *This starts the PostgreSQL database on port `54322`, the REST API on port `54321`, Supabase Studio web dashboard on port `54323`, and the Inbucket local mail server on port `54324`.*

3. Apply database migrations:
   ```bash
   npx supabase db reset
   ```
   *`db reset` recreates the local database from scratch, executes all migrations in `supabase/migrations/` in chronological order, and loads `supabase/seed.sql`.*

### Step B: Offline Static Validation (No Docker Required)

If Docker is not currently running, you can run the offline static contract validator:

```bash
npm run test:db
```

> [!NOTE]
> This suite performs static AST/regex analysis on migration source files, constraint integrity, seed referential links, and TypeScript types parity. It does **not** connect to a live PostgreSQL server.

### Step C: Execute Live pgTAP Behavioral Tests (Requires Docker)

When Docker is running with `npx supabase start`:

```bash
npx supabase test db
```

This executes all 4 pgTAP test suites (`01` through `04`) directly inside the local PostgreSQL engine, testing:
- Workspace creation & owner auto-provisioning
- Last-owner deletion and demotion rejection (`throws_ok`)
- Self-privilege escalation denial
- Audit log & patch version immutability triggers
- Unique constraint duplicate finding rejection
- Cross-workspace compound foreign key violation rejection (`23503`)

---

## 5. Working with Migrations

### Creating a New Migration
Always create versioned migrations rather than editing existing applied migrations:

```bash
npx supabase migration new <migration_name>
```

This generates an empty timestamped SQL file in `supabase/migrations/`.

### Regenerating TypeScript Types
After altering or creating tables, regenerate the TypeScript database contract:

```bash
npx supabase gen types typescript --local > src/types/database.types.ts
```

---

## 6. Synthetic Seed Data

The provided `supabase/seed.sql` contains a safe, comprehensive demonstration dataset:
- **Workspaces:**
  - `Acme Corp Security Operations` (`acme-corp-secops`) — Primary enterprise tenant
  - `Beta Dynamics Sandbox` (`beta-dynamics-test`) — Isolated tenant for cross-tenant testing
- **Demonstration Users:**
  - `alex.vance@healforge.internal` (Workspace Owner / Principal Security Engineer)
  - `sarah.chen@healforge.internal` (Admin / Head of SecOps)
  - `marcus.brody@healforge.internal` (Developer / Senior Backend)
  - `elena.rostova@healforge.internal` (Viewer / Compliance Auditor)
  - `dave.miller@betadynamics.internal` (Beta Dynamics Owner)
- **Demonstration Repositories:** `auth-service` (Node.js), `payments-api` (Python), `ingestion-pipeline` (Go)
- **Scans & Findings:** SAST analyses, CVE-2024-41110, CVE-2024-2149, HWP-2024-881
- **Patches & Verification:** Multi-version AST patches, peer reviews, gVisor microVM sandbox runs, attestation hashes

> [!NOTE]
> All seed records carry an explicit flag `{"is_synthetic": true}` in their `metadata` or settings fields. Never represent these mock records as real production vulnerability findings or operational evidence.

---

## 7. Connecting the Application

Configure your local environment variables in `.env.local` (never commit real credentials):

```env
# Supabase Local Development Settings
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend Service Worker (Private Service Role)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

For complete integration guidance, see [`BACKEND_HANDOFF.md`](./BACKEND_HANDOFF.md).
