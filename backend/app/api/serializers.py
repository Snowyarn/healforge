"""DTO builders matching the existing frontend TypeScript contracts exactly.

The React types in frontend/src/types are the API contract; these builders
produce those shapes from persisted ORM rows only.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..models import (
    AgentExecution,
    ApiKey,
    AuthSession,
    BugReport,
    Finding,
    IntegrationConfig,
    PatchProposal,
    PatchReview,
    PatchVersion,
    Project,
    Report,
    ReviewEvent,
    ScanJob,
    ScanLog,
    SourceFile,
    SourceRevision,
    TeamMember,
    UserAccount,
    UserProfile,
    VerificationRun,
    WebhookEndpoint,
    Workspace,
)
from ..models import (
    UserPreferences as UserPrefsModel,
)


def time_ago(dt: datetime | None) -> str:
    if dt is None:
        return "—"
    now = datetime.now(UTC)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    delta = now - dt
    s = int(delta.total_seconds())
    if s < 30:
        return "Just now"
    if s < 90:
        return "1 minute ago"
    if s < 3600:
        return f"{s // 60} minutes ago"
    if s < 7200:
        return "1 hour ago"
    if s < 86400:
        return f"{s // 3600} hours ago"
    if s < 172800:
        return "Yesterday"
    if s < 2592000:
        return f"{s // 86400} days ago"
    return dt.strftime("%b %d, %Y")


def duration_text(job: ScanJob) -> str:
    if job.status in ("Queued",):
        return "Waiting"
    end = job.finished_at or datetime.now(UTC)
    start = job.started_at or job.queued_at
    if start is None:
        return "—"
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    ms = (end - start).total_seconds() * 1000
    if job.status == "Running":
        return f"{ms / 1000:.1f}s (running)"
    return f"{ms / 1000:.1f}s"


def short_digest(digest: str | None) -> str:
    return (digest or "")[:12] or "n/a"


# ------------------------------------------------------------------ projects

RUNTIME_ICONS = {
    "python": "terminal",
    "javascript": "javascript",
    "typescript": "javascript",
    "go": "terminal",
    "rust": "terminal",
    "java": "terminal",
    "multi-language": "hub",
}


from ..services import source_store


def project_dto(db: Session, p: Project, health: dict | None = None) -> dict:
    """ProjectDetail contract + id fields used by new flows."""
    if health is None:
        health = project_health(db, p)
    last_scan = db.query(ScanJob).filter(ScanJob.repository_id == p.id).order_by(ScanJob.created_at.desc()).first()
    latest_rev = source_store.get_latest_revision(p.id)
    scan_status = "healthy"
    if health["critical_open"] > 0:
        scan_status = "vulnerable"
    elif last_scan is not None and last_scan.status == "running":
        scan_status = "scanning"
    verification_status = "pending"
    runs = db.query(VerificationRun).filter(VerificationRun.workspace_id == p.workspace_id).count()
    if runs:
        verification_status = "verified"

    head_commit = short_digest(latest_rev.digest if latest_rev else (last_scan.commit_sha if last_scan else None))
    latest_rev_id = latest_rev.id if latest_rev else (str(last_scan.id) if last_scan else None)

    return {
        "id": str(p.id),
        "name": p.name,
        "provider": p.provider,
        "primaryBranch": p.default_branch,
        "branches": [p.default_branch],
        "lastScanTime": time_ago(last_scan.created_at if last_scan else None),
        "lastScanTimeIso": (last_scan.created_at.isoformat() if last_scan and last_scan.created_at else None),
        "scanStatus": scan_status,
        "openVulnCount": health["open"],
        "criticalCount": health["critical_open"],
        "highCount": health["high_open"],
        "verificationStatus": verification_status,
        "healthScore": health["score"],
        "description": p.description,
        "runtime": p.runtime,
        "headCommit": head_commit,
        "latestRevisionId": latest_rev_id,
        "archived": False,
        "createdAtIso": p.created_at.isoformat() if p.created_at else None,
    }


def project_health(db: Session, p: Project) -> dict:
    open_rows = db.query(Finding).filter(Finding.repository_id == p.id, Finding.status == "open").all()
    critical = sum(1 for f in open_rows if (f.severity or "").lower() == "critical")
    high = sum(1 for f in open_rows if (f.severity or "").lower() == "high")
    open_count = len(open_rows)
    score = max(0, 100 - critical * 15 - high * 8 - (open_count - critical - high) * 3)
    return {"open": open_count, "critical_open": critical, "high_open": high, "score": score}


def repository_health_dto(db: Session, p: Project) -> dict:
    h = project_health(db, p)
    last_rev = source_store.get_latest_revision(p.id)
    return {
        "name": p.name,
        "runtime": p.runtime,
        "icon": RUNTIME_ICONS.get((p.runtime or "").lower().split("/")[0].strip(), "hub"),
        "description": p.description,
        "securityScore": h["score"],
        "criticalCount": h["critical_open"],
        "highCount": h["high_open"],
        "headCommit": short_digest(last_rev.digest if last_rev else None),
        "status": "critical" if h["critical_open"] else "optimal",
        "projectId": str(p.id),
    }


# ------------------------------------------------------------------ scans

SCAN_STATUS_MAP = {
    "queued": "Queued",
    "running": "Running",
    "completed": "Completed",
    "failed": "Failed",
    "cancelled": "Cancelled",
}


def scan_record_dto(db: Session, job: ScanJob, with_logs: bool = True) -> dict:
    project = db.get(Project, job.repository_id)
    revision = source_store.get_revision(job.id) or source_store.get_latest_revision(job.repository_id)
    raw_logs = job.logs or []
    if with_logs:
        logs = [f"[{entry.get('level', 'INFO')}] {entry.get('message', '')}" if isinstance(entry, dict) else str(entry) for entry in raw_logs]
    else:
        logs = []
    started = job.started_at or job.created_at
    commit_hash = short_digest(revision.digest if revision else job.commit_sha)
    return {
        "id": str(job.id),
        "project": project.name if project else "unknown",
        "projectId": str(job.repository_id),
        "scanType": job.scan_type,
        "startTime": time_ago(started),
        "startTimeIso": started.isoformat() if started else None,
        "duration": duration_text(job),
        "status": SCAN_STATUS_MAP.get(job.status, job.status),
        "statusRaw": job.status,
        "findingsCount": job.findings_count,
        "criticalCount": job.critical_count,
        "highCount": job.high_count,
        "mediumCount": job.medium_count,
        "lowCount": job.low_count,
        "trigger": job.trigger_type,
        "commitHash": commit_hash,
        "revisionId": str(job.id),
        "logs": logs,
        "consentGranted": job.consent_granted,
        "modelEnrichment": job.model_enrichment,
        "modelUsed": job.model_used,
        "error": {"code": job.error_code, "message": job.safe_error_message} if job.error_code else None,
    }


# ------------------------------------------------------------------ findings


def _code_lines(content: str | None, lo: int, hi: int, highlight_from: int, highlight_to: int) -> list[dict]:
    lines = (content or "").split("\n")
    lo = max(1, lo)
    hi = min(len(lines), hi)
    out = []
    for n in range(lo, hi + 1):
        out.append(
            {
                "lineNumber": n,
                "content": lines[n - 1][:400],
                "type": "neutral",
                "highlight": highlight_from <= n <= highlight_to,
            }
        )
    return out


def finding_dto(db: Session, f: Finding, full: bool = False) -> dict:
    project = db.get(Project, f.repository_id)
    revision = source_store.get_revision(f.first_detected_analysis_id or f.latest_analysis_id)
    if not revision and f.repository_id:
        revision = source_store.get_latest_revision(f.repository_id)
    src = None
    if full and revision:
        src = source_store.get_file(revision.id, f.affected_file)
    patch = (
        db.query(PatchProposal).filter(PatchProposal.finding_id == f.id).order_by(PatchProposal.version.desc()).first()
    )

    model_note = None
    if f.model_analysis:
        model_note = {
            "impact": f.model_analysis.get("impact", ""),
            "recommendation": f.model_analysis.get("recommendation", ""),
            "confidence": f.model_analysis.get("confidence", ""),
            "provenance": f.model_analysis.get("provenance", {}),
            "disclaimer": f.model_analysis.get("disclaimer", ""),
        }

    snippet = {"language": "text", "filePath": f.file_path, "lines": f"L{f.line_start}-L{f.line_end}", "code": []}
    if src is not None and src.content:
        lo = max(1, f.line_start - 5)
        hi = min(src.line_count, f.line_end + 5)
        snippet = {
            "language": src.language or "text",
            "filePath": f.file_path,
            "lines": f"L{lo}-L{hi}",
            "code": _code_lines(src.content, lo, hi, f.line_start, f.line_end),
        }

    ast_patch = {
        "title": "No patch synthesized yet",
        "description": "Patch synthesis uses NVIDIA inference. Request it from this screen; "
        "without a configured NVIDIA key this stays honestly unavailable.",
        "targetBranch": project.primary_branch if project else "main",
        "removedLines": [],
        "addedLines": [],
    }
    if patch is not None:
        removed = [c.get("content", "") for c in (patch.original_code or []) if c.get("type") == "removed"]
        added = [c.get("content", "") for c in (patch.patched_code or []) if c.get("type") == "added"]
        ast_patch = {
            "title": patch.title,
            "description": patch.description,
            "targetBranch": ast_patch["targetBranch"],
            "removedLines": removed,
            "addedLines": added,
            "patchId": patch.id,
            "patchStatus": patch.status,
        }

    impact = f.description
    if model_note and model_note.get("impact"):
        impact = model_note["impact"]
    elif f.reachability == "Reachable":
        impact = (
            f"{f.description} Reachability heuristic: the affected file exposes routing/handler "
            "symbols, so the path is likely reachable in normal traffic."
        )

    dto = {
        "id": f.display_id,
        "internalId": f.id,
        "cwe": f.cwe,
        "title": f.title,
        "description": f.description,
        "service": project.name if project else "unknown",
        "repository": project.name if project else "unknown",
        "projectId": f.project_id,
        "affectedFile": f.file_path,
        "exactLines": f"L{f.line_start}-L{f.line_end}",
        "discoveredBy": f.detector,
        "severity": f.severity,
        "cvssScore": f.cvss_score,
        "cvssBasis": f.cvss_basis,
        "reachability": f.reachability.capitalize() if f.reachability else "Unknown",
        "reachabilityBasis": f.reachability_basis,
        "autofixStatus": f.autofix_status,
        "status": "resolved" if f.status == "verified_fixed" else f.status,
        "confidence": f.confidence,
        "scanId": f.scan_id,
        "revisionDigest": short_digest(revision.digest if revision else None),
        "discoveredAt": time_ago(f.created_at),
        "discoveredAtIso": f.created_at.isoformat() if f.created_at else None,
        "hasPatch": patch is not None,
        "patchId": patch.id if patch else None,
        "modelAnalysis": model_note,
    }
    if full:
        dto.update(
            {
                "codeSnippet": snippet,
                "taintSteps": f.taint_steps or [],
                "impactAnalysis": impact,
                "astPatch": ast_patch,
                "compliance": {
                    "owasp": f.owasp_category or "Uncategorized",
                    "cvss": f"{f.cvss_score} ({f.cvss_basis})",
                    "exploitability": "Heuristic: reachable"
                    if f.reachability == "Reachable"
                    else "Heuristic: not directly routed",
                },
            }
        )
    return dto


# ------------------------------------------------------------------ patches


def patch_dto(db: Session, p: PatchProposal, include_reviews: bool = True) -> dict:
    finding = db.get(Finding, p.finding_id)
    project = db.get(Project, p.project_id)
    reviews = []
    if include_reviews:
        if p.versions:
            for v in p.versions:
                reviews.extend(v.reviews)
        else:
            reviews = (
                db.query(PatchReview)
                .join(PatchVersion)
                .filter(PatchVersion.patch_id == p.id)
                .order_by(PatchReview.created_at)
                .all()
            )
    runs = (
        db.query(VerificationRun)
        .filter(VerificationRun.patch_id == p.id)
        .order_by(VerificationRun.created_at.desc())
        .all()
    )

    verification_log: list[str] = []
    if not runs:
        verification_log.append("[STATIC] No verification run recorded for this patch yet.")
        verification_log.append("[UNAVAILABLE] Execution-based verification is disabled (no isolated runner).")
    for r in runs:
        if r.status == "verification_unavailable":
            when = r.created_at.isoformat() if r.created_at else "?"
            verification_log.append(
                f"[UNAVAILABLE] Execution verification refused at {when} — isolated runner not available."
            )
        checks = (r.results or {}).get("checks", [])
        for c in checks:
            tag = "PASS" if c.get("passed") else "FAIL"
            verification_log.append(f"[{tag}] {c.get('name', 'check')} — {c.get('detail', '')}")

    taint = (finding.taint_steps or []) if finding else []
    taint_source = {
        "label": "Taint source",
        "param": taint[0].get("codeRef", "n/a") if taint else "n/a",
        "desc": taint[0].get("description", "No taint trace recorded for this finding.")
        if taint
        else "No taint trace recorded (enable taint-flow analysis when scanning).",
    }
    ast_mutation = {
        "label": "Proposed change",
        "nodeType": p.generator or "n/a",
        "desc": p.description,
    }
    verification_status = {
        "label": "Verification",
        "count": f"{sum(1 for c in ((runs[0].results or {}).get('checks', []) if runs else []))} checks"
        if runs
        else "0 checks",
        "desc": (
            "tatic re-analysis only — code execution is not available in "
            "this deployment; see evidence for exact checks that ran."
        )
        if runs
        else "Not yet verified.",
    }

    return {
        "id": p.id,
        "vulnerabilityId": finding.display_id if finding else "n/a",
        "findingId": p.finding_id,
        "title": p.title,
        "description": p.description,
        "service": project.name if project else "unknown",
        "filePath": p.file_path,
        "linesRange": p.lines_range,
        "addedLinesCount": p.added_count,
        "removedLinesCount": p.removed_count,
        "status": PATCH_STATUS_MAP.get(p.status, p.status),
        "statusRaw": p.status,
        "version": p.version,
        "generatedAgo": time_ago(p.created_at),
        "generatedAtIso": p.created_at.isoformat() if p.created_at else None,
        "generator": p.generator,
        "originalCode": p.original_code or [],
        "patchedCode": p.patched_code or [],
        "unifiedDiff": p.diff,
        "astImpact": {
            "taintSource": taint_source,
            "astMutation": ast_mutation,
            "verificationStatus": verification_status,
        },
        "rationale": p.rationale or {},
        "verificationLog": verification_log,
        "reviews": [
            {
                "action": "approve" if r.action == "approved" else ("reject" if r.action == "rejected" else ("request_changes" if r.action == "changes_requested" else r.action)),
                "notes": r.notes,
                "actor": str(r.user_id) if r.user_id else "",
                "at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ],
        "verificationRuns": [
            {
                "id": v.id,
                "mode": v.mode,
                "status": v.status,
                "createdAt": v.created_at.isoformat() if v.created_at else None,
                "evidenceDigest": v.evidence_digest,
            }
            for v in runs
        ],
    }


PATCH_STATUS_MAP = {
    "ready_for_review": "Pending Review",
    "under_review": "Under Review",
    "pending_review": "Pending Review",
    "approved": "Approved",
    "rejected": "Rejected",
    "changes_requested": "Changes Requested",
    "applied": "Applied",
    "superseded": "Superseded",
}


# ------------------------------------------------------------------ verification


def verification_run_dto(db: Session, v: VerificationRun) -> dict:
    patch_ver = db.get(PatchVersion, v.patch_version_id)
    patch = patch_ver.patch if patch_ver else db.get(PatchProposal, v.patch_id)
    patch_id = patch.id if patch else v.patch_id
    ev = (v.isolation_config or {}).get("evidence", {})
    checks = (v.isolation_config or {}).get("checks", [])
    disclaimer = (v.isolation_config or {}).get("disclaimer", "")
    api_status = v.status
    if v.mode == "execution" and v.status == "failed":
        api_status = "verification_unavailable"
    elif v.status == "passed":
        api_status = "completed"
    return {
        "id": str(v.id),
        "patchId": str(patch_id),
        "patchStatus": patch.status if patch else None,
        "mode": v.mode,
        "status": api_status,
        "reason": v.reason or "",
        "policy": v.policy or {},
        "checks": checks,
        "disclaimer": disclaimer,
        "evidenceDigest": v.attestation_hash or "",
        "createdAt": v.created_at.isoformat() if v.created_at else None,
        "finishedAt": v.completed_at.isoformat() if v.completed_at else None,
        "evidenceAvailable": bool(ev),
    }


# ------------------------------------------------------------------ activity


def agent_execution_dto(a: AgentExecution) -> dict:
    return {
        "id": a.display_id,
        "internalId": a.id,
        "severityBadge": a.severity_badge,
        "severityType": a.severity_type,
        "service": a.service,
        "title": a.title,
        "startTime": time_ago(a.start_time),
        "startTimeIso": a.start_time.isoformat() if a.start_time else None,
        "commitHash": short_digest(a.revision_digest),
        "duration": f"{a.duration_ms / 1000:.1f}s",
        "stages": a.stages or [],
        "artifacts": a.artifacts or [],
        "traceHeader": {
            "title": f"Execution trace — {a.display_id}",
            "status": "completed",
            "statusType": "success" if a.severity_type != "critical" else "warning",
        },
        "traceLines": a.trace_lines or [],
    }


# ------------------------------------------------------------------ reports / audit / bugs


def report_dto(r: Report) -> dict:
    rtype = (r.report_type or "").replace("_", "-")
    return {
        "id": r.id,
        "title": r.title,
        "type": rtype,
        "generatedAt": time_ago(r.created_at),
        "generatedAtIso": r.created_at.isoformat() if r.created_at else None,
        "project": r.payload.get("project") if r.payload else None,
        "author": r.generated_by,
        "summary": r.summary,
        "findingsCount": r.findings_count,
        "criticalCount": r.critical_count,
        "format": r.format,
        "checksThatRan": (r.payload or {}).get("checks_that_ran", []),
    }


def audit_event_dto(a) -> dict:
    cat = a.category or "Security"
    if cat.lower() == "api":
        cat_fmt = "API"
    else:
        cat_fmt = cat.capitalize()
    return {
        "id": a.id,
        "category": cat_fmt,
        "action": a.action,
        "description": a.description,
        "timestamp": time_ago(a.created_at),
        "timestampIso": a.created_at.isoformat() if a.created_at else None,
        "actor": a.user_id,
        "ip": a.ip,
        "status": a.status,
    }


def bug_report_dto(b: BugReport, project_name: str | None) -> dict:
    return {
        "id": b.display_id,
        "internalId": b.id,
        "title": b.title,
        "description": b.description,
        "category": b.category,
        "severity": b.severity,
        "affectedRepo": project_name or "unassigned",
        "affectedFile": b.affected_file,
        "stepsToReproduce": b.steps_to_reproduce,
        "expectedBehavior": b.expected_behavior,
        "actualBehavior": b.actual_behavior,
        "status": b.status,
        "submittedAt": time_ago(b.created_at),
        "submittedAtIso": b.created_at.isoformat() if b.created_at else None,
        "submittedBy": b.submitted_by,
        "evidenceName": b.evidence_name,
        "hasEvidence": b.evidence_content is not None,
    }


# ------------------------------------------------------------------ files


def file_tree_dto(files: list[SourceFile], findings: list[Finding]) -> list[dict]:
    findings_by_path: dict[str, Finding] = {}
    for f in findings:
        if f.status == "open":
            findings_by_path.setdefault(f.file_path, f)

    nodes: dict[str, dict] = {}
    roots: list[dict] = []
    dirs = sorted({"/".join(f.path.split("/")[:-1]) for f in files if "/" in f.path}, key=len, reverse=True)
    for d in dirs:
        parts = d.split("/")
        name = parts[-1]
        nodes[d] = {"path": d, "name": name, "type": "dir", "children": []}

    for d in sorted(nodes, key=len):
        parent = "/".join(d.split("/")[:-1])
        if parent and parent in nodes:
            nodes[parent]["children"].append(nodes[d])
        elif d:
            roots.append(nodes[d])

    for f in files:
        if f.is_dir:
            continue
        finding = findings_by_path.get(f.path)
        node = {
            "path": f.path,
            "name": f.path.split("/")[-1],
            "type": "file",
            "language": f.language,
            "linesCount": f.line_count,
            "hasVulnerability": finding is not None,
            "vulnId": finding.display_id if finding else None,
            "findingId": finding.id if finding else None,
            "internalFileId": f.id,
        }
        parent = "/".join(f.path.split("/")[:-1])
        if parent and parent in nodes:
            nodes[parent]["children"].append(node)
        else:
            roots.append(node)

    def sort_children(n: dict) -> dict:
        if "children" in n:
            n["children"] = sorted(
                (sort_children(c) for c in n["children"]),
                key=lambda c: (c["type"] != "dir", c["name"].lower()),
            )
        return n

    return [sort_children(r) for r in sorted(roots, key=lambda r: (r["type"] != "dir", r["name"].lower()))]


# ------------------------------------------------------------------ account


def _parse_ua(ua: str) -> tuple[str, str, str]:
    browser = "Unknown browser"
    os_name = "Unknown OS"
    ua_l = ua.lower()
    if "edg/" in ua_l:
        browser = "Edge"
    elif "chrome/" in ua_l:
        browser = "Chrome"
    elif "firefox/" in ua_l:
        browser = "Firefox"
    elif "safari/" in ua_l:
        browser = "Safari"
    if "mac" in ua_l:
        os_name = "macOS"
    elif "windows" in ua_l:
        os_name = "Windows"
    elif "linux" in ua_l:
        os_name = "Linux"
    elif "iphone" in ua_l or "android" in ua_l:
        os_name = "Mobile"
    return browser, os_name, ua


def account_state_dto(
    db: Session,
    user: UserAccount,
    profile: UserProfile | None,
    prefs: UserPrefsModel | None,
    workspace: Workspace,
    current_session_id: str | None,
) -> dict:
    sessions = getattr(user, "_sessions", [])
    keys = getattr(user, "_keys", [])
    webhooks = getattr(workspace, "_webhooks", [])
    is_sqlite = str(db.bind.url).startswith("sqlite")
    if is_sqlite:
        team = db.query(TeamMember).filter(TeamMember.workspace_id == workspace.id).order_by(TeamMember.created_at).all()
        integrations = db.query(IntegrationConfig).filter(IntegrationConfig.workspace_id == workspace.id).all()
    else:
        from ..models import IntegrationConnection, Profile, WorkspaceMember
        wms = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).order_by(WorkspaceMember.created_at).all()
        user_ids = [wm.user_id for wm in wms]
        profiles = {p.id: p for p in db.query(Profile).filter(Profile.id.in_(user_ids)).all()} if user_ids else {}
        team = []
        for wm in wms:
            p = profiles.get(wm.user_id)
            team.append(type("TeamMemberView", (), {
                "id": str(wm.id),
                "name": (p.display_name or p.full_name or "Member") if p else "Member",
                "email": p.email if p else "unknown@healforge.local",
                "role": wm.role.replace("_", " ").title(),
                "status": wm.status.capitalize(),
                "created_at": wm.created_at,
                "user_id": str(wm.user_id),
                "revoked_at": None,
                "invite_expires_at": None,
            })())
        ics = db.query(IntegrationConnection).filter(IntegrationConnection.workspace_id == workspace.id).all()
        integrations = []
        for ic in ics:
            integrations.append(type("IntegrationView", (), {
                "id": str(ic.id),
                "workspace_id": str(ic.workspace_id),
                "provider": ic.provider,
                "name": ic.name,
                "status": ic.status,
                "created_at": ic.created_at,
                "updated_at": ic.updated_at,
                "config": ic.metadata_,
            })())
    from ..models import AuditEvent

    activity = (
        db.query(AuditEvent)
        .filter(AuditEvent.workspace_id == workspace.id)
        .order_by(AuditEvent.created_at.desc())
        .limit(50)
        .all()
    )

    auth_events = [
        {
            "id": s.id,
            "event": "Session active" + (" (current)" if s.id == current_session_id else ""),
            "timestamp": time_ago(s.created_at),
            "location": "session record (IP only)",
            "ip": s.ip or "unknown",
            "status": "success",
        }
        for s in sessions[:8]
    ]

    session_dtos = []
    for s in sessions:
        browser, os_name, _ = _parse_ua(s.user_agent or "")
        session_dtos.append(
            {
                "id": s.id,
                "isCurrent": s.id == current_session_id,
                "device": s.device_label or f"{browser} on {os_name}",
                "browser": browser,
                "os": os_name,
                "location": "—",
                "ip": s.ip or "unknown",
                "lastActive": time_ago(s.last_seen_at),
                "signInTime": time_ago(s.created_at),
            }
        )

    key_dtos = [
        {
            "id": k.id,
            "name": k.name,
            "prefix": k.key_prefix,
            "scopes": k.scopes or [],
            "createdAt": time_ago(k.created_at),
            "lastUsedAt": time_ago(k.last_used_at) if k.last_used_at else None,
            "status": "revoked" if k.revoked_at else "active",
            "expiresAt": k.expires_at.isoformat() if k.expires_at else "never",
        }
        for k in keys
    ]

    webhook_dtos = [
        {
            "id": w.id,
            "url": w.url,
            "events": w.events or [],
            "createdAt": time_ago(w.created_at),
            "status": "disabled" if not w.active else "healthy",
            "deliveryConfigured": False,  # honest: delivery worker not configured in this deployment
        }
        for w in webhooks
    ]

    INTEGRATION_META = {
        "github": {
            "name": "GitHub",
            "icon": "code_blocks",
            "description": "Repository import via GitHub App (authorized credential setup required).",
            "setup": (
                "reate a GitHub App, set its credentials in the backend secret store, then connect here. "
                "Until then, use the ZIP archive import — no GitHub credentials are stored by HealForge."
            ),
        },
        "gitlab": {
            "name": "GitLab",
            "icon": "code_blocks",
            "description": "Repository import via GitLab OAuth.",
            "setup": "Configure GitLab OAuth credentials in the backend secret store to enable.",
        },
        "slack": {
            "name": "Slack",
            "icon": "chat",
            "description": "Security alert notifications to Slack channels.",
            "setup": "Configure a Slack incoming webhook / bot token in the backend secret store to enable.",
        },
        "jira": {
            "name": "Jira",
            "icon": "task_alt",
            "description": "Create remediation tickets from findings.",
            "setup": "Configure Jira API credentials in the backend secret store to enable.",
        },
    }
    integration_dtos = []
    for prov in ("github", "gitlab", "slack", "jira"):
        meta = INTEGRATION_META[prov]
        integration_dtos.append(
            {
                "id": f"itg-{prov}",
                "provider": prov,
                "name": meta["name"],
                "icon": meta["icon"],
                "description": meta["description"],
                "connected": False,
                "accountName": None,
                "scope": None,
                "lastSync": None,
                "notConfigured": True,
                "setupInstructions": meta["setup"],
            }
        )
    _ = integrations  # rows exist but remain not_configured; honest state comes from provider setup

    team_dtos = [
        {
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "role": m.role,
            "status": m.status,
            "joinedAt": time_ago(m.created_at),
        }
        for m in team
    ]

    pref_data = (prefs.preferences if prefs else {}) or {}
    notif_data = (prefs.notification_prefs if prefs else {}) or {}
    priv_data = (prefs.privacy_prefs if prefs else {}) or {}

    return {
        "profile": {
            "fullName": (profile.full_name if profile else "") or user.username,
            "displayName": (profile.display_name if profile else "") or user.username,
            "username": user.username,
            "email": user.email,
            "isEmailVerified": bool(profile.email_verified) if profile else False,
            "pendingEmail": profile.pending_email if profile else None,
            "phone": profile.phone if profile else "",
            "location": profile.location if profile else "",
            "bio": profile.bio if profile else "",
            "jobTitle": profile.job_title if profile else "",
            "role": workspace_role(user),
            "organization": profile.organization if profile else "",
            "department": profile.department if profile else "",
            "expertise": profile.expertise if profile else [],
            "skills": profile.skills if profile else [],
            "githubUrl": profile.github_url if profile else "",
            "websiteUrl": profile.website_url if profile else "",
            "linkedinUrl": profile.linkedin_url if profile else "",
            "avatarInitials": (profile.avatar_initials if profile else "") or (user.username[:2].upper()),
        },
        "security": {
            "mfaEnabled": user.mfa_enabled,
            "mfaMethod": "authenticator_app" if user.mfa_enabled else "none",
            "passkeysEnabled": False,  # honest: no passkey/WebAuthn provider configured
            "passkeyCount": 0,
            "recoveryCodesRemaining": len(user.recovery_code_hashes or []),
            "lastPasswordChange": "not recorded",
            "recentAuthEvents": auth_events,
        },
        "sessions": session_dtos,
        "subscription": None,  # honest: no billing provider configured
        "billingNotConfigured": True,
        "apiKeys": key_dtos,
        "webhooks": webhook_dtos,
        "privacy": {
            "telemetryOptIn": bool(priv_data.get("telemetryOptIn", False)),
            "productUpdates": bool(priv_data.get("productUpdates", False)),
            "marketingEmails": bool(priv_data.get("marketingEmails", False)),
            "crashReporting": bool(priv_data.get("crashReporting", True)),
            "dataRetentionMonths": int(priv_data.get("dataRetentionMonths", 12)),
        },
        "notifications": {
            "securityAlertsInApp": bool(notif_data.get("securityAlertsInApp", True)),
            "securityAlertsEmail": bool(notif_data.get("securityAlertsEmail", False)),
            "patchGeneratedInApp": bool(notif_data.get("patchGeneratedInApp", True)),
            "patchGeneratedEmail": bool(notif_data.get("patchGeneratedEmail", False)),
            "sandboxCompletedInApp": bool(notif_data.get("sandboxCompletedInApp", True)),
            "sandboxCompletedEmail": bool(notif_data.get("sandboxCompletedEmail", False)),
            "credentialChangesEmail": bool(notif_data.get("credentialChangesEmail", True)),
            "billingAlertsEmail": bool(notif_data.get("billingAlertsEmail", False)),
            "weeklyDigest": bool(notif_data.get("weeklyDigest", False)),
        },
        "integrations": integration_dtos,
        "team": team_dtos,
        "preferences": {
            "theme": pref_data.get("theme", "system"),
            "timezone": pref_data.get("timezone", "UTC"),
            "dateFormat": pref_data.get("dateFormat", "YYYY-MM-DD"),
            "timeFormat": pref_data.get("timeFormat", "24h"),
            "density": pref_data.get("density", "comfortable"),
            "reducedMotion": bool(pref_data.get("reducedMotion", False)),
            "defaultLanding": pref_data.get("defaultLanding", "home"),
        },
        "activity": [audit_event_dto(a) for a in activity],
    }


def workspace_role(user: UserAccount) -> str:
    return {"owner": "Owner", "admin": "Admin"}.get(user.role, "Security Engineer")


# ------------------------------------------------------------------ intelligence / dashboard


def intelligence_dto(db: Session, workspace_id: str) -> dict:
    findings = db.query(Finding).filter(Finding.workspace_id == workspace_id).all()
    severity = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    cwe_map: dict[str, dict] = {}
    owasp_map: dict[str, int] = {}
    for f in findings:
        severity[f.severity] = severity.get(f.severity, 0) + 1
        cwe_key = f.cwe.split(":")[0] if f.cwe else "n/a"
        entry = cwe_map.setdefault(cwe_key, {"cwe": cwe_key, "title": f.cwe or "Unclassified", "count": 0})
        entry["count"] += 1
        if f.owasp_category:
            owasp_map[f.owasp_category] = owasp_map.get(f.owasp_category, 0) + 1

    total_findings = len(findings)
    owasp_list = [
        {"name": name, "count": count, "percentage": round(count * 100 / total_findings) if total_findings else 0}
        for name, count in sorted(owasp_map.items(), key=lambda kv: -kv[1])
    ] or [{"name": "No data yet — run a scan", "count": 0, "percentage": 0}]

    resolved = [f for f in findings if f.status == "resolved"]
    runs = db.query(VerificationRun).filter(VerificationRun.workspace_id == workspace_id).all()
    avg_verification_sec = 0.0
    if runs:
        durations = []
        for r in runs:
            if r.created_at and r.finished_at:
                start = r.created_at.replace(tzinfo=UTC) if r.created_at.tzinfo is None else r.created_at
                end = r.finished_at.replace(tzinfo=UTC) if r.finished_at.tzinfo is None else r.finished_at
                durations.append((end - start).total_seconds())
        avg_verification_sec = sum(durations) / len(durations) if durations else 0.0

    mttr_hours = 0.0
    resolved_durations = []
    for f in resolved:
        if f.created_at and f.resolved_at:
            created = f.created_at.replace(tzinfo=UTC) if f.created_at.tzinfo is None else f.created_at
            resolved_at = f.resolved_at.replace(tzinfo=UTC) if f.resolved_at.tzinfo is None else f.resolved_at
            resolved_durations.append((resolved_at - created).total_seconds() / 3600)
    if resolved_durations:
        mttr_hours = sum(resolved_durations) / len(resolved_durations)

    return {
        "owaspCategories": owasp_list,
        "cweDistribution": sorted(cwe_map.values(), key=lambda c: -c["count"])[:10],
        "severityBreakdown": [{"severity": k, "count": v} for k, v in severity.items()],
        "mttrHours": round(mttr_hours, 2),
        "totalRemediated": len(resolved),
        "averageVerificationTimeSec": round(avg_verification_sec, 1),
        "totalFindings": total_findings,
        "hasData": total_findings > 0,
    }


def dashboard_dto(db: Session, ctx) -> dict:
    ws_id = ctx.workspace.id
    projects = db.query(Project).filter(Project.workspace_id == ws_id, Project.archived_at.is_(None)).all()
    scans = db.query(ScanJob).filter(ScanJob.workspace_id == ws_id).order_by(ScanJob.created_at.desc()).limit(500).all()
    open_findings = db.query(Finding).filter(Finding.workspace_id == ws_id, Finding.status == "open").all()
    pending_reviews = (
        db.query(PatchProposal)
        .filter(PatchProposal.workspace_id == ws_id, PatchProposal.status.in_(["ready_for_review", "under_review"]))
        .count()
    )
    approved = (
        db.query(PatchProposal).filter(PatchProposal.workspace_id == ws_id, PatchProposal.status == "approved").count()
    )
    verified_runs = (
        db.query(VerificationRun)
        .filter(VerificationRun.workspace_id == ws_id, VerificationRun.status == "passed")
        .count()
    )
    executions = []
    last_run = (
        db.query(VerificationRun)
        .filter(VerificationRun.workspace_id == ws_id)
        .order_by(VerificationRun.created_at.desc())
        .first()
    )

    week_ago = datetime.now(UTC) - timedelta(days=7)
    resolved_weekly = (
        db.query(Finding)
        .filter(Finding.workspace_id == ws_id, Finding.status == "verified_fixed", Finding.updated_at >= week_ago)
        .count()
    )

    critical = sum(1 for f in open_findings if (f.severity or "").lower() == "critical")
    high = sum(1 for f in open_findings if (f.severity or "").lower() == "high")
    medium = sum(1 for f in open_findings if (f.severity or "").lower() == "medium")
    total_scans = len(scans)
    completed_scans = sum(1 for s in scans if s.status == "completed")
    pass_rate = f"{int(completed_scans * 100 / total_scans)}%" if total_scans else "—"

    sandbox_logs = [
        {
            "text": "Execution-based verification is disabled (no isolated runner in this deployment).",
            "type": "neutral",
        },
    ]
    if last_run is not None and last_run.created_at is not None:
        sandbox_logs.append(
            {
                "text": (
                    f"Last verification run: {last_run.status} ({last_run.mode}) at {last_run.created_at.isoformat()}"
                ),
                "type": "success" if last_run.status == "completed" else "neutral",
            }
        )
    else:
        sandbox_logs.append(
            {
                "text": (
                    "o verification run recorded yet. Static re-analysis verification "
                    "is available; execution-based verification is disabled."
                ),
                "type": "neutral",
            }
        )

    return {
        "metrics": {
            "criticalCount": critical,
            "highCount": high,
            "mediumCount": medium,
            "passRate": pass_rate,
            "projectCount": len(projects),
            "scanCount": total_scans,
            "openFindingCount": len(open_findings),
            "pendingReviewCount": pending_reviews,
            "verifiedFixCount": verified_runs,
            "regressionCount": 0,
        },
        "repositories": [repository_health_dto(db, p) for p in projects],
        "remediationVelocity": {
            "appliedPatches": str(approved),
            "passRate": pass_rate,
            "avgTimeToFix": "not enough data" if not resolved_weekly else f"{resolved_weekly} resolved this week",
            "resolvedWeeklyCount": resolved_weekly,
        },
        "recentAgentActivities": [
            {
                "id": e.id,
                "icon": "smart_toy" if e.severity_type == "success" else "warning",
                "title": e.title,
                "timeAgo": time_ago(e.created_at),
                "description": (
                    f"{e.service} — {e.severity_badge or 'completed'} (revision {short_digest(e.revision_digest)})."
                ),
            }
            for e in executions
        ],
        "activeSandboxSummary": {
            "containerId": "—",
            "targetService": "No sandbox is running: execution is disabled in this deployment.",
            "status": "verification_unavailable",
            "recentLogs": sandbox_logs,
        },
    }
