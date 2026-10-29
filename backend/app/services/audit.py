"""Audit trail + notification helpers."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import AuditEvent, Notification
from ..models.base import new_id, utcnow


def audit(
    db: Session,
    workspace_id: str,
    user_id: str,
    category: str,
    action: str,
    description: str = "",
    ip: str = "",
    status: str = "Success",
    request_id: str = "",
) -> None:
    db.add(
        AuditEvent(
            id=new_id("aud"),
            workspace_id=workspace_id,
            user_id=user_id,
            category=category,
            action=action[:250],
            description=description[:2000],
            ip=(ip or "")[:60],
            status=status,
            request_id=request_id[:60],
            created_at=utcnow(),
        )
    )


def notify(
    db: Session, user_id: str, title: str, message: str, icon: str = "notifications", link_screen: str = ""
) -> None:
    db.add(
        Notification(
            id=new_id("ntf"),
            user_id=user_id,
            title=title[:250],
            message=message[:1000],
            icon=icon,
            link_screen=link_screen,
        )
    )
