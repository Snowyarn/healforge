-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — PGTAP SUITE 04: BEHAVIORAL SECURITY & INTEGRITY
-- ==============================================================================

BEGIN;
SELECT plan(13);

-- ------------------------------------------------------------------------------
-- Setup Test Fixtures in Transaction
-- ------------------------------------------------------------------------------

-- Ensure test auth users exist in auth.users if available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES 
        ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.owner@healforge.internal', 'pass', now(), '{}', '{}', now(), now()),
        ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.admin@healforge.internal', 'pass', now(), '{}', '{}', now(), now()),
        ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.dev@healforge.internal', 'pass', now(), '{}', '{}', now(), now())
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Workspace Creation & Owner Auto-Provisioning
-- ------------------------------------------------------------------------------

-- Insert a test workspace
INSERT INTO public.workspaces (id, name, slug, owner_id)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Behavioral Test Workspace', 'behavioral-test-ws', 'a0000000-0000-0000-0000-000000000001');

-- Test 1: Verify owner was auto-provisioned by handle_new_workspace trigger
SELECT is(
    (SELECT role FROM public.workspace_members WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND user_id = 'a0000000-0000-0000-0000-000000000001'),
    'owner'::public.workspace_role,
    'Workspace creator is automatically enrolled as active owner'
);

-- ------------------------------------------------------------------------------
-- 2. Role Escalation Denial & Privilege Checks
-- ------------------------------------------------------------------------------

-- Add admin and developer
INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
VALUES 
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin', 'active'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'developer', 'active');

-- Test 2: Role rank ordering
SELECT is(
    public.role_rank('owner'::public.workspace_role) > public.role_rank('admin'::public.workspace_role),
    true,
    'Owner rank (50) is higher than Admin rank (40)'
);

-- Test 3: has_workspace_role evaluation
SELECT is(
    public.has_workspace_role('b0000000-0000-0000-0000-000000000001', 'developer'::public.workspace_role, 'a0000000-0000-0000-0000-000000000002'),
    true,
    'Admin user satisfies required developer role'
);

-- ------------------------------------------------------------------------------
-- 3. Last Active Owner Protection
-- ------------------------------------------------------------------------------

-- Test 4: Attempting to remove the sole active owner must fail
SELECT throws_ok(
    $$ DELETE FROM public.workspace_members WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND user_id = 'a0000000-0000-0000-0000-000000000001' $$,
    'P0001',
    'Operation Blocked: Cannot demote or remove the last active owner of a workspace.',
    'Deleting the last active owner is rejected'
);

-- Test 5: Attempting to demote the sole active owner to developer must fail
SELECT throws_ok(
    $$ UPDATE public.workspace_members SET role = 'developer' WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND user_id = 'a0000000-0000-0000-0000-000000000001' $$,
    'P0001',
    'Operation Blocked: Cannot demote or remove the last active owner of a workspace.',
    'Demoting the last active owner is rejected'
);

-- ------------------------------------------------------------------------------
-- 4. Audit Log Immutability
-- ------------------------------------------------------------------------------

-- Insert an audit log entry
INSERT INTO public.audit_logs (id, workspace_id, actor_email, category, action, entity_type, status)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'test.owner@healforge.internal', 'security', 'Test Event', 'workspace', 'success');

-- Test 6: Updating an audit log entry must be blocked
SELECT throws_ok(
    $$ UPDATE public.audit_logs SET action = 'Tampered Event' WHERE id = 'c0000000-0000-0000-0000-000000000001' $$,
    'P0001',
    'Security Violation: Audit logs are immutable and cannot be updated or deleted.',
    'Audit log UPDATE is blocked by trigger'
);

-- Test 7: Deleting an audit log entry must be blocked
SELECT throws_ok(
    $$ DELETE FROM public.audit_logs WHERE id = 'c0000000-0000-0000-0000-000000000001' $$,
    'P0001',
    'Security Violation: Audit logs are immutable and cannot be updated or deleted.',
    'Audit log DELETE is blocked by trigger'
);

-- ------------------------------------------------------------------------------
-- 5. Patch Version Immutability
-- ------------------------------------------------------------------------------

-- Set up repository, finding, patch, and patch version
INSERT INTO public.repositories (id, workspace_id, provider, owner_name, name, url)
VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'github', 'test-org', 'test-repo', 'https://github.com/test-org/test-repo');

INSERT INTO public.findings (id, workspace_id, repository_id, fingerprint, title, description, severity, affected_file, rule_id)
VALUES ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'fp-1111111111111111111111111111111111111111111111111111111111111111', 'Test SQLi', 'SQL Injection vulnerability', 'critical', 'db/query.go', 'SEC-01');

INSERT INTO public.patches (id, workspace_id, repository_id, finding_id, title, explanation)
VALUES ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Param SQL Patch', 'Fix SQL injection');

INSERT INTO public.patch_versions (id, patch_id, version_number, diff_content, content_hash)
VALUES ('f5000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, '--- a/db/query.go\n+++ b/db/query.go', 'hash-1111111111111111111111111111111111111111111111111111111111111111');

-- Test 8: Modifying patch diff content must be blocked
SELECT throws_ok(
    $$ UPDATE public.patch_versions SET diff_content = 'Tampered Diff' WHERE id = 'f5000000-0000-0000-0000-000000000001' $$,
    'P0001',
    'Integrity Error: Patch version diffs and hashes are immutable. Create a new version instead.',
    'Patch version diff modification is blocked by trigger'
);

-- Test 9: Modifying patch version number must be blocked
SELECT throws_ok(
    $$ UPDATE public.patch_versions SET version_number = 2 WHERE id = 'f5000000-0000-0000-0000-000000000001' $$,
    'P0001',
    'Integrity Error: Patch version diffs and hashes are immutable. Create a new version instead.',
    'Patch version number alteration is blocked by trigger'
);

-- ------------------------------------------------------------------------------
-- 6. Finding Deduplication Uniqueness
-- ------------------------------------------------------------------------------

-- Test 10: Inserting a duplicate finding fingerprint on the same repository must violate uniqueness
SELECT throws_ok(
    $$ INSERT INTO public.findings (id, workspace_id, repository_id, fingerprint, title, description, severity, affected_file, rule_id)
       VALUES ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'fp-1111111111111111111111111111111111111111111111111111111111111111', 'Duplicate SQLi', 'Duplicate defect', 'critical', 'db/query.go', 'SEC-01') $$,
    '23505',
    NULL,
    'Duplicate (repository_id, fingerprint) is rejected by unique constraint'
);

-- ------------------------------------------------------------------------------
-- 7. Cross-Workspace Compound Foreign Key Integrity
-- ------------------------------------------------------------------------------

-- Create a second isolated workspace
INSERT INTO public.workspaces (id, name, slug, owner_id)
VALUES ('b0000000-0000-0000-0000-000000000002', 'Second Workspace', 'second-ws', 'a0000000-0000-0000-0000-000000000001');

-- Test 11: Attempting to create an analysis in Second Workspace referencing repository from First Workspace must fail
SELECT throws_ok(
    $$ INSERT INTO public.analyses (workspace_id, repository_id, commit_sha)
       VALUES ('b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'commit-sha-cross-test') $$,
    '23503',
    NULL,
    'Cross-workspace entity mixing is rejected by compound foreign key (repository_id, workspace_id)'
);

-- Test 12: Deterministic Fingerprint Generation Helper
SELECT is(
    public.generate_finding_fingerprint('d0000000-0000-0000-0000-000000000001', 'SEC-01', 'db/query.go', 'db.Query(input)'),
    public.generate_finding_fingerprint('d0000000-0000-0000-0000-000000000001', 'SEC-01', 'db/query.go', 'db.Query(input)'),
    'generate_finding_fingerprint produces identical deterministic SHA-256 digest'
);

-- Test 13: Unauthorized role disclosure prevention for non-member caller
-- Simulate caller as user 3 (member of Workspace 1, but NOT member of Workspace 2)
SET LOCAL "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000003"}';

SELECT is(
    public.get_user_workspace_role('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    NULL,
    'Authenticated caller cannot discover roles in workspaces where they are not a member'
);

RESET "request.jwt.claim.sub";
RESET "request.jwt.claims";

SELECT * FROM finish();
ROLLBACK;
