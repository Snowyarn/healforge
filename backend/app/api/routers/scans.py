"""Scans (create/list/detail/logs/findings/diff/export) and findings routes."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...models import SCAN_TYPES, Finding, Project, ScanJob, SourceRevision
from ...models.base import new_id, utcnow
from ...security import rate_limit as rl
from ...security.idempotency import (
    idempotency_begin,
    idempotency_release,
    idempotency_store,
)
from ...security.rbac import require_permission
from ...services import scan_pipeline
from ...services.audit import audit, notify
from ..deps import CtxDep, DbDep, RequestIdDep, api_error
from ..serializers import finding_dto, scan_record_dto

router = APIRouter(tags=["scans"])

CONSENT_SCOPES = [
    "source file paths",
    "secret-redacted source snippets around findings",
    "finding metadata (rule, severity, location)",
]


class ScanOptions(BaseModel):
    taintFlow: bool = True
    cveCorrelation: bool = False
    modelEnrichment: bool = False


class ScanConsent(BaseModel):
    granted: bool = False
    redactionAcknowledged: bool = False


class ScanCreate(BaseModel):
    projectId: str
    revisionId: str | None = None
    scanType: str
    options: ScanOptions = Field(default_factory=ScanOptions)
    consent: ScanConsent = Field(default_factory=ScanConsent)


class ScanDiffRequest(BaseModel):
    scanAId: str
    scanBId: str


def _get_project(db: Session, ctx, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if p is None or p.workspace_id != ctx.workspace.id:
        raise api_error(404, "project_not_found", "Project not found in this workspace.")
    return p


def _get_scan(db: Session, ctx, scan_id: str) -> ScanJob:
    job = db.get(ScanJob, scan_id)
    if job is None or job.workspace_id != ctx.workspace.id:
        raise api_error(404, "scan_not_found", "Scan not found in this workspace.")
    return job


@router.post("/scans", status_code=202)
def create_scan(body: ScanCreate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "run_scans")
    rl.rate_limit(f"scan:{ctx.user.id}", 30, 3600)
    p = _get_project(db, ctx, body.projectId)
    if body.scanType not in SCAN_TYPES.values():
        raise api_error(422, "invalid_scan_type", "Unknown scan type.")
    if body.options.modelEnrichment and not body.consent.granted:
        raise api_error(
            400, "consent_required", "Model enrichment sends source code to NVIDIA — explicit consent is required."
        )
    if body.options.modelEnrichment and not body.consent.redactionAcknowledged:
        raise api_error(400, "consent_required", "You must acknowledge the secret-redaction step.")
    if body.revisionId:
        rev = db.get(SourceRevision, body.revisionId)
        if rev is None or rev.project_id != p.id:
            raise api_error(404, "revision_not_found", "Revision not found for this project.")
    else:
        rev = (
            db.query(SourceRevision)
            .filter(SourceRevision.project_id == p.id)
            .order_by(SourceRevision.created_at.desc())
            .first()
        )
        if rev is None:
            raise api_error(409, "no_source_imported", "Import a source archive for this project before scanning.")

    # Persisted idempotency: a retried POST with the same Idempotency-Key returns
    # the original scan instead of starting a duplicate.
    guard = idempotency_begin(db, ctx, "scan.create", request.headers.get("idempotency-key"), body.model_dump())
    if guard.replay is not None:
        return guard.replay

    try:
        job = ScanJob(
            id=new_id("scan"),
            workspace_id=ctx.workspace.id,
            project_id=p.id,
            revision_id=rev.id,
            scan_type=body.scanType,
            trigger="Manual Scan",
            status="queued",
            options={
                "taintFlow": body.options.taintFlow,
                "cveCorrelation": body.options.cveCorrelation,
                "modelEnrichment": body.options.modelEnrichment,
            },
            consent_granted=body.consent.granted,
            consent_granted_at=utcnow() if body.consent.granted else None,
            consent_scopes=CONSENT_SCOPES if body.consent.granted else [],
            model_enrichment="not_requested" if not body.options.modelEnrichment else "pending",
            queued_at=utcnow(),
            request_id=request_id,
        )
        db.add(job)
        audit(
            db,
            ctx.workspace.id,
            ctx.user.id,
            "Security",
            "Scan started",
            f"{body.scanType} on '{p.name}' (revision {rev.digest[:12]}), model enrichment "
            f"{'consented' if body.consent.granted and body.options.modelEnrichment else 'not requested'}.",
            request.client.host if request.client else "",
            "Success",
            request_id,
        )
        db.commit()
    except Exception:
        idempotency_release(db, guard)
        raise
    scan_pipeline.submit_scan(job.id)
    response = {"scanId": job.id, "status": "queued", "poll": f"/api/v1/scans/{job.id}"}
    idempotency_store(db, guard, 202, response)
    return response


@router.post("/scans/{scan_id}/retry", status_code=202)
def retry_scan(scan_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    """Re-queue a FAILED scan (bounded retry for the in-process job backend).

    The job record is reused (no duplicate scans); status returns to queued and
    the pipeline re-runs from the same persisted revision.
    """
    require_permission(db, ctx, "run_scans")
    rl.rate_limit(f"scan-retry:{ctx.user.id}", 20, 3600)
    job = _get_scan(db, ctx, scan_id)
    if job.status != "failed":
        raise api_error(409, "not_retryable", f"Only failed scans can be retried (current status: {job.status}).")
    # Clear partial results from the failed attempt so the re-run cannot duplicate findings.
    db.query(Finding).filter(Finding.scan_id == job.id).delete(synchronize_session=False)
    job.status = "queued"
    job.error_code = None
    job.error_message = None
    job.findings_count = 0
    job.started_at = None
    job.finished_at = None
    job.queued_at = utcnow()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Scan retry requested",
        f"Retrying failed scan {job.id} ({job.scan_type}).",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    scan_pipeline.submit_scan(job.id)
    return {"scanId": job.id, "status": "queued", "poll": f"/api/v1/scans/{job.id}"}


@router.get("/scans")
def list_scans(
    ctx: CtxDep,
    db: DbDep,
    projectId: str = "",
    q: str = "",
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    query = db.query(ScanJob).filter(ScanJob.workspace_id == ctx.workspace.id)
    if projectId:
        query = query.filter(ScanJob.project_id == projectId)
    total = query.count()
    scans = query.order_by(ScanJob.queued_at.desc()).offset(offset).limit(limit).all()
    if q:
        needle = q.lower()
        scans = [s for s in scans if needle in s.id.lower() or needle in s.scan_type.lower()]
    return {
        "scans": [scan_record_dto(db, s, with_logs=False) for s in scans],
        "pagination": {"limit": limit, "offset": offset, "total": total, "returned": len(scans)},
    }


@router.get("/scans/export")
def export_scans(ctx: CtxDep, db: DbDep) -> dict:
    scans = db.query(ScanJob).filter(ScanJob.workspace_id == ctx.workspace.id).order_by(ScanJob.queued_at.desc()).all()
    manifest = {
        "exportedAt": utcnow().isoformat(),
        "workspace": ctx.workspace.id,
        "scanCount": len(scans),
        "scans": [scan_record_dto(db, s, with_logs=True) for s in scans],
    }
    return manifest


@router.get("/scans/{scan_id}")
def scan_detail(scan_id: str, ctx: CtxDep, db: DbDep) -> dict:
    job = _get_scan(db, ctx, scan_id)
    return {"scan": scan_record_dto(db, job, with_logs=True)}


@router.get("/scans/{scan_id}/logs")
def scan_logs(scan_id: str, ctx: CtxDep, db: DbDep) -> dict:
    job = _get_scan(db, ctx, scan_id)
    return scan_record_dto(db, job, with_logs=True)


@router.get("/scans/{scan_id}/findings")
def scan_findings(scan_id: str, ctx: CtxDep, db: DbDep) -> dict:
    job = _get_scan(db, ctx, scan_id)
    findings = db.query(Finding).filter(Finding.scan_id == job.id).order_by(Finding.cvss_score.desc()).all()
    return {"scanId": job.id, "status": job.status, "findings": [finding_dto(db, f) for f in findings]}


@router.post("/scans/diff")
def scan_diff(body: ScanDiffRequest, ctx: CtxDep, db: DbDep) -> dict:
    a = _get_scan(db, ctx, body.scanAId)
    b = _get_scan(db, ctx, body.scanBId)
    fa = {
        f.rule_id + "|" + f.file_path + "|" + str(f.line_start)
        for f in db.query(Finding).filter(Finding.scan_id == a.id).all()
    }
    fb = {
        f.rule_id + "|" + f.file_path + "|" + str(f.line_start)
        for f in db.query(Finding).filter(Finding.scan_id == b.id).all()
    }
    resolved = fa - fb
    new = fb - fa
    persistent = fa & fb
    return {
        "scanA": {"id": a.id, "status": a.status, "findingsCount": a.findings_count},
        "scanB": {"id": b.id, "status": b.status, "findingsCount": b.findings_count},
        "resolved": len(resolved),
        "new": len(new),
        "persistent": len(persistent),
    }


# ------------------------------------------------------------------ findings


@router.get("/findings")
def list_findings(
    ctx: CtxDep,
    db: DbDep,
    status: str = "open",
    severity: str = "",
    projectId: str = "",
    q: str = "",
    limit: int = Query(default=50, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
) -> dict:
    query = db.query(Finding).filter(Finding.workspace_id == ctx.workspace.id)
    if status and status != "all":
        query = query.filter(Finding.status == status)
    if severity and severity != "all":
        query = query.filter(Finding.severity == severity)
    if projectId:
        query = query.filter(Finding.project_id == projectId)
    total = query.count()
    findings = query.order_by(Finding.cvss_score.desc(), Finding.created_at.desc()).offset(offset).limit(limit).all()
    if q:
        needle = q.lower()
        findings = [
            f
            for f in findings
            if needle in f.title.lower() or needle in f.display_id.lower() or needle in (f.file_path or "").lower()
        ]
    return {
        "findings": [finding_dto(db, f) for f in findings],
        "pagination": {"limit": limit, "offset": offset, "total": total, "returned": len(findings)},
    }


@router.get("/findings/{finding_id}")
def finding_detail(finding_id: str, ctx: CtxDep, db: DbDep) -> dict:
    f = db.query(Finding).filter((Finding.id == finding_id) | (Finding.display_id == finding_id)).first()
    if f is None or f.workspace_id != ctx.workspace.id:
        raise api_error(404, "finding_not_found", "Finding not found in this workspace.")
    return {"finding": finding_dto(db, f, full=True)}


@router.post("/findings/{finding_id}/patch-request", status_code=202)
def request_patch(finding_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "run_scans")
    rl.rate_limit(f"patchreq:{ctx.user.id}", 20, 3600)
    f = db.query(Finding).filter((Finding.id == finding_id) | (Finding.display_id == finding_id)).first()
    if f is None or f.workspace_id != ctx.workspace.id:
        raise api_error(404, "finding_not_found", "Finding not found in this workspace.")
    from ...models import PatchProposal

    existing = db.query(PatchProposal).filter(PatchProposal.finding_id == f.id).first()
    if existing is not None:
        return {"patchId": existing.id, "status": "existing", "patch": None}

    from ...services import ai_provider, nvidia

    ai_stat = ai_provider.status()
    if not ai_stat["configured"]:
        prov_name = ai_stat["active_provider"].upper()
        key_name = f"{prov_name}_API_KEY"
        is_nvidia = ai_stat["active_provider"] == "nvidia" or not ai_stat["nebius"]["configured"]
        err_code = "nvidia_not_configured" if is_nvidia else "nebius_not_configured"
        raise api_error(
            409,
            err_code,
            f"Patch synthesis uses {prov_name} inference ({key_name}), which is not configured in the backend. "
            f"Set {key_name} in backend/.env (never in the browser) and retry.",
        )

    guard = idempotency_begin(db, ctx, "patch.request", request.headers.get("idempotency-key"), {"findingId": f.id})
    if guard.replay is not None:
        return guard.replay

    try:
        result = scan_pipeline.synthesize_patch_for_finding(db, f)
    except (ai_provider.AiRequestError, nvidia.NvidiaRequestError) as exc:
        idempotency_release(db, guard)
        raise api_error(502, exc.code, exc.message) from exc
    except Exception:
        idempotency_release(db, guard)
        raise

    patch_data = result["data"]
    prov = result["provenance"]
    lo, _hi = result["context_bounds"]
    source_lines = result["source_lines"]
    patched_text = str(patch_data.get("patched_code", ""))
    patched_lines = patched_text.split("\n")

    original_code = [
        {
            "lineNumber": lo + i + 1,
            "content": line[:400],
            "type": "neutral",
            "highlight": f.line_start <= lo + i + 1 <= f.line_end,
        }
        for i, line in enumerate(source_lines)
    ]
    patched_code = [
        {"lineNumber": lo + i + 1, "content": line[:400], "type": "neutral"} for i, line in enumerate(patched_lines)
    ]

    diff_lines = ["--- a/" + f.file_path, "+++ b/" + f.file_path]
    for line in source_lines:
        diff_lines.append("- " + line)
    for line in patched_lines:
        diff_lines.append("+ " + line)

    rationale = patch_data.get("rationale") or {}
    patch = PatchProposal(
        id=new_id("pat"),
        workspace_id=ctx.workspace.id,
        finding_id=f.id,
        project_id=f.project_id,
        revision_id=f.revision_id,
        version=1,
        title=str(patch_data.get("title", f"Patch for {f.display_id}"))[:250],
        description=str(patch_data.get("description", ""))[:4000],
        file_path=f.file_path,
        lines_range=f"L{f.line_start}-L{f.line_end}",
        added_count=sum(1 for ln in patched_lines if ln.strip()),
        removed_count=sum(1 for ln in source_lines if ln.strip()),
        diff="\n".join(diff_lines)[:20000],
        original_code=original_code,
        patched_code=patched_code,
        rationale={
            "syntaxConventions": str(rationale.get("syntax_conventions", ""))[:2000],
            "dependencySafety": str(rationale.get("dependency_safety", ""))[:2000],
            "performanceImpact": str(rationale.get("performance_impact", ""))[:2000],
        },
        generator=f"{getattr(prov, 'provider', 'ai')}:{prov.model_id}",
        status="pending_review",
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(patch)
    f.autofix_status = "Ready"
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Patch synthesized",
        f"Model-generated patch for {f.display_id} ({f.file_path}) — pending human review.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    notify(
        db,
        ctx.user.id,
        "Patch ready for review",
        f"Patch for {f.display_id} ({f.title[:80]}) awaits your review.",
        "build",
        "patch-review",
    )
    db.commit()
    response = {"patchId": patch.id, "status": "pending_review", "generator": patch.generator}
    idempotency_store(db, guard, 202, response)
    return response
