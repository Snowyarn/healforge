-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — SYNTHETIC SEED DATA
-- Autonomous Code Security Analysis and Remediation Workbench
--
-- IMPORTANT SAFETY NOTICE:
-- ALL DATA DEFINED IN THIS SEED IS SAFE SYNTHETIC DEMONSTRATION DATA DESIGNED
-- FOR LOCAL INTEGRATION TESTING AND FRONTEND PREVIEWS.
-- IT DOES NOT CONTAIN REAL PRODUCTION CREDENTIALS, REAL EXPLOITS, OR REAL USER DATA.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SYNTHETIC USERS (Local Auth Support)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Provision synthetic test users if auth schema exists (local Supabase CLI environment)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES
        (
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'alex.vance@healforge.internal',
            crypt('SyntheticPasswordDemo123!', gen_salt('bf')),
            timezone('utc'::text, now()),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Alex Vance", "display_name": "Alex Vance", "username": "alexvance", "avatar_url": ""}'::jsonb,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        ),
        (
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'sarah.chen@healforge.internal',
            crypt('SyntheticPasswordDemo123!', gen_salt('bf')),
            timezone('utc'::text, now()),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Sarah Chen", "display_name": "Sarah Chen", "username": "schen", "avatar_url": ""}'::jsonb,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        ),
        (
            '00000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'marcus.brody@healforge.internal',
            crypt('SyntheticPasswordDemo123!', gen_salt('bf')),
            timezone('utc'::text, now()),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Marcus Brody", "display_name": "Marcus Brody", "username": "mbrody", "avatar_url": ""}'::jsonb,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        ),
        (
            '00000000-0000-0000-0000-000000000004',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'elena.rostova@healforge.internal',
            crypt('SyntheticPasswordDemo123!', gen_salt('bf')),
            timezone('utc'::text, now()),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Elena Rostova", "display_name": "Elena Rostova", "username": "erostova", "avatar_url": ""}'::jsonb,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        ),
        (
            '00000000-0000-0000-0000-000000000005',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'dave.miller@betadynamics.internal',
            crypt('SyntheticPasswordDemo123!', gen_salt('bf')),
            timezone('utc'::text, now()),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"full_name": "Dave Miller", "display_name": "Dave Miller", "username": "dmiller", "avatar_url": ""}'::jsonb,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Synthetic Profiles
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    username,
    job_title,
    role_title,
    organization,
    department,
    bio,
    phone,
    location,
    expertise,
    skills,
    github_url,
    website_url,
    linkedin_url
) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'alex.vance@healforge.internal',
    'Alex Vance',
    'Alex Vance',
    'alexvance',
    'Principal Application Security Engineer',
    'Security Engineer',
    'Acme Corp',
    'Product Security & Trust',
    'Specializing in automated AST taint analysis, gVisor microVM isolation, and zero-day triage across distributed microservices.',
    '+1 (555) 382-9104',
    'San Francisco, CA (Remote)',
    ARRAY['AST Static Analysis', 'Taint Tracking', 'Container Sandboxing', 'Go / Python / Node.js AppSec', 'OWASP Top 10'],
    ARRAY['Go', 'Python', 'TypeScript', 'Semgrep', 'Docker', 'gVisor', 'SQLi Mitigation', 'JWT Auditing'],
    'https://github.com/alexvance-sec',
    'https://alexvance.dev',
    'https://linkedin.com/in/alexvance-security'
),
(
    '00000000-0000-0000-0000-000000000002',
    'sarah.chen@healforge.internal',
    'Sarah Chen',
    'Sarah Chen',
    'schen',
    'Head of Security Operations',
    'Admin',
    'Acme Corp',
    'Information Security',
    'Directing autonomous patch synthesis pipelines, compliance attestation, and enterprise risk management.',
    '+1 (555) 492-1083',
    'New York, NY',
    ARRAY['SecOps', 'Threat Modeling', 'SOC2 / ISO 27001', 'Cryptographic Attestation'],
    ARRAY['Kubernetes', 'Terraform', 'Vault', 'PostgreSQL', 'SIEM'],
    'https://github.com/sarahchen-secops',
    'https://sarahchen.io',
    'https://linkedin.com/in/sarahchen-secops'
),
(
    '00000000-0000-0000-0000-000000000003',
    'marcus.brody@healforge.internal',
    'Marcus Brody',
    'Marcus Brody',
    'mbrody',
    'Senior Backend Engineer',
    'Developer',
    'Acme Corp',
    'Core Infrastructure',
    'Backend engineer working on high-throughput microservices and automated pull request verification.',
    '+1 (555) 781-9921',
    'Austin, TX',
    ARRAY['Distributed Systems', 'Kafka', 'PostgreSQL', 'Microservices'],
    ARRAY['Go', 'Rust', 'Docker', 'gRPC'],
    'https://github.com/marcusbrody-dev',
    'https://brodytech.dev',
    'https://linkedin.com/in/marcusbrody'
),
(
    '00000000-0000-0000-0000-000000000004',
    'elena.rostova@healforge.internal',
    'Elena Rostova',
    'Elena Rostova',
    'erostova',
    'Compliance & Governance Auditor',
    'Viewer',
    'Acme Corp',
    'Trust & Governance',
    'Monitoring regulatory compliance, verification evidence records, and immutable audit logs.',
    '+1 (555) 602-4419',
    'London, UK',
    ARRAY['Regulatory Compliance', 'SOC2', 'GDPR', 'Audit Verification'],
    ARRAY['Risk Management', 'Security Frameworks', 'Reporting'],
    'https://github.com/elena-rostova-audit',
    'https://elenarostova.co.uk',
    'https://linkedin.com/in/elenarostova-audit'
),
(
    '00000000-0000-0000-0000-000000000005',
    'dave.miller@betadynamics.internal',
    'Dave Miller',
    'Dave Miller',
    'dmiller',
    'Chief Architect',
    'Owner',
    'Beta Dynamics',
    'Engineering',
    'External tenant lead for isolated cross-workspace boundary verification.',
    '+1 (555) 918-3301',
    'Seattle, WA',
    ARRAY['Cloud Architecture', 'Multi-tenant Systems'],
    ARRAY['AWS', 'Kubernetes', 'Go'],
    'https://github.com/davemiller-beta',
    'https://betadynamics.internal',
    'https://linkedin.com/in/davemiller'
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    display_name = EXCLUDED.display_name,
    job_title = EXCLUDED.job_title;

-- ------------------------------------------------------------------------------
-- 2. WORKSPACES & MEMBERS
-- ------------------------------------------------------------------------------

-- Primary Workspace (Acme Corp Security Operations)
INSERT INTO public.workspaces (
    id,
    name,
    slug,
    owner_id,
    description,
    tier,
    settings
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'Acme Corp Security Operations',
    'acme-corp-secops',
    '00000000-0000-0000-0000-000000000001',
    'Enterprise autonomous remediation workbench for core Acme infrastructure.',
    'enterprise',
    '{"is_synthetic": true, "auto_patch": true, "gvisor_isolated": true, "max_parallel_sandboxes": 8}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Secondary Workspace (Beta Dynamics — for Cross-Workspace Isolation Verification)
INSERT INTO public.workspaces (
    id,
    name,
    slug,
    owner_id,
    description,
    tier,
    settings
) VALUES (
    '10000000-0000-0000-0000-000000000002',
    'Beta Dynamics Sandbox',
    'beta-dynamics-test',
    '00000000-0000-0000-0000-000000000005',
    'Isolated secondary tenant workspace for boundary testing and sandbox verification.',
    'pro',
    '{"is_synthetic": true, "auto_patch": false, "gvisor_isolated": true}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Workspace Members for Acme Corp
INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    status
) VALUES
(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner',
    'active'
),
(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'admin',
    'active'
),
(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'developer',
    'active'
),
(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'viewer',
    'active'
),
-- Beta Dynamics Members (Dave Miller is owner)
(
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000005',
    'owner',
    'active'
)
ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- ------------------------------------------------------------------------------
-- 3. REPOSITORIES & INTEGRATIONS
-- ------------------------------------------------------------------------------

-- Repositories under Acme Corp
INSERT INTO public.repositories (
    id,
    workspace_id,
    provider,
    external_repo_id,
    owner_name,
    name,
    url,
    default_branch,
    runtime,
    security_score,
    connection_status,
    last_scan_at,
    open_vuln_count,
    critical_count,
    high_count
) VALUES
(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'github',
    'github:acme/auth-service',
    'acme-corp',
    'auth-service',
    'https://github.com/acme-corp/auth-service',
    'main',
    'Node.js',
    88,
    'connected',
    timezone('utc'::text, now() - INTERVAL '2 hours'),
    2,
    1,
    1
),
(
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'github',
    'github:acme/payments-api',
    'acme-corp',
    'payments-api',
    'https://github.com/acme-corp/payments-api',
    'main',
    'Python',
    72,
    'connected',
    timezone('utc'::text, now() - INTERVAL '5 hours'),
    3,
    1,
    2
),
(
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'github',
    'github:acme/ingestion-pipeline',
    'acme-corp',
    'ingestion-pipeline',
    'https://github.com/acme-corp/ingestion-pipeline',
    'main',
    'Go',
    95,
    'connected',
    timezone('utc'::text, now() - INTERVAL '1 day'),
    1,
    0,
    1
),
-- Beta Dynamics Repository (isolated)
(
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    'gitlab',
    'gitlab:beta/gateway-proxy',
    'beta-dynamics',
    'gateway-proxy',
    'https://gitlab.com/beta-dynamics/gateway-proxy',
    'main',
    'Rust',
    98,
    'connected',
    timezone('utc'::text, now() - INTERVAL '3 hours'),
    0,
    0,
    0
)
ON CONFLICT (id) DO NOTHING;

-- Integration Connections
INSERT INTO public.integration_connections (
    id,
    workspace_id,
    provider,
    name,
    status,
    account_identifier,
    scopes,
    secret_ref,
    metadata
) VALUES
(
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'github',
    'Acme GitHub App Integration',
    'active',
    'app:acme-security-bot',
    ARRAY['repo', 'workflow', 'pull_requests:write', 'security_events:write'],
    'vault:secret:gh-app-acme-sec',
    '{"app_id": 98124, "installation_id": 551029, "is_synthetic": true}'::jsonb
),
(
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'anthropic',
    'Claude 3.5 Sonnet Patch Synthesizer',
    'active',
    'org:acme-corp-ai',
    ARRAY['messages:write', 'tokens:stream'],
    'vault:secret:anthropic-claude-key',
    '{"model": "claude-3-5-sonnet-20241022", "temperature": 0.1, "is_synthetic": true}'::jsonb
),
(
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'gvisor_sandbox',
    'gVisor Secure MicroVM Cluster (us-east-1)',
    'active',
    'cluster:gvisor-prod-node-04',
    ARRAY['microvm:spawn', 'syscall:audit', 'network:isolate'],
    'vault:secret:gvisor-cluster-tls',
    '{"runtime": "runsc", "isolation": "microvm", "region": "us-east-1", "is_synthetic": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. ANALYSES & SCANS
-- ------------------------------------------------------------------------------

INSERT INTO public.analyses (
    id,
    workspace_id,
    repository_id,
    branch,
    commit_sha,
    trigger_type,
    scan_type,
    status,
    started_at,
    completed_at,
    duration_seconds,
    findings_count,
    critical_count,
    high_count,
    medium_count,
    low_count,
    logs,
    created_by
) VALUES
(
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'main',
    'c42e190f84a1e94017a421b8c6e2671bf5039a01',
    'ci_webhook',
    'sast',
    'completed',
    timezone('utc'::text, now() - INTERVAL '2 hours'),
    timezone('utc'::text, now() - INTERVAL '1 hour 58 minutes'),
    124,
    2,
    1,
    1,
    0,
    0,
    ARRAY[
        '[AST-INIT] Parsing repository syntax tree for auth-service...',
        '[AST-TAINT] Propagating untrusted HTTP header sources to sensitive auth plugin sinks...',
        '[ALERT-CRITICAL] Discovered authentication bypass pathway in api/handlers/docker.go:142',
        '[ALERT-HIGH] Discovered prototype pollution risk in lib/utils/merge.js:28',
        '[AST-COMPLETE] Analysis completed with 2 actionable findings.'
    ],
    '00000000-0000-0000-0000-000000000001'
),
(
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'main',
    '8f92a11c19b023f77a83d91c78491823bc0192a2',
    'manual',
    'sast',
    'completed',
    timezone('utc'::text, now() - INTERVAL '5 hours'),
    timezone('utc'::text, now() - INTERVAL '4 hours 56 minutes'),
    210,
    1,
    1,
    0,
    0,
    0,
    ARRAY[
        '[AST-INIT] Initializing SQL syntax analyzer for payments-api...',
        '[ALERT-CRITICAL] Unsanitized string interpolation in SQL query constructor: backend/handlers/reports.go:44',
        '[AST-COMPLETE] Scan completed.'
    ],
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. FINDINGS & DEDUPLICATION OCCURRENCES
-- ------------------------------------------------------------------------------

INSERT INTO public.findings (
    id,
    workspace_id,
    repository_id,
    fingerprint,
    cve_id,
    cwe_id,
    title,
    description,
    severity,
    confidence,
    reachability,
    cvss_score,
    affected_file,
    start_line,
    end_line,
    scanner_name,
    rule_id,
    remediation_guidance,
    first_detected_analysis_id,
    latest_analysis_id,
    status,
    metadata
) VALUES
(
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '4a8e23f9914c67b9382f6e5c82903ab7281c7412803b879c941e7845f1b0a823',
    'CVE-2024-41110',
    'CWE-288: Authentication Bypass Using an Alternate Path',
    'Docker Engine Auth Plugin Request Forwarding Bypass',
    'Improper validation of plugin response headers allows unauthenticated attackers to bypass authorization filters when specific HTTP forwarding headers are malformed.',
    'critical',
    'high',
    'reachable',
    9.8,
    'api/handlers/docker.go',
    142,
    156,
    'HealForge AST Engine v2.4',
    'GO-AUTH-0041',
    'Replace weak string prefix checks with strict cryptographic signature verification via the internal auth validator module.',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'patch_generated',
    '{"owasp": "A01:2021 - Broken Access Control", "exploitability": "Functional Exploit Proven", "is_synthetic": true}'::jsonb
),
(
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'e92c478120b48a1c97f12389148bcae710293481023948712304918230914812',
    'CVE-2024-2149',
    'CWE-89: SQL Injection',
    'SQL Injection via Query Params in Reports Generator',
    'Direct string interpolation in database query construction allows unauthenticated attackers to execute arbitrary SQL commands via user-supplied query parameters.',
    'critical',
    'high',
    'reachable',
    9.6,
    'backend/handlers/reports.go',
    42,
    68,
    'HealForge AST Engine v2.4',
    'SQLI-GO-PARAM-001',
    'Convert dynamic format string concatenation into parameterized prepared statements.',
    '40000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'open',
    '{"owasp": "A03:2021 - Injection", "exploitability": "Functional Exploit Proven", "is_synthetic": true}'::jsonb
),
(
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '789bc1029348a102934812093481023948102934810293481029348102934812',
    'HWP-2024-881',
    'CWE-1321: Improperly Controlled Modification of Object Prototype Attributes',
    'RCE via Prototype Pollution in Token Serializer',
    'Recursive merge utility allows malicious JSON payloads with __proto__ keys to pollute base Object properties.',
    'critical',
    'high',
    'reachable',
    9.4,
    'lib/utils/merge.js',
    28,
    45,
    'HealForge AST Engine v2.4',
    'JS-PROTO-POLLUTE-002',
    'Validate keys against prototype property blocklists or use Map instead of plain object merge.',
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'open',
    '{"owasp": "A08:2021 - Software and Data Integrity Failures", "is_synthetic": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Finding occurrences per scan
INSERT INTO public.analysis_findings (
    id,
    analysis_id,
    finding_id,
    file_path,
    start_line,
    end_line,
    evidence_snippet
) VALUES
(
    '55000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'api/handlers/docker.go',
    142,
    147,
    'if pluginHeader == "" || strings.HasPrefix(pluginHeader, "bypass/") { ctx := context.WithValue(r.Context(), "role", "anonymous") }'
),
(
    '55000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    'lib/utils/merge.js',
    28,
    35,
    'for (let key in source) { target[key] = deepMerge(target[key] || {}, source[key]); }'
),
(
    '55000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    'backend/handlers/reports.go',
    44,
    48,
    'queryString := fmt.Sprintf("SELECT id, title, data FROM reports WHERE org_id = ''%s'' AND name LIKE ''%%%s%%''", orgID, query)'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. PATCHES, VERSIONS & REVIEWS
-- ------------------------------------------------------------------------------

-- Patch for CVE-2024-41110
INSERT INTO public.patches (
    id,
    workspace_id,
    repository_id,
    finding_id,
    target_branch,
    status,
    title,
    explanation,
    rationale,
    model_provider,
    model_name,
    generation_prompt_tokens,
    generation_completion_tokens,
    current_version_number,
    created_by
) VALUES
(
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'healforge/patch-cve-2024-41110',
    'approved',
    'Strict Cryptographic Header HMAC Verification',
    'Replaces insecure prefix check with cryptographic HMAC verification on auth plugin forwarded headers, stopping anonymous privilege escalation.',
    'Ensures constant-time comparison and invalidates forged proxy routing headers without introducing performance overhead.',
    'anthropic',
    'claude-3-5-sonnet-20241022',
    1420,
    312,
    2,
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Patch Version 1 (Iterated & Superseded)
INSERT INTO public.patch_versions (
    id,
    patch_id,
    version_number,
    diff_content,
    original_snippet,
    proposed_snippet,
    content_hash,
    generation_metadata,
    created_by
) VALUES
(
    '65000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    1,
    '--- a/api/handlers/docker.go
+++ b/api/handlers/docker.go
@@ -142,5 +142,5 @@
- if pluginHeader == "" || strings.HasPrefix(pluginHeader, "bypass/") {
+ if pluginHeader == "" {
-     ctx := context.WithValue(r.Context(), "role", "anonymous")
+     http.Error(w, "Forbidden", http.StatusForbidden)
      return
  }',
    'if pluginHeader == "" || strings.HasPrefix(pluginHeader, "bypass/") { ctx := context.WithValue(r.Context(), "role", "anonymous"); return }',
    'if pluginHeader == "" { http.Error(w, "Forbidden", http.StatusForbidden); return }',
    'd89e2b1049c812a0487192bcfa8271049281c7412803b879c941e7845f1b0a82',
    '{"iteration": 1, "note": "Initial simplistic fix", "is_synthetic": true}'::jsonb,
    '00000000-0000-0000-0000-000000000001'
),
-- Patch Version 2 (Refined with cryptographic HMAC validation)
(
    '65000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    2,
    '--- a/api/handlers/docker.go
+++ b/api/handlers/docker.go
@@ -142,6 +142,7 @@
- if pluginHeader == "" || strings.HasPrefix(pluginHeader, "bypass/") {
-     ctx := context.WithValue(r.Context(), "role", "anonymous")
-     next.ServeHTTP(w, r.WithContext(ctx))
-     return
- }
+ if !secureValidator.VerifyPluginSignature(pluginHeader) {
+     http.Error(w, "Forbidden: Invalid Auth Signature", http.StatusForbidden)
+     return
+ }',
    'if pluginHeader == "" || strings.HasPrefix(pluginHeader, "bypass/") { ... }',
    'if !secureValidator.VerifyPluginSignature(pluginHeader) { http.Error(w, "Forbidden", 403); return }',
    'f308ab194e82910c81293847a98124b892374918230914812389104918230914',
    '{"iteration": 2, "note": "Production hardening with HMAC validation", "is_synthetic": true}'::jsonb,
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Peer Reviews on Patch Versions
INSERT INTO public.patch_reviews (
    id,
    patch_version_id,
    reviewer_id,
    decision,
    comments
) VALUES
(
    '68000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'changes_requested',
    'Removing the prefix is insufficient if pluginHeader contains alternative bypass encodings. We need cryptographic signature validation with HMAC.'
),
(
    '68000000-0000-0000-0000-000000000002',
    '65000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'approved',
    'Cryptographic HMAC signature verification completely resolves the alternate path bypass. Verification in isolated gVisor sandbox passes 100% of tests with zero regressions.'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. SANDBOX RUNS & VERIFICATION CHECKS
-- ------------------------------------------------------------------------------

-- Sandbox Run for Patch v2
INSERT INTO public.sandbox_runs (
    id,
    workspace_id,
    repository_id,
    patch_version_id,
    container_id,
    execution_environment,
    isolation_config,
    network_policy,
    status,
    exit_code,
    execution_summary,
    safe_terminal_logs,
    duration_ms,
    attestation_hash,
    started_at,
    completed_at
) VALUES
(
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000002',
    'gvisor-vm-box-94812a',
    'gvisor_microvm',
    '{"runtime": "runsc", "memory_limit_mb": 2048, "cpu_quota": 2, "seccomp": "strict"}'::jsonb,
    'deny_all',
    'passed',
    0,
    'All 4 automated verification stages succeeded in isolated microVM. Exploit replay neutralized; 42/42 unit & integration tests passed with zero regressions.',
    '[gVisor-Sandbox] Initializing runsc guest container sandbox...
[Mount] Ephemeral rootfs mounted read-only with copy-on-write scratch volume.
[Network] Network policy enforced: DENY_ALL (all outbound sockets blocked).
[Build] Compiling auth-service with patched AST diff... OK (exit 0)
[Replay] Replaying original exploit payload HTTP POST /v1/docker/proxy... RESULT: 403 Forbidden (Blocked).
[Tests] Running regression suite: 42 passed, 0 failed.
[Attestation] Cryptographic trace signed with SHA-256 digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.',
    4280,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    timezone('utc'::text, now() - INTERVAL '1 hour 45 minutes'),
    timezone('utc'::text, now() - INTERVAL '1 hour 44 minutes')
)
ON CONFLICT (id) DO NOTHING;

-- Verification Checks under Sandbox Run
INSERT INTO public.verification_checks (
    id,
    sandbox_run_id,
    check_type,
    check_name,
    status,
    tests_passed,
    tests_failed,
    tests_total,
    evidence_reference,
    execution_metadata
) VALUES
(
    '75000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'build_verification',
    'Clean Go Binary Compilation',
    'passed',
    1,
    0,
    1,
    'evidence/build-log-94812.log',
    '{"compiler": "go version go1.22.4 linux/amd64", "exit_code": 0, "is_synthetic": true}'::jsonb
),
(
    '75000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    'vulnerability_replay',
    'CVE-2024-41110 Exploit Replay Neutralization Check',
    'passed',
    5,
    0,
    5,
    'evidence/replay-trace-cve41110.json',
    '{"payload_count": 5, "blocked_count": 5, "bypass_attempted": true, "is_synthetic": true}'::jsonb
),
(
    '75000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000001',
    'regression_test',
    'Unit & Integration Regression Suite',
    'passed',
    42,
    0,
    42,
    'evidence/junit-report-authservice.xml',
    '{"coverage_pct": 91.4, "regressions_detected": 0, "is_synthetic": true}'::jsonb
),
(
    '75000000-0000-0000-0000-000000000004',
    '70000000-0000-0000-0000-000000000001',
    'post_patch_sast',
    'Post-Patch AST Security Scan',
    'passed',
    1,
    0,
    1,
    'evidence/sast-differential-scan.sarif',
    '{"new_findings_count": 0, "remediated_count": 1, "is_synthetic": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. AUDIT LOGS & SAVED REPORTS
-- ------------------------------------------------------------------------------

-- Synthetic Audit Events
INSERT INTO public.audit_logs (
    id,
    workspace_id,
    actor_id,
    actor_email,
    category,
    action,
    entity_type,
    entity_id,
    ip_address,
    user_agent,
    status,
    metadata
) VALUES
(
    '80000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'alex.vance@healforge.internal',
    'auth',
    'User Authenticated via SSO (SAML 2.0)',
    'user_session',
    'sess-981204',
    '198.51.100.24'::inet,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    '{"method": "sso_saml", "idp": "Okta", "is_synthetic": true}'::jsonb
),
(
    '80000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'alex.vance@healforge.internal',
    'repository',
    'Repository Connected',
    'repository',
    '20000000-0000-0000-0000-000000000001',
    '198.51.100.24'::inet,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    '{"repo_name": "auth-service", "provider": "github", "is_synthetic": true}'::jsonb
),
(
    '80000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'sarah.chen@healforge.internal',
    'patch',
    'Patch Version Approved',
    'patch_version',
    '65000000-0000-0000-0000-000000000002',
    '203.0.113.88'::inet,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    '{"patch_id": "60000000-0000-0000-0000-000000000001", "decision": "approved", "is_synthetic": true}'::jsonb
),
(
    '80000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'system:gvisor-sandbox-runner',
    'verification',
    'Sandbox Verification Completed',
    'sandbox_run',
    '70000000-0000-0000-0000-000000000001',
    '10.240.0.14'::inet,
    'HealForge-MicroVM-Agent/2.4',
    'success',
    '{"attestation_digest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "is_synthetic": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Saved Executive Reports
INSERT INTO public.saved_reports (
    id,
    workspace_id,
    title,
    report_type,
    created_by,
    format,
    filters,
    summary_snapshot,
    artifact_storage_path,
    findings_count,
    critical_count
) VALUES
(
    '90000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Executive Vulnerability Remediation Summary - Q4 2026',
    'vulnerability_summary',
    '00000000-0000-0000-0000-000000000001',
    'PDF',
    '{"timeframe": "last_90_days", "severity": ["critical", "high"], "is_synthetic": true}'::jsonb,
    'Across 3 connected production repositories, HealForge identified 6 vulnerabilities and successfully synthesized 4 verified patches with 100% test passing rates in gVisor microVMs.',
    'reports/2026-q4-exec-summary.pdf',
    6,
    3
),
(
    '90000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'gVisor MicroVM Cryptographic Verification Attestation Report',
    'sandbox_attestation',
    '00000000-0000-0000-0000-000000000002',
    'PDF',
    '{"patch_id": "60000000-0000-0000-0000-000000000001", "is_synthetic": true}'::jsonb,
    'Official attestation record confirming isolated replay of CVE-2024-41110 inside runsc microVM sandbox. Zero regressions detected.',
    'reports/attestation-cve-2024-41110.pdf',
    1,
    1
)
ON CONFLICT (id) DO NOTHING;
