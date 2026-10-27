-- ==============================================================================
-- HEALFORGE DATABASE FOUNDATION — MIGRATION 03: ROW LEVEL SECURITY (RLS) POLICIES
-- Autonomous Code Security Analysis and Remediation Workbench
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patch_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patch_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. PROFILES POLICIES
-- ------------------------------------------------------------------------------

-- Users can view their own profile and profiles of peers in shared workspaces
CREATE POLICY "profiles_select_shared_workspace"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.workspace_members wm_self
            JOIN public.workspace_members wm_peer
                ON wm_self.workspace_id = wm_peer.workspace_id
            WHERE wm_self.user_id = auth.uid()
              AND wm_peer.user_id = public.profiles.id
              AND wm_self.status = 'active'
              AND wm_peer.status = 'active'
        )
    );

-- Users can insert their own profile during registration
CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- Users can only modify their own profile
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3. WORKSPACES POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can view their workspaces
CREATE POLICY "workspaces_select_member"
    ON public.workspaces
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(id));

-- Any authenticated user can create a workspace (they become owner via trigger)
CREATE POLICY "workspaces_insert_authenticated"
    ON public.workspaces
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Only owners and admins can update workspace details
CREATE POLICY "workspaces_update_admin"
    ON public.workspaces
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(id, 'admin'))
    WITH CHECK (public.has_workspace_role(id, 'admin'));

-- Only the owner can delete a workspace
CREATE POLICY "workspaces_delete_owner"
    ON public.workspaces
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(id, 'owner'));

-- ------------------------------------------------------------------------------
-- 4. WORKSPACE MEMBERS POLICIES
-- ------------------------------------------------------------------------------

-- Members can see other members in their workspace
CREATE POLICY "workspace_members_select_member"
    ON public.workspace_members
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Admins and owners can invite/add new members
CREATE POLICY "workspace_members_insert_admin"
    ON public.workspace_members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

-- Admins and owners can update roles/status (escalation trigger enforces limits)
CREATE POLICY "workspace_members_update_admin"
    ON public.workspace_members
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

-- Admins and owners can remove members
CREATE POLICY "workspace_members_delete_admin"
    ON public.workspace_members
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- Non-owner members can leave a workspace themselves
CREATE POLICY "workspace_members_delete_self"
    ON public.workspace_members
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        AND role <> 'owner'
    );

-- ------------------------------------------------------------------------------
-- 5. REPOSITORIES POLICIES
-- ------------------------------------------------------------------------------

-- Any workspace member can view repository assets
CREATE POLICY "repositories_select_member"
    ON public.repositories
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Security engineers and above can link repositories
CREATE POLICY "repositories_insert_seceng"
    ON public.repositories
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'security_engineer'));

-- Security engineers and above can update repository properties
CREATE POLICY "repositories_update_seceng"
    ON public.repositories
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'security_engineer'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'security_engineer'));

-- Admins and owners can delete repositories
CREATE POLICY "repositories_delete_admin"
    ON public.repositories
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 6. INTEGRATION CONNECTIONS POLICIES
-- ------------------------------------------------------------------------------

-- Only Security Engineers, Admins, and Owners can view integration connection configs
CREATE POLICY "integrations_select_seceng"
    ON public.integration_connections
    FOR SELECT
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'security_engineer'));

-- Only Admins and Owners can add, update, or remove integrations
CREATE POLICY "integrations_insert_admin"
    ON public.integration_connections
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "integrations_update_admin"
    ON public.integration_connections
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "integrations_delete_admin"
    ON public.integration_connections
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 7. ANALYSES POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can view scan and analysis history
CREATE POLICY "analyses_select_member"
    ON public.analyses
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Developers and above can trigger or queue new scans
CREATE POLICY "analyses_insert_developer"
    ON public.analyses
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Developers and above can update analysis records (e.g. cancel)
CREATE POLICY "analyses_update_developer"
    ON public.analyses
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'developer'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Admins can delete analysis runs if needed
CREATE POLICY "analyses_delete_admin"
    ON public.analyses
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 8. FINDINGS & ANALYSIS_FINDINGS POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can view vulnerability findings
CREATE POLICY "findings_select_member"
    ON public.findings
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Developers and above can create or register findings (scanner integrations)
CREATE POLICY "findings_insert_developer"
    ON public.findings
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Triage status changes (false positive, resolved) require Developer or above
CREATE POLICY "findings_update_developer"
    ON public.findings
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'developer'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Admins can delete findings
CREATE POLICY "findings_delete_admin"
    ON public.findings
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- Analysis findings occurrence visibility
CREATE POLICY "analysis_findings_select_member"
    ON public.analysis_findings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = public.analysis_findings.analysis_id
              AND public.is_workspace_member(a.workspace_id)
        )
    );

CREATE POLICY "analysis_findings_insert_developer"
    ON public.analysis_findings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = public.analysis_findings.analysis_id
              AND public.has_workspace_role(a.workspace_id, 'developer')
        )
    );

CREATE POLICY "analysis_findings_delete_admin"
    ON public.analysis_findings
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = public.analysis_findings.analysis_id
              AND public.has_workspace_role(a.workspace_id, 'admin')
        )
    );

-- ------------------------------------------------------------------------------
-- 9. PATCHES & PATCH VERSIONS POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can view patches
CREATE POLICY "patches_select_member"
    ON public.patches
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Developers and above can generate or propose patches
CREATE POLICY "patches_insert_developer"
    ON public.patches
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Developers and above can update patch lifecycle metadata
CREATE POLICY "patches_update_developer"
    ON public.patches
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'developer'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Admins can delete patches
CREATE POLICY "patches_delete_admin"
    ON public.patches
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- Patch Versions: Viewable by workspace members
CREATE POLICY "patch_versions_select_member"
    ON public.patch_versions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.patches p
            WHERE p.id = public.patch_versions.patch_id
              AND public.is_workspace_member(p.workspace_id)
        )
    );

-- Patch Versions: Proposable by developers and above
CREATE POLICY "patch_versions_insert_developer"
    ON public.patch_versions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patches p
            WHERE p.id = public.patch_versions.patch_id
              AND public.has_workspace_role(p.workspace_id, 'developer')
        )
    );

-- ------------------------------------------------------------------------------
-- 10. PATCH REVIEWS POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can inspect peer reviews
CREATE POLICY "patch_reviews_select_member"
    ON public.patch_reviews
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.patch_versions pv
            JOIN public.patches p ON pv.patch_id = p.id
            WHERE pv.id = public.patch_reviews.patch_version_id
              AND public.is_workspace_member(p.workspace_id)
        )
    );

-- Only Security Engineers and Admins can approve, reject, or request changes
-- Reviewer identity cannot be spoofed (reviewer_id must equal auth.uid())
CREATE POLICY "patch_reviews_insert_seceng"
    ON public.patch_reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reviewer_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.patch_versions pv
            JOIN public.patches p ON pv.patch_id = p.id
            WHERE pv.id = public.patch_reviews.patch_version_id
              AND public.has_workspace_role(p.workspace_id, 'security_engineer')
        )
    );

-- ------------------------------------------------------------------------------
-- 11. SANDBOX RUNS & VERIFICATION CHECKS POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can view sandbox test executions
CREATE POLICY "sandbox_runs_select_member"
    ON public.sandbox_runs
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Developers and above can queue sandbox execution runs
CREATE POLICY "sandbox_runs_insert_developer"
    ON public.sandbox_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Security Engineers and above (or service role) can update sandbox run states
CREATE POLICY "sandbox_runs_update_seceng"
    ON public.sandbox_runs
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'security_engineer'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'security_engineer'));

-- Admins can clean up sandbox runs
CREATE POLICY "sandbox_runs_delete_admin"
    ON public.sandbox_runs
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'admin'));

-- Verification checks: Viewable by workspace members
CREATE POLICY "verification_checks_select_member"
    ON public.verification_checks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sandbox_runs sr
            WHERE sr.id = public.verification_checks.sandbox_run_id
              AND public.is_workspace_member(sr.workspace_id)
        )
    );

-- Verification checks: Recordable by Security Engineers / execution workers
CREATE POLICY "verification_checks_insert_seceng"
    ON public.verification_checks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sandbox_runs sr
            WHERE sr.id = public.verification_checks.sandbox_run_id
              AND public.has_workspace_role(sr.workspace_id, 'security_engineer')
        )
    );

CREATE POLICY "verification_checks_update_seceng"
    ON public.verification_checks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sandbox_runs sr
            WHERE sr.id = public.verification_checks.sandbox_run_id
              AND public.has_workspace_role(sr.workspace_id, 'security_engineer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sandbox_runs sr
            WHERE sr.id = public.verification_checks.sandbox_run_id
              AND public.has_workspace_role(sr.workspace_id, 'security_engineer')
        )
    );

CREATE POLICY "verification_checks_delete_admin"
    ON public.verification_checks
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sandbox_runs sr
            WHERE sr.id = public.verification_checks.sandbox_run_id
              AND public.has_workspace_role(sr.workspace_id, 'admin')
        )
    );

-- ------------------------------------------------------------------------------
-- 12. AUDIT LOGS POLICIES
-- ------------------------------------------------------------------------------

-- Workspace audit history: only Security Engineers, Admins and Owners can view
CREATE POLICY "audit_logs_select_seceng"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        workspace_id IS NOT NULL
        AND public.has_workspace_role(workspace_id, 'security_engineer')
    );

-- Users can view their own direct audit events (e.g., auth, profile changes)
CREATE POLICY "audit_logs_select_actor"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        actor_id = auth.uid()
    );

-- Authenticated users or background backend workers can log security events
CREATE POLICY "audit_logs_insert_authenticated"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        workspace_id IS NULL
        OR public.is_workspace_member(workspace_id)
    );

-- Note: UPDATE and DELETE are blocked by trigger prevent_audit_log_modification
-- to guarantee tamper-proof audit trails.

-- ------------------------------------------------------------------------------
-- 13. SAVED REPORTS POLICIES
-- ------------------------------------------------------------------------------

-- Workspace members can view saved compliance and audit reports
CREATE POLICY "saved_reports_select_member"
    ON public.saved_reports
    FOR SELECT
    TO authenticated
    USING (public.is_workspace_member(workspace_id));

-- Developers and above can generate and save reports
CREATE POLICY "saved_reports_insert_developer"
    ON public.saved_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, 'developer'));

-- Security Engineers and above can update or delete reports
CREATE POLICY "saved_reports_update_seceng"
    ON public.saved_reports
    FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'security_engineer'))
    WITH CHECK (public.has_workspace_role(workspace_id, 'security_engineer'));

CREATE POLICY "saved_reports_delete_seceng"
    ON public.saved_reports
    FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, 'security_engineer'));
