# HealForge Database Security Architecture & Threat Model

This document outlines the security architecture, authorization model, Row Level Security (RLS) policies, and defense-in-depth safeguards engineered into the HealForge PostgreSQL database foundation.

---

## 1. Security Design Principles

1. **Defense-in-Depth:** Authorization is enforced at the database engine level via Row Level Security (RLS) and constraints, not merely in the frontend or middleware application logic.
2. **Strict Multi-Tenant Isolation:** Users cannot query, insert, or manipulate records belonging to another workspace simply by forging UUIDs.
3. **Compound Key Boundary Enforcement:** Composite foreign keys (`FOREIGN KEY (repository_id, workspace_id) REFERENCES repositories(id, workspace_id)`) prevent cross-tenant object manipulation.
4. **Append-Only Tamper Resistance:** Audit logs and historical patch version diffs are protected by database triggers that reject `UPDATE` and `DELETE` operations.
5. **Zero Plaintext Credentials:** API keys, personal access tokens, and private keys are barred from ordinary database columns.

---

## 2. Role-Based Access Control (RBAC) Matrix

Workspaces employ a 5-tier role hierarchy. Each role inherits permissions of all roles beneath it:

```text
Owner (Rank 50) ──> Admin (Rank 40) ──> Security Engineer (Rank 30) ──> Developer (Rank 20) ──> Viewer (Rank 10)
```

| Capability | Viewer (10) | Developer (20) | Security Engineer (30) | Admin (40) | Owner (50) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **View Repositories & Findings** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inspect Patches & Verifications** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Audit Trail & Compliance Reports** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **View Integration Connections Config** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Trigger New Scans & Analyses** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Propose Patches & Versions** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Triage Findings (Mark False Positive)** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Approve / Reject Patches** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Queue MicroVM Sandbox Runs** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Connect / Disconnect Repositories** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Configure External Integrations** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Invite / Manage Team Members** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Transfer Ownership / Delete Workspace**| ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Row Level Security (RLS) Implementation

Row Level Security is enabled on **all 15 tables** in the `public` schema.

### Core Helper Functions (Security Definer Hardening)

Per Supabase official security guidance, all `SECURITY DEFINER` functions are hardened against search_path substitution attacks by setting an empty search path (`SET search_path = ''`) and schema-qualifying all table references (`public.`), enum types (`public.`), auth calls (`auth.uid()`), system functions (`pg_catalog.`), and extensions (`extensions.digest()`):

- `public.role_rank(role public.workspace_role) RETURNS integer`: Computes numeric rank (IMMUTABLE).
- `public.get_user_workspace_role(target_workspace_id uuid, check_user_id uuid) RETURNS public.workspace_role`: Checks active membership (`SECURITY DEFINER SET search_path = ''`). Enforces strict caller authorization: if an authenticated user calls this function with another user's ID (`caller_id <> check_user_id`), the caller must themselves be an active member of `target_workspace_id`; otherwise, the function returns `NULL` to prevent unauthorized role and workspace discovery.
- `public.has_workspace_role(target_workspace_id uuid, required_role public.workspace_role, check_user_id uuid) RETURNS boolean`: Evaluates whether the user holds at least the required role rank (`SECURITY DEFINER SET search_path = ''`). Inherits disclosure protection via `get_user_workspace_role`.
- `public.is_workspace_member(target_workspace_id uuid, check_user_id uuid) RETURNS boolean`: Evaluates active membership (`SECURITY DEFINER SET search_path = ''`). Inherits disclosure protection via `get_user_workspace_role`.
- `public.prevent_role_escalation() RETURNS trigger`: Self-privilege escalation prevention (`SECURITY DEFINER SET search_path = ''`).
- `public.handle_new_workspace() RETURNS trigger`: Auto-provisions workspace creator as active owner (`SECURITY DEFINER SET search_path = ''`).
- `public.handle_new_user() RETURNS trigger`: Provisions user profile on auth signup (`SECURITY DEFINER SET search_path = ''`).

Additionally, execute privileges on helper functions are revoked from `PUBLIC` and granted strictly to `authenticated` and `service_role`.

### Table Policy Summaries

```text
PROFILES
  SELECT: Authenticated users sharing at least one common active workspace, or own profile.
  INSERT: id = auth.uid() (allows self-registration).
  UPDATE: auth.uid() = id only.
  DELETE: Managed by auth triggers / Supabase Auth.

WORKSPACES
  SELECT: is_workspace_member(id).
  INSERT: Authenticated users (must be owner_id).
  UPDATE: has_workspace_role(id, 'admin').
  DELETE: has_workspace_role(id, 'owner').

WORKSPACE_MEMBERS
  SELECT: is_workspace_member(workspace_id).
  INSERT/UPDATE: has_workspace_role(workspace_id, 'admin').
  DELETE: has_workspace_role(workspace_id, 'admin') OR (user_id = auth.uid() AND role <> 'owner' for self-leave).
  * Trigger enforce_role_escalation_rules blocks self-promotion, owner demotion, and deleting the last active owner.

REPOSITORIES
  SELECT: is_workspace_member(workspace_id).
  INSERT/UPDATE: has_workspace_role(workspace_id, 'security_engineer').
  DELETE: has_workspace_role(workspace_id, 'admin').

INTEGRATION_CONNECTIONS
  SELECT: has_workspace_role(workspace_id, 'security_engineer'). (Hidden from developers/viewers).
  INSERT/UPDATE/DELETE: has_workspace_role(workspace_id, 'admin').

ANALYSES
  SELECT: is_workspace_member(workspace_id).
  INSERT/UPDATE: has_workspace_role(workspace_id, 'developer').
  DELETE: has_workspace_role(workspace_id, 'admin').

FINDINGS & ANALYSIS_FINDINGS
  SELECT: is_workspace_member(workspace_id).
  INSERT/UPDATE: has_workspace_role(workspace_id, 'developer').
  DELETE: has_workspace_role(workspace_id, 'admin').

PATCHES & PATCH_VERSIONS
  SELECT: is_workspace_member(workspace_id).
  INSERT/UPDATE: has_workspace_role(workspace_id, 'developer').
  DELETE: has_workspace_role(workspace_id, 'admin').
  * Trigger block_patch_version_alteration blocks UPDATE of diff_content, content_hash, or version_number.

PATCH_REVIEWS
  SELECT: is_workspace_member(workspace_id).
  INSERT: has_workspace_role(workspace_id, 'security_engineer') AND reviewer_id = auth.uid().
  UPDATE/DELETE: Restricted (immutable review history).

SANDBOX_RUNS & VERIFICATION_CHECKS
  SELECT: is_workspace_member(workspace_id).
  INSERT: has_workspace_role(workspace_id, 'developer').
  UPDATE: has_workspace_role(workspace_id, 'security_engineer') or service role.
  DELETE: has_workspace_role(workspace_id, 'admin').

AUDIT_LOGS
  SELECT: has_workspace_role(workspace_id, 'security_engineer') OR actor_id = auth.uid() (personal activity).
  INSERT: Authenticated workspace members or trusted backend worker.
  * Trigger block_audit_log_updates blocks all UPDATE and DELETE statements.

SAVED_REPORTS
  SELECT: is_workspace_member(workspace_id).
  INSERT/UPDATE: has_workspace_role(workspace_id, 'developer').
  DELETE: has_workspace_role(workspace_id, 'security_engineer').
```

---

## 4. Privilege Escalation Prevention Trigger

Even if an attacker gains administrative API access to a workspace, the PostgreSQL trigger `enforce_role_escalation_rules` enforces hard database-level barriers on `public.workspace_members`:

```sql
-- Prevents a user from updating their own role
IF TG_OP = 'UPDATE' AND OLD.user_id = current_actor AND NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'Privilege Escalation Blocked: You cannot modify your own workspace role.';
END IF;

-- Prevents an admin from granting owner permissions or modifying an existing owner
IF actor_role = 'admin' AND TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'owner' THEN
    RAISE EXCEPTION 'Access Denied: Only the workspace owner can transfer or assign owner privileges.';
END IF;

-- Prevents removing the last active owner of a workspace
IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    IF NOT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = target_ws AND user_id <> OLD.user_id AND role = 'owner' AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Operation Blocked: Cannot remove the last active owner of a workspace.';
    END IF;
END IF;

-- Prevents an actor from assigning a role higher than their own rank
IF TG_OP IN ('INSERT', 'UPDATE') AND role_rank(NEW.role) > role_rank(actor_role) THEN
    RAISE EXCEPTION 'Privilege Escalation Blocked: You cannot grant a role higher than your own.';
END IF;
```

---

## 5. Credential Storage & Secret Boundary

### Zero Plaintext Ingestion
The database explicitly prohibits plaintext storage of credentials:
- `integration_connections.secret_ref`: Contains a string token or UUID referencing Supabase Vault (`vault.decrypted_secrets`) or a cloud KMS resource (AWS Secrets Manager ARN / HashiCorp Vault path).
- Under no circumstances should backend code write OAuth tokens or API keys directly to `metadata` JSONB columns or general database fields.

### Service Role Key Protection
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security policies.
- It must **NEVER** be committed to Git, bundled into frontend client packages, or exposed via public HTTP endpoints.
- Store the service role key exclusively in backend runtime environments (AWS ECS Task Definitions, Google Cloud Run secrets, Kubernetes Secrets).

---

## 6. Known Limitations & Security Considerations

1. **Direct Database Connection (`DATABASE_URL`):**
   - Direct PostgreSQL connections made using the `postgres` superuser bypass RLS. Backend engineers using ORMs must ensure they either connect using a scoped role with RLS enabled or strictly enforce tenant constraints in queries.
2. **Denial of Service via High Ingestion:**
   - Analysis scan logs and findings count should be capped by the backend worker before batch insertion to prevent database storage exhaustion.
3. **Database Audit Log Archival:**
   - While `audit_logs` are protected from modification by database triggers, production systems should periodically replicate audit records to write-once-read-many (WORM) storage (such as AWS S3 Object Lock) for compliance with PCI-DSS and SOC2 regulations.
