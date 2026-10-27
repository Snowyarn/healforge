-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — PGTAP SUITE 01: SCHEMA STRUCTURE & INTEGRITY
-- ==============================================================================

BEGIN;
SELECT plan(32);

-- 1. Verify Extensions
SELECT has_extension('uuid-ossp', 'Extension uuid-ossp should be installed');
SELECT has_extension('pgcrypto', 'Extension pgcrypto should be installed');

-- 2. Verify Core Tables Exist
SELECT has_table('public', 'profiles', 'Table public.profiles must exist');
SELECT has_table('public', 'workspaces', 'Table public.workspaces must exist');
SELECT has_table('public', 'workspace_members', 'Table public.workspace_members must exist');
SELECT has_table('public', 'repositories', 'Table public.repositories must exist');
SELECT has_table('public', 'integration_connections', 'Table public.integration_connections must exist');
SELECT has_table('public', 'analyses', 'Table public.analyses must exist');
SELECT has_table('public', 'findings', 'Table public.findings must exist');
SELECT has_table('public', 'analysis_findings', 'Table public.analysis_findings must exist');
SELECT has_table('public', 'patches', 'Table public.patches must exist');
SELECT has_table('public', 'patch_versions', 'Table public.patch_versions must exist');
SELECT has_table('public', 'patch_reviews', 'Table public.patch_reviews must exist');
SELECT has_table('public', 'sandbox_runs', 'Table public.sandbox_runs must exist');
SELECT has_table('public', 'verification_checks', 'Table public.verification_checks must exist');
SELECT has_table('public', 'audit_logs', 'Table public.audit_logs must exist');
SELECT has_table('public', 'saved_reports', 'Table public.saved_reports must exist');

-- 3. Verify Primary Keys
SELECT has_pk('public', 'profiles', 'profiles has PK');
SELECT has_pk('public', 'workspaces', 'workspaces has PK');
SELECT has_pk('public', 'workspace_members', 'workspace_members has PK');
SELECT has_pk('public', 'repositories', 'repositories has PK');
SELECT has_pk('public', 'analyses', 'analyses has PK');
SELECT has_pk('public', 'findings', 'findings has PK');
SELECT has_pk('public', 'patches', 'patches has PK');
SELECT has_pk('public', 'patch_versions', 'patch_versions has PK');
SELECT has_pk('public', 'patch_reviews', 'patch_reviews has PK');
SELECT has_pk('public', 'sandbox_runs', 'sandbox_runs has PK');
SELECT has_pk('public', 'verification_checks', 'verification_checks has PK');
SELECT has_pk('public', 'audit_logs', 'audit_logs has PK');
SELECT has_pk('public', 'saved_reports', 'saved_reports has PK');

-- 4. Verify Unique Constraints
SELECT col_is_unique('public', 'workspaces', ARRAY['slug'], 'workspaces.slug is unique');
SELECT col_is_unique('public', 'workspace_members', ARRAY['workspace_id', 'user_id'], 'workspace membership is unique per user');

SELECT * FROM finish();
ROLLBACK;
