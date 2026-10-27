export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = 'owner' | 'admin' | 'security_engineer' | 'developer' | 'viewer';
export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type RepositoryProvider = 'github' | 'gitlab' | 'bitbucket' | 'other';
export type ConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';
export type IntegrationProvider =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'gvisor_sandbox'
  | 'slack'
  | 'jira'
  | 'custom_webhook';
export type IntegrationStatus = 'active' | 'inactive' | 'revoked' | 'error';
export type ScanTrigger = 'manual' | 'ci_webhook' | 'cron' | 'pr_hook';
export type ScanType = 'sast' | 'sbom' | 'secrets' | 'container_audit' | 'composite';
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';
export type FindingConfidence = 'high' | 'medium' | 'low';
export type ReachabilityStatus = 'reachable' | 'unreachable' | 'unknown';
export type FindingStatus =
  | 'open'
  | 'in_progress'
  | 'patch_generated'
  | 'verified_fixed'
  | 'false_positive'
  | 'ignored'
  | 'closed';
export type PatchStatus =
  | 'generating'
  | 'ready_for_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'applied'
  | 'superseded';
export type ReviewDecision = 'approved' | 'rejected' | 'changes_requested';
export type SandboxStatus =
  | 'queued'
  | 'initializing'
  | 'running'
  | 'passed'
  | 'failed'
  | 'timeout'
  | 'cancelled';
export type NetworkPolicyType = 'deny_all' | 'isolated_local_only' | 'allow_package_registry';
export type VerificationCheckType =
  | 'build_verification'
  | 'regression_test'
  | 'vulnerability_replay'
  | 'post_patch_sast';
export type VerificationCheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type AuditCategory =
  | 'auth'
  | 'profile'
  | 'security'
  | 'api'
  | 'billing'
  | 'team'
  | 'privacy'
  | 'repository'
  | 'analysis'
  | 'patch'
  | 'verification';
export type AuditStatus = 'success' | 'warning' | 'failed';
export type ReportType =
  | 'vulnerability_summary'
  | 'project_assessment'
  | 'scan_audit'
  | 'sandbox_attestation'
  | 'custom';
export type ReportFormat = 'PDF' | 'Markdown' | 'JSON' | 'CSV';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          display_name: string;
          username: string | null;
          avatar_url: string | null;
          job_title: string;
          role_title: string;
          organization: string;
          department: string;
          bio: string;
          phone: string;
          location: string;
          expertise: string[];
          skills: string[];
          github_url: string;
          website_url: string;
          linkedin_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          display_name?: string;
          username?: string | null;
          avatar_url?: string | null;
          job_title?: string;
          role_title?: string;
          organization?: string;
          department?: string;
          bio?: string;
          phone?: string;
          location?: string;
          expertise?: string[];
          skills?: string[];
          github_url?: string;
          website_url?: string;
          linkedin_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          display_name?: string;
          username?: string | null;
          avatar_url?: string | null;
          job_title?: string;
          role_title?: string;
          organization?: string;
          department?: string;
          bio?: string;
          phone?: string;
          location?: string;
          expertise?: string[];
          skills?: string[];
          github_url?: string;
          website_url?: string;
          linkedin_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          description: string;
          tier: 'free' | 'pro' | 'enterprise';
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          description?: string;
          tier?: 'free' | 'pro' | 'enterprise';
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_id?: string;
          description?: string;
          tier?: 'free' | 'pro' | 'enterprise';
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          status: MembershipStatus;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          status?: MembershipStatus;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: WorkspaceRole;
          status?: MembershipStatus;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          }
        ];
      };
      repositories: {
        Row: {
          id: string;
          workspace_id: string;
          provider: RepositoryProvider;
          external_repo_id: string | null;
          owner_name: string;
          name: string;
          url: string;
          default_branch: string;
          runtime: string;
          security_score: number;
          connection_status: ConnectionStatus;
          last_scan_at: string | null;
          open_vuln_count: number;
          critical_count: number;
          high_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider?: RepositoryProvider;
          external_repo_id?: string | null;
          owner_name: string;
          name: string;
          url: string;
          default_branch?: string;
          runtime?: string;
          security_score?: number;
          connection_status?: ConnectionStatus;
          last_scan_at?: string | null;
          open_vuln_count?: number;
          critical_count?: number;
          high_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          provider?: RepositoryProvider;
          external_repo_id?: string | null;
          owner_name?: string;
          name?: string;
          url?: string;
          default_branch?: string;
          runtime?: string;
          security_score?: number;
          connection_status?: ConnectionStatus;
          last_scan_at?: string | null;
          open_vuln_count?: number;
          critical_count?: number;
          high_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'repositories_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          }
        ];
      };
      integration_connections: {
        Row: {
          id: string;
          workspace_id: string;
          provider: IntegrationProvider;
          name: string;
          status: IntegrationStatus;
          account_identifier: string | null;
          scopes: string[];
          secret_ref: string | null;
          metadata: Json;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider: IntegrationProvider;
          name: string;
          status?: IntegrationStatus;
          account_identifier?: string | null;
          scopes?: string[];
          secret_ref?: string | null;
          metadata?: Json;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          provider?: IntegrationProvider;
          name?: string;
          status?: IntegrationStatus;
          account_identifier?: string | null;
          scopes?: string[];
          secret_ref?: string | null;
          metadata?: Json;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'integration_connections_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          }
        ];
      };
      analyses: {
        Row: {
          id: string;
          workspace_id: string;
          repository_id: string;
          branch: string;
          commit_sha: string;
          trigger_type: ScanTrigger;
          scan_type: ScanType;
          status: ScanStatus;
          started_at: string | null;
          completed_at: string | null;
          duration_seconds: number | null;
          findings_count: number;
          critical_count: number;
          high_count: number;
          medium_count: number;
          low_count: number;
          safe_error_message: string | null;
          logs: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          repository_id: string;
          branch?: string;
          commit_sha: string;
          trigger_type?: ScanTrigger;
          scan_type?: ScanType;
          status?: ScanStatus;
          started_at?: string | null;
          completed_at?: string | null;
          duration_seconds?: number | null;
          findings_count?: number;
          critical_count?: number;
          high_count?: number;
          medium_count?: number;
          low_count?: number;
          safe_error_message?: string | null;
          logs?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          repository_id?: string;
          branch?: string;
          commit_sha?: string;
          trigger_type?: ScanTrigger;
          scan_type?: ScanType;
          status?: ScanStatus;
          started_at?: string | null;
          completed_at?: string | null;
          duration_seconds?: number | null;
          findings_count?: number;
          critical_count?: number;
          high_count?: number;
          medium_count?: number;
          low_count?: number;
          safe_error_message?: string | null;
          logs?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_analysis_repository_workspace';
            columns: ['repository_id', 'workspace_id'];
            referencedRelation: 'repositories';
            referencedColumns: ['id', 'workspace_id'];
          }
        ];
      };
      findings: {
        Row: {
          id: string;
          workspace_id: string;
          repository_id: string;
          fingerprint: string;
          cve_id: string | null;
          cwe_id: string | null;
          title: string;
          description: string;
          severity: VulnerabilitySeverity;
          confidence: FindingConfidence;
          reachability: ReachabilityStatus;
          cvss_score: number | null;
          affected_file: string;
          start_line: number | null;
          end_line: number | null;
          scanner_name: string;
          rule_id: string;
          remediation_guidance: string | null;
          first_detected_analysis_id: string | null;
          latest_analysis_id: string | null;
          status: FindingStatus;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          repository_id: string;
          fingerprint: string;
          cve_id?: string | null;
          cwe_id?: string | null;
          title: string;
          description: string;
          severity: VulnerabilitySeverity;
          confidence?: FindingConfidence;
          reachability?: ReachabilityStatus;
          cvss_score?: number | null;
          affected_file: string;
          start_line?: number | null;
          end_line?: number | null;
          scanner_name?: string;
          rule_id: string;
          remediation_guidance?: string | null;
          first_detected_analysis_id?: string | null;
          latest_analysis_id?: string | null;
          status?: FindingStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          repository_id?: string;
          fingerprint?: string;
          cve_id?: string | null;
          cwe_id?: string | null;
          title?: string;
          description?: string;
          severity?: VulnerabilitySeverity;
          confidence?: FindingConfidence;
          reachability?: ReachabilityStatus;
          cvss_score?: number | null;
          affected_file?: string;
          start_line?: number | null;
          end_line?: number | null;
          scanner_name?: string;
          rule_id?: string;
          remediation_guidance?: string | null;
          first_detected_analysis_id?: string | null;
          latest_analysis_id?: string | null;
          status?: FindingStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_finding_repository_workspace';
            columns: ['repository_id', 'workspace_id'];
            referencedRelation: 'repositories';
            referencedColumns: ['id', 'workspace_id'];
          }
        ];
      };
      analysis_findings: {
        Row: {
          id: string;
          analysis_id: string;
          finding_id: string;
          file_path: string;
          start_line: number | null;
          end_line: number | null;
          evidence_snippet: string | null;
          detected_at: string;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          finding_id: string;
          file_path: string;
          start_line?: number | null;
          end_line?: number | null;
          evidence_snippet?: string | null;
          detected_at?: string;
        };
        Update: {
          id?: string;
          analysis_id?: string;
          finding_id?: string;
          file_path?: string;
          start_line?: number | null;
          end_line?: number | null;
          evidence_snippet?: string | null;
          detected_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analysis_findings_analysis_id_fkey';
            columns: ['analysis_id'];
            referencedRelation: 'analyses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'analysis_findings_finding_id_fkey';
            columns: ['finding_id'];
            referencedRelation: 'findings';
            referencedColumns: ['id'];
          }
        ];
      };
      patches: {
        Row: {
          id: string;
          workspace_id: string;
          repository_id: string;
          finding_id: string;
          target_branch: string;
          status: PatchStatus;
          title: string;
          explanation: string;
          rationale: string | null;
          model_provider: string | null;
          model_name: string | null;
          generation_prompt_tokens: number | null;
          generation_completion_tokens: number | null;
          current_version_number: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          repository_id: string;
          finding_id: string;
          target_branch?: string;
          status?: PatchStatus;
          title: string;
          explanation: string;
          rationale?: string | null;
          model_provider?: string | null;
          model_name?: string | null;
          generation_prompt_tokens?: number | null;
          generation_completion_tokens?: number | null;
          current_version_number?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          repository_id?: string;
          finding_id?: string;
          target_branch?: string;
          status?: PatchStatus;
          title?: string;
          explanation?: string;
          rationale?: string | null;
          model_provider?: string | null;
          model_name?: string | null;
          generation_prompt_tokens?: number | null;
          generation_completion_tokens?: number | null;
          current_version_number?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_patch_finding_workspace';
            columns: ['finding_id', 'workspace_id'];
            referencedRelation: 'findings';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'fk_patch_repository_workspace';
            columns: ['repository_id', 'workspace_id'];
            referencedRelation: 'repositories';
            referencedColumns: ['id', 'workspace_id'];
          }
        ];
      };
      patch_versions: {
        Row: {
          id: string;
          patch_id: string;
          version_number: number;
          diff_content: string;
          original_snippet: string | null;
          proposed_snippet: string | null;
          content_hash: string;
          generation_metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patch_id: string;
          version_number: number;
          diff_content: string;
          original_snippet?: string | null;
          proposed_snippet?: string | null;
          content_hash: string;
          generation_metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patch_id?: string;
          version_number?: number;
          diff_content?: string;
          original_snippet?: string | null;
          proposed_snippet?: string | null;
          content_hash?: string;
          generation_metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patch_versions_patch_id_fkey';
            columns: ['patch_id'];
            referencedRelation: 'patches';
            referencedColumns: ['id'];
          }
        ];
      };
      patch_reviews: {
        Row: {
          id: string;
          patch_version_id: string;
          reviewer_id: string;
          decision: ReviewDecision;
          comments: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          patch_version_id: string;
          reviewer_id: string;
          decision: ReviewDecision;
          comments?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          patch_version_id?: string;
          reviewer_id?: string;
          decision?: ReviewDecision;
          comments?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patch_reviews_patch_version_id_fkey';
            columns: ['patch_version_id'];
            referencedRelation: 'patch_versions';
            referencedColumns: ['id'];
          }
        ];
      };
      sandbox_runs: {
        Row: {
          id: string;
          workspace_id: string;
          repository_id: string;
          patch_version_id: string;
          container_id: string | null;
          execution_environment: string;
          isolation_config: Json;
          network_policy: NetworkPolicyType;
          status: SandboxStatus;
          exit_code: number | null;
          execution_summary: string | null;
          safe_terminal_logs: string | null;
          duration_ms: number | null;
          attestation_hash: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          repository_id: string;
          patch_version_id: string;
          container_id?: string | null;
          execution_environment?: string;
          isolation_config?: Json;
          network_policy?: NetworkPolicyType;
          status?: SandboxStatus;
          exit_code?: number | null;
          execution_summary?: string | null;
          safe_terminal_logs?: string | null;
          duration_ms?: number | null;
          attestation_hash?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          repository_id?: string;
          patch_version_id?: string;
          container_id?: string | null;
          execution_environment?: string;
          isolation_config?: Json;
          network_policy?: NetworkPolicyType;
          status?: SandboxStatus;
          exit_code?: number | null;
          execution_summary?: string | null;
          safe_terminal_logs?: string | null;
          duration_ms?: number | null;
          attestation_hash?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_sandbox_repository_workspace';
            columns: ['repository_id', 'workspace_id'];
            referencedRelation: 'repositories';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'sandbox_runs_patch_version_id_fkey';
            columns: ['patch_version_id'];
            referencedRelation: 'patch_versions';
            referencedColumns: ['id'];
          }
        ];
      };
      verification_checks: {
        Row: {
          id: string;
          sandbox_run_id: string;
          check_type: VerificationCheckType;
          check_name: string;
          status: VerificationCheckStatus;
          tests_passed: number;
          tests_failed: number;
          tests_total: number;
          evidence_reference: string | null;
          execution_metadata: Json;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sandbox_run_id: string;
          check_type: VerificationCheckType;
          check_name: string;
          status?: VerificationCheckStatus;
          tests_passed?: number;
          tests_failed?: number;
          tests_total?: number;
          evidence_reference?: string | null;
          execution_metadata?: Json;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sandbox_run_id?: string;
          check_type?: VerificationCheckType;
          check_name?: string;
          status?: VerificationCheckStatus;
          tests_passed?: number;
          tests_failed?: number;
          tests_total?: number;
          evidence_reference?: string | null;
          execution_metadata?: Json;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'verification_checks_sandbox_run_id_fkey';
            columns: ['sandbox_run_id'];
            referencedRelation: 'sandbox_runs';
            referencedColumns: ['id'];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          workspace_id: string | null;
          actor_id: string | null;
          actor_email: string | null;
          category: AuditCategory;
          action: string;
          entity_type: string;
          entity_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          status: AuditStatus;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          actor_id?: string | null;
          actor_email?: string | null;
          category: AuditCategory;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          status?: AuditStatus;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          actor_id?: string | null;
          actor_email?: string | null;
          category?: AuditCategory;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          status?: AuditStatus;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          }
        ];
      };
      saved_reports: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          report_type: ReportType;
          created_by: string | null;
          format: ReportFormat;
          filters: Json;
          summary_snapshot: string | null;
          artifact_storage_path: string | null;
          findings_count: number;
          critical_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          report_type?: ReportType;
          created_by?: string | null;
          format?: ReportFormat;
          filters?: Json;
          summary_snapshot?: string | null;
          artifact_storage_path?: string | null;
          findings_count?: number;
          critical_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          report_type?: ReportType;
          created_by?: string | null;
          format?: ReportFormat;
          filters?: Json;
          summary_snapshot?: string | null;
          artifact_storage_path?: string | null;
          findings_count?: number;
          critical_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_reports_workspace_id_fkey';
            columns: ['workspace_id'];
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_finding_fingerprint: {
        Args: {
          p_repo_id: string;
          p_rule_id: string;
          p_file: string;
          p_sink_snippet?: string;
        };
        Returns: string;
      };
      get_user_workspace_role: {
        Args: {
          target_workspace_id: string;
          check_user_id?: string;
        };
        Returns: WorkspaceRole | null;
      };
      has_workspace_role: {
        Args: {
          target_workspace_id: string;
          required_role?: WorkspaceRole;
          check_user_id?: string;
        };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: {
          target_workspace_id: string;
          check_user_id?: string;
        };
        Returns: boolean;
      };
      role_rank: {
        Args: {
          role: WorkspaceRole;
        };
        Returns: number;
      };
    };
    Enums: {
      workspace_role: WorkspaceRole;
      membership_status: MembershipStatus;
      repository_provider: RepositoryProvider;
      connection_status: ConnectionStatus;
      integration_provider: IntegrationProvider;
      integration_status: IntegrationStatus;
      scan_trigger: ScanTrigger;
      scan_type: ScanType;
      scan_status: ScanStatus;
      vulnerability_severity: VulnerabilitySeverity;
      finding_confidence: FindingConfidence;
      reachability_status: ReachabilityStatus;
      finding_status: FindingStatus;
      patch_status: PatchStatus;
      review_decision: ReviewDecision;
      sandbox_status: SandboxStatus;
      network_policy_type: NetworkPolicyType;
      verification_check_type: VerificationCheckType;
      verification_check_status: VerificationCheckStatus;
      audit_category: AuditCategory;
      audit_status: AuditStatus;
      report_type: ReportType;
      report_format: ReportFormat;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
