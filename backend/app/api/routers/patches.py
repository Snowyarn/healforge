"""Patch review (human decisions only — never auto-apply) and verification runs."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...models import Finding, PatchProposal, ReviewEvent, VerificationRun
from ...models.base import utcnow
from ...security import rate_limit as rl
from ...security.idempotency import idempotency_begin, idempotency_release, idempotency_store
from ...security.rbac import require_permission
from ...services import verification
from ...services.audit import audit, notify
from ..deps import CtxDep, DbDep, RequestIdDep, api_error
from ..serializers import patch_dto, verification_run_dto

router = APIRouter(tags=["patches"])


class ReviewRequest(BaseModel):
    action: str = Field(pattern="^(approve|reject|request_changes)$")
    notes: str = Field(default="", max_length=4000)
    expectedVersion: int = Field(default=1, ge=1)


class VerificationRequest(BaseModel):
    patchId: str
    mode: str = Field(pattern="^(execution|static_reanalysis)$")


def _get_patch(db: Session, ctx, patch_id: str) -> PatchProposal:
    patch = db.get(PatchProposal, patch_id)
    if patch is None or patch.workspace_id != ctx.workspace.id:
        raise api_error(404, "patch_not_found", "Patch not found in this workspace.")
    return patch


@router.get("/patches")
def list_patches(ctx: CtxDep, db: DbDep, findingId: str = "", status: str = "") -> dict:
    query = db.query(PatchProposal).filter(PatchProposal.workspace_id == ctx.workspace.id)
    if findingId:
        query = query.filter(PatchProposal.finding_id == findingId)
    if status:
        query = query.filter(PatchProposal.status == status)
    patches = query.order_by(PatchProposal.created_at.desc()).limit(200).all()
    return {"patches": [patch_dto(db, p) for p in patches]}


@router.get("/patches/{patch_id}")
def patch_detail(patch_id: str, ctx: CtxDep, db: DbDep) -> dict:
    patch = _get_patch(db, ctx, patch_id)
    return {"patch": patch_dto(db, patch)}


@router.post("/patches/{patch_id}/review")
def review_patch(
    patch_id: str, body: ReviewRequest, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep
) -> dict:
    require_permission(db, ctx, "review_patches")
    rl.rate_limit(f"review:{ctx.user.id}", 60, 3600)
    patch = _get_patch(db, ctx, patch_id)
    if patch.status != "pending_review":
        raise api_error(409, "already_reviewed", f"This patch was already reviewed (current status: {patch.status}).")
    if body.expectedVersion != patch.version:
        raise api_error(
            409, "version_conflict", "The patch changed since you loaded it. Reload and review the latest version."
        )

    action_map = {"approve": "approved", "reject": "rejected", "request_changes": "changes_requested"}
    new_status = action_map[body.action]

    db.add(
        ReviewEvent(
            patch_id=patch.id,
            user_id=ctx.user.id,
            action=body.action,
            notes=body.notes.strip(),
            patch_version=patch.version,
            created_at=utcnow(),
        )
    )
    patch.status = new_status
    patch.updated_at = utcnow()

    finding = db.get(Finding, patch.finding_id)
    if finding is not None:
        if new_status == "approved":
            finding.autofix_status = "Applied"
            finding.status = "resolved"
            finding.resolved_at = utcnow()
        elif new_status == "rejected":
            finding.autofix_status = "Pending"
        else:
            finding.autofix_status = "Review Required"

    verb = {"approve": "approved", "reject": "rejected", "request_changes": "requested changes on"}.get(
        body.action, "reviewed"
    )
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        f"Patch {body.action}",
        f"Reviewer {verb} patch {patch.id} for finding {finding.display_id if finding else patch.finding_id}."
        + (f" Notes: {body.notes.strip()[:300]}" if body.notes.strip() else ""),
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    notify(
        db,
        ctx.user.id,
        f"Patch {new_status.replace('_', ' ')}",
        f"Patch {patch.id} is now {new_status.replace('_', ' ')}.",
        "rate_review",
        "patch-review",
    )
    db.commit()
    return {"patch": patch_dto(db, patch)}


# ------------------------------------------------------------------ verification


@router.get("/verification/status")
def verification_status(ctx: CtxDep) -> dict:
    return verification.status()


@router.get("/verification-runs")
def list_verification_runs(ctx: CtxDep, db: DbDep, patchId: str = "") -> dict:
    query = db.query(VerificationRun).filter(VerificationRun.workspace_id == ctx.workspace.id)
    if patchId:
        query = query.filter(VerificationRun.patch_id == patchId)
    runs = query.order_by(VerificationRun.created_at.desc()).limit(100).all()
    return {"runs": [verification_run_dto(db, r) for r in runs]}


@router.post("/verification-runs", status_code=202)
def create_verification_run(
    body: VerificationRequest, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep
) -> dict:
    require_permission(db, ctx, "request_verification")
    rl.rate_limit(f"verify:{ctx.user.id}", 30, 3600)
    patch = _get_patch(db, ctx, body.patchId)
    guard = idempotency_begin(db, ctx, "verification.create", request.headers.get("idempotency-key"), body.model_dump())
    if guard.replay is not None:
        return guard.replay
    try:
        run = verification.create_run(db, patch, ctx.user.id, body.mode)
        audit(
            db,
            ctx.workspace.id,
            ctx.user.id,
            "Security",
            "Verification run created",
            f"Verification ({run.mode}) for patch {patch.id}: {run.status}.",
            request.client.host if request.client else "",
            "Success",
            request_id,
        )
        db.commit()
    except Exception:
        idempotency_release(db, guard)
        raise
    response = {"run": verification_run_dto(db, run)}
    idempotency_store(db, guard, 202, response)
    return response


@router.get("/verification-runs/{run_id}")
def verification_run_detail(run_id: str, ctx: CtxDep, db: DbDep) -> dict:
    run = db.get(VerificationRun, run_id)
    if run is None or run.workspace_id != ctx.workspace.id:
        raise api_error(404, "run_not_found", "Verification run not found.")
    return {"run": verification_run_dto(db, run)}


@router.get("/verification-runs/{run_id}/evidence")
def verification_evidence(run_id: str, ctx: CtxDep, db: DbDep) -> JSONResponse:
    run = db.get(VerificationRun, run_id)
    if run is None or run.workspace_id != ctx.workspace.id:
        raise api_error(404, "run_not_found", "Verification run not found.")
    evidence = verification.build_evidence(db, run)
    return JSONResponse(
        content=evidence,
        headers={"Content-Disposition": f'attachment; filename="healforge-evidence-{run.id}.json"'},
    )
