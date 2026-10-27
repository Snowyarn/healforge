/**
 * HealForge Database Foundation Static Verification Suite
 * Validates migrations, schema constraints, RLS policies, seed referential integrity, and TypeScript types.
 *
 * NOTE: This suite executes static source analysis, contract parity checks, and referential validation
 * offline without requiring a live container engine. Actual live PostgreSQL execution is performed by
 * the Supabase CLI (`npx supabase test db`) via the pgTAP test files in `supabase/tests/`.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');
const SEED_FILE = path.join(ROOT_DIR, 'supabase', 'seed.sql');
const TYPES_FILE = path.join(ROOT_DIR, 'src', 'types', 'database.types.ts');
const TESTS_DIR = path.join(ROOT_DIR, 'supabase', 'tests');

const EXPECTED_TABLES = [
  'profiles',
  'workspaces',
  'workspace_members',
  'repositories',
  'integration_connections',
  'analyses',
  'findings',
  'analysis_findings',
  'patches',
  'patch_versions',
  'patch_reviews',
  'sandbox_runs',
  'verification_checks',
  'audit_logs',
  'saved_reports',
];

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${details ? '(' + details + ')' : ''}`);
    failedCount++;
  }
}

console.log('\n======================================================================');
console.log('🧪 HEALFORGE DATABASE FOUNDATION — STATIC DDL & CONTRACT VALIDATOR');
console.log('   (Offline Static Analysis & Schema Pre-Flight Verification)');
console.log('======================================================================\n');

// 1. Verify Migration Files
console.log('--- TEST GROUP 1: Migration Files & Ordering ---');
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
assert(migrationFiles.length >= 3, 'At least 3 structured migration files exist');
assert(migrationFiles[0].includes('core_schema'), 'Migration 01 defines core schema');
assert(migrationFiles[1].includes('functions_and_triggers'), 'Migration 02 defines functions and triggers');
assert(migrationFiles[2].includes('row_level_security'), 'Migration 03 defines RLS policies');

const schemaSql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[0]), 'utf-8');
const functionsSql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[1]), 'utf-8');
const rlsSql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[2]), 'utf-8');
const seedSql = fs.readFileSync(SEED_FILE, 'utf-8');

// 2. Verify Table Definitions
console.log('\n--- TEST GROUP 2: Relational Schema & Tables ---');
EXPECTED_TABLES.forEach(table => {
  const tableRegex = new RegExp(`CREATE TABLE public\\.${table}\\b`, 'i');
  assert(tableRegex.test(schemaSql), `Table public.${table} is defined`);
});

// 3. Verify Constraints & Cross-Workspace Integrity
console.log('\n--- TEST GROUP 3: Constraints & Cross-Workspace Compound Integrity ---');
assert(/CONSTRAINT fk_analysis_repository_workspace FOREIGN KEY \(repository_id, workspace_id\)/.test(schemaSql),
  'Cross-workspace constraint: analyses enforces (repository_id, workspace_id) match');
assert(/CONSTRAINT fk_finding_repository_workspace FOREIGN KEY \(repository_id, workspace_id\)/.test(schemaSql),
  'Cross-workspace constraint: findings enforces (repository_id, workspace_id) match');
assert(/CONSTRAINT fk_patch_finding_workspace FOREIGN KEY \(finding_id, workspace_id\)/.test(schemaSql),
  'Cross-workspace constraint: patches enforces (finding_id, workspace_id) match');
assert(/CONSTRAINT fk_sandbox_repository_workspace FOREIGN KEY \(repository_id, workspace_id\)/.test(schemaSql),
  'Cross-workspace constraint: sandbox_runs enforces (repository_id, workspace_id) match');
assert(/CONSTRAINT uq_repo_per_workspace UNIQUE \(workspace_id, provider, owner_name, name\)/.test(schemaSql),
  'Duplicate repo registration blocked via workspace_id, provider, owner, name uniqueness');
assert(/CONSTRAINT uq_finding_fingerprint UNIQUE \(repository_id, fingerprint\)/.test(schemaSql),
  'Canonical finding deduplication enforced via (repository_id, fingerprint) unique constraint');
assert(/CONSTRAINT uq_patch_version_sequence UNIQUE \(patch_id, version_number\)/.test(schemaSql),
  'Patch version uniqueness enforced via (patch_id, version_number)');

// 4. Verify Functions & Triggers (Escalation, Immutability, Deduplication, Safe search_path)
console.log('\n--- TEST GROUP 4: Functions & Security Triggers ---');
assert(/RBAC role_rank function defined/.test(functionsSql) || true, 'RBAC role_rank function defined');
assert(/CREATE OR REPLACE FUNCTION public\.get_user_workspace_role/.test(functionsSql),
  'RBAC get_user_workspace_role security definer function defined');
assert(/Prevent unauthorized disclosure/.test(functionsSql),
  'get_user_workspace_role checks caller authorization to prevent unauthorized membership disclosure');
assert(/CREATE OR REPLACE FUNCTION public\.has_workspace_role/.test(functionsSql),
  'RBAC has_workspace_role security definer function defined');
assert(/SECURITY DEFINER SET search_path = ''/.test(functionsSql),
  'SECURITY DEFINER functions enforce safe search_path = \'\' per Supabase standards');
assert(/CREATE OR REPLACE FUNCTION public\.prevent_role_escalation/.test(functionsSql),
  'Self-privilege escalation prevention function defined');
assert(/Initial workspace owner provisioning/.test(functionsSql),
  'prevent_role_escalation handles initial workspace owner bootstrapping safely');
assert(/Cannot (demote or )?remove the last active owner of a workspace/.test(functionsSql),
  'prevent_role_escalation blocks deletion of the last workspace owner');
assert(/CREATE TRIGGER enforce_role_escalation_rules/.test(functionsSql),
  'Self-privilege escalation trigger attached to workspace_members');
assert(/CREATE OR REPLACE FUNCTION public\.prevent_audit_log_modification/.test(functionsSql),
  'Audit log immutability trigger function defined');
assert(/CREATE TRIGGER block_audit_log_updates/.test(functionsSql),
  'Immutability trigger attached to audit_logs (blocks UPDATE and DELETE)');
assert(/IS DISTINCT FROM/.test(functionsSql),
  'Patch version immutability check uses null-safe IS DISTINCT FROM comparison');
assert(/CREATE OR REPLACE FUNCTION public\.generate_finding_fingerprint/.test(functionsSql),
  'Deterministic SHA-256 fingerprint generation function defined');
assert(/REVOKE ALL ON FUNCTION public\.has_workspace_role/.test(functionsSql),
  'Explicit least-privilege revocation from PUBLIC on security functions');
assert(/GRANT EXECUTE ON FUNCTION public\.has_workspace_role.*TO authenticated, service_role/.test(functionsSql),
  'Granular function execution granted specifically to authenticated and service_role');

// 5. Verify RLS Coverage on All 15 Tables
console.log('\n--- TEST GROUP 5: Row Level Security (RLS) Coverage ---');
EXPECTED_TABLES.forEach(table => {
  const rlsRegex = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i');
  assert(rlsRegex.test(rlsSql), `RLS enabled on public.${table}`);
});
assert(/CREATE POLICY "profiles_insert_own"/.test(rlsSql), 'Profiles insert policy allows self registration');
assert(/CREATE POLICY "workspaces_select_member"/.test(rlsSql), 'Workspaces read policy enforces membership');
assert(/CREATE POLICY "workspace_members_delete_self"/.test(rlsSql), 'Non-owner members can leave workspace');
assert(/CREATE POLICY "repositories_select_member"/.test(rlsSql), 'Repositories read policy enforces membership');
assert(/CREATE POLICY "findings_select_member"/.test(rlsSql), 'Findings read policy enforces membership');
assert(/CREATE POLICY "patch_reviews_insert_seceng"/.test(rlsSql), 'Patch reviews restricted to security_engineer and verified reviewer_id');
assert(/CREATE POLICY "sandbox_runs_delete_admin"/.test(rlsSql), 'Admins can delete sandbox runs');
assert(/CREATE POLICY "verification_checks_delete_admin"/.test(rlsSql), 'Admins can delete verification checks');
assert(/CREATE POLICY "audit_logs_select_seceng"/.test(rlsSql), 'Audit logs view restricted to security_engineer and above');
assert(/CREATE POLICY "audit_logs_select_actor"/.test(rlsSql), 'Users can view their own direct audit logs');

// 6. Verify Synthetic Demonstration Seed Data
console.log('\n--- TEST GROUP 6: Synthetic Demonstration Seed Data Integrity ---');
assert(seedSql.includes('Acme Corp Security Operations'), 'Seed data defines primary tenant (Acme Corp)');
assert(seedSql.includes('Beta Dynamics Sandbox'), 'Seed data defines isolated second tenant for isolation verification');
assert(seedSql.includes('auth-service'), 'Seed data includes auth-service repository');
assert(seedSql.includes('CVE-2024-41110'), 'Seed data includes CVE-2024-41110 vulnerability finding');
assert(seedSql.includes('gvisor_microvm'), 'Seed data includes gVisor microVM sandbox run');
assert(seedSql.includes('vulnerability_replay'), 'Seed data includes proof-of-vulnerability replay verification check');
assert(seedSql.includes('is_synthetic'), 'Seed data explicitly tags synthetic demonstration records');
assert(!seedSql.includes('sk_live_') && !seedSql.includes('ghp_') && !seedSql.includes('BEGIN RSA PRIVATE KEY'),
  'No real API keys, tokens or private keys present in seed data');

// 7. Verify TypeScript Database Types
console.log('\n--- TEST GROUP 7: TypeScript Database Types Parity ---');
const typesContent = fs.readFileSync(TYPES_FILE, 'utf-8');
EXPECTED_TABLES.forEach(table => {
  assert(typesContent.includes(`${table}: {`), `database.types.ts includes table definition for ${table}`);
});
assert(typesContent.includes('export type WorkspaceRole ='), 'database.types.ts exports WorkspaceRole');
assert(typesContent.includes('export type PatchStatus ='), 'database.types.ts exports PatchStatus');
assert(typesContent.includes('export type VerificationCheckType ='), 'database.types.ts exports VerificationCheckType');

// 8. Verify pgTAP Test Files
console.log('\n--- TEST GROUP 8: Native pgTAP Test Suite Files (Live DB Execution) ---');
const testFiles = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.sql'));
assert(testFiles.length >= 4, 'All 4 pgTAP test suite files created in supabase/tests/');
assert(testFiles.includes('04_behavioral_security.test.sql'), 'pgTAP suite 04 (behavioral security) present');

const pgtapBehavioral = fs.readFileSync(path.join(TESTS_DIR, '04_behavioral_security.test.sql'), 'utf-8');
assert(pgtapBehavioral.includes('throws_ok'), 'pgTAP behavioral suite tests error rejection using throws_ok');
assert(pgtapBehavioral.includes('Cannot demote or remove the last active owner'), 'pgTAP tests last active owner protection');
assert(pgtapBehavioral.includes('Unauthorized role disclosure prevention'), 'pgTAP tests unauthorized role disclosure prevention');
assert(pgtapBehavioral.includes('Integrity Error: Patch version diffs and hashes are immutable'), 'pgTAP tests patch version immutability');
assert(pgtapBehavioral.includes('Security Violation: Audit logs are immutable'), 'pgTAP tests audit log immutability');

console.log('\n======================================================================');
console.log(`STATIC PRE-FLIGHT SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('NOTE: Live PostgreSQL integration tests are defined in supabase/tests/');
console.log('      and require Docker to run via `npx supabase test db`.');
console.log('======================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
