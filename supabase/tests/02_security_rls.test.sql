-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — PGTAP SUITE 02: ROW LEVEL SECURITY & WORKSPACE ISOLATION
-- ==============================================================================

BEGIN;
SELECT plan(18);

-- 1. Verify RLS is enabled on all tables
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace), true, 'profiles has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'workspaces' AND relnamespace = 'public'::regnamespace), true, 'workspaces has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'workspace_members' AND relnamespace = 'public'::regnamespace), true, 'workspace_members has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'repositories' AND relnamespace = 'public'::regnamespace), true, 'repositories has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'integration_connections' AND relnamespace = 'public'::regnamespace), true, 'integration_connections has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'analyses' AND relnamespace = 'public'::regnamespace), true, 'analyses has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'findings' AND relnamespace = 'public'::regnamespace), true, 'findings has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'analysis_findings' AND relnamespace = 'public'::regnamespace), true, 'analysis_findings has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'patches' AND relnamespace = 'public'::regnamespace), true, 'patches has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'patch_versions' AND relnamespace = 'public'::regnamespace), true, 'patch_versions has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'patch_reviews' AND relnamespace = 'public'::regnamespace), true, 'patch_reviews has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'sandbox_runs' AND relnamespace = 'public'::regnamespace), true, 'sandbox_runs has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'verification_checks' AND relnamespace = 'public'::regnamespace), true, 'verification_checks has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_logs' AND relnamespace = 'public'::regnamespace), true, 'audit_logs has RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class WHERE relname = 'saved_reports' AND relnamespace = 'public'::regnamespace), true, 'saved_reports has RLS enabled');

-- 2. Verify Helper Functions
SELECT has_function('public', 'is_workspace_member', ARRAY['uuid', 'uuid'], 'is_workspace_member function exists');
SELECT has_function('public', 'has_workspace_role', ARRAY['uuid', 'public.workspace_role', 'uuid'], 'has_workspace_role function exists');
SELECT has_function('public', 'role_rank', ARRAY['public.workspace_role'], 'role_rank function exists');

SELECT * FROM finish();
ROLLBACK;
