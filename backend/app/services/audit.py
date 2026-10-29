"""Audit trail + notification helpers mapped to Supabase audit_logs."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models import AuditEvent
from ..models.base import utcnow

VALID_CATEGORIES = {
    "auth",
    "profile",
    "security",
    "api",
    "billing",
    "team",
    "privacy",
    "repository",
    "analysis",
    "patch",
    "verification",
}


def audit(
    db: Session,
    workspace_id: str | uuid.UUID | None,
    user_id: str | uuid.UUID | None,
    category: str,
    action: str,
    description: str = "",
    ip: str = "",
    status: str = "success",
    request_id: str = "",
) -> None:
    ws_uuid = None
    if workspace_id:
        try:
            ws_uuid = uuid.UUID(str(workspace_id))
        except Exception:
            ws_uuid = None

    act_uuid = None
    if user_id:
        try:
            act_uuid = uuid.UUID(str(user_id))
        except Exception:
            act_uuid = None

    cat_clean = (category or "security").lower().strip()
    if cat_clean not in VALID_CATEGORIES:
        cat_clean = "security"

    stat_clean = (status or "success").lower().strip()
    if stat_clean not in ("success", "warning", "failed"):
        stat_clean = "success"

    try:
        log_entry = AuditEvent(
            id=uuid.uuid4(),
            workspace_id=ws_uuid,
            actor_id=act_uuid,
            category=cat_clean,
            action=action[:250],
            entity_type="workbench",
            entity_id=request_id or None,
            ip_address=ip or None,
            status=stat_clean,
            metadata_={"description": description, "request_id": request_id},
            created_at=utcnow(),
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()


def notify(
    db: Session,
    user_id: str | uuid.UUID,
    title: str,
    message: str,
    icon: str = "notifications",
    link_screen: str = "",
) -> None:
    try:
        from ..models import Notification
        from ..models.base import new_id

        db.add(
            Notification(
                id=new_id("ntf"),
                user_id=str(user_id) if user_id else "00000000-0000-0000-0000-000000000001",
                title=title[:250],
                message=message[:1000],
                icon=icon,
                link_screen=link_screen,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
