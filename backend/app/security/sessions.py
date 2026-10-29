"""Server-side sessions: 128-bit tokens in HttpOnly SameSite=Strict cookies, hashed at rest."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import Request, Response
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AuthSession, TeamMember, UserAccount, UserProfile, Workspace
from ..models.base import new_id

COOKIE_NAME = "healforge_session"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, response: Response, user: UserAccount, request: Request) -> AuthSession:
    token = secrets.token_urlsafe(32)
    expires = datetime.now().astimezone() + timedelta(hours=settings.session_ttl_hours)
    sess = AuthSession(
        user_id=user.id,
        token_hash=_hash_token(token),
        expires_at=expires,
        user_agent=(request.headers.get("user-agent") or "")[:250],
        ip=(request.client.host if request.client else "")[:60],
        device_label=_device_label(request.headers.get("user-agent") or ""),
    )
    db.add(sess)
    db.commit()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite="strict",
        secure=settings.healforge_env == "production",
        path="/",
    )
    return sess


def _device_label(user_agent: str) -> str:
    ua = user_agent.lower()
    if "mac" in ua:
        return "MacBook • Current Browser Session"
    if "iphone" in ua or "android" in ua:
        return "Mobile Device"
    if "linux" in ua:
        return "Linux Workstation"
    return "Browser Session"


def resolve_session(db: Session, request: Request) -> AuthSession | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    sess = db.query(AuthSession).filter(AuthSession.token_hash == _hash_token(token)).first()
    if sess is None or sess.revoked_at is not None:
        return None
    now = datetime.now().astimezone()
    if sess.expires_at.replace(tzinfo=sess.expires_at.tzinfo or now.tzinfo) < now:
        return None
    return sess


def revoke_session(db: Session, session_id: str) -> bool:
    sess = db.query(AuthSession).filter(AuthSession.id == session_id).first()
    if sess is None or sess.revoked_at is not None:
        return False
    sess.revoked_at = datetime.now().astimezone()
    db.commit()
    return True


class AuthContext:
    """Resolved actor + workspace for the request. Server-derived, never client-supplied."""

    def __init__(self, user: UserAccount, profile: UserProfile, session: AuthSession, workspace: Workspace):
        self.user = user
        self.profile = profile
        self.session = session
        self.workspace = workspace


def get_auth(db: Session, request: Request = None) -> AuthContext | None:
    sess = resolve_session(db, request)
    if sess is None:
        return None
    user = db.query(UserAccount).get(sess.user_id)
    if user is None or user.deactivated_at is not None:
        return None
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    workspace = _resolve_workspace(db, user, request)
    return AuthContext(user=user, profile=profile, session=sess, workspace=workspace)


def _resolve_workspace(db: Session, user: UserAccount, request: Request | None) -> Workspace:
    """Server-side workspace resolution. The client NEVER chooses an arbitrary workspace:
    an explicit X-Workspace-Id header is honored only when the user owns the workspace
    or holds an active membership in it.
    """
    requested = (request.headers.get("x-workspace-id") or "").strip() if request is not None else ""
    if requested:
        ws = db.query(Workspace).filter(Workspace.id == requested).first()
        if ws is not None and (ws.owner_user_id == user.id or _is_active_member(db, ws.id, user.id)):
            return ws
        # unknown or unauthorized workspace id -> fall through to default resolution
    own = db.query(Workspace).filter(Workspace.owner_user_id == user.id).first()
    if own is not None:
        ensure_owner_membership(db, user, own)
        return own
    member = (
        db.query(TeamMember)
        .filter(
            TeamMember.user_id == user.id,
            TeamMember.status == "Active",
            TeamMember.revoked_at.is_(None),
        )
        .order_by(TeamMember.created_at)
        .first()
    )
    if member is not None:
        ws = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
        if ws is not None:
            return ws
    return _ensure_workspace(db, user)


def _is_active_member(db: Session, workspace_id: str, user_id: str) -> bool:
    return (
        db.query(TeamMember)
        .filter(
            TeamMember.workspace_id == workspace_id,
            TeamMember.user_id == user_id,
            TeamMember.status == "Active",
            TeamMember.revoked_at.is_(None),
        )
        .first()
        is not None
    )


def user_workspaces(db: Session, user: UserAccount) -> list[dict]:
    """Workspaces the user can access (owned + active memberships), for /auth/session."""
    result: list[dict] = []
    for ws in db.query(Workspace).filter(Workspace.owner_user_id == user.id).all():
        ensure_owner_membership(db, user, ws)
        result.append({"id": ws.id, "name": ws.name, "role": "Owner"})
    memberships = (
        db.query(TeamMember)
        .filter(
            TeamMember.user_id == user.id,
            TeamMember.status == "Active",
            TeamMember.revoked_at.is_(None),
        )
        .all()
    )
    for m in memberships:
        ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if ws is not None and ws.owner_user_id != user.id:
            result.append({"id": ws.id, "name": ws.name, "role": m.role})
    return result


def _ensure_workspace(db: Session, user: UserAccount) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.owner_user_id == user.id).first()
    if ws is None:
        ws = Workspace(name=f"{user.username}'s Workspace", owner_user_id=user.id)
        db.add(ws)
        db.commit()
    ensure_owner_membership(db, user, ws)
    return ws


def ensure_owner_membership(db: Session, user: UserAccount, workspace: Workspace) -> TeamMember:
    """The workspace owner always has an Active Owner row in team_members.

    This keeps ownership checks, team listing and last-owner protection on a
    single table. Idempotent; called on workspace creation and session resolution.
    """
    member = (
        db.query(TeamMember)
        .filter(
            TeamMember.workspace_id == workspace.id,
            TeamMember.user_id == user.id,
            TeamMember.role == "Owner",
        )
        .first()
    )
    if member is not None:
        if member.status != "Active" or member.revoked_at is not None:
            member.status = "Active"
            member.revoked_at = None
            db.commit()
        return member
    member = TeamMember(
        id=new_id("mem"),
        workspace_id=workspace.id,
        name=user.username,
        email=user.email,
        role="Owner",
        status="Active",
        invited_by="system",
        user_id=user.id,
        accepted_at=datetime.now().astimezone(),
    )
    db.add(member)
    db.commit()
    return member


def ensure_default_user(db: Session) -> UserAccount:
    """Single-user development mode: provision the default owner exactly once."""
    from ..security.passwords import hash_password

    user = db.query(UserAccount).filter(UserAccount.email == settings.healforge_default_user_email).first()
    if user is not None:
        return user
    user = UserAccount(
        email=settings.healforge_default_user_email,
        username="healforge-dev",
        password_hash=hash_password(secrets.token_urlsafe(24)),  # random password; login not used in single-user mode
        role="owner",
    )
    db.add(user)
    db.flush()
    initials = "HF"
    profile = UserProfile(
        user_id=user.id,
        full_name="HealForge Developer",
        display_name="HealForge Developer",
        avatar_initials=initials,
        bio="Local single-user development workspace.",
        email_verified=True,
    )
    db.add(profile)
    _ensure_workspace(db, user)
    db.commit()
    return user
