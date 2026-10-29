"""Projects, source-revision import (safe ZIP), file tree/content routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, File, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...config import settings
from ...models import Finding, Project, ScanJob
from ...models.base import new_id, utcnow
from ...security import rate_limit as rl
from ...security.rbac import require_permission
from ...services import secret_engine, source_store
from ...services.audit import audit
from ...services.source_store import SourceFile, SourceRevision
from ...services.upload import ExtractionResult, UploadError, extract_archive
from ..deps import CtxDep, DbDep, RequestIdDep, api_error
from ..serializers import (
    file_tree_dto,
    project_dto,
    scan_record_dto,
    short_digest,
    time_ago,
)

router = APIRouter(prefix="/projects", tags=["projects"])

_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._/#@-]{1,80}$")

VALID_PROJECT_PROVIDERS = {"zip-archive", "github", "gitlab", "bitbucket"}


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=2000)
    runtime: str = Field(default="Multi-language", max_length=64)
    primaryBranch: str = Field(default="import", max_length=64)


class ProjectPatch(BaseModel):
    description: str | None = Field(default=None, max_length=2000)
    primaryBranch: str | None = Field(default=None, max_length=64)


def _get_project(db: Session, ctx, project_id: str) -> Project:
    import uuid
    try:
        val = uuid.UUID(str(project_id))
        p = db.get(Project, val)
    except (ValueError, TypeError):
        p = None
    if p is None or p.workspace_id != ctx.workspace.id:
        raise api_error(404, "project_not_found", "Project not found in this workspace.")
    return p


@router.get("")
def list_projects(
    ctx: CtxDep,
    db: DbDep,
    q: str = "",
    includeArchived: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    query = db.query(Project).filter(Project.workspace_id == ctx.workspace.id)
    if not includeArchived:
        query = query.filter(Project.archived_at.is_(None))
    total = query.count()
    projects = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()
    if q:
        needle = q.lower()
        projects = [p for p in projects if needle in p.name.lower() or needle in (p.description or "").lower()]
    return {
        "projects": [project_dto(db, p) for p in projects],
        "pagination": {"limit": limit, "offset": offset, "total": total, "returned": len(projects)},
    }


@router.post("", status_code=201)
def create_project(body: ProjectCreate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "manage_projects")
    rl.rate_limit(f"project:{ctx.user.id}", 30, 3600)
    if not _NAME_RE.match(body.name.strip()):
        raise api_error(422, "invalid_name", "Project name has invalid characters (2-80 chars).")
    name = body.name.strip()
    existing = db.query(Project).filter(Project.workspace_id == ctx.workspace.id, Project.name == name).first()
    if existing is not None:
        raise api_error(409, "duplicate_name", "A project with this name already exists.")
    p = Project(
        id=new_id("proj"),
        workspace_id=ctx.workspace.id,
        name=name,
        description=body.description.strip(),
        runtime=body.runtime.strip() or "Multi-language",
        primary_branch=body.primaryBranch.strip() or "import",
        provider="other",
        created_by=ctx.user.id,
        created_at=utcnow(),
    )
    db.add(p)
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Project created",
        f"Project '{name}' created (ZIP archive import target).",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"project": project_dto(db, p)}


@router.get("/{project_id}")
def project_detail(project_id: str, ctx: CtxDep, db: DbDep) -> dict:
    p = _get_project(db, ctx, project_id)
    dto = project_dto(db, p)
    findings = db.query(Finding).filter(Finding.repository_id == p.id).order_by(Finding.cvss_score.desc()).limit(50).all()
    scans = db.query(ScanJob).filter(ScanJob.repository_id == p.id).order_by(ScanJob.created_at.desc()).limit(50).all()
    revisions = source_store.list_revisions(p.id)
    from ..serializers import finding_dto

    dto.update(
        {
            "findings": [finding_dto(db, f) for f in findings],
            "scans": [scan_record_dto(db, s, with_logs=False) for s in scans],
            "revisions": [
                {
                    "id": r.id,
                    "digest": r.digest,
                    "shortDigest": short_digest(r.digest),
                    "archiveFilename": r.archive_filename,
                    "branchLabel": r.branch_label,
                    "fileCount": r.file_count,
                    "textFileCount": r.text_file_count,
                    "sizeBytes": r.size_bytes,
                    "createdAt": time_ago(r.created_at),
                    "createdAtIso": r.created_at.isoformat() if r.created_at else None,
                }
                for r in revisions
            ],
        }
    )
    return {"project": dto}


@router.patch("/{project_id}")
def patch_project(project_id: str, body: ProjectPatch, ctx: CtxDep, db: DbDep, request: Request) -> dict:
    require_permission(db, ctx, "manage_projects")
    p = _get_project(db, ctx, project_id)
    if body.description is not None:
        p.description = body.description.strip()
    if body.primaryBranch is not None:
        p.primary_branch = body.primaryBranch.strip() or p.primary_branch
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Project updated",
        f"Project '{p.name}' details updated.",
        request.client.host if request.client else "",
    )
    db.commit()
    return {"project": project_dto(db, p)}


@router.delete("/{project_id}")
def archive_project(project_id: str, ctx: CtxDep, db: DbDep, request: Request) -> dict:
    require_permission(db, ctx, "manage_projects")
    p = _get_project(db, ctx, project_id)
    if p.archived_at is not None:
        return {"ok": True, "alreadyArchived": True}
    p.archived_at = utcnow()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Project archived",
        f"Project '{p.name}' archived with its scans/findings retained.",
        request.client.host if request.client else "",
    )
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ sources


@router.post("/{project_id}/sources")
async def upload_source(
    project_id: str,
    ctx: CtxDep,
    db: DbDep,
    request: Request,
    request_id: RequestIdDep,
    file: UploadFile = File(...),
) -> dict:
    require_permission(db, ctx, "manage_projects")
    rl.rate_limit(f"upload:{ctx.user.id}", 20, 3600)
    p = _get_project(db, ctx, project_id)

    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > settings.max_archive_bytes + 4096:
        raise api_error(413, "archive_too_large", f"Archive exceeds {settings.max_archive_bytes} bytes.")

    data = await file.read()
    filename = file.filename or "upload.zip"
    try:
        result: ExtractionResult = extract_archive(data)
    except UploadError as exc:
        raise api_error(422, exc.code, exc.message) from exc
    finally:
        data = b""  # free the buffer

    revision = source_store.save_revision(
        project_id=p.id,
        digest=result.digest,
        archive_filename=filename[:250],
        branch_label=p.default_branch,
        files=result.files,
        user_id=ctx.user.id,
    )
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Source imported",
        f"Imported {filename} into '{p.name}': {result.text_file_count} text files, "
        f"digest {short_digest(result.digest)}. "
        f"{len(result.skipped)} entries skipped by safety policy.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()

    # Immediate pre-scan secret census (informational; not persisted as findings):
    secret_count = 0
    for f in result.files:
        if f.content and secret_engine.scan_text(f.path, f.content):
            secret_count += 1

    return {
        "revision": {
            "id": revision.id,
            "digest": revision.digest,
            "shortDigest": short_digest(revision.digest),
            "archiveFilename": revision.archive_filename,
            "branchLabel": revision.branch_label,
            "fileCount": revision.file_count,
            "textFileCount": revision.text_file_count,
            "sizeBytes": revision.total_text_bytes,
            "createdAt": time_ago(revision.created_at),
            "skipped": result.skipped[:50],
        },
        "filesWithPossibleSecrets": secret_count,
    }


@router.get("/{project_id}/sources")
def list_sources(project_id: str, ctx: CtxDep, db: DbDep) -> dict:
    p = _get_project(db, ctx, project_id)
    revisions = source_store.list_revisions(p.id)
    return {
        "revisions": [
            {
                "id": r.id,
                "digest": r.digest,
                "shortDigest": short_digest(r.digest),
                "archiveFilename": r.archive_filename,
                "branchLabel": r.branch_label,
                "fileCount": r.file_count,
                "textFileCount": r.text_file_count,
                "sizeBytes": r.total_text_bytes,
                "createdAt": time_ago(r.created_at),
            }
            for r in revisions
        ]
    }


@router.get("/{project_id}/files")
def file_tree(project_id: str, ctx: CtxDep, db: DbDep, revision_id: str = "") -> dict:
    p = _get_project(db, ctx, project_id)
    rev = _target_revision(db, p, revision_id)
    files = source_store.get_files(rev.id)
    findings = db.query(Finding).filter(Finding.repository_id == p.id, Finding.status == "open").all()
    return {
        "revisionId": rev.id,
        "revisionDigest": short_digest(rev.digest),
        "tree": file_tree_dto(files, findings),
    }


@router.get("/{project_id}/files/content")
def file_content(project_id: str, ctx: CtxDep, db: DbDep, path: str, revision_id: str = "") -> dict:
    p = _get_project(db, ctx, project_id)
    rev = _target_revision(db, p, revision_id)
    src = source_store.get_file(rev.id, path)
    if src is None:
        raise api_error(404, "file_not_found", "File not found in this revision.")
    if src.is_dir or src.content is None:
        raise api_error(422, "not_a_text_file", "Directory or non-text file.")
    findings = db.query(Finding).filter(Finding.repository_id == p.id, Finding.affected_file == path).all()
    lines = src.content.split("\n")
    line_dtos = [
        {"lineNumber": i + 1, "content": line[:500], "type": "neutral", "highlight": False}
        for i, line in enumerate(lines)
    ]
    for f in findings:
        for n in range(max(1, f.start_line or 1), min(len(lines), f.end_line or (f.start_line or 1)) + 1):
            if 0 < n <= len(line_dtos):
                line_dtos[n - 1]["highlight"] = True
    return {
        "path": src.path,
        "language": src.language,
        "linesCount": src.line_count,
        "codeSnippet": line_dtos,
        "findings": [
            {
                "id": f.display_id,
                "internalId": str(f.id),
                "title": f.title,
                "severity": f.severity,
                "lineStart": f.start_line or 1,
                "lineEnd": f.end_line or (f.start_line or 1),
                "cwe": f.cwe_id or "",
                "cvssScore": f.cvss_score,
                "description": f.description,
            }
            for f in findings
        ],
    }


def _target_revision(db: Session, p: Project, revision_id: str) -> SourceRevision:
    if revision_id:
        rev = source_store.get_revision(revision_id)
        if rev is None or str(rev.project_id) != str(p.id):
            raise api_error(404, "revision_not_found", "Revision not found for this project.")
        return rev
    rev = source_store.get_latest_revision(p.id)
    if rev is None:
        raise api_error(409, "no_source_imported", "Import a source archive before browsing files.")
    return rev
