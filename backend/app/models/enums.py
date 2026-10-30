"""PostgreSQL native Enum type definitions for Supabase schema."""

from sqlalchemy import Enum

# Account domain enums
WorkspaceRoleEnum = Enum(
    "owner", "admin", "security_engineer", "developer", "viewer",
    name="workspace_role", create_type=False, native_enum=True
)

MembershipStatusEnum = Enum(
    "active", "invited", "suspended",
    name="membership_status", create_type=False, native_enum=True
)

IntegrationProviderEnum = Enum(
    "github", "gitlab", "bitbucket", "anthropic", "openai", "gemini",
    "gvisor_sandbox", "slack", "jira", "custom_webhook",
    name="integration_provider", create_type=False, native_enum=True
)

IntegrationStatusEnum = Enum(
    "active", "inactive", "revoked", "error",
    name="integration_status", create_type=False, native_enum=True
)

# Workbench domain enums
RepositoryProviderEnum = Enum(
    "github", "gitlab", "bitbucket", "other",
    name="repository_provider", create_type=False, native_enum=True
)

ConnectionStatusEnum = Enum(
    "connected", "disconnected", "syncing", "error",
    name="connection_status", create_type=False, native_enum=True
)

ScanTriggerEnum = Enum(
    "manual", "ci_webhook", "cron", "pr_hook",
    name="scan_trigger", create_type=False, native_enum=True
)

ScanTypeEnum = Enum(
    "sast", "sbom", "secrets", "container_audit", "composite",
    name="scan_type", create_type=False, native_enum=True
)

ScanStatusEnum = Enum(
    "queued", "running", "completed", "failed", "cancelled",
    name="scan_status", create_type=False, native_enum=True
)

VulnerabilitySeverityEnum = Enum(
    "critical", "high", "medium", "low",
    name="vulnerability_severity", create_type=False, native_enum=True
)

FindingConfidenceEnum = Enum(
    "high", "medium", "low",
    name="finding_confidence", create_type=False, native_enum=True
)

ReachabilityStatusEnum = Enum(
    "reachable", "unreachable", "unknown",
    name="reachability_status", create_type=False, native_enum=True
)

FindingStatusEnum = Enum(
    "open", "in_progress", "patch_generated", "verified_fixed",
    "false_positive", "ignored", "closed",
    name="finding_status", create_type=False, native_enum=True
)

PatchStatusEnum = Enum(
    "generating", "ready_for_review", "under_review", "approved",
    "rejected", "changes_requested", "applied", "superseded",
    name="patch_status", create_type=False, native_enum=True
)

ReviewDecisionEnum = Enum(
    "approved", "rejected", "changes_requested",
    name="review_decision", create_type=False, native_enum=True
)

NetworkPolicyTypeEnum = Enum(
    "deny_all", "isolated_local_only", "allow_package_registry",
    name="network_policy_type", create_type=False, native_enum=True
)

SandboxStatusEnum = Enum(
    "queued", "initializing", "running", "passed", "failed", "timeout", "cancelled",
    name="sandbox_status", create_type=False, native_enum=True
)

VerificationCheckTypeEnum = Enum(
    "build_verification", "regression_test", "vulnerability_replay", "post_patch_sast",
    name="verification_check_type", create_type=False, native_enum=True
)

VerificationCheckStatusEnum = Enum(
    "pending", "running", "passed", "failed", "skipped",
    name="verification_check_status", create_type=False, native_enum=True
)

AuditCategoryEnum = Enum(
    "auth", "profile", "security", "api", "billing", "team", "privacy",
    "repository", "analysis", "patch", "verification",
    name="audit_category", create_type=False, native_enum=True
)

AuditStatusEnum = Enum(
    "success", "warning", "failed",
    name="audit_status", create_type=False, native_enum=True
)

ReportTypeEnum = Enum(
    "vulnerability_summary", "project_assessment", "scan_audit", "sandbox_attestation", "custom",
    name="report_type", create_type=False, native_enum=True
)

ReportFormatEnum = Enum(
    "PDF", "Markdown", "JSON", "CSV",
    name="report_format", create_type=False, native_enum=True
)
