"""Workbench-domain ORM models mapped to Supabase PostgreSQL:
workspaces, repositories, analyses, findings, analysis_findings,
patches, patch_versions, patch_reviews, sandbox_runs, verification_checks,
audit_logs, saved_reports.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from sqlalchemy.sql import null

from ..db import Base
from ..services.source_store import SourceFile, SourceRevision
from .base import PgArray, SafeUuid, SafeUuid as Uuid, new_id, utcnow
from .enums import (
    AuditCategoryEnum,
    AuditStatusEnum,
    ConnectionStatusEnum,
    FindingConfidenceEnum,
    FindingStatusEnum,
    NetworkPolicyTypeEnum,
    PatchStatusEnum,
    ReachabilityStatusEnum,
    ReportFormatEnum,
    ReportTypeEnum,
    RepositoryProviderEnum,
    ReviewDecisionEnum,
    SandboxStatusEnum,
    ScanStatusEnum,
    ScanTriggerEnum,
    ScanTypeEnum,
    VerificationCheckStatusEnum,
    VerificationCheckTypeEnum,
    VulnerabilitySeverityEnum,
)

SCAN_TYPES = {
    "sast": "AST Static Analysis (SAST)",
    "sbom": "Dependency Vulnerability (SBOM)",
    "secrets": "Secret & Token Detection",
    "container": "gVisor Container Config Audit",
    "container_audit": "gVisor Container Config Audit",
}
SCAN_TYPE_KEYS = {v: k for k, v in SCAN_TYPES.items()}
SCAN_TYPE_KEYS["gVisor Container Config Audit"] = "container"
SCAN_TYPE_KEYS["container_audit"] = "container"


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    description: Mapped[str] = mapped_column(Text, default="")
    tier: Mapped[str] = mapped_column(Text, default="free")
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner_user_id = synonym("owner_id")

    @property
    def engine_paused(self) -> bool:
        return bool(self.settings.get("engine_paused", False))


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(RepositoryProviderEnum, default="github")
    external_repo_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_name: Mapped[str] = mapped_column(Text, default="healforge")
    name: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, default="")
    default_branch: Mapped[str] = mapped_column(Text, default="main")
    runtime: Mapped[str] = mapped_column(Text, default="Node.js")
    security_score: Mapped[int] = mapped_column(Integer, default=100)
    connection_status: Mapped[str] = mapped_column(ConnectionStatusEnum, default="connected")
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    open_vuln_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    high_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    primary_branch = synonym("default_branch")

    @property
    def description(self) -> str:
        return getattr(self, "_description", f"Repository {self.name} ({self.runtime})")

    @description.setter
    def description(self, val: str) -> None:
        self._description = val

    @property
    def created_by(self) -> uuid.UUID | None:
        return getattr(self, "_created_by", None)

    @created_by.setter
    def created_by(self, val: uuid.UUID | str | None) -> None:
        self._created_by = val

    @hybrid_property
    def archived_at(self) -> datetime | None:
        return None

    @archived_at.setter
    def archived_at(self, value: datetime | None) -> None:
        pass

    @archived_at.expression
    def archived_at(cls):
        return null()

    @property
    def revisions(self) -> list:
        return []


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    branch: Mapped[str] = mapped_column(Text, default="main")
    commit_sha: Mapped[str] = mapped_column(Text, default="HEAD")
    trigger_type: Mapped[str] = mapped_column(ScanTriggerEnum, default="manual")
    scan_type: Mapped[str] = mapped_column(ScanTypeEnum, default="sast")
    status: Mapped[str] = mapped_column(ScanStatusEnum, default="queued", index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    high_count: Mapped[int] = mapped_column(Integer, default=0)
    medium_count: Mapped[int] = mapped_column(Integer, default=0)
    low_count: Mapped[int] = mapped_column(Integer, default=0)
    safe_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[list[str]] = mapped_column(PgArray, default=list)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project_id = synonym("repository_id")
    trigger = synonym("trigger_type")
    queued_at = synonym("created_at")
    finished_at = synonym("completed_at")
    commit_hash = synonym("commit_sha")
    error_message = synonym("safe_error_message")

    @property
    def engine_versions(self) -> dict:
        return {"bandit": "1.7.5", "semgrep": "1.45.0", "trivy": "0.48.0"}

    @hybrid_property
    def revision_id(self) -> uuid.UUID:
        return self.id

    @revision_id.expression
    def revision_id(cls):
        return cls.id

    @property
    def error_code(self) -> str | None:
        if self.safe_error_message and "interrupted_by_restart" in self.safe_error_message:
            return "interrupted_by_restart"
        return getattr(self, "_error_code", "pipeline_error" if self.status == "failed" else None)

    @error_code.setter
    def error_code(self, val: str | None) -> None:
        self._error_code = val
        if val:
            self.safe_error_message = val

    @property
    def consent_granted(self) -> bool:
        return True

    @property
    def model_enrichment(self) -> str:
        if hasattr(self, "_model_enrichment") and self._model_enrichment:
            return self._model_enrichment
        for log_line in reversed(self.logs or []):
            if "NVIDIA inference not configured" in log_line or "inference not configured" in log_line:
                return "not_configured"
            if "Model enrichment skipped: source-sharing consent" in log_line:
                return "refused"
            if "Model enrichment finished" in log_line:
                return "completed"
            if "Model enrichment not requested" in log_line:
                return "not_requested"
        return "not_requested"

    @model_enrichment.setter
    def model_enrichment(self, val: str) -> None:
        self._model_enrichment = val

    @property
    def model_used(self) -> str:
        return getattr(self, "_model_used", "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF")

    @model_used.setter
    def model_used(self, val: str) -> None:
        self._model_used = val


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    fingerprint: Mapped[str] = mapped_column(Text, index=True)
    cve_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    cwe_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(VulnerabilitySeverityEnum)
    confidence: Mapped[str] = mapped_column(FindingConfidenceEnum, default="high")
    reachability: Mapped[str] = mapped_column(ReachabilityStatusEnum, default="unknown")
    cvss_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    affected_file: Mapped[str] = mapped_column(Text)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scanner_name: Mapped[str] = mapped_column(Text, default="HealForge AST Engine")
    rule_id: Mapped[str] = mapped_column(Text)
    remediation_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_detected_analysis_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    latest_analysis_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    status: Mapped[str] = mapped_column(FindingStatusEnum, default="open", index=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project_id = synonym("repository_id")
    scan_id = synonym("latest_analysis_id")
    revision_id = synonym("first_detected_analysis_id")
    file_path = synonym("affected_file")
    line_start = synonym("start_line")
    line_end = synonym("end_line")
    cwe = synonym("cwe_id")
    detector = synonym("scanner_name")

    @hybrid_property
    def resolved_at(self) -> datetime:
        return self.updated_at

    @resolved_at.setter
    def resolved_at(self, value: datetime) -> None:
        self.updated_at = value

    @resolved_at.expression
    def resolved_at(cls):
        return cls.updated_at

    @hybrid_property
    def display_id(self) -> str:
        if self.cve_id:
            return self.cve_id
        return f"HF-{str(self.id)[:6].upper()}"

    @display_id.expression
    def display_id(cls):
        return func.coalesce(cls.cve_id, cls.rule_id)

    @property
    def evidence(self) -> str:
        return str(self.metadata_.get("evidence", ""))

    @property
    def taint_steps(self) -> list:
        return self.metadata_.get("taint_steps", [])

    @property
    def model_analysis(self) -> dict | None:
        return self.metadata_.get("model_analysis")

    @property
    def cvss_basis(self) -> str:
        return "estimated-static"

    @property
    def reachability_basis(self) -> str:
        return "AST call-graph analysis"

    @property
    def autofix_status(self) -> str:
        if self.metadata_ and "autofix_status" in self.metadata_:
            return self.metadata_["autofix_status"]
        return getattr(self, "_autofix_status", "Pending")

    @autofix_status.setter
    def autofix_status(self, val: str) -> None:
        self._autofix_status = val
        meta = dict(self.metadata_ or {})
        meta["autofix_status"] = val
        self.metadata_ = meta

    @property
    def owasp_category(self) -> str:
        return str(self.metadata_.get("owasp", "A03:2021 Injection"))


class AnalysisFinding(Base):
    __tablename__ = "analysis_findings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    finding_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("findings.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(Text)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Patch(Base):
    __tablename__ = "patches"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("findings.id", ondelete="CASCADE"), index=True)
    target_branch: Mapped[str] = mapped_column(Text, default="main")
    status: Mapped[str] = mapped_column(PatchStatusEnum, default="ready_for_review", index=True)
    title: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generation_completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_version_number: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project_id = synonym("repository_id")
    version = synonym("current_version_number")
    description = synonym("explanation")

    versions: Mapped[list[PatchVersion]] = relationship(
        back_populates="patch", cascade="all, delete-orphan", order_by="PatchVersion.version_number.desc()"
    )

    def __init__(self, **kwargs):
        if "status" in kwargs and kwargs["status"] == "pending_review":
            kwargs["status"] = "ready_for_review"
        if "revision_id" in kwargs:
            self._revision_id = kwargs.pop("revision_id")
        if "file_path" in kwargs:
            self._file_path = kwargs.pop("file_path")
        if "lines_range" in kwargs:
            self._lines_range = kwargs.pop("lines_range")
        if "added_count" in kwargs:
            self._added_count = kwargs.pop("added_count")
        if "removed_count" in kwargs:
            self._removed_count = kwargs.pop("removed_count")
        if "generator" in kwargs:
            self.model_name = kwargs.pop("generator")
        if "rationale" in kwargs and isinstance(kwargs["rationale"], (dict, list)):
            import json
            kwargs["rationale"] = json.dumps(kwargs["rationale"])

        diff = kwargs.pop("diff", None)
        orig = kwargs.pop("original_code", None)
        pat = kwargs.pop("patched_code", None)

        super().__init__(**kwargs)

        if diff or orig or pat:
            orig_text = (
                "\n".join(l.get("content", "") for l in orig)
                if isinstance(orig, list)
                else (orig or "")
            )
            pat_text = (
                "\n".join(l.get("content", "") for l in pat)
                if isinstance(pat, list)
                else (pat or "")
            )
            import hashlib
            h = hashlib.sha256((diff or "").encode()).hexdigest()
            pv = PatchVersion(
                patch_id=self.id,
                version_number=self.current_version_number or 1,
                diff_content=diff or "",
                original_snippet=orig_text,
                proposed_snippet=pat_text,
                content_hash=h,
            )
            self.versions.append(pv)

    @property
    def diff(self) -> str:
        if self.versions:
            return self.versions[0].diff_content
        return getattr(self, "_diff", "")

    @diff.setter
    def diff(self, val: str) -> None:
        self._diff = val
        if self.versions:
            self.versions[0].diff_content = val

    @property
    def original_code(self) -> list[dict]:
        if not self.versions or not self.versions[0].original_snippet:
            return getattr(self, "_original_code", [])
        return [
            {"lineNumber": i + 1, "content": line, "type": "removed", "highlight": True}
            for i, line in enumerate(self.versions[0].original_snippet.splitlines())
        ]

    @original_code.setter
    def original_code(self, val) -> None:
        self._original_code = val

    @property
    def patched_code(self) -> list[dict]:
        if not self.versions or not self.versions[0].proposed_snippet:
            return getattr(self, "_patched_code", [])
        return [
            {"lineNumber": i + 1, "content": line, "type": "added", "highlight": True}
            for i, line in enumerate(self.versions[0].proposed_snippet.splitlines())
        ]

    @patched_code.setter
    def patched_code(self, val) -> None:
        self._patched_code = val

    @property
    def file_path(self) -> str:
        return getattr(self, "_file_path", "")

    @file_path.setter
    def file_path(self, val: str) -> None:
        self._file_path = val

    @property
    def lines_range(self) -> str:
        return getattr(self, "_lines_range", "")

    @lines_range.setter
    def lines_range(self, val: str) -> None:
        self._lines_range = val

    @property
    def revision_id(self) -> uuid.UUID | str | None:
        return getattr(self, "_revision_id", None)

    @revision_id.setter
    def revision_id(self, val) -> None:
        self._revision_id = val

    @property
    def added_count(self) -> int:
        return len([line for line in self.diff.split("\n") if line.startswith("+") and not line.startswith("+++")])

    @added_count.setter
    def added_count(self, val: int) -> None:
        self._added_count = val

    @property
    def removed_count(self) -> int:
        return len([line for line in self.diff.split("\n") if line.startswith("-") and not line.startswith("---")])

    @removed_count.setter
    def removed_count(self, val: int) -> None:
        self._removed_count = val

    @property
    def generator(self) -> str:
        return self.model_name or getattr(self, "_generator", "Nebius Token Factory (Nemotron 70B)")

    @generator.setter
    def generator(self, val: str) -> None:
        self.model_name = val
        self._generator = val

    @property
    def reviews(self) -> list:
        return []


class PatchVersion(Base):
    __tablename__ = "patch_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("patches.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    diff_content: Mapped[str] = mapped_column(Text)
    original_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_hash: Mapped[str] = mapped_column(Text)
    generation_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patch: Mapped[Patch] = relationship(back_populates="versions")
    reviews: Mapped[list[PatchReview]] = relationship(back_populates="version", cascade="all, delete-orphan")


class PatchReview(Base):
    __tablename__ = "patch_reviews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patch_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patch_versions.id", ondelete="CASCADE"), index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    decision: Mapped[str] = mapped_column(ReviewDecisionEnum)  # approved, rejected, changes_requested
    comments: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    version: Mapped[PatchVersion] = relationship(back_populates="reviews")

    patch_id = synonym("patch_version_id")
    action = synonym("decision")
    notes = synonym("comments")
    user_id = synonym("reviewer_id")

    @property
    def patch_version(self) -> int:
        return self.version.version_number if self.version else 1


class SandboxRun(Base):
    __tablename__ = "sandbox_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    patch_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("patch_versions.id", ondelete="CASCADE"), index=True
    )
    container_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_environment: Mapped[str] = mapped_column(Text, default="gvisor_microvm")
    isolation_config: Mapped[dict] = mapped_column(JSON, default=dict)
    network_policy: Mapped[str] = mapped_column(NetworkPolicyTypeEnum, default="deny_all")
    status: Mapped[str] = mapped_column(SandboxStatusEnum, default="queued", index=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    execution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    safe_terminal_logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attestation_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project_id = synonym("repository_id")
    patch_id = synonym("patch_version_id")
    reason = synonym("execution_summary")
    evidence_digest = synonym("attestation_hash")
    finished_at = synonym("completed_at")

    @property
    def mode(self) -> str:
        return self.isolation_config.get("mode", "execution") if self.isolation_config else "execution"

    @property
    def policy(self) -> dict:
        return self.isolation_config.get("policy", self.isolation_config) if self.isolation_config else {}

    @property
    def results(self) -> dict:
        if self.isolation_config and "checks" in self.isolation_config:
            return {"checks": self.isolation_config.get("checks", []), "passed": self.status == "passed", "exit_code": self.exit_code}
        return {"passed": self.status == "passed", "exit_code": self.exit_code}


class VerificationCheck(Base):
    __tablename__ = "verification_checks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sandbox_run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("sandbox_runs.id", ondelete="CASCADE"), index=True
    )
    check_type: Mapped[str] = mapped_column(VerificationCheckTypeEnum)
    check_name: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(VerificationCheckStatusEnum, default="pending")
    tests_passed: Mapped[int] = mapped_column(Integer, default=0)
    tests_failed: Mapped[int] = mapped_column(Integer, default=0)
    tests_total: Mapped[int] = mapped_column(Integer, default=0)
    evidence_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    actor_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(AuditCategoryEnum, default="security")
    action: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str] = mapped_column(Text, default="")
    entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(AuditStatusEnum, default="success")
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user_id = synonym("actor_id")
    actor = synonym("actor_email")
    ip = synonym("ip_address")

    @property
    def description(self) -> str:
        return f"{self.action} on {self.entity_type}"


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id: Mapped[str] = mapped_column(SafeUuid, primary_key=True, default=lambda: new_id("rpt"))
    workspace_id: Mapped[str] = mapped_column(SafeUuid, ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text)
    report_type: Mapped[str] = mapped_column(ReportTypeEnum, default="vulnerability_summary")
    created_by: Mapped[str | None] = mapped_column(SafeUuid, nullable=True)
    format: Mapped[str] = mapped_column(ReportFormatEnum, default="PDF")
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def __init__(self, **kwargs):
        if "project_id" in kwargs:
            self._project_id = kwargs.pop("project_id")
        if "scan_id" in kwargs:
            self._scan_id = kwargs.pop("scan_id")
        if "payload" in kwargs:
            kwargs["filters"] = kwargs.pop("payload")
        if "summary" in kwargs:
            kwargs["summary_snapshot"] = kwargs.pop("summary")
        if "generated_by" in kwargs:
            self._generated_by = kwargs.pop("generated_by")
        super().__init__(**kwargs)

    @property
    def project_id(self) -> str | None:
        return getattr(self, "_project_id", None)

    @project_id.setter
    def project_id(self, val: str | None) -> None:
        self._project_id = val

    @property
    def scan_id(self) -> str | None:
        return getattr(self, "_scan_id", None)

    @scan_id.setter
    def scan_id(self, val: str | None) -> None:
        self._scan_id = val

    @property
    def summary(self) -> str:
        return self.summary_snapshot or ""

    @summary.setter
    def summary(self, val: str) -> None:
        self.summary_snapshot = val

    @property
    def payload(self) -> dict:
        return self.filters or {}

    @payload.setter
    def payload(self, val: dict) -> None:
        self.filters = val

    @property
    def generated_by(self) -> str:
        return getattr(self, "_generated_by", str(self.created_by or "System"))

    @generated_by.setter
    def generated_by(self, val: str) -> None:
        self._generated_by = val


# --- Compatibility Aliases for Rohit's existing code ---
Project = Repository
ScanJob = Analysis
PatchProposal = Patch
ReviewEvent = PatchReview
VerificationRun = SandboxRun
Report = SavedReport
AuditEvent = AuditLog


class ScanLog:
    """Compatibility shim for in-memory / array-based log lines."""

    def __init__(self, scan_id: str = "", message: str = "", level: str = "INFO", ts: datetime | None = None):
        self.scan_id = scan_id
        self.message = message
        self.level = level
        self.ts = ts or utcnow()


class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("aex"))
    workspace_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    scan_id: Mapped[str | None] = mapped_column(SafeUuid, nullable=True, index=True)
    display_id: Mapped[str] = mapped_column(String(24))  # #EX-xxxxx
    severity_type: Mapped[str] = mapped_column(String(16), default="success")
    severity_badge: Mapped[str] = mapped_column(String(24), default="")
    service: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(255), default="")
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    revision_digest: Mapped[str] = mapped_column(String(64), default="")
    stages: Mapped[list] = mapped_column(JSON, default=list)
    trace_lines: Mapped[list] = mapped_column(JSON, default=list)
    artifacts: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BugReport(Base):
    __tablename__ = "bug_reports"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("bug"))
    workspace_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    project_id: Mapped[str | None] = mapped_column(SafeUuid, nullable=True, index=True)
    display_id: Mapped[str] = mapped_column(String(24))  # BUG-401 ...
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(48), default="Other")
    severity: Mapped[str] = mapped_column(String(16), default="Medium")
    affected_file: Mapped[str] = mapped_column(String(512), default="")
    steps_to_reproduce: Mapped[str] = mapped_column(Text, default="")
    expected_behavior: Mapped[str] = mapped_column(Text, default="")
    actual_behavior: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="In Triage")
    submitted_by: Mapped[str] = mapped_column(String(128), default="")
    evidence_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    evidence_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
