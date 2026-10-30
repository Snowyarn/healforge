"""Role-based access control: server-side permission matrix for workspace roles.

Roles: Owner, Admin, Security Engineer, Developer, Viewer.
The actor's role is ALWAYS derived server-side from team_members (never from a
client-supplied profile.role). Own-account operations (profile, preferences,
sessions, MFA, own API keys) are allowed for every authenticated user and are
not part of this matrix.

Permissions:
  manage_team          invite / change / remove workspace members
  manage_projects      create/edit/archive projects, import source archives
  manage_workspace     webhooks + integrations configuration
  run_scans            trigger scans, request patch synthesis
  review_patches       approve / reject / request-changes on patches
  request_verification create verification runs
  submit_reports       generate reports
  delete_workspace     delete the workspace and its data (account deletion cascade)
  view_data            read projects/scans/findings/patches/reports/audit
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import TeamMember, Workspace
from .sessions import AuthContext

ALL_PERMISSIONS = {
    "manage_team",
    "manage_projects",
    "manage_workspace",
    "run_scans",
    "review_patches",
    "request_verification",
    "submit_reports",
    "delete_workspace",
    "view_data",
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "Owner": set(ALL_PERMISSIONS),
    "Admin": {
        "manage_team",
        "manage_projects",
        "manage_workspace",
        "run_scans",
        "review_patches",
        "request_verification",
        "submit_reports",
        "view_data",
    },
    "Security Engineer": {
        "run_scans",
        "review_patches",
        "request_verification",
        "submit_reports",
        "view_data",
    },
    "Developer": {
        "manage_projects",
        "run_scans",
        "request_verification",
        "view_data",
    },
    "Viewer": {"view_data"},
}

ROLE_ORDER = {"Owner": 0, "Admin": 1, "Security Engineer": 2, "Developer": 3, "Viewer": 4}


class PermissionDenied(Exception):
    def __init__(self, role: str, permission: str):
        self.role = role
        self.permission = permission
        super().__init__(f"Role '{role}' lacks permission '{permission}'.")


def workspace_role(db: Session, workspace_id: str, user_id: str) -> str | None:
    """Resolve the actor's role in this workspace, server-side.

    The workspace owner is an Owner by definition; otherwise the active
    membership row decides. No role is trusted from the client.
    """
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if ws is not None and str(ws.owner_user_id) == str(user_id):
        return "Owner"
    from ..models import WorkspaceMember

    wm = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == "active",
        )
        .first()
    )
    if wm is not None:
        role_map = {
            "owner": "Owner",
            "admin": "Admin",
            "security_lead": "Security Engineer",
            "developer": "Developer",
            "analyst": "Security Engineer",
            "auditor": "Viewer",
            "viewer": "Viewer",
        }
        return role_map.get(wm.role.lower(), wm.role.capitalize())

    if str(db.bind.url).startswith("sqlite"):
        member = (
            db.query(TeamMember)
            .filter(
                TeamMember.workspace_id == workspace_id,
                TeamMember.user_id == user_id,
                TeamMember.status == "Active",
                TeamMember.revoked_at.is_(None),
            )
            .first()
        )
        return member.role if member is not None else None
    return None


def actor_role(db: Session, ctx: AuthContext) -> str:
    """Role of the current actor in their resolved workspace (never client-supplied)."""
    role = workspace_role(db, ctx.workspace.id, ctx.user.id)
    return role if role is not None else "Viewer"


def has_permission(db: Session, ctx: AuthContext, permission: str) -> bool:
    if permission not in ALL_PERMISSIONS:
        raise ValueError(f"Unknown permission: {permission}")
    role = actor_role(db, ctx)
    return permission in ROLE_PERMISSIONS.get(role, set())


def require_permission(db: Session, ctx: AuthContext, permission: str) -> None:
    """Raise PermissionDenied (mapped to 403) when the actor's role lacks permission."""
    if not has_permission(db, ctx, permission):
        raise PermissionDenied(actor_role(db, ctx), permission)


def count_active_owners(db: Session, workspace_id: str) -> int:
    """Active Owner memberships — used for last-owner protection."""
    from ..models import WorkspaceMember

    wm_count = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role.in_(["owner", "Owner"]),
            WorkspaceMember.status == "active",
        )
        .count()
    )
    if wm_count > 0:
        return wm_count
    if str(db.bind.url).startswith("sqlite"):
        return (
            db.query(TeamMember)
            .filter(
                TeamMember.workspace_id == workspace_id,
                TeamMember.role == "Owner",
                TeamMember.status == "Active",
                TeamMember.revoked_at.is_(None),
            )
            .count()
        )
    return 0
