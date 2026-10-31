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
    except Exception:  # noqa: BLE001
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
    except Exception:  # noqa: BLE001, S110
        pass

    try:
        unverified_header = jwt.get_unverified_header(token)
        if unverified_header.get("alg") == "ES256":
            try:
                from jwt import PyJWKClient

                jwks_url = f"{settings.effective_supabase_url}/auth/v1/.well-known/jwks.json"
                jwks_client = PyJWKClient(jwks_url)
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                return jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["ES256"],
                    options={"verify_aud": False},
                )
            except Exception:  # noqa: BLE001, S110
                pass
    except Exception:  # noqa: BLE001, S110
        pass

    return None


def create_session(db: Session, response: Response, user: UserAccount, request: Request) -> AuthSession:
    """Issue a verified Supabase JWT and set the healforge_session cookie."""
    token = mint_supabase_jwt(user.id, user.email)
    # Secure cookie flag: require HTTPS unless on local developer host
    is_secure = False
    if settings.healforge_env == "production" and request is not None:
        client_host = request.headers.get("host", "") or (request.client.host if request.client else "")
        is_local = "localhost" in client_host or "127.0.0.1" in client_host
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        is_secure = (proto == "https") or (not is_local)

    samesite = settings.cookie_samesite.lower()
    if samesite == "none":
        is_secure = True

    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite=samesite,
        secure=is_secure,
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
        except Exception:  # noqa: BLE001
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
            user_email = claims.get("email", "")
            if _is_sqlite(db):
                try:
                    sess = (
                        db.query(AuthSession)
                        .filter(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
                        .first()
                    )
                    if sess is not None:
                        sess.claims_email = user_email
                        return sess
                except Exception:  # noqa: BLE001
                    db.rollback()
            sess = AuthSession(
                id=user_id,
                user_id=user_id,
                user_agent=request.headers.get("user-agent", "")[:250],
                ip=request.client.host if request.client else "",
            )
            sess.claims_email = user_email
            return sess

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
            except Exception:  # noqa: BLE001
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
            except Exception:  # noqa: BLE001
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
        except Exception:  # noqa: BLE001
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
    except Exception:  # noqa: BLE001
        db.rollback()

    if profile is None:
        user_email = getattr(sess, "claims_email", "") or ""
        if user_email:
            try:
                profile = db.query(Profile).filter(Profile.email == user_email).first()
            except Exception:  # noqa: BLE001
                db.rollback()

    if profile is None:
        user_email = getattr(sess, "claims_email", "")
        if user_email or not settings.healforge_single_user:
            email_val = user_email or f"user-{sess.user_id[:8]}@healforge.local"
            username_val = email_val.split("@")[0].replace(".", "_")
            profile = Profile(
                id=sess.user_id,
                email=email_val,
                username=username_val,
                full_name=username_val.capitalize(),
                display_name=username_val.capitalize(),
            )
            try:
                db.add(profile)
                db.commit()
                db.refresh(profile)
            except Exception:  # noqa: BLE001
                db.rollback()
                profile = db.get(Profile, sess.user_id)

    allow_single_user = settings.healforge_single_user and (
        settings.healforge_env != "production" or settings.healforge_allow_single_user_in_production
    )

    if profile is None and allow_single_user:
        try:
            # Fallback query by email if default dev user
            profile = db.query(Profile).filter(Profile.email == settings.healforge_default_user_email).first()
        except Exception:  # noqa: BLE001
            db.rollback()

    if profile is None:
        if allow_single_user:
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
        except Exception:  # noqa: BLE001
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
            except Exception:  # noqa: BLE001
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
        except Exception:  # noqa: BLE001
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
                except Exception:  # noqa: BLE001
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
            except Exception:  # noqa: BLE001
                db.rollback()

    # Default to user's owned workspace
    try:
        ws = db.query(Workspace).filter(Workspace.owner_id == user_id_str).first()
        if ws is not None:
            return ws, "Owner"
    except Exception:  # noqa: BLE001
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
        except Exception:  # noqa: BLE001
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
    except Exception:  # noqa: BLE001
        db.rollback()

    # If the user has no owned or member workspace, provision their personal workspace
    ws_slug = f"ws-{user_id_str[:8]}"
    ws = Workspace(
        name="Personal Workspace",
        slug=ws_slug,
        owner_id=user_id_str,
        tier="enterprise" if settings.healforge_single_user else "free",
    )
    try:
        db.add(ws)
        db.commit()
        db.refresh(ws)
        ensure_owner_membership(db, UserAccount(id=user_id_str, email="", username="user"), ws)
        return ws, "Owner"
    except Exception:  # noqa: BLE001
        db.rollback()
        # In single-user dev mode fallback to first workspace
        if settings.healforge_single_user:
            ws = db.query(Workspace).first()
            if ws is not None:
                return ws, "Owner"
    # Final fallback if query fails
    ws = db.query(Workspace).filter(Workspace.owner_id == user_id_str).first()
    if ws is not None:
        return ws, "Owner"
    ws = db.query(Workspace).first()
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
    """Ensure a default profile exists for local single-user development."""
    if settings.healforge_env == "production" and not settings.healforge_allow_single_user_in_production:
        raise RuntimeError("Single-user bootstrap is disabled in production mode.")
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
    if settings.healforge_env == "production" and not settings.healforge_allow_single_user_in_production:
        raise RuntimeError("Single-user bootstrap is disabled in production mode.")
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
        except Exception:  # noqa: BLE001
            db.rollback()

    try:
        db.commit()
        db.refresh(member)
    except Exception:  # noqa: BLE001
        db.rollback()
    return member


def ensure_user_workspace(db: Session, user_id: uuid.UUID | str, username: str | None = None) -> tuple[Workspace, str]:
    """Ensure the user owns an active Workspace and has an owner WorkspaceMember row."""
    user_id_str = str(user_id)
    user_uuid = (
        uuid.UUID(user_id_str)
        if isinstance(user_id, str) and len(user_id_str) == 36 and "-" in user_id_str
        else user_id
    )

    # Check for existing owned workspace
    ws = None
    try:
        ws = db.query(Workspace).filter(Workspace.owner_id == user_uuid).first()
    except Exception:  # noqa: BLE001
        db.rollback()

    if ws is None:
        import re

        uname = (username or "user").strip()
        slug_base = re.sub(r"[^a-z0-9-]", "-", uname.lower()).strip("-")
        if len(slug_base) < 3:
            slug_base = f"ws-{str(user_id)[:8]}"
        existing_ws = None
        try:
            existing_ws = db.query(Workspace).filter(Workspace.slug == slug_base).first()
        except Exception:  # noqa: BLE001
            db.rollback()
        ws_slug = f"{slug_base}-{str(user_id)[:6]}" if existing_ws else slug_base

        ws_id = uuid.uuid4() if not _is_sqlite(db) else new_id("ws")
        ws = Workspace(
            id=ws_id,
            name=f"{uname.capitalize()}'s Workspace",
            slug=ws_slug,
            owner_id=user_uuid,
            tier="free",
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        try:
            db.add(ws)
            db.flush()
        except Exception:  # noqa: BLE001
            db.rollback()
            try:
                ws = db.query(Workspace).filter(Workspace.owner_id == user_uuid).first()
            except Exception:  # noqa: BLE001
                db.rollback()

    if ws is not None:
        user_proxy = UserAccount(id=user_uuid, username=username or "user")
        ensure_owner_membership(db, user_proxy, ws)
        return ws, "Owner"

    first_ws = db.query(Workspace).first()
    return first_ws, "Viewer"
