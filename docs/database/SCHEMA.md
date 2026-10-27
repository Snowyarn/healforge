# HealForge Relational Database Schema Specification

This document details the database schema designed for the **HealForge Autonomous Code Security Analysis and Remediation Workbench**.

---

## 1. Architectural Highlights

- **Identifier Standard:** RFC 4122 UUID (`uuid_generate_v4()` / `gen_random_uuid()`).
- **Temporal Standard:** All timestamps use `TIMESTAMPTZ` with `timezone('utc'::text, now())`.
- **Tenant Isolation:** Enforced via `workspace_id` scoping and PostgreSQL **compound foreign keys** across related tables.
- **Deduplication Strategy:** Canonical vulnerabilities are decoupled from point-in-time scan occurrences via deterministic SHA-256 fingerprinting.
- **Immutability Safeguards:** Database triggers prevent tampering with audit logs and patch version diffs.

---

## 2. Global Enums

| Enum Type | Allowed Values | Description |
|:---|:---|:---|
| `workspace_role` | `owner`, `admin`, `security_engineer`, `developer`, `viewer` | RBAC hierarchy used for workspace-level permission evaluation. |
| `membership_status` | `active`, `invited`, `suspended` | Status of a user's membership in a workspace. |
| `repository_provider` | `github`, `gitlab`, `bitbucket`, `other` | Git VCS hosting provider. |
| `connection_status` | `connected`, `disconnected`, `syncing`, `error` | Health status of repository integration. |
| `integration_provider` | `github`, `gitlab`, `bitbucket`, `anthropic`, `openai`, `gemini`, `gvisor_sandbox`, `slack`, `jira`, `custom_webhook` | Third-party service integration provider. |
| `integration_status` | `active`, `inactive`, `revoked`, `error` | Connection status for an external service. |
| `scan_trigger` | `manual`, `ci_webhook`, `cron`, `pr_hook` | Ingestion source initiating an analysis run. |
| `scan_type` | `sast`, `sbom`, `secrets`, `container_audit`, `composite` | Scope/engine of the security analysis. |
| `scan_status` | `queued`, `running`, `completed`, `failed`, `cancelled` | Execution lifecycle status of an analysis run. |
| `vulnerability_severity` | `critical`, `high`, `medium`, `low` | Standard 4-tier security severity rating. |
| `finding_confidence` | `high`, `medium`, `low` | Scanner heuristic confidence level. |
| `reachability_status` | `reachable`, `unreachable`, `unknown` | AST call-graph reachability confirmation. |
| `finding_status` | `open`, `in_progress`, `patch_generated`, `verified_fixed`, `false_positive`, `ignored`, `closed` | Canonical finding remediation state. |
| `patch_status` | `generating`, `ready_for_review`, `under_review`, `approved`, `rejected`, `changes_requested`, `applied`, `superseded` | Patch generation & review state. |
| `review_decision` | `approved`, `rejected`, `changes_requested` | Peer reviewer decision on a patch version. |
| `sandbox_status` | `queued`, `initializing`, `running`, `passed`, `failed`, `timeout`, `cancelled` | MicroVM sandbox container execution state. |
| `network_policy_type` | `deny_all`, `isolated_local_only`, `allow_package_registry` | Egress network rules for sandboxes. |
| `verification_check_type`| `build_verification`, `regression_test`, `vulnerability_replay`, `post_patch_sast` | Specific automated validation check stage. |
| `verification_check_status` | `pending`, `running`, `passed`, `failed`, `skipped` | Verification check test outcome. |
| `audit_category` | `auth`, `profile`, `security`, `api`, `billing`, `team`, `privacy`, `repository`, `analysis`, `patch`, `verification` | Categorization for audit trail events. |
| `audit_status` | `success`, `warning`, `failed` | Audit event execution result. |
| `report_type` | `vulnerability_summary`, `project_assessment`, `scan_audit`, `sandbox_attestation`, `custom` | Scope of generated compliance report. |
| `report_format` | `PDF`, `Markdown`, `JSON`, `CSV` | Export document format. |

---

## 3. Table Dictionary

### 3.1 `profiles`
Application profile information linked 1:1 with Supabase Auth users. Never stores authentication credentials.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Matches the Supabase Auth user UUID. |
| `email` | `TEXT` | `NOT NULL` | User primary email address. |
| `full_name` | `TEXT` | `NOT NULL DEFAULT ''` | Full legal or display name. |
| `display_name` | `TEXT` | `NOT NULL DEFAULT ''` | UI preferred display handle. |
| `username` | `TEXT` | `UNIQUE`, `CHECK (length >= 3)` | System-wide unique handle. |
| `avatar_url` | `TEXT` | | Optional avatar image URL. |
| `job_title` | `TEXT` | `NOT NULL DEFAULT ''` | Professional designation. |
| `role_title` | `TEXT` | `NOT NULL DEFAULT 'Security Engineer'` | Functional persona. |
| `organization` | `TEXT` | `NOT NULL DEFAULT ''` | Employer or company name. |
| `department` | `TEXT` | `NOT NULL DEFAULT ''` | Organizational unit. |
| `bio` | `TEXT` | `NOT NULL DEFAULT ''` | Biography / security focus areas. |
| `phone` | `TEXT` | `NOT NULL DEFAULT ''` | Contact telephone number. |
| `location` | `TEXT` | `NOT NULL DEFAULT ''` | Location or timezone. |
| `expertise` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | High-level focus competencies. |
| `skills` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Languages, frameworks, and tools. |
| `github_url` | `TEXT` | `NOT NULL DEFAULT ''` | GitHub profile link. |
| `website_url` | `TEXT` | `NOT NULL DEFAULT ''` | Personal/portfolio website URL. |
| `linkedin_url` | `TEXT` | `NOT NULL DEFAULT ''` | LinkedIn professional URL. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Registration timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

---

### 3.2 `workspaces`
Tenant boundary grouping repositories, integrations, team members, scans, patches, and audit trails.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique workspace identifier. |
| `name` | `TEXT` | `NOT NULL` | Display name of the organization. |
| `slug` | `TEXT` | `NOT NULL UNIQUE`, `CHECK (slug ~* '^[a-z0-9-]+$')` | URL-safe workspace slug. |
| `owner_id` | `UUID` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE RESTRICT` | Primary workspace owner. |
| `description` | `TEXT` | `NOT NULL DEFAULT ''` | Workspace summary. |
| `tier` | `TEXT` | `NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise'))` | Subscription tier. |
| `settings` | `JSONB` | `NOT NULL DEFAULT '{}'` | Tenant configuration flags. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

---

### 3.3 `workspace_members`
RBAC membership table defining user roles within a workspace.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Membership row identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Associated workspace. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Member user identifier. |
| `role` | `workspace_role` | `NOT NULL DEFAULT 'developer'` | Assigned RBAC role. |
| `status` | `membership_status` | `NOT NULL DEFAULT 'active'` | State of membership. |
| `invited_by` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Inviter user identifier. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Join/invite timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `UNIQUE (workspace_id, user_id)` prevents duplicate memberships. Trigger `enforce_role_escalation_rules` prevents members from elevating their own privileges or assigning roles higher than their own rank.

---

### 3.4 `repositories`
Registered codebases monitored for vulnerabilities and automated remediation.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Repository record identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Parent workspace tenant. |
| `provider` | `repository_provider` | `NOT NULL DEFAULT 'github'` | Git hosting provider. |
| `external_repo_id` | `TEXT` | | Provider's external ID (e.g. `github:19824`). |
| `owner_name` | `TEXT` | `NOT NULL` | Repository owner/organization namespace. |
| `name` | `TEXT` | `NOT NULL` | Repository repository name. |
| `url` | `TEXT` | `NOT NULL` | Git clone or browse URL. |
| `default_branch` | `TEXT` | `NOT NULL DEFAULT 'main'` | Base branch for scans and patches. |
| `runtime` | `TEXT` | `NOT NULL DEFAULT 'Node.js'` | Detected programming runtime/stack. |
| `security_score` | `INTEGER` | `NOT NULL DEFAULT 100 CHECK (0 <= score <= 100)` | Computed security posture score. |
| `connection_status` | `connection_status` | `NOT NULL DEFAULT 'connected'` | VCS webhook & sync state. |
| `last_scan_at` | `TIMESTAMPTZ`| | Timestamp of most recent completed scan. |
| `open_vuln_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (open_vuln_count >= 0)` | Active open findings count. |
| `critical_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (critical_count >= 0)` | Critical severity count. |
| `high_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (high_count >= 0)` | High severity count. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `UNIQUE (workspace_id, provider, owner_name, name)` blocks duplicate registrations. `UNIQUE (id, workspace_id)` enables compound foreign key relationships from child tables.

---

### 3.5 `integration_connections`
Third-party credentials metadata and service integration connectors.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Connector record identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Parent workspace tenant. |
| `provider` | `integration_provider` | `NOT NULL` | Target service. |
| `name` | `TEXT` | `NOT NULL` | Human-readable connection name. |
| `status` | `integration_status` | `NOT NULL DEFAULT 'active'` | Operational status. |
| `account_identifier` | `TEXT` | | External account ID / bot username. |
| `scopes` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Granted authorization scopes. |
| `secret_ref` | `TEXT` | | Reference key to Supabase Vault / KMS (never plaintext). |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | Non-sensitive connection configuration. |
| `last_sync_at`| `TIMESTAMPTZ`| | Last health check or sync timestamp. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Registration timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `UNIQUE (workspace_id, provider, account_identifier)`.

---

### 3.6 `analyses`
Execution records of automated code security scans, AST analyses, SBOM evaluations, and container audits.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Analysis run identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Tenant boundary. |
| `repository_id`| `UUID` | `NOT NULL` | Target repository. |
| `branch` | `TEXT` | `NOT NULL DEFAULT 'main'` | Target git branch. |
| `commit_sha` | `TEXT` | `NOT NULL` | Target git commit SHA. |
| `trigger_type`| `scan_trigger` | `NOT NULL DEFAULT 'manual'` | Trigger origin. |
| `scan_type` | `scan_type` | `NOT NULL DEFAULT 'sast'` | Engine analysis type. |
| `status` | `scan_status` | `NOT NULL DEFAULT 'queued'` | Execution lifecycle state. |
| `started_at` | `TIMESTAMPTZ`| | Execution start time. |
| `completed_at`| `TIMESTAMPTZ`| | Execution finish time. |
| `duration_seconds` | `INTEGER` | `CHECK (duration_seconds >= 0)` | Wall-clock elapsed time. |
| `findings_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (findings_count >= 0)` | Total vulnerabilities identified. |
| `critical_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (critical_count >= 0)` | Critical severity count. |
| `high_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (high_count >= 0)` | High severity count. |
| `medium_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (medium_count >= 0)` | Medium severity count. |
| `low_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (low_count >= 0)` | Low severity count. |
| `safe_error_message` | `TEXT`| | Sanitized non-sensitive failure log if failed. |
| `logs` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Diagnostic log lines. |
| `created_by` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Triggering user identifier. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `FOREIGN KEY (repository_id, workspace_id) REFERENCES repositories(id, workspace_id) ON DELETE CASCADE` guarantees repository and analysis belong to the identical workspace. `UNIQUE (id, workspace_id)` enables child compound foreign keys.

---

### 3.7 `findings`
Canonical vulnerability findings with deterministic deduplication across scan iterations.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique finding identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Tenant boundary. |
| `repository_id`| `UUID` | `NOT NULL` | Vulnerable repository. |
| `fingerprint` | `TEXT` | `NOT NULL` | SHA-256 deterministic hash of `(repo, rule, file, sink)`. |
| `cve_id` | `TEXT` | | Standard CVE identifier (e.g. `CVE-2024-41110`). |
| `cwe_id` | `TEXT` | | Standard CWE identifier (e.g. `CWE-288`). |
| `title` | `TEXT` | `NOT NULL` | Concise summary title. |
| `description` | `TEXT` | `NOT NULL` | Detailed vulnerability explanation. |
| `severity` | `vulnerability_severity` | `NOT NULL` | Severity classification. |
| `confidence` | `finding_confidence` | `NOT NULL DEFAULT 'high'` | Detection confidence. |
| `reachability`| `reachability_status` | `NOT NULL DEFAULT 'unknown'` | AST taint reachability assessment. |
| `cvss_score` | `NUMERIC(3, 1)` | `CHECK (0.0 <= cvss_score <= 10.0)` | CVSS v3.1 base score. |
| `affected_file`| `TEXT` | `NOT NULL` | Path relative to repository root. |
| `start_line` | `INTEGER` | `CHECK (start_line > 0)` | Beginning source line. |
| `end_line` | `INTEGER` | `CHECK (end_line >= start_line)` | Ending source line. |
| `scanner_name`| `TEXT` | `NOT NULL DEFAULT 'HealForge AST Engine'` | Tool or rule package that flagged the defect. |
| `rule_id` | `TEXT` | `NOT NULL` | Scanner-specific rule identifier. |
| `remediation_guidance` | `TEXT` | | Guidance on remediation approach. |
| `first_detected_analysis_id` | `UUID` | `REFERENCES analyses(id) ON DELETE SET NULL` | Initial discovery scan. |
| `latest_analysis_id` | `UUID` | `REFERENCES analyses(id) ON DELETE SET NULL` | Most recent confirming scan. |
| `status` | `finding_status` | `NOT NULL DEFAULT 'open'` | Lifecycle triage state. |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | Additional compliance/taint trace details. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Initial creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `UNIQUE (repository_id, fingerprint)` enforces that each unique defect has exactly one canonical record in `findings`. `FOREIGN KEY (repository_id, workspace_id) REFERENCES repositories(id, workspace_id) ON DELETE CASCADE` enforces cross-workspace integrity.

---

### 3.8 `analysis_findings`
Mapping table that links canonical `findings` to every historical `analysis` run where the vulnerability was observed.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Occurrence row identifier. |
| `analysis_id` | `UUID` | `NOT NULL`, `REFERENCES analyses(id) ON DELETE CASCADE` | Specific analysis execution. |
| `finding_id` | `UUID` | `NOT NULL`, `REFERENCES findings(id) ON DELETE CASCADE` | Canonical finding. |
| `file_path` | `TEXT` | `NOT NULL` | File path observed in this specific scan. |
| `start_line` | `INTEGER` | | Start line in this specific scan. |
| `end_line` | `INTEGER` | | End line in this specific scan. |
| `evidence_snippet` | `TEXT`| | Raw source code extract observed during scan. |
| `detected_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Detection time of this occurrence. |

*Constraints:* `UNIQUE (analysis_id, finding_id)` ensures an analysis records each canonical finding at most once.

---

### 3.9 `patches`
Autonomous remediation attempts synthesized for a canonical finding.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Patch record identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Tenant boundary. |
| `repository_id`| `UUID` | `NOT NULL` | Target repository. |
| `finding_id` | `UUID` | `NOT NULL` | Remedied finding. |
| `target_branch`| `TEXT` | `NOT NULL DEFAULT 'main'` | Target git branch for remediation PR. |
| `status` | `patch_status` | `NOT NULL DEFAULT 'ready_for_review'` | Patch lifecycle state. |
| `title` | `TEXT` | `NOT NULL` | Patch title / commit headline. |
| `explanation` | `TEXT` | `NOT NULL` | Remediation summary. |
| `rationale` | `TEXT` | | AST architectural and safety rationale. |
| `model_provider` | `TEXT` | | AI Provider (e.g. `anthropic`, `gemini`). |
| `model_name` | `TEXT` | | LLM Model (e.g. `claude-3-5-sonnet-20241022`). |
| `generation_prompt_tokens` | `INTEGER` | `CHECK (tokens >= 0)` | LLM prompt token count. |
| `generation_completion_tokens` | `INTEGER` | `CHECK (tokens >= 0)` | LLM response token count. |
| `current_version_number` | `INTEGER` | `NOT NULL DEFAULT 1 CHECK (version >= 1)` | Active version pointer. |
| `created_by` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Author user identifier. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `FOREIGN KEY (finding_id, workspace_id) REFERENCES findings(id, workspace_id) ON DELETE CASCADE` and `FOREIGN KEY (repository_id, workspace_id) REFERENCES repositories(id, workspace_id) ON DELETE CASCADE` enforce workspace containment.

---

### 3.10 `patch_versions`
Immutable versioned diff revisions for an ongoing remediation attempt.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Version record identifier. |
| `patch_id` | `UUID` | `NOT NULL`, `REFERENCES patches(id) ON DELETE CASCADE` | Parent patch. |
| `version_number` | `INTEGER` | `NOT NULL CHECK (version_number >= 1)` | Monotonically increasing revision number. |
| `diff_content` | `TEXT` | `NOT NULL` | Unified diff (`git diff`) payload. |
| `original_snippet` | `TEXT` | | Vulnerable source snippet before patch. |
| `proposed_snippet` | `TEXT` | | Proposed replacement source snippet. |
| `content_hash` | `TEXT` | `NOT NULL` | SHA-256 cryptographic digest of `diff_content`. |
| `generation_metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | Temperature, prompt version, AST mutation metadata. |
| `created_by` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Creator user identifier. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp. |

*Constraints:* `UNIQUE (patch_id, version_number)`. Trigger `block_patch_version_alteration` rejects `UPDATE` queries altering `diff_content`, `content_hash`, or `version_number`.

---

### 3.11 `patch_reviews`
Peer review decisions and comments recorded for a patch version.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Review row identifier. |
| `patch_version_id` | `UUID` | `NOT NULL`, `REFERENCES patch_versions(id) ON DELETE CASCADE` | Evaluated patch version. |
| `reviewer_id` | `UUID` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE RESTRICT` | Reviewer identity (cannot be spoofed). |
| `decision` | `review_decision` | `NOT NULL` | `approved`, `rejected`, or `changes_requested`. |
| `comments` | `TEXT` | `NOT NULL DEFAULT ''` | Review critique and suggestions. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Review submission timestamp. |

---

### 3.12 `sandbox_runs`
Isolated gVisor microVM test runs executing regression suites and exploit replays against patched code.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Sandbox run identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Tenant boundary. |
| `repository_id`| `UUID` | `NOT NULL` | Target repository. |
| `patch_version_id` | `UUID` | `NOT NULL`, `REFERENCES patch_versions(id) ON DELETE CASCADE` | Target patch version under test. |
| `container_id` | `TEXT` | | Internal worker container or microVM ID. |
| `execution_environment` | `TEXT` | `NOT NULL DEFAULT 'gvisor_microvm'` | MicroVM runtime (`runsc`, `firecracker`). |
| `isolation_config` | `JSONB` | `NOT NULL DEFAULT '{"runtime": "runsc"}'` | CPU/Memory caps and seccomp filters. |
| `network_policy` | `network_policy_type` | `NOT NULL DEFAULT 'deny_all'` | Egress firewall rule. |
| `status` | `sandbox_status` | `NOT NULL DEFAULT 'queued'` | Execution lifecycle state. |
| `exit_code` | `INTEGER` | | Process return code (0 = success). |
| `execution_summary` | `TEXT` | | High-level summary of verification outcome. |
| `safe_terminal_logs`| `TEXT` | | Sanitized stdout/stderr terminal output. |
| `duration_ms`| `INTEGER` | `CHECK (duration_ms >= 0)` | Total execution duration in milliseconds. |
| `attestation_hash` | `TEXT` | | Cryptographic SHA-256 digest of verified execution. |
| `started_at` | `TIMESTAMPTZ`| | Container start time. |
| `completed_at`| `TIMESTAMPTZ`| | Container termination time. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Queue timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

*Constraints:* `FOREIGN KEY (repository_id, workspace_id) REFERENCES repositories(id, workspace_id) ON DELETE CASCADE` enforces workspace boundary.

---

### 3.13 `verification_checks`
Individual test suite stages executed inside an isolated sandbox run.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Check record identifier. |
| `sandbox_run_id` | `UUID` | `NOT NULL`, `REFERENCES sandbox_runs(id) ON DELETE CASCADE` | Parent sandbox run. |
| `check_type` | `verification_check_type` | `NOT NULL` | `build_verification`, `regression_test`, `vulnerability_replay`, or `post_patch_sast`. |
| `check_name` | `TEXT` | `NOT NULL` | Display label (e.g. `Exploit Replay Neutralization`). |
| `status` | `verification_check_status` | `NOT NULL DEFAULT 'pending'` | Test result state. |
| `tests_passed` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (passed >= 0)` | Count of passed assertions. |
| `tests_failed` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (failed >= 0)` | Count of failed assertions. |
| `tests_total` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (total >= 0)` | Total assertions executed. |
| `evidence_reference` | `TEXT` | | File or object path to raw test report artifact. |
| `execution_metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | Framework, flags, and assertion logs. |
| `started_at` | `TIMESTAMPTZ`| | Stage start timestamp. |
| `completed_at`| `TIMESTAMPTZ`| | Stage completion timestamp. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |

---

### 3.14 `audit_logs`
Append-only, immutable audit trail recording security and governance events across workspaces.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Audit log identifier. |
| `workspace_id`| `UUID` | `REFERENCES workspaces(id) ON DELETE CASCADE` | Associated workspace (null for global auth). |
| `actor_id` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Performing user identity. |
| `actor_email`| `TEXT` | | Email of actor at execution time. |
| `category` | `audit_category` | `NOT NULL` | High-level audit domain. |
| `action` | `TEXT` | `NOT NULL` | Human-readable action description. |
| `entity_type`| `TEXT` | `NOT NULL` | Type of affected entity (`patch`, `repository`). |
| `entity_id` | `TEXT` | | Identifier of affected entity. |
| `ip_address` | `INET` | | Origin IP address. |
| `user_agent` | `TEXT` | | Origin browser or worker user agent string. |
| `status` | `audit_status` | `NOT NULL DEFAULT 'success'` | Event outcome. |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | Contextual non-sensitive event parameters. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Exact timestamp of the event. |

*Constraints:* Trigger `block_audit_log_updates` strictly prevents any `UPDATE` or `DELETE` statement on this table.

---

### 3.15 `saved_reports`
Persisted executive summaries, cryptographic attestation documents, and compliance records.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Report identifier. |
| `workspace_id`| `UUID` | `NOT NULL`, `REFERENCES workspaces(id) ON DELETE CASCADE` | Tenant boundary. |
| `title` | `TEXT` | `NOT NULL` | Formal report title. |
| `report_type` | `report_type` | `NOT NULL DEFAULT 'vulnerability_summary'` | Classification of report. |
| `created_by` | `UUID` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Author user identifier. |
| `format` | `report_format` | `NOT NULL DEFAULT 'PDF'` | Export format. |
| `filters` | `JSONB` | `NOT NULL DEFAULT '{}'` | Filters applied when generating the report. |
| `summary_snapshot` | `TEXT` | | Executive narrative summary. |
| `artifact_storage_path` | `TEXT` | | Storage path to exported PDF/JSON document. |
| `findings_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (findings_count >= 0)` | Findings included in report scope. |
| `critical_count` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (critical_count >= 0)` | Critical findings count. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Generation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Auto-updated via trigger. |
