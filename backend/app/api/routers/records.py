"""Bug reports, reports, audit trail, notifications."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ...models import AuditEvent, BugReport, Notification, Project, Report
from ...models.base import new_id, utcnow
from ...security import rate_limit as rl
from ...security.idempotency import idempotency_begin, idempotency_release, idempotency_store
from ...security.rbac import require_permission
from ...services import reports as report_service
from ...services.audit import audit
from ..deps import CtxDep, DbDep, RequestIdDep, api_error
from ..serializers import audit_event_dto, bug_report_dto, report_dto

router = APIRouter(tags=["records"])

BUG_CATEGORIES = {"Authentication", "Memory Safety", "SQL Injection", "Authorization Bypass", "Logic Flaw", "Other"}
SEVERITIES = {"Critical", "High", "Medium", "Low"}
EVIDENCE_MAX_BYTES = 2 * 1024 * 1024
EVIDENCE_ALLOWED_EXT = {".txt", ".md", ".json", ".log", ".xml", ".yaml", ".yml", ".csv", ".py", ".js", ".ts", ".go"}


class BugReportCreate(BaseModel):
    title: str = Field(min_length=5, max_length=250)
    description: str = Field(min_length=10, max_length=8000)
    category: str
    severity: str
    affectedRepo: str = Field(min_length=2, max_length=128)
    affectedFile: str = Field(min_length=1, max_length=400)
    stepsToReproduce: str = Field(default="", max_length=8000)
    expectedBehavior: str = Field(default="", max_length=4000)
    actualBehavior: str = Field(default="", max_length=4000)
    projectId: str | None = None


class ReportCreate(BaseModel):
    type: str
    format: str = "JSON"
    projectId: str | None = None
    scanId: str | None = None


_in_memory_bug_reports: list[BugReport] = []
_in_memory_notifications: list[Notification] = []


def record_in_memory_notification(note: Notification) -> None:
    _in_memory_notifications.insert(0, note)


@router.get("/bug-reports")
def list_bug_reports(ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        reports = (
            db.query(BugReport)
            .filter(BugReport.workspace_id == ctx.workspace.id)
            .order_by(BugReport.created_at.desc())
            .limit(200)
            .all()
        )
    else:
        reports = [b for b in _in_memory_bug_reports if str(b.workspace_id) == str(ctx.workspace.id)]
    out = []
    for b in reports:
        project = db.get(Project, b.project_id) if b.project_id else None
        out.append(bug_report_dto(b, project.name if project else None))
    return {"reports": out}


@router.post("/bug-reports", status_code=201)
def create_bug_report(
    body: BugReportCreate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep
) -> dict:
    rl.rate_limit(f"bugreport:{ctx.user.id}", 30, 3600)
    if body.category not in BUG_CATEGORIES:
        raise api_error(422, "invalid_category", "Unknown bug category.")
    if body.severity not in SEVERITIES:
        raise api_error(422, "invalid_severity", "Unknown severity.")
    project = None
    if body.projectId:
        project = db.get(Project, body.projectId)
        if project is None or project.workspace_id != ctx.workspace.id:
            raise api_error(404, "project_not_found", "Project not found in this workspace.")
    else:
        project = (
            db.query(Project)
            .filter(Project.workspace_id == ctx.workspace.id, Project.name == body.affectedRepo)
            .first()
        )

    is_sqlite = str(db.bind.url).startswith("sqlite")
    if is_sqlite:
        count = db.query(BugReport).filter(BugReport.workspace_id == ctx.workspace.id).count()
    else:
        count = sum(1 for b in _in_memory_bug_reports if str(b.workspace_id) == str(ctx.workspace.id))
    report = BugReport(
        id=new_id("bug"),
        workspace_id=ctx.workspace.id,
        project_id=project.id if project else None,
        display_id=f"BUG-{400 + count + 1}",
        title=body.title.strip(),
        description=body.description.strip(),
        category=body.category,
        severity=body.severity,
        affected_file=body.affectedFile.strip(),
        steps_to_reproduce=body.stepsToReproduce.strip(),
        expected_behavior=body.expectedBehavior.strip(),
        actual_behavior=body.actualBehavior.strip(),
        status="In Triage",
        submitted_by=f"{ctx.profile.display_name if ctx.profile else ctx.user.username} "
        f"({'Owner' if ctx.user.role == 'owner' else ctx.user.role})",
        created_at=utcnow(),
    )
    if is_sqlite:
        db.add(report)
        db.commit()
    else:
        _in_memory_bug_reports.insert(0, report)
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Bug report submitted",
        f"{report.display_id}: {report.title[:120]}",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    return {"report": bug_report_dto(report, project.name if project else None)}


@router.post("/bug-reports/{report_id}/evidence")
async def attach_evidence(
    report_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep, file: UploadFile = File(...)
) -> dict:
    rl.rate_limit(f"evidence:{ctx.user.id}", 30, 3600)
    if str(db.bind.url).startswith("sqlite"):
        report = db.query(BugReport).filter((BugReport.id == report_id) | (BugReport.display_id == report_id)).first()
    else:
        report = next(
            (
                b
                for b in _in_memory_bug_reports
                if (b.id == report_id or b.display_id == report_id) and str(b.workspace_id) == str(ctx.workspace.id)
            ),
            None,
        )
    if report is None or report.workspace_id != ctx.workspace.id:
        raise api_error(404, "report_not_found", "Bug report not found.")
    name = file.filename or "evidence.txt"
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    if ext not in EVIDENCE_ALLOWED_EXT:
        raise api_error(
            422,
            "evidence_type_rejected",
            f"Evidence must be a text file ({', '.join(sorted(EVIDENCE_ALLOWED_EXT))}). "
            "Executables/archives are not accepted and are never run.",
        )
    data = await file.read()
    if len(data) > EVIDENCE_MAX_BYTES:
        raise api_error(413, "evidence_too_large", "Evidence file exceeds 2 MB.")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise api_error(422, "evidence_not_text", "Evidence must be UTF-8 text.") from exc
    report.evidence_name = name[:250]
    report.evidence_content = text[:EVIDENCE_MAX_BYTES]
    report.evidence_sha256 = hashlib.sha256(data).hexdigest()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Evidence attached",
        f"Attached {name} ({len(data)} bytes) to {report.display_id}. Stored as text; never executed.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True, "evidenceName": report.evidence_name, "sha256": report.evidence_sha256}


# ------------------------------------------------------------------ reports


@router.get("/reports")
def list_reports(ctx: CtxDep, db: DbDep) -> dict:
    reports = (
        db.query(Report)
        .filter(Report.workspace_id == ctx.workspace.id)
        .order_by(Report.created_at.desc())
        .limit(100)
        .all()
    )
    return {"reports": [report_dto(r) for r in reports]}


@router.post("/reports", status_code=201)
def create_report(body: ReportCreate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "submit_reports")
    if body.type not in report_service.REPORT_TYPES:
        raise api_error(
            422, "invalid_report_type", f"Report type must be one of {', '.join(report_service.REPORT_TYPES)}."
        )
    if body.format not in report_service.FORMATS:
        raise api_error(422, "invalid_format", "Format must be PDF, Markdown or JSON.")
    guard = idempotency_begin(db, ctx, "report.create", request.headers.get("idempotency-key"), body.model_dump())
    if guard.replay is not None:
        return guard.replay
    try:
        report = report_service.generate_report(
            db,
            ctx.workspace.id,
            body.type,
            body.format,
            body.projectId,
            body.scanId,
            ctx.profile.display_name if ctx.profile else ctx.user.username,
        )
    except ValueError as exc:
        idempotency_release(db, guard)
        raise api_error(422, str(exc), "Invalid report request.") from exc
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Report generated",
        f"{body.type} ({body.format}) — {report.title[:120]}",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    response = {"report": report_dto(report)}
    idempotency_store(db, guard, 201, response)
    return response


@router.get("/reports/{report_id}/download")
def download_report(report_id: str, ctx: CtxDep, db: DbDep) -> Response:
    report = db.get(Report, report_id)
    if report is None or report.workspace_id != ctx.workspace.id:
        raise api_error(404, "report_not_found", "Report not found.")
    data, media_type, filename = report_service.render_report(report)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ------------------------------------------------------------------ audit + notifications


@router.get("/audit-events")
def list_audit_events(ctx: CtxDep, db: DbDep, category: str = "All", q: str = "") -> dict:
    query = db.query(AuditEvent).filter(AuditEvent.workspace_id == ctx.workspace.id)
    if category and category != "All":
        query = query.filter(AuditEvent.category.ilike(category))
    events = query.order_by(AuditEvent.created_at.desc()).limit(200).all()
    if q:
        needle = q.lower()
        events = [
            e
            for e in events
            if needle in e.action.lower()
            or needle in (e.description or "").lower()
            or needle in (e.user_id or "").lower()
        ]
    return {"events": [audit_event_dto(e) for e in events]}


@router.get("/notifications")
def list_notifications(ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        notes = (
            db.query(Notification)
            .filter(Notification.user_id == ctx.user.id)
            .order_by(Notification.created_at.desc())
            .limit(30)
            .all()
        )
    else:
        notes = [n for n in _in_memory_notifications if str(n.user_id) == str(ctx.user.id)][:30]
    unread = sum(1 for n in notes if n.read_at is None)
    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "icon": n.icon,
                "linkScreen": n.link_screen,
                "read": n.read_at is not None,
                "createdAt": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "unread": unread,
    }


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        note = db.get(Notification, notification_id)
        if note is None or note.user_id != ctx.user.id:
            raise api_error(404, "notification_not_found", "Notification not found.")
        note.read_at = utcnow()
        db.commit()
    else:
        note = next(
            (n for n in _in_memory_notifications if n.id == notification_id and str(n.user_id) == str(ctx.user.id)),
            None,
        )
        if note is None:
            raise api_error(404, "notification_not_found", "Notification not found.")
        note.read_at = utcnow()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        db.query(Notification).filter(Notification.user_id == ctx.user.id, Notification.read_at.is_(None)).update(
            {"read_at": utcnow()}
        )
        db.commit()
    else:
        now = utcnow()
        for n in _in_memory_notifications:
            if str(n.user_id) == str(ctx.user.id) and n.read_at is None:
                n.read_at = now
    return {"ok": True}
