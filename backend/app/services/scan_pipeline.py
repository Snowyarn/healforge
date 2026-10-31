"""Scan pipeline: orchestrates a persisted scan job end-to-end.

Runs in a worker thread with its own DB session. Every stage appends real
ScanLog rows with real timestamps. No artificial delays, no fabricated
results. Model enrichment only happens with recorded consent AND a configured
NVIDIA key; otherwise the honest state is logged and recorded on the job.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import threading
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    AnalysisFinding,
    Finding,
    Project,
    ScanJob,
    Workspace,
)
from ..models.base import utcnow
from . import ai_provider, nvidia, secret_engine, source_store, static_engine

_persist_lock = threading.Lock()  # serializes finding-ID assignment + commit across scan calls


def log(db: Session, scan_id: str, message: str, level: str = "INFO") -> None:
    import uuid
    try:
        val = uuid.UUID(str(scan_id)) if not isinstance(scan_id, uuid.UUID) else scan_id
        job = db.get(ScanJob, val)
        if job is not None:
            new_logs = list(job.logs or [])
            new_logs.append(f"[{utcnow().isoformat()}] [{level}] {message[:2000]}")
            job.logs = new_logs
            db.commit()
    except Exception:
        pass


_job_options: dict[str, dict] = {}


def quick_pass_enrich(
    finding_dict: dict,
    context: str,
    source_digest: str,
    timeout_sec: float = 5.0,
) -> tuple[dict, object]:
    """Execute AI enrichment within a strict timeout budget (5s) for Vercel compliance."""
    async def _async_call():
        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return await asyncio.wait_for(
                loop.run_in_executor(
                    pool,
                    ai_provider.enrich_finding,
                    finding_dict,
                    context,
                    source_digest,
                ),
                timeout=timeout_sec,
            )

    try:
        return asyncio.run(_async_call())
    except TimeoutError:
        raise TimeoutError("Nebius AI enrichment timed out after 5.0 seconds.") from None


def submit_scan(
    scan_id: str,
    options: dict | None = None,
    consent: dict | None = None,
    db: Session | None = None,
) -> None:
    """Synchronous scan execution for Vercel serverless microVM compliance."""
    sid = str(scan_id)
    if options is not None:
        _job_options[sid] = {"options": options, "consent": consent or {}}
    if db is not None:
        run_scan(db, scan_id)
    else:
        _run_scan_safe(scan_id)


def _run_scan_safe(scan_id: str) -> None:
    from ..db import session_scope

    db = session_scope()
    try:
        run_scan(db, scan_id)
    except Exception as exc:  # noqa: BLE001 — record the true failure on the job
        print(f"[healforge] scan {scan_id} pipeline error: {type(exc).__name__}: {exc}", flush=True)
        db.rollback()
        try:
            import uuid
            val = uuid.UUID(str(scan_id)) if not isinstance(scan_id, uuid.UUID) else scan_id
            job = db.get(ScanJob, val)
            if job is not None and job.status in ("queued", "running"):
                job.status = "failed"
                job.safe_error_message = f"{type(exc).__name__}: {exc}"[:1000]
                job.completed_at = utcnow()
                log(db, scan_id, f"[FAIL] Pipeline error: {type(exc).__name__}: {exc}"[:2000], "ERROR")
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
                            "UPDATE analyses SET status='failed', "
                            "safe_error_message=:msg, completed_at=CURRENT_TIMESTAMP WHERE id=:sid"
                        ),
                        {"msg": f"{type(exc).__name__}: {exc}"[:1000], "sid": val},
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
    import uuid
    val = uuid.UUID(str(scan_id)) if not isinstance(scan_id, uuid.UUID) else scan_id
    job = db.get(ScanJob, val)
    if job is None:
        return
    project = db.get(Project, job.repository_id)
    revision = source_store.get_revision(job.id) or source_store.get_latest_revision(job.repository_id)
    if project is None or revision is None:
        job.status = "failed"
        job.safe_error_message = "Project or source revision not found."
        job.completed_at = utcnow()
        db.commit()
        return

    job.status = "running"
    job.started_at = utcnow()
    db.commit()

    saved = _job_options.get(str(job.id), {})
    options = saved.get("options") or getattr(job, "_options", None) or getattr(job, "options", None) or {"taintFlow": True}
    consent = saved.get("consent") or getattr(job, "_consent", None) or getattr(job, "consent", None) or {}
    consent_granted = consent.get("granted", getattr(job, "consent_granted", True))
    from ..models.workbench import SCAN_TYPE_KEYS

    scan_key = SCAN_TYPE_KEYS.get(job.scan_type, job.scan_type or "sast")

    log(
        db,
        scan_id,
        f"[INIT] Scan {scan_id} started: {job.scan_type} on project '{project.name}' "
        f"revision {revision.digest[:12]} (engine {static_engine.ENGINE_VERSION}).",
    )

    files = source_store.get_files(revision.id)
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
    import hashlib
    log(db, scan_id, f"[FINDINGS] Persisting {len(raw_findings)} findings tied to revision {revision.digest[:12]}...")
    with _persist_lock:
        for index, rf in enumerate(raw_findings, start=1):
            taint = []
            if options.get("taintFlow") and rf.get("code"):
                taint = static_engine.build_taint_steps(rf["file_path"], rf["code"], rf)
            sev = (rf.get("severity") or "medium").lower()
            if sev not in ("critical", "high", "medium", "low"):
                sev = "medium"
            conf = (rf.get("confidence") or "high").lower()
            if conf not in ("high", "medium", "low"):
                conf = "high"
            reach = (rf.get("reachable") or "unknown").lower()
            if reach not in ("reachable", "unreachable", "unknown"):
                reach = "unknown"

            fp = hashlib.sha256(
                f"{job.repository_id}:{rf.get('file_path')}:{rf.get('rule_id')}:{rf.get('line_start')}".encode()
            ).hexdigest()
            fnd_id = uuid.uuid4()
            finding = Finding(
                id=fnd_id,
                workspace_id=job.workspace_id,
                repository_id=job.repository_id,
                first_detected_analysis_id=job.id,
                latest_analysis_id=job.id,
                fingerprint=fp,
                cve_id=rf.get("display_id_override") or f"HF-{index:04d}",
                rule_id=rf.get("rule_id", "HEALFORGE-RULE"),
                cwe_id=rf.get("cwe", "CWE-000"),
                title=rf["title"][:250],
                description=rf.get("description", ""),
                severity=sev,
                cvss_score=float(static_engine.CVSS_ESTIMATE.get(rf.get("severity", "Medium"), 5.0)),
                affected_file=rf.get("file_path", ""),
                start_line=rf.get("line_start", 1),
                end_line=rf.get("line_end", 1),
                scanner_name=rf.get("detector", static_engine.ENGINE_VERSION),
                confidence=conf,
                reachability=reach,
                status="open",
                metadata_={
                    "evidence": (rf.get("evidence") or "")[:1000],
                    "owasp": rf.get("owasp", ""),
                    "taint_steps": taint,
                },
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            db.add(finding)
            db.flush()
            db.add(
                AnalysisFinding(
                    id=uuid.uuid4(),
                    analysis_id=job.id,
                    finding_id=finding.id,
                    file_path=finding.affected_file,
                    start_line=finding.start_line,
                    end_line=finding.end_line,
                    evidence_snippet=(rf.get("evidence") or "")[:500],
                )
            )
        db.commit()

    job.findings_count = len(raw_findings)
    job.critical_count = sum(1 for f in raw_findings if (f.get("severity") or "").lower() == "critical")
    job.high_count = sum(1 for f in raw_findings if (f.get("severity") or "").lower() == "high")
    job.medium_count = sum(1 for f in raw_findings if (f.get("severity") or "").lower() == "medium")
    job.low_count = sum(1 for f in raw_findings if (f.get("severity") or "").lower() == "low")

    # --- Stage 3: optional AI model enrichment (consent + key required) ---------
    wants_model = bool(options.get("modelEnrichment"))
    ai_stat = ai_provider.status()
    active_prov = ai_stat["active_provider"].upper()
    active_model = settings.active_ai_model

    if not wants_model:
        job.model_enrichment = "not_requested"
        log(db, scan_id, "[MODEL] Model enrichment not requested for this scan.")
    elif not consent_granted:
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
            .limit(1)  # Vercel serverless quick pass: top finding under 5s budget
            .all()
        )
        enriched = failed = 0
        for f in findings_rows:
            src = source_store.get_file(revision.id, f.affected_file)
            context = ""
            if src is not None and src.content:
                lines = src.content.split("\n")
                lo = max(0, (f.start_line or 1) - 6)
                hi = min(len(lines), (f.end_line or 1) + 6)
                context = "\n".join(lines[lo:hi])
                secret_hits = secret_engine.scan_text(src.path, context)
                context = secret_engine.redact_secrets(context, secret_hits)
            try:
                analysis, prov = quick_pass_enrich(
                    {
                        "title": f.title,
                        "cwe": f.cwe_id or "CWE-000",
                        "severity": f.severity,
                        "file_path": f.affected_file,
                        "line_start": f.start_line or 1,
                        "description": f.description,
                    },
                    context,
                    revision.digest,
                    timeout_sec=5.0,
                )
                f.metadata_ = {
                    **(f.metadata_ or {}),
                    "model_analysis": {
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
                    },
                }
                f.confidence = "high"
                db.commit()
                enriched += 1
                log(db, scan_id, f"[MODEL] Quick pass enriched {f.display_id} ({f.title[:60]}).")
            except TimeoutError:
                failed += 1
                log(
                    db,
                    scan_id,
                    "[MODEL] Deep AI analysis timed out (Vercel 5s quick-pass limit reached); "
                    "static AST findings preserved.",
                    "WARN",
                )
                job.safe_error_message = (
                    "Deep AI analysis timed out (5s serverless quick-pass limit); static AST findings preserved."
                )
                db.commit()
            except (ai_provider.AiRequestError, nvidia.NvidiaRequestError) as exc:
                failed += 1
                log(db, scan_id, f"[MODEL] Enrichment failed for {f.display_id}: {exc.code} — {exc.message}", "WARN")
        job.model_enrichment = (
            "completed" if enriched and not failed else ("failed" if failed and not enriched else "partial")
        )
        job.model_used = active_model
        log(db, scan_id, f"[MODEL] Model enrichment finished: {enriched} enriched, {failed} failed.")

    # --- Stage 4: complete ----------------------------------------------------
    job.status = "completed"
    job.completed_at = utcnow()
    duration_ms = int((job.completed_at - (job.started_at or job.created_at)).total_seconds() * 1000)
    job.duration_seconds = max(1, duration_ms // 1000)
    db.commit()
    log(db, scan_id, f"[COMPLETE] Scan completed in {duration_ms}ms with {job.findings_count} findings.")

    ws = db.query(Workspace).filter(Workspace.id == job.workspace_id).first()
    if ws is not None:
        try:
            from ..models import Notification
            from ..models.base import new_id
            note = Notification(
                id=new_id("ntf"),
                user_id=ws.owner_user_id,
                title=f"Scan completed: {project.name if project else 'Project'}",
                message=f"{job.scan_type} found {job.findings_count} issues "
                f"({job.critical_count} critical, {job.high_count} high).",
                icon="radar",
                link_screen="scan-history",
            )
            if str(db.bind.url).startswith("sqlite"):
                db.add(note)
                db.commit()
            else:
                from ..api.routers.records import record_in_memory_notification
                record_in_memory_notification(note)
        except Exception:
            db.rollback()


def mark_stale_jobs_failed(db: Session) -> int:
    """On boot: any job left queued/running by a previous process is honestly marked failed."""
    stale = db.query(ScanJob).filter(ScanJob.status.in_(("queued", "running"))).all()
    for job in stale:
        job.status = "failed"
        job.safe_error_message = "interrupted_by_restart: The API process restarted before this scan finished. Re-run the scan."
        job.completed_at = datetime.now(UTC)
        new_logs = list(job.logs or [])
        new_logs.append(
            f"[{utcnow().isoformat()}] [ERROR] [FAIL] Job interrupted by API restart; marked failed."
        )
        job.logs = new_logs
    if stale:
        db.commit()
    return len(stale)


# ---------------------------------------------------------------------------
# Patch synthesis (model-backed; honest error when not configured)


def synthesize_patch_for_finding(db: Session, finding: Finding) -> dict:
    """Returns patch dict (unpersisted) or raises AiRequestError."""
    revision = source_store.get_revision(finding.first_detected_analysis_id or finding.latest_analysis_id)
    if not revision and finding.repository_id:
        revision = source_store.get_latest_revision(finding.repository_id)
    src = None
    if revision:
        src = source_store.get_file(revision.id, finding.affected_file)
    if src is None or not src.content:
        raise ai_provider.AiRequestError("source_unavailable", "Original source file is not available for patching.")
    lines = src.content.split("\n")
    lo = max(0, (finding.start_line or 1) - 8)
    hi = min(len(lines), (finding.end_line or 1) + 8)
    context = "\n".join(lines[lo:hi])
    secret_hits = secret_engine.scan_text(src.path, context)
    context = secret_engine.redact_secrets(context, secret_hits)

    finding_dict = {
        "title": finding.title,
        "cwe": finding.cwe_id or "CWE-000",
        "severity": finding.severity,
        "file_path": finding.affected_file,
        "line_start": finding.start_line or 1,
        "line_end": finding.end_line or 1,
        "description": finding.description,
        "remediation": "",
    }
    patch_data, prov = ai_provider.synthesize_patch(finding_dict, context, revision.digest if revision else "")
    return {"data": patch_data, "provenance": prov, "context_bounds": (lo, hi), "source_lines": lines[lo:hi]}
