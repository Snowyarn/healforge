-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — PGTAP SUITE 03: IMMUTABILITY & DEDUPLICATION
-- ==============================================================================

BEGIN;
SELECT plan(6);

-- 1. Deduplication fingerprint function
SELECT has_function('public', 'generate_finding_fingerprint', ARRAY['uuid', 'text', 'text', 'text'], 'generate_finding_fingerprint function exists');

-- 2. Verify Immutability and Escalation Triggers
SELECT has_trigger('public', 'audit_logs', 'block_audit_log_updates', 'audit_logs has block_audit_log_updates trigger');
SELECT has_trigger('public', 'patch_versions', 'block_patch_version_alteration', 'patch_versions has block_patch_version_alteration trigger');
SELECT has_trigger('public', 'workspace_members', 'enforce_role_escalation_rules', 'workspace_members has enforce_role_escalation_rules trigger');

-- 3. Verify Composite Constraints for Deduplication
SELECT col_is_unique('public', 'findings', ARRAY['repository_id', 'fingerprint'], 'findings has unique constraint on (repository_id, fingerprint)');
SELECT col_is_unique('public', 'patch_versions', ARRAY['patch_id', 'version_number'], 'patch_versions has unique constraint on (patch_id, version_number)');

SELECT * FROM finish();
ROLLBACK;
