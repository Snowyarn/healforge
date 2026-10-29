"""Workbench-domain ORM models: workspace, projects, sources, scans, findings,
patches, reviews, verifications, agent executions, reports, audit, bug reports."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .base import new_id, utcnow

# Canonical scan type identifiers (match the frontend radio-card contract exactly).
SCAN_TYPES = {
    "sast": "AST Static Analysis (SAST)",
    "sbom": "Dependency Vulnerability (SBOM)",
    "secrets": "Secret & Token Detection",
    "container": "gVisor Container Config Audit",
}
SCAN_TYPE_KEYS = {v: k for k, v in SCAN_TYPES.items()}


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("ws"))
    name: Mapped[str] = mapped_column(String(128))
    owner_user_id: Mapped[str] = mapped_column(String(48), index=True)
    engine_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_project_name_ws"),)

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("proj"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    runtime: Mapped[str] = mapped_column(String(64), default="Multi-language")
    provider: Mapped[str] = mapped_column(
        String(32), default="zip-archive"
    )  # zip-archive | github | gitlab | bitbucket
    primary_branch: Mapped[str] = mapped_column(String(64), default="import")
    created_by: Mapped[str] = mapped_column(String(48), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    revisions: Mapped[list[SourceRevision]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="SourceRevision.created_at.desc()"
    )


class SourceRevision(Base):
    __tablename__ = "source_revisions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("rev"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    digest: Mapped[str] = mapped_column(String(64))  # sha256 over sorted file digests
    archive_filename: Mapped[str] = mapped_column(String(255))
    branch_label: Mapped[str] = mapped_column(String(64), default="import")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    text_file_count: Mapped[int] = mapped_column(Integer, default=0)
    total_text_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[str] = mapped_column(String(48), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="revisions")
    files: Mapped[list[SourceFile]] = relationship(
        back_populates="revision", cascade="all, delete-orphan", order_by="SourceFile.path"
    )


class SourceFile(Base):
    __tablename__ = "source_files"
    __table_args__ = (UniqueConstraint("revision_id", "path", name="uq_revision_path"),)

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("sfl"))
    revision_id: Mapped[str] = mapped_column(ForeignKey("source_revisions.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(512))  # normalized, forward-slash relative path
    is_dir: Mapped[bool] = mapped_column(Boolean, default=False)
    size: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(32), default="")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # text files only, bounded
    content_sha256: Mapped[str] = mapped_column(String(64), default="")
    line_count: Mapped[int] = mapped_column(Integer, default=0)

    revision: Mapped[SourceRevision] = relationship(back_populates="files")


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("scan"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    revision_id: Mapped[str] = mapped_column(ForeignKey("source_revisions.id", ondelete="CASCADE"), index=True)
    scan_type: Mapped[str] = mapped_column(String(64))  # display string, see SCAN_TYPES
    trigger: Mapped[str] = mapped_column(String(32), default="Manual Scan")
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    options: Mapped[dict] = mapped_column(JSON, default=dict)
    consent_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_scopes: Mapped[list] = mapped_column(JSON, default=list)
    engine_versions: Mapped[dict] = mapped_column(JSON, default=dict)
    model_enrichment: Mapped[str] = mapped_column(String(32), default="not_requested")
    # not_requested | not_configured | completed | failed | refused
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(48), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    high_count: Mapped[int] = mapped_column(Integer, default=0)
    medium_count: Mapped[int] = mapped_column(Integer, default=0)
    low_count: Mapped[int] = mapped_column(Integer, default=0)
    model_used: Mapped[str | None] = mapped_column(String(128), nullable=True)
    request_id: Mapped[str] = mapped_column(String(64), default="")

    logs: Mapped[list[ScanLog]] = relationship(
        back_populates="scan", cascade="all, delete-orphan", order_by="ScanLog.ts"
    )


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_jobs.id", ondelete="CASCADE"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    level: Mapped[str] = mapped_column(String(16), default="INFO")
    message: Mapped[str] = mapped_column(Text)

    scan: Mapped[ScanJob] = relationship(back_populates="logs")


class Finding(Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("workspace_id", "display_id", name="uq_finding_display_ws"),)

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("fnd"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_jobs.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    revision_id: Mapped[str] = mapped_column(ForeignKey("source_revisions.id", ondelete="CASCADE"), index=True)
    display_id: Mapped[str] = mapped_column(String(48))  # HF-0001 / CVE-…-style for advisories
    rule_id: Mapped[str] = mapped_column(String(64))
    cwe: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(16))  # Critical | High | Medium | Low
    cvss_score: Mapped[float] = mapped_column(Float, default=0.0)
    cvss_basis: Mapped[str] = mapped_column(String(32), default="estimated-static")
    file_path: Mapped[str] = mapped_column(String(512), default="")
    line_start: Mapped[int] = mapped_column(Integer, default=0)
    line_end: Mapped[int] = mapped_column(Integer, default=0)
    evidence: Mapped[str] = mapped_column(Text, default="")  # redacted snippet
    detector: Mapped[str] = mapped_column(String(128), default="")
    confidence: Mapped[str] = mapped_column(String(16), default="high")  # high|medium|low|model-reported
    reachability: Mapped[str] = mapped_column(String(16), default="Unreachable")
    reachability_basis: Mapped[str] = mapped_column(String(255), default="heuristic")
    autofix_status: Mapped[str] = mapped_column(String(24), default="Pending")
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)  # open|resolved|false_positive
    owasp_category: Mapped[str] = mapped_column(String(64), default="")
    taint_steps: Mapped[list] = mapped_column(JSON, default=list)
    model_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PatchProposal(Base):
    __tablename__ = "patch_proposals"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("pat"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    finding_id: Mapped[str] = mapped_column(ForeignKey("findings.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(48), index=True)
    revision_id: Mapped[str] = mapped_column(String(48), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    file_path: Mapped[str] = mapped_column(String(512), default="")
    lines_range: Mapped[str] = mapped_column(String(32), default="")
    added_count: Mapped[int] = mapped_column(Integer, default=0)
    removed_count: Mapped[int] = mapped_column(Integer, default=0)
    diff: Mapped[str] = mapped_column(Text, default="")
    original_code: Mapped[list] = mapped_column(JSON, default=list)
    patched_code: Mapped[list] = mapped_column(JSON, default=list)
    rationale: Mapped[dict] = mapped_column(JSON, default=dict)
    generator: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(32), default="pending_review", index=True)
    # pending_review | approved | rejected | changes_requested | superseded
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    reviews: Mapped[list[ReviewEvent]] = relationship(
        back_populates="patch", cascade="all, delete-orphan", order_by="ReviewEvent.created_at"
    )


class ReviewEvent(Base):
    __tablename__ = "review_events"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("rev"))
    patch_id: Mapped[str] = mapped_column(ForeignKey("patch_proposals.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(48), default="")
    action: Mapped[str] = mapped_column(String(24))  # approve | reject | request_changes
    notes: Mapped[str] = mapped_column(Text, default="")
    patch_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patch: Mapped[PatchProposal] = relationship(back_populates="reviews")


class VerificationRun(Base):
    __tablename__ = "verification_runs"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("vrun"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    patch_id: Mapped[str] = mapped_column(ForeignKey("patch_proposals.id", ondelete="CASCADE"), index=True)
    requested_by: Mapped[str] = mapped_column(String(48), default="")
    mode: Mapped[str] = mapped_column(String(32))  # execution | static_reanalysis
    status: Mapped[str] = mapped_column(String(48), default="pending", index=True)
    # pending | verification_unavailable | completed | failed
    reason: Mapped[str] = mapped_column(Text, default="")
    policy: Mapped[dict] = mapped_column(JSON, default=dict)
    results: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence_digest: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("aex"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    scan_id: Mapped[str | None] = mapped_column(String(48), nullable=True, index=True)
    display_id: Mapped[str] = mapped_column(String(24))  # #EX-xxxxx
    severity_type: Mapped[str] = mapped_column(String(16), default="success")  # critical|success|warning
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


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("rpt"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    report_type: Mapped[str] = mapped_column(String(48))  # vulnerability-summary | scan-audit | project-assessment
    title: Mapped[str] = mapped_column(String(255))
    project_id: Mapped[str | None] = mapped_column(String(48), nullable=True)
    scan_id: Mapped[str | None] = mapped_column(String(48), nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    format: Mapped[str] = mapped_column(String(16), default="JSON")  # PDF | Markdown | JSON
    payload: Mapped[dict] = mapped_column(JSON, default=dict)  # includes checks_that_ran
    generated_by: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("aud"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    user_id: Mapped[str] = mapped_column(String(48), default="")
    category: Mapped[str] = mapped_column(String(32), default="Security", index=True)
    action: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(16), default="Success")
    request_id: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class BugReport(Base):
    __tablename__ = "bug_reports"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("bug"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    project_id: Mapped[str | None] = mapped_column(String(48), nullable=True, index=True)
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
