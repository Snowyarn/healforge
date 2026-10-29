"""Supabase Auth & Session integration:
Validates Supabase HS256 JWTs from Bearer headers or HttpOnly cookies,
resolving user profiles and workspace tenant boundaries.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import timedelta

import jwt
from fastapi import Request, Response
from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    AuthSession,
    Profile,
    TeamMember,
    UserAccount,
    UserProfile,
    Workspace,
    WorkspaceMember,
)
from ..models.base import new_id, utcnow

COOKIE_NAME = "healforge_session"


def _is_sqlite(db: Session) -> bool:
    try:
        return str(db.bind.url).startswith("sqlite")
    except Exception:
        return True


def mint_supabase_jwt(user_id: uuid.UUID | str, email: str, role: str = "authenticated") -> str:
    """Mint a standard Supabase-compatible JWT signed with SUPABASE_JWT_SECRET."""
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iss": f"{settings.supabase_url}/auth/v1",
        "iat": now,
        "exp": now + (settings.session_ttl_hours * 3600),
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


def verify_supabase_jwt(token: str) -> dict | None:
    """Verify and decode a Supabase JWT."""
    if not token:
        return None
    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return claims
    except Exception:
        return None


def create_session(db: Session, response: Response, user: UserAccount, request: Request) -> AuthSession:
    """Issue a verified Supabase JWT and set the healforge_session cookie."""
    token = mint_supabase_jwt(user.id, user.email)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite="strict",
        secure=settings.healforge_env == "production",
        path="/",
    )
    sess_id = new_id("ses")
    sess = AuthSession(
        id=sess_id,
        user_id=str(user.id),
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        user_agent=request.headers.get("user-agent", "")[:250] if request else "",
        ip=request.client.host if (request and request.client) else "",
        expires_at=utcnow() + timedelta(hours=settings.session_ttl_hours),
    )
    if _is_sqlite(db):
        try:
            db.add(sess)
            db.commit()
        except Exception:
            db.rollback()
    return sess


def resolve_session(db: Session, request: Request | None) -> AuthSession | None:
    """Extract and verify session from Authorization header or cookie."""
    if request is None:
        return None

    token = None
    # 1. Check Authorization: Bearer <token>
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()

    # 2. Check Cookie
    if not token:
        token = request.cookies.get(COOKIE_NAME)

    if token:
        claims = verify_supabase_jwt(token)
        if claims and "sub" in claims:
            user_id = str(claims["sub"])
            if _is_sqlite(db):
                try:
                    sess = (
                        db.query(AuthSession)
                        .filter(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
                        .first()
                    )
                    if sess is not None:
                        return sess
                except Exception:
                    db.rollback()
            return AuthSession(
                id=user_id,
                user_id=user_id,
                user_agent=request.headers.get("user-agent", "")[:250],
                ip=request.client.host if request.client else "",
            )

    # 3. Single-user local development fallback
    if settings.healforge_single_user:
        default_id = str(settings.healforge_default_user_id)
        if _is_sqlite(db):
            try:
                sess = (
                    db.query(AuthSession)
                    .filter(AuthSession.user_id == default_id, AuthSession.revoked_at.is_(None))
                    .first()
                )
                if sess is not None:
                    return sess
            except Exception:
                db.rollback()
        sess = AuthSession(
            id=new_id("ses"),
            user_id=default_id,
            user_agent="Dev Session",
            ip="127.0.0.1",
        )
        if _is_sqlite(db):
            try:
                db.add(sess)
                db.commit()
                db.refresh(sess)
                return sess
            except Exception:
                db.rollback()
        return sess

    return None


def revoke_session(db: Session, session_id: str) -> bool:
    """Logout / revoke session."""
    if _is_sqlite(db):
        try:
            sess = db.query(AuthSession).filter(AuthSession.id == session_id).first()
            if sess is not None:
                sess.revoked_at = utcnow()
                db.commit()
        except Exception:
            db.rollback()
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

    # Load profile from public.profiles
    profile = None
    try:
        profile = db.get(Profile, sess.user_id)
    except Exception:
        db.rollback()

    if profile is None:
        try:
            # Fallback query by email if default dev user
            profile = db.query(Profile).filter(Profile.email == settings.healforge_default_user_email).first()
        except Exception:
            db.rollback()

    if profile is None:
        if settings.healforge_single_user:
            profile = ensure_default_profile(db)
        else:
            return None

    # Resolve workspace and role
    workspace, role = _resolve_workspace_and_role(db, profile.id, request)

    # Load or create UserAccount
    user = None
    if _is_sqlite(db):
        try:
            user = db.query(UserAccount).filter(UserAccount.id == profile.id).first()
        except Exception:
            db.rollback()
    if user is None:
        user = UserAccount(
            id=profile.id,
            email=profile.email,
            username=profile.username or profile.email.split("@")[0],
            role=role,
        )
        if _is_sqlite(db):
            try:
                db.add(user)
                db.commit()
            except Exception:
                db.rollback()
    else:
        user.role = role
    user.profile = profile

    return AuthContext(user=user, profile=profile, session=sess, workspace=workspace)


def _resolve_workspace_and_role(
    db: Session, user_id: uuid.UUID | str, request: Request | None
) -> tuple[Workspace, str]:
    """Resolve active workspace and user role."""
    user_id_str = str(user_id)
    requested_id_str = (request.headers.get("x-workspace-id") or "").strip() if request is not None else ""
    if requested_id_str:
        ws = None
        try:
            ws = db.query(Workspace).filter(Workspace.id == requested_id_str).first()
        except Exception:
            db.rollback()
        if ws is not None:
            # 1. Owner of requested workspace
            if str(ws.owner_id) == user_id_str:
                return ws, "Owner"
            # 2. Check TeamMember in requested workspace (SQLite only)
            if _is_sqlite(db):
                try:
                    tm = (
                        db.query(TeamMember)
                        .filter(
                            TeamMember.workspace_id == ws.id,
                            TeamMember.user_id == user_id_str,
                            TeamMember.status == "Active",
                            TeamMember.revoked_at.is_(None),
                        )
                        .first()
                    )
                    if tm is not None:
                        return ws, tm.role
                except Exception:
                    db.rollback()
            # 3. Check WorkspaceMember in requested workspace
            try:
                wm = (
                    db.query(WorkspaceMember)
                    .filter(
                        WorkspaceMember.workspace_id == ws.id,
                        WorkspaceMember.user_id == user_id_str,
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
                    return ws, role_map.get(wm.role.lower(), wm.role.capitalize())
            except Exception:
                db.rollback()

    # Default to user's owned workspace
    try:
        ws = db.query(Workspace).filter(Workspace.owner_id == user_id_str).first()
        if ws is not None:
            return ws, "Owner"
    except Exception:
        db.rollback()

    # Next check any active membership (SQLite only for TeamMember)
    if _is_sqlite(db):
        try:
            tm = (
                db.query(TeamMember)
                .filter(
                    TeamMember.user_id == user_id_str,
                    TeamMember.status == "Active",
                    TeamMember.revoked_at.is_(None),
                )
                .order_by(TeamMember.created_at)
                .first()
            )
            if tm is not None:
                ws = db.query(Workspace).filter(Workspace.id == tm.workspace_id).first()
                if ws is not None:
                    return ws, tm.role
        except Exception:
            db.rollback()

    try:
        wm = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.user_id == user_id_str,
                WorkspaceMember.status == "active",
            )
            .order_by(WorkspaceMember.created_at)
            .first()
        )
        if wm is not None:
            ws = db.query(Workspace).filter(Workspace.id == wm.workspace_id).first()
            if ws is not None:
                return ws, wm.role.capitalize()
    except Exception:
        db.rollback()

    # Fallback: get first available workspace or create default
    try:
        ws = db.query(Workspace).first()
        if ws is not None:
            return ws, "Owner"
    except Exception:
        db.rollback()

    # Seed default workspace if database is empty
    ws = Workspace(
        name="HealForge Primary Workspace",
        slug="primary-workspace",
        owner_id=user_id_str,
        tier="enterprise",
    )
    try:
        db.add(ws)
        db.commit()
        db.refresh(ws)
    except Exception:
        db.rollback()
    return ws, "Owner"


def user_workspaces(db: Session, user: UserAccount) -> list[dict]:
    """Workspaces the user can access, formatted for frontend session DTO."""
    result: list[dict] = []
    seen = set()

    # Owned workspaces
    owned = db.query(Workspace).filter(Workspace.owner_id == user.id).all()
    for w in owned:
        seen.add(w.id)
        result.append({"id": str(w.id), "name": w.name, "role": "Owner"})

    # Member workspaces
    memberships = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
        .all()
    )
    for m in memberships:
        if m.workspace_id in seen:
            continue
        ws = db.get(Workspace, m.workspace_id)
        if ws is not None:
            seen.add(ws.id)
            result.append({"id": str(ws.id), "name": ws.name, "role": m.role.capitalize()})

    return result


def ensure_default_profile(db: Session) -> Profile:
    """Ensure a default profile exists for local development."""
    user_id = uuid.UUID(settings.healforge_default_user_id)
    profile = db.get(Profile, user_id)
    if profile is not None:
        return profile

    profile = Profile(
        id=user_id,
        email=settings.healforge_default_user_email,
        full_name="Alex Vance",
        display_name="Alex Vance",
        username="alexvance",
        role_title="Lead Security Architect",
        organization="Acme Corp",
        department="Security Engineering",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def ensure_default_user(db: Session) -> UserAccount:
    """Compatibility helper for single-user dev bootstrapping."""
    profile = ensure_default_profile(db)
    return UserAccount(
        id=profile.id,
        email=profile.email,
        username=profile.username or "alexvance",
        role="owner",
        profile=profile,
    )


def ensure_owner_membership(db: Session, user: UserAccount, workspace: Workspace) -> WorkspaceMember:
    """Ensure the owner has an active WorkspaceMember row and TeamMember row."""
    member = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user.id,
        )
        .first()
    )
    if member is None:
        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
            status="active",
        )
        db.add(member)

    # Also ensure TeamMember row exists for team views (SQLite only)
    if _is_sqlite(db):
        try:
            tm = (
                db.query(TeamMember)
                .filter(
                    TeamMember.workspace_id == workspace.id,
                    TeamMember.user_id == user.id,
                )
                .first()
            )
            if tm is None:
                tm = TeamMember(
                    workspace_id=workspace.id,
                    user_id=user.id,
                    name=user.username,
                    email=user.email,
                    role="Owner",
                    status="Active",
                )
                db.add(tm)
        except Exception:
            db.rollback()

    try:
        db.commit()
        db.refresh(member)
    except Exception:
        db.rollback()
    return member
