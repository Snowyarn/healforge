-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — MIGRATION 01: CORE SCHEMA & CONSTRAINTS
-- Autonomous Code Security Analysis and Remediation Workbench
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAINS
CREATE TYPE public.workspace_role AS ENUM (
    'owner',
    'admin',
    'security_engineer',
    'developer',
    'viewer'
);

CREATE TYPE public.membership_status AS ENUM (
    'active',
    'invited',
    'suspended'
);

CREATE TYPE public.repository_provider AS ENUM (
    'github',
    'gitlab',
    'bitbucket',
    'other'
);

CREATE TYPE public.connection_status AS ENUM (
    'connected',
    'disconnected',
    'syncing',
    'error'
);

CREATE TYPE public.integration_provider AS ENUM (
    'github',
    'gitlab',
    'bitbucket',
    'anthropic',
    'openai',
    'gemini',
    'gvisor_sandbox',
    'slack',
    'jira',
    'custom_webhook'
);

CREATE TYPE public.integration_status AS ENUM (
    'active',
    'inactive',
    'revoked',
    'error'
);

CREATE TYPE public.scan_trigger AS ENUM (
    'manual',
    'ci_webhook',
    'cron',
    'pr_hook'
);

CREATE TYPE public.scan_type AS ENUM (
    'sast',
    'sbom',
    'secrets',
    'container_audit',
    'composite'
);

CREATE TYPE public.scan_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
);

CREATE TYPE public.vulnerability_severity AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

CREATE TYPE public.finding_confidence AS ENUM (
    'high',
    'medium',
    'low'
);

CREATE TYPE public.reachability_status AS ENUM (
    'reachable',
    'unreachable',
    'unknown'
);

CREATE TYPE public.finding_status AS ENUM (
    'open',
    'in_progress',
    'patch_generated',
    'verified_fixed',
    'false_positive',
    'ignored',
    'closed'
);

CREATE TYPE public.patch_status AS ENUM (
    'generating',
    'ready_for_review',
    'under_review',
    'approved',
    'rejected',
    'changes_requested',
    'applied',
    'superseded'
);

CREATE TYPE public.review_decision AS ENUM (
    'approved',
    'rejected',
    'changes_requested'
);

CREATE TYPE public.sandbox_status AS ENUM (
    'queued',
    'initializing',
    'running',
    'passed',
    'failed',
    'timeout',
    'cancelled'
);

CREATE TYPE public.network_policy_type AS ENUM (
    'deny_all',
    'isolated_local_only',
    'allow_package_registry'
);

CREATE TYPE public.verification_check_type AS ENUM (
    'build_verification',
    'regression_test',
    'vulnerability_replay',
    'post_patch_sast'
);

CREATE TYPE public.verification_check_status AS ENUM (
    'pending',
    'running',
    'passed',
    'failed',
    'skipped'
);

CREATE TYPE public.audit_category AS ENUM (
    'auth',
    'profile',
    'security',
    'api',
    'billing',
    'team',
    'privacy',
    'repository',
    'analysis',
    'patch',
    'verification'
);

CREATE TYPE public.audit_status AS ENUM (
    'success',
    'warning',
    'failed'
);

CREATE TYPE public.report_type AS ENUM (
    'vulnerability_summary',
    'project_assessment',
    'scan_audit',
    'sandbox_attestation',
    'custom'
);

CREATE TYPE public.report_format AS ENUM (
    'PDF',
    'Markdown',
    'JSON',
    'CSV'
);

-- ==============================================================================
-- 3. CORE TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. USERS AND WORKSPACES
-- ------------------------------------------------------------------------------

-- Application profile linked to Supabase Auth users (never stores passwords)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    username TEXT UNIQUE,
    avatar_url TEXT,
    job_title TEXT NOT NULL DEFAULT '',
    role_title TEXT NOT NULL DEFAULT 'Security Engineer',
    organization TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    expertise TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    skills TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    github_url TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL DEFAULT '',
    linkedin_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT username_length CHECK (username IS NULL OR char_length(username) >= 3)
);

-- Workspace tenant boundaries
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    description TEXT NOT NULL DEFAULT '',
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    settings JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT slug_format CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Workspace memberships and RBAC roles
CREATE TABLE public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.workspace_role NOT NULL DEFAULT 'developer',
    status public.membership_status NOT NULL DEFAULT 'active',
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

-- ------------------------------------------------------------------------------
-- B. REPOSITORIES AND INTEGRATIONS
-- ------------------------------------------------------------------------------

-- Repositories linked to workspaces
CREATE TABLE public.repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider public.repository_provider NOT NULL DEFAULT 'github',
    external_repo_id TEXT,
    owner_name TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    runtime TEXT NOT NULL DEFAULT 'Node.js',
    security_score INTEGER NOT NULL DEFAULT 100 CHECK (security_score >= 0 AND security_score <= 100),
    connection_status public.connection_status NOT NULL DEFAULT 'connected',
    last_scan_at TIMESTAMPTZ,
    open_vuln_count INTEGER NOT NULL DEFAULT 0 CHECK (open_vuln_count >= 0),
    critical_count INTEGER NOT NULL DEFAULT 0 CHECK (critical_count >= 0),
    high_count INTEGER NOT NULL DEFAULT 0 CHECK (high_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Prevent duplicate repo registrations in a workspace
    CONSTRAINT uq_repo_per_workspace UNIQUE (workspace_id, provider, owner_name, name),
    -- Supporting compound uniqueness for child workspace-consistency foreign keys
    CONSTRAINT uq_repo_workspace_composite UNIQUE (id, workspace_id)
);

-- Integrations metadata and secure boundary references
-- NOTE: Plaintext API keys, OAuth tokens and private keys are NEVER stored here.
-- Instead, secret_ref stores an identifier pointing to Supabase Vault or KMS.
CREATE TABLE public.integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider public.integration_provider NOT NULL,
    name TEXT NOT NULL,
    status public.integration_status NOT NULL DEFAULT 'active',
    account_identifier TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    secret_ref TEXT, -- Reference ID to Vault / KMS, never plaintext credentials
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_integration_account UNIQUE (workspace_id, provider, account_identifier)
);

-- ------------------------------------------------------------------------------
-- C. ANALYSIS AND FINDINGS
-- ------------------------------------------------------------------------------

-- Scans and security analysis executions
CREATE TABLE public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    commit_sha TEXT NOT NULL,
    trigger_type public.scan_trigger NOT NULL DEFAULT 'manual',
    scan_type public.scan_type NOT NULL DEFAULT 'sast',
    status public.scan_status NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    findings_count INTEGER NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
    critical_count INTEGER NOT NULL DEFAULT 0 CHECK (critical_count >= 0),
    high_count INTEGER NOT NULL DEFAULT 0 CHECK (high_count >= 0),
    medium_count INTEGER NOT NULL DEFAULT 0 CHECK (medium_count >= 0),
    low_count INTEGER NOT NULL DEFAULT 0 CHECK (low_count >= 0),
    safe_error_message TEXT,
    logs TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Enforce cross-workspace integrity: repository must belong to the same workspace
    CONSTRAINT fk_analysis_repository_workspace FOREIGN KEY (repository_id, workspace_id)
        REFERENCES public.repositories(id, workspace_id) ON DELETE CASCADE,
    -- Compound uniqueness for child workspace-consistency foreign keys
    CONSTRAINT uq_analysis_workspace_composite UNIQUE (id, workspace_id)
);

-- Canonical findings with deterministic fingerprinting for deduplication
CREATE TABLE public.findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    fingerprint TEXT NOT NULL, -- SHA-256 (repository_id, rule_id, affected_file, normalized_sink)
    cve_id TEXT,
    cwe_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity public.vulnerability_severity NOT NULL,
    confidence public.finding_confidence NOT NULL DEFAULT 'high',
    reachability public.reachability_status NOT NULL DEFAULT 'unknown',
    cvss_score NUMERIC(3, 1) CHECK (cvss_score IS NULL OR (cvss_score >= 0.0 AND cvss_score <= 10.0)),
    affected_file TEXT NOT NULL,
    start_line INTEGER CHECK (start_line IS NULL OR start_line > 0),
    end_line INTEGER CHECK (end_line IS NULL OR (start_line IS NOT NULL AND end_line >= start_line)),
    scanner_name TEXT NOT NULL DEFAULT 'HealForge AST Engine',
    rule_id TEXT NOT NULL,
    remediation_guidance TEXT,
    first_detected_analysis_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
    latest_analysis_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
    status public.finding_status NOT NULL DEFAULT 'open',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Canonical deduplication per repository: one unique finding entry per fingerprint
    CONSTRAINT uq_finding_fingerprint UNIQUE (repository_id, fingerprint),
    -- Enforce cross-workspace integrity: repository must belong to the same workspace
    CONSTRAINT fk_finding_repository_workspace FOREIGN KEY (repository_id, workspace_id)
        REFERENCES public.repositories(id, workspace_id) ON DELETE CASCADE,
    -- Compound uniqueness for child workspace-consistency foreign keys
    CONSTRAINT uq_finding_workspace_composite UNIQUE (id, workspace_id)
);

-- Finding occurrences per analysis run (preserves scan history and lineage)
CREATE TABLE public.analysis_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    evidence_snippet TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_analysis_finding_occurrence UNIQUE (analysis_id, finding_id)
);

-- ------------------------------------------------------------------------------
-- D. PATCH GENERATION AND REVIEW
-- ------------------------------------------------------------------------------

-- Remediation patches created for a canonical finding
CREATE TABLE public.patches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    finding_id UUID NOT NULL,
    target_branch TEXT NOT NULL DEFAULT 'main',
    status public.patch_status NOT NULL DEFAULT 'ready_for_review',
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    rationale TEXT,
    model_provider TEXT,
    model_name TEXT,
    generation_prompt_tokens INTEGER CHECK (generation_prompt_tokens IS NULL OR generation_prompt_tokens >= 0),
    generation_completion_tokens INTEGER CHECK (generation_completion_tokens IS NULL OR generation_completion_tokens >= 0),
    current_version_number INTEGER NOT NULL DEFAULT 1 CHECK (current_version_number >= 1),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Enforce cross-workspace integrity: finding & repository must belong to the same workspace
    CONSTRAINT fk_patch_finding_workspace FOREIGN KEY (finding_id, workspace_id)
        REFERENCES public.findings(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_patch_repository_workspace FOREIGN KEY (repository_id, workspace_id)
        REFERENCES public.repositories(id, workspace_id) ON DELETE CASCADE,
    -- Compound uniqueness for child workspace-consistency foreign keys
    CONSTRAINT uq_patch_workspace_composite UNIQUE (id, workspace_id)
);

-- Immutable versioned diffs for each patch iteration
CREATE TABLE public.patch_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patch_id UUID NOT NULL REFERENCES public.patches(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    diff_content TEXT NOT NULL,
    original_snippet TEXT,
    proposed_snippet TEXT,
    content_hash TEXT NOT NULL, -- SHA-256 hash of diff_content
    generation_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Enforce strictly sequential, unique versions per patch
    CONSTRAINT uq_patch_version_sequence UNIQUE (patch_id, version_number)
);

-- Human peer review and sign-off records
CREATE TABLE public.patch_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patch_version_id UUID NOT NULL REFERENCES public.patch_versions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    decision public.review_decision NOT NULL,
    comments TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- E. SANDBOX AND VERIFICATION
-- ------------------------------------------------------------------------------

-- Isolated sandbox execution runs (e.g. gVisor microVMs)
CREATE TABLE public.sandbox_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    patch_version_id UUID NOT NULL REFERENCES public.patch_versions(id) ON DELETE CASCADE,
    container_id TEXT,
    execution_environment TEXT NOT NULL DEFAULT 'gvisor_microvm',
    isolation_config JSONB NOT NULL DEFAULT '{"runtime": "runsc", "memory_limit_mb": 2048, "cpu_quota": 2}'::JSONB,
    network_policy public.network_policy_type NOT NULL DEFAULT 'deny_all',
    status public.sandbox_status NOT NULL DEFAULT 'queued',
    exit_code INTEGER,
    execution_summary TEXT,
    safe_terminal_logs TEXT,
    duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    attestation_hash TEXT, -- Cryptographic SHA-256 digest of verified execution trace
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Enforce cross-workspace integrity
    CONSTRAINT fk_sandbox_repository_workspace FOREIGN KEY (repository_id, workspace_id)
        REFERENCES public.repositories(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT uq_sandbox_workspace_composite UNIQUE (id, workspace_id)
);

-- Fine-grained validation checks inside a sandbox run
CREATE TABLE public.verification_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_run_id UUID NOT NULL REFERENCES public.sandbox_runs(id) ON DELETE CASCADE,
    check_type public.verification_check_type NOT NULL,
    check_name TEXT NOT NULL,
    status public.verification_check_status NOT NULL DEFAULT 'pending',
    tests_passed INTEGER NOT NULL DEFAULT 0 CHECK (tests_passed >= 0),
    tests_failed INTEGER NOT NULL DEFAULT 0 CHECK (tests_failed >= 0),
    tests_total INTEGER NOT NULL DEFAULT 0 CHECK (tests_total >= 0),
    evidence_reference TEXT,
    execution_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- F. AUDIT HISTORY & SAVED REPORTS
-- ------------------------------------------------------------------------------

-- Tamper-evident, immutable audit trail for compliance and security events
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    category public.audit_category NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    ip_address INET,
    user_agent TEXT,
    status public.audit_status NOT NULL DEFAULT 'success',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Saved compliance and executive audit reports
CREATE TABLE public.saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type public.report_type NOT NULL DEFAULT 'vulnerability_summary',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    format public.report_format NOT NULL DEFAULT 'PDF',
    filters JSONB NOT NULL DEFAULT '{}'::JSONB,
    summary_snapshot TEXT,
    artifact_storage_path TEXT,
    findings_count INTEGER NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
    critical_count INTEGER NOT NULL DEFAULT 0 CHECK (critical_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. PERFORMANCE & FILTER INDEXES
-- ==============================================================================

-- Profiles & Workspaces
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX idx_workspace_members_user_ws ON public.workspace_members(user_id, workspace_id);
CREATE INDEX idx_workspace_members_role ON public.workspace_members(workspace_id, role);

-- Repositories
CREATE INDEX idx_repositories_workspace ON public.repositories(workspace_id);
CREATE INDEX idx_repositories_status_score ON public.repositories(workspace_id, connection_status, security_score);

-- Integration Connections
CREATE INDEX idx_integration_connections_workspace ON public.integration_connections(workspace_id);

-- Analyses
CREATE INDEX idx_analyses_workspace_repo ON public.analyses(workspace_id, repository_id);
CREATE INDEX idx_analyses_status ON public.analyses(workspace_id, status);
CREATE INDEX idx_analyses_created_at ON public.analyses(workspace_id, created_at DESC);

-- Findings
CREATE INDEX idx_findings_workspace_repo ON public.findings(workspace_id, repository_id);
CREATE INDEX idx_findings_fingerprint ON public.findings(repository_id, fingerprint);
CREATE INDEX idx_findings_severity_status ON public.findings(workspace_id, severity, status);
CREATE INDEX idx_findings_reachability ON public.findings(workspace_id, reachability);

-- Analysis Findings (occurrences)
CREATE INDEX idx_analysis_findings_analysis ON public.analysis_findings(analysis_id);
CREATE INDEX idx_analysis_findings_finding ON public.analysis_findings(finding_id);

-- Patches & Versions & Reviews
CREATE INDEX idx_patches_workspace_finding ON public.patches(workspace_id, finding_id);
CREATE INDEX idx_patches_status ON public.patches(workspace_id, status);
CREATE INDEX idx_patch_versions_patch ON public.patch_versions(patch_id);
CREATE INDEX idx_patch_reviews_version ON public.patch_reviews(patch_version_id);

-- Sandbox Runs & Verification Checks
CREATE INDEX idx_sandbox_runs_workspace ON public.sandbox_runs(workspace_id);
CREATE INDEX idx_sandbox_runs_patch_version ON public.sandbox_runs(patch_version_id);
CREATE INDEX idx_sandbox_runs_status ON public.sandbox_runs(workspace_id, status);
CREATE INDEX idx_verification_checks_sandbox ON public.verification_checks(sandbox_run_id);
CREATE INDEX idx_verification_checks_status ON public.verification_checks(sandbox_run_id, status);

-- Audit Logs & Saved Reports
CREATE INDEX idx_audit_logs_workspace_created ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_logs_category ON public.audit_logs(workspace_id, category);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_saved_reports_workspace ON public.saved_reports(workspace_id, created_at DESC);
