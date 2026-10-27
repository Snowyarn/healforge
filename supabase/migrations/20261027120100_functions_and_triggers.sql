-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — MIGRATION 02: FUNCTIONS, RBAC & TRIGGERS
-- Autonomous Code Security Analysis and Remediation Workbench
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TIMESTAMP MANAGEMENT
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all mutable tables
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_workspace_members_updated_at
    BEFORE UPDATE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_repositories_updated_at
    BEFORE UPDATE ON public.repositories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_integration_connections_updated_at
    BEFORE UPDATE ON public.integration_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_analyses_updated_at
    BEFORE UPDATE ON public.analyses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_findings_updated_at
    BEFORE UPDATE ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_patches_updated_at
    BEFORE UPDATE ON public.patches
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_sandbox_runs_updated_at
    BEFORE UPDATE ON public.sandbox_runs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_verification_checks_updated_at
    BEFORE UPDATE ON public.verification_checks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_saved_reports_updated_at
    BEFORE UPDATE ON public.saved_reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. ROLE RANKING & AUTHORIZATION HELPERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.role_rank(role public.workspace_role)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE role
        WHEN 'owner' THEN 50
        WHEN 'admin' THEN 40
        WHEN 'security_engineer' THEN 30
        WHEN 'developer' THEN 20
        WHEN 'viewer' THEN 10
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_user_workspace_role(
    target_workspace_id UUID,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS public.workspace_role AS $$
DECLARE
    caller_id UUID := auth.uid();
    found_role public.workspace_role;
BEGIN
    IF target_workspace_id IS NULL OR check_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Prevent unauthorized disclosure:
    -- If called by an authenticated user querying another user's membership/role,
    -- the caller must themselves be an active member of the target workspace.
    IF caller_id IS NOT NULL AND caller_id <> check_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = target_workspace_id
              AND user_id = caller_id
              AND status = 'active'
        ) THEN
            RETURN NULL;
        END IF;
    END IF;

    SELECT role INTO found_role
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = check_user_id
      AND status = 'active'
    LIMIT 1;

    RETURN found_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.has_workspace_role(
    target_workspace_id UUID,
    required_role public.workspace_role DEFAULT 'viewer'::public.workspace_role,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
    actual_role public.workspace_role;
BEGIN
    actual_role := public.get_user_workspace_role(target_workspace_id, check_user_id);
    IF actual_role IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN public.role_rank(actual_role) >= public.role_rank(required_role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_workspace_member(
    target_workspace_id UUID,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_workspace_role(target_workspace_id, 'viewer'::public.workspace_role, check_user_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- ------------------------------------------------------------------------------
-- 3. SELF-PRIVILEGE ESCALATION PREVENTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
    current_actor UUID := auth.uid();
    actor_role public.workspace_role;
    target_ws UUID;
    ws_owner UUID;
BEGIN
    target_ws := COALESCE(NEW.workspace_id, OLD.workspace_id);

    -- Prevent demoting or removing the last active owner of an existing workspace
    IF (TG_OP = 'DELETE' AND OLD.role = 'owner') 
       OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner') THEN
        IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = target_ws) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.workspace_members
                WHERE workspace_id = target_ws
                  AND user_id <> OLD.user_id
                  AND role = 'owner'
                  AND status = 'active'
            ) THEN
                RAISE EXCEPTION 'Operation Blocked: Cannot demote or remove the last active owner of a workspace.';
            END IF;
        END IF;
    END IF;

    -- Allow service_role or unauthenticated DB maintenance to proceed for other operations
    IF current_actor IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Special case: Initial workspace owner provisioning
    -- If this is an INSERT assigning 'owner' role to the declared owner_id of the workspace, allow it
    IF TG_OP = 'INSERT' AND NEW.role = 'owner' THEN
        SELECT owner_id INTO ws_owner FROM public.workspaces WHERE id = target_ws;
        IF ws_owner = NEW.user_id AND current_actor = ws_owner THEN
            RETURN NEW;
        END IF;
    END IF;

    actor_role := public.get_user_workspace_role(target_ws, current_actor);

    -- Actor must be at least an admin in the workspace
    IF actor_role IS NULL OR public.role_rank(actor_role) < public.role_rank('admin'::public.workspace_role) THEN
        RAISE EXCEPTION 'Access Denied: Only workspace owners and admins can manage memberships.';
    END IF;

    -- Prevent self-modification of roles or status
    IF TG_OP IN ('UPDATE') AND OLD.user_id = current_actor AND NEW.role <> OLD.role THEN
        RAISE EXCEPTION 'Privilege Escalation Blocked: You cannot modify your own workspace role.';
    END IF;

    -- Admins cannot promote anyone to owner
    IF actor_role = 'admin'::public.workspace_role AND TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'owner' THEN
        RAISE EXCEPTION 'Access Denied: Only the workspace owner can transfer or assign owner privileges.';
    END IF;

    -- Admins cannot demote or delete an owner
    IF actor_role = 'admin'::public.workspace_role AND TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'owner' THEN
        RAISE EXCEPTION 'Access Denied: Admins cannot alter or remove workspace owners.';
    END IF;

    -- Actor cannot assign a role higher than their own rank
    IF TG_OP IN ('INSERT', 'UPDATE') AND public.role_rank(NEW.role) > public.role_rank(actor_role) THEN
        RAISE EXCEPTION 'Privilege Escalation Blocked: You cannot grant a role higher than your own.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER enforce_role_escalation_rules
    BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- ------------------------------------------------------------------------------
-- 4. WORKSPACE CREATION & OWNER REGISTRATION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        status
    ) VALUES (
        NEW.id,
        NEW.owner_id,
        'owner'::public.workspace_role,
        'active'::public.membership_status
    ) ON CONFLICT (workspace_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ------------------------------------------------------------------------------
-- 5. IMMUTABILITY SAFEGUARDS
-- ------------------------------------------------------------------------------

-- Audit logs cannot be updated or deleted once written
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: Audit logs are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_audit_log_updates
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Patch versions cannot have their diff content or hashes altered
CREATE OR REPLACE FUNCTION public.prevent_patch_version_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.diff_content IS DISTINCT FROM OLD.diff_content 
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash 
       OR NEW.version_number IS DISTINCT FROM OLD.version_number THEN
        RAISE EXCEPTION 'Integrity Error: Patch version diffs and hashes are immutable. Create a new version instead.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_patch_version_alteration
    BEFORE UPDATE ON public.patch_versions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_patch_version_modification();

-- ------------------------------------------------------------------------------
-- 6. FINGERPRINTING & PROFILE AUTOMATION
-- ------------------------------------------------------------------------------

-- Deterministic SHA-256 fingerprint generation for vulnerability deduplication
CREATE OR REPLACE FUNCTION public.generate_finding_fingerprint(
    p_repo_id UUID,
    p_rule_id TEXT,
    p_file TEXT,
    p_sink_snippet TEXT DEFAULT ''
)
RETURNS TEXT AS $$
BEGIN
    RETURN pg_catalog.encode(
        extensions.digest(
            p_repo_id::text || ':' ||
            pg_catalog.btrim(p_rule_id) || ':' ||
            pg_catalog.btrim(p_file) || ':' ||
            COALESCE(pg_catalog.btrim(p_sink_snippet), ''),
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

-- Sync newly registered Supabase auth users to application profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    candidate_username TEXT;
BEGIN
    base_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1)
    );
    -- Enforce minimum username length of 3 characters per constraint username_length
    IF pg_catalog.char_length(base_username) < 3 THEN
        base_username := 'usr_' || pg_catalog.substr(NEW.id::text, 1, 6);
    END IF;

    candidate_username := base_username;
    -- Handle collision on unique username by appending user UUID fragment
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username AND id <> NEW.id) THEN
        candidate_username := pg_catalog.substr(base_username, 1, 20) || '_' || pg_catalog.substr(NEW.id::text, 1, 8);
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        display_name,
        username,
        avatar_url
    ) VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', ''),
        candidate_username,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Wire trigger to auth.users if available in Supabase schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. FUNCTION EXECUTION PRIVILEGES
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_user_workspace_role(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_role(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_workspace_role(UUID, public.workspace_role, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(UUID, public.workspace_role, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.role_rank(public.workspace_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.role_rank(public.workspace_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.generate_finding_fingerprint(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_finding_fingerprint(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
