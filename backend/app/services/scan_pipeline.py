"""Scan pipeline: orchestrates a persisted scan job end-to-end.

Runs in a worker thread with its own DB session. Every stage appends real
ScanLog rows with real timestamps. No artificial delays, no fabricated
results. Model enrichment only happens with recorded consent AND a configured
NVIDIA key; otherwise the honest state is logged and recorded on the job.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    AgentExecution,
    Finding,
    Notification,
    Project,
    ScanJob,
    ScanLog,
    SourceFile,
    SourceRevision,
    Workspace,
)
from ..models.base import new_id, utcnow
from . import ai_provider, nvidia, secret_engine, static_engine

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="healforge-job")
_persist_lock = threading.Lock()  # serializes finding-ID assignment + commit across scan threads


def log(db: Session, scan_id: str, message: str, level: str = "INFO") -> None:
    db.add(ScanLog(scan_id=scan_id, ts=utcnow(), level=level, message=message[:2000]))
    db.commit()


def submit_scan(scan_id: str) -> None:
    _executor.submit(_run_scan_safe, scan_id)


def _run_scan_safe(scan_id: str) -> None:
    from ..db import session_scope

    db = session_scope()
    try:
        run_scan(db, scan_id)
    except Exception as exc:  # noqa: BLE001 — record the true failure on the job
        print(f"[healforge] scan {scan_id} pipeline error: {type(exc).__name__}: {exc}", flush=True)
        db.rollback()
        try:
            job = db.get(ScanJob, scan_id)
            if job is not None and job.status in ("queued", "running"):
                job.status = "failed"
                job.error_code = "pipeline_error"
                job.error_message = f"{type(exc).__name__}: {exc}"[:1000]
                job.finished_at = utcnow()
                db.add(
                    ScanLog(
                        scan_id=scan_id,
                        ts=utcnow(),
                        level="ERROR",
                        message=f"[FAIL] Pipeline error: {type(exc).__name__}: {exc}"[:2000],
                    )
                )
                db.commit()
        except Exception as mark_exc:  # noqa: BLE001 — never lose the failure silently
            print(f"[healforge] scan {scan_id} could not be marked failed: {mark_exc}", flush=True)
            db.rollback()
            try:
                # Last resort: raw connection, independent of the ORM session state.
                from sqlalchemy import text

                with db.get_bind().connect() as raw:
                    raw.execute(
                        text(
                            "UPDATE scan_jobs SET status='failed', error_code='pipeline_error', "
                            "error_message=:msg, finished_at=CURRENT_TIMESTAMP WHERE id=:sid"
                        ),
                        {"msg": f"{type(exc).__name__}: {exc}"[:1000], "sid": scan_id},
                    )
                    raw.commit()
            except Exception as raw_exc:  # noqa: BLE001
                print(f"[healforge] scan {scan_id} raw fallback failed too: {raw_exc}", flush=True)
    finally:
        db.close()


def _next_finding_display_id(db: Session, workspace_id: str, index: int) -> str:
    """Collision-free sequential IDs: derive from the highest existing HF-xxxx
    suffix (count-based numbering breaks when historical rows have gaps)."""
    rows = db.query(Finding.display_id).filter(Finding.workspace_id == workspace_id).all()
    max_n = 0
    for (did,) in rows:
        if did and did.startswith("HF-"):
            try:
                max_n = max(max_n, int(did.split("-")[1]))
            except (ValueError, IndexError):
                continue
    return f"HF-{max_n + index:04d}"


def _unique_display_id(db: Session, workspace_id: str, candidate: str) -> str:
    """CVE-style override IDs must also stay unique per workspace across scans."""
    exists = db.query(Finding.id).filter(Finding.workspace_id == workspace_id, Finding.display_id == candidate).first()
    if not exists:
        return candidate
    n = 2
    while True:
        suffixed = f"{candidate}#{n}"
        if (
            not db.query(Finding.id)
            .filter(Finding.workspace_id == workspace_id, Finding.display_id == suffixed)
            .first()
        ):
            return suffixed
        n += 1


def run_scan(db: Session, scan_id: str) -> None:
    job = db.get(ScanJob, scan_id)
    if job is None:
        return
    project = db.get(Project, job.project_id)
    revision = db.get(SourceRevision, job.revision_id)
    if project is None or revision is None:
        job.status = "failed"
        job.error_code = "invalid_reference"
        job.finished_at = utcnow()
        db.commit()
        return

    job.status = "running"
    job.started_at = utcnow()
    db.commit()

    options = job.options or {}
    from ..models.workbench import SCAN_TYPE_KEYS

    scan_key = SCAN_TYPE_KEYS.get(job.scan_type, "sast")

    log(
        db,
        scan_id,
        f"[INIT] Scan {scan_id} started: {job.scan_type} on project '{project.name}' "
        f"revision {revision.digest[:12]} (engine {static_engine.ENGINE_VERSION}).",
    )

    files = db.query(SourceFile).filter(SourceFile.revision_id == revision.id, SourceFile.is_dir.is_(False)).all()
    log(
        db, scan_id, f"[PARSE] Loaded {len(files)} text files ({revision.total_text_bytes} bytes) from stored revision."
    )

    raw_findings: list[dict] = []

    # --- Stage 1: static analysis per scan type -------------------------------
    if scan_key in ("sast", "secrets", "container"):
        log(db, scan_id, "[ANALYZE] Running built-in static rules over source files...")
        for f in files:
            content = f.content or ""
            if scan_key == "sast":
                for rf in static_engine.run_sast_file(f.path, f.language, content):
                    rf["file_path"] = f.path
                    rf["language"] = f.language
                    rf["code"] = content
                    rf["detector"] = static_engine.ENGINE_VERSION
                    rf["confidence"] = "high"
                    raw_findings.append(rf)
            elif scan_key == "container":
                lname = f.path.rsplit("/", 1)[-1].lower()
                if lname.startswith("dockerfile") or lname.endswith(".dockerfile"):
                    for rf in static_engine.scan_dockerfile(f.path, content):
                        rf["file_path"] = f.path
                        rf["language"] = f.language
                        rf["detector"] = static_engine.ENGINE_VERSION
                        rf["confidence"] = "high"
                        raw_findings.append(rf)
                elif lname in ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"):
                    for rf in static_engine.scan_compose(f.path, content):
                        rf["file_path"] = f.path
                        rf["language"] = f.language
                        rf["detector"] = static_engine.ENGINE_VERSION
                        rf["confidence"] = "high"
                        raw_findings.append(rf)

        if scan_key == "container":
            log(db, scan_id, f"[ANALYZE] Container config audit complete: {len(raw_findings)} configuration findings.")

    if scan_key in ("sast", "secrets", "sbom"):
        log(db, scan_id, "[SECRETS] Running secret & token detection (pattern + entropy)...")
        secret_hits: list[dict] = []
        for f in files:
            content = f.content or ""
            for sf in secret_engine.scan_text(f.path, content):
                secret_hits.append({"file": f, "hit": sf})
        for entry in secret_hits:
            hit = entry["hit"]
            raw_findings.append(
                {
                    "rule_id": hit["rule_id"],
                    "cwe": "CWE-798: Use of Hard-coded Credentials",
                    "title": f"Detected secret: {hit['name']}",
                    "severity": hit["severity"],
                    "line_start": hit["line_start"],
                    "line_end": hit["line_end"],
                    "evidence": secret_engine.redact_line(hit["evidence_line"]),
                    "description": f"{hit['name']} detected in {entry['file'].path}. Secrets committed to source "
                    f"repositories must be rotated and removed from history.",
                    "owasp": "A02:2021 Cryptographic Failures",
                    "file_path": entry["file"].path,
                    "language": entry["file"].language,
                    "code": entry["file"].content or "",
                    "detector": secret_engine.ENGINE_VERSION,
                    "confidence": "high",
                    "secret_value": hit["value"],
                    "redact_hint": hit["redact_hint"],
                }
            )
        log(
            db,
            scan_id,
            f"[SECRETS] Secret detection complete: {len(secret_hits)} credential exposures "
            f"(values redacted from all evidence).",
        )

    if scan_key == "sbom":
        log(db, scan_id, "[SBOM] Parsing dependency manifests and matching local advisory ruleset...")
        components: list[dict] = []
        for f in files:
            lname = f.path.rsplit("/", 1)[-1].lower()
            if lname == "requirements.txt":
                components += static_engine.scan_requirements_txt(f.content or "")
            elif lname == "package.json":
                components += static_engine.scan_package_json(f.content or "")
            elif lname == "go.mod":
                components += static_engine.scan_go_mod(f.content or "")
        matched = static_engine.match_advisories(components)
        for adv in matched:
            manifest = (
                "requirements.txt"
                if adv["ecosystem"] == "pypi"
                else ("package.json" if adv["ecosystem"] == "npm" else "go.mod")
            )
            raw_findings.append(
                {
                    "rule_id": f"HF-DEP-{adv['cve']}",
                    "cwe": adv["cwe"],
                    "title": f"Vulnerable dependency: {adv['package']} {adv['declared']} ({adv['cve']})",
                    "severity": adv["severity"],
                    "line_start": 1,
                    "line_end": 1,
                    "evidence": f"{manifest}: {adv['line']}",
                    "description": f"{adv['summary']} Declared {adv['declared']}; fixed in {adv['vulnerable_below']}. "
                    f"Matched against {static_engine.ADVISORY_DB_VERSION}.",
                    "owasp": "A06:2021 Vulnerable and Outdated Components",
                    "file_path": manifest,
                    "language": "manifest",
                    "code": "",
                    "detector": static_engine.ADVISORY_DB_VERSION.split(" ")[0],
                    "confidence": "high",
                    "display_id_override": adv["cve"],
                }
            )
        log(
            db,
            scan_id,
            f"[SBOM] {len(components)} components parsed, {len(matched)} advisories matched "
            f"({static_engine.ADVISORY_DB_VERSION}).",
        )

    # --- Stage 2: persist findings -------------------------------------------
    log(db, scan_id, f"[FINDINGS] Persisting {len(raw_findings)} findings tied to revision {revision.digest[:12]}...")
    with _persist_lock:
        for index, rf in enumerate(raw_findings, start=1):
            taint = []
            if options.get("taintFlow") and rf.get("code"):
                taint = static_engine.build_taint_steps(rf["file_path"], rf["code"], rf)
            finding = Finding(
                id=new_id("fnd"),
                workspace_id=job.workspace_id,
                scan_id=job.id,
                project_id=job.project_id,
                revision_id=job.revision_id,
                display_id=(
                    _unique_display_id(db, job.workspace_id, rf["display_id_override"])
                    if rf.get("display_id_override")
                    else _next_finding_display_id(db, job.workspace_id, index)
                ),
                rule_id=rf["rule_id"],
                cwe=rf.get("cwe", ""),
                title=rf["title"][:250],
                description=rf.get("description", ""),
                severity=rf["severity"],
                cvss_score=static_engine.CVSS_ESTIMATE[rf["severity"]],
                cvss_basis="estimated-static",
                file_path=rf.get("file_path", ""),
                line_start=rf.get("line_start", 0),
                line_end=rf.get("line_end", 0),
                evidence=(rf.get("evidence") or "")[:1000],
                detector=rf.get("detector", static_engine.ENGINE_VERSION),
                confidence=rf.get("confidence", "high"),
                reachability=rf.get("reachable", "Unreachable")
                if rf.get("detector") == static_engine.ENGINE_VERSION
                else "Unreachable",
                reachability_basis="heuristic (routing/decorator presence in file)"
                if rf.get("detector") == static_engine.ENGINE_VERSION
                else "n/a (manifest/config)",
                autofix_status="Pending",
                status="open",
                owasp_category=rf.get("owasp", ""),
                taint_steps=taint,
            )
            db.add(finding)
        db.commit()

    job.findings_count = len(raw_findings)
    job.critical_count = sum(1 for f in raw_findings if f["severity"] == "Critical")
    job.high_count = sum(1 for f in raw_findings if f["severity"] == "High")
    job.medium_count = sum(1 for f in raw_findings if f["severity"] == "Medium")
    job.low_count = sum(1 for f in raw_findings if f["severity"] == "Low")

    # --- Stage 3: optional AI model enrichment (consent + key required) ---------
    wants_model = bool(options.get("modelEnrichment"))
    ai_stat = ai_provider.status()
    active_prov = ai_stat["active_provider"].upper()
    active_model = settings.active_ai_model

    if not wants_model:
        job.model_enrichment = "not_requested"
        log(db, scan_id, "[MODEL] Model enrichment not requested for this scan.")
    elif not job.consent_granted:
        job.model_enrichment = "refused"
        log(db, scan_id, "[MODEL] Model enrichment skipped: source-sharing consent not granted.", "WARN")
    elif not ai_stat["configured"]:
        job.model_enrichment = "not_configured"
        key_name = f"{active_prov}_API_KEY"
        log(
            db,
            scan_id,
            f"[MODEL] NVIDIA inference not configured ({key_name} absent in backend environment) — "
            f"static findings only. Set the key in backend/.env to enable model analysis.",
            "WARN",
        )
    else:
        log(
            db,
            scan_id,
            f"[MODEL] Requesting {active_prov} analysis ({active_model}) for top findings "
            f"(source secret-redacted, bounded context)...",
        )
        findings_rows = (
            db.query(Finding)
            .filter(Finding.scan_id == job.id)
            .order_by(Finding.cvss_score.desc())
            .limit(ai_provider.MAX_FINDINGS_PER_SCAN_ENRICHMENT)
            .all()
        )
        enriched = failed = 0
        for f in findings_rows:
            src = (
                db.query(SourceFile)
                .filter(SourceFile.revision_id == job.revision_id, SourceFile.path == f.file_path)
                .first()
            )
            context = ""
            if src is not None and src.content:
                lines = src.content.split("\n")
                lo = max(0, f.line_start - 6)
                hi = min(len(lines), f.line_end + 6)
                context = "\n".join(lines[lo:hi])
                secret_hits = secret_engine.scan_text(src.path, context)
                context = secret_engine.redact_secrets(context, secret_hits)
            try:
                analysis, prov = ai_provider.enrich_finding(
                    {
                        "title": f.title,
                        "cwe": f.cwe,
                        "severity": f.severity,
                        "file_path": f.file_path,
                        "line_start": f.line_start,
                        "description": f.description,
                    },
                    context,
                    revision.digest,
                )
                f.model_analysis = {
                    **analysis,
                    "provenance": {
                        "model_id": prov.model_id,
                        "prompt_schema_version": prov.prompt_schema_version,
                        "provider": getattr(prov, "provider", active_prov.lower()),
                        "source_digest": prov.source_digest,
                        "request_digest": prov.request_digest,
                        "response_digest": prov.response_digest,
                        "duration_ms": prov.duration_ms,
                    },
                    "disclaimer": "Model analysis is AI-generated context, not verification evidence.",
                }
                f.confidence = f"model-reported:{analysis['confidence']}"
                db.commit()
                enriched += 1
                log(db, scan_id, f"[MODEL] Enriched {f.display_id} ({f.title[:60]}).")
            except (ai_provider.AiRequestError, nvidia.NvidiaRequestError) as exc:
                failed += 1
                log(db, scan_id, f"[MODEL] Enrichment failed for {f.display_id}: {exc.code} — {exc.message}", "WARN")
        job.model_enrichment = (
            "completed" if enriched and not failed else ("failed" if failed and not enriched else "partial")
        )
        job.model_used = active_model
        log(db, scan_id, f"[MODEL] Model enrichment finished: {enriched} enriched, {failed} failed.")

    job.engine_versions = {
        "static": static_engine.ENGINE_VERSION,
        "secrets": secret_engine.ENGINE_VERSION,
        "advisories": static_engine.ADVISORY_DB_VERSION,
        "model": active_model if job.model_enrichment == "completed" else None,
    }

    # --- Stage 4: complete + agent record + notification ----------------------
    job.status = "completed"
    job.finished_at = utcnow()
    duration_ms = int((job.finished_at - (job.started_at or job.queued_at)).total_seconds() * 1000)
    db.commit()

    aex = AgentExecution(
        workspace_id=job.workspace_id,
        scan_id=job.id,
        display_id=f"#EX-{abs(hash(job.id)) % 100000:05d}",
        severity_type="critical" if job.critical_count else ("warning" if job.findings_count else "success"),
        severity_badge=f"{job.critical_count} critical"
        if job.critical_count
        else ("clean" if not job.findings_count else "findings"),
        service=project.name,
        title=f"{job.scan_type} completed — {job.findings_count} findings",
        start_time=job.started_at or job.queued_at,
        duration_ms=duration_ms,
        revision_digest=revision.digest,
        stages=[
            {
                "name": "Source Intake",
                "status": "completed",
                "timing": f"{len(files)} files",
                "detail": f"revision {revision.digest[:12]}",
            },
            {
                "name": "Static Analysis",
                "status": "completed",
                "timing": f"{duration_ms}ms",
                "detail": f"{job.findings_count} findings",
            },
            {
                "name": "Secret Detection",
                "status": "completed",
                "timing": "pass",
                "detail": "values redacted from evidence",
            },
            {
                "name": "Model Enrichment",
                "status": "completed"
                if job.model_enrichment == "completed"
                else (
                    "skipped" if job.model_enrichment in ("not_requested", "not_configured", "refused") else "warning"
                ),
                "timing": job.model_enrichment,
                "detail": "" if job.model_enrichment == "completed" else "see scan logs",
            },
        ],
        trace_lines=[
            f"[INIT] scan {job.id} ({job.scan_type})",
            f"[PARSE] {len(files)} files from revision {revision.digest[:12]}",
            f"[FINDINGS] {job.findings_count} persisted ({job.critical_count} critical / {job.high_count} high)",
            f"[MODEL] enrichment={job.model_enrichment}",
            f"[COMPLETE] status=completed duration={duration_ms}ms",
        ],
        artifacts=[{"name": f"scan:{job.id}", "type": "proof"}],
    )
    db.add(aex)

    ws = db.query(Workspace).filter(Workspace.id == job.workspace_id).first()
    if ws is not None:
        db.add(
            Notification(
                user_id=ws.owner_user_id,
                title=f"Scan completed: {project.name}",
                message=f"{job.scan_type} found {job.findings_count} issues "
                f"({job.critical_count} critical, {job.high_count} high).",
                icon="radar",
                link_screen="scan-history",
            )
        )
    db.commit()
    log(db, scan_id, f"[COMPLETE] Scan completed in {duration_ms}ms with {job.findings_count} findings.")


def mark_stale_jobs_failed(db: Session) -> int:
    """On boot: any job left queued/running by a previous process is honestly marked failed."""
    stale = db.query(ScanJob).filter(ScanJob.status.in_(("queued", "running"))).all()
    for job in stale:
        job.status = "failed"
        job.error_code = "interrupted_by_restart"
        job.error_message = "The API process restarted before this scan finished. Re-run the scan."
        job.finished_at = datetime.now(UTC)
        db.add(
            ScanLog(
                scan_id=job.id,
                ts=utcnow(),
                level="ERROR",
                message="[FAIL] Job interrupted by API restart; marked failed.",
            )
        )
    if stale:
        db.commit()
    return len(stale)


# ---------------------------------------------------------------------------
# Patch synthesis (model-backed; honest error when not configured)


def synthesize_patch_for_finding(db: Session, finding: Finding) -> dict:
    """Returns patch dict (unpersisted) or raises NvidiaNotConfigured / NvidiaRequestError."""
    revision = db.get(SourceRevision, finding.revision_id)
    src = (
        db.query(SourceFile)
        .filter(SourceFile.revision_id == finding.revision_id, SourceFile.path == finding.file_path)
        .first()
    )
    if src is None or not src.content:
        raise ai_provider.AiRequestError("source_unavailable", "Original source file is not available for patching.")
    lines = src.content.split("\n")
    lo = max(0, finding.line_start - 8)
    hi = min(len(lines), finding.line_end + 8)
    context = "\n".join(lines[lo:hi])
    secret_hits = secret_engine.scan_text(src.path, context)
    context = secret_engine.redact_secrets(context, secret_hits)

    finding_dict = {
        "title": finding.title,
        "cwe": finding.cwe,
        "severity": finding.severity,
        "file_path": finding.file_path,
        "line_start": finding.line_start,
        "line_end": finding.line_end,
        "description": finding.description,
        "remediation": finding.taint_steps[0].get("description") if finding.taint_steps else "",
    }
    patch_data, prov = ai_provider.synthesize_patch(finding_dict, context, revision.digest if revision else "")
    return {"data": patch_data, "provenance": prov, "context_bounds": (lo, hi), "source_lines": lines[lo:hi]}
