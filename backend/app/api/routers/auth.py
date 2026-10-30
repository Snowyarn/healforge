"""Auth routes: session bootstrap (Supabase Auth integration), login, logout."""

from __future__ import annotations

import re

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import text

from ...config import settings
from ...models import Profile, UserAccount, Workspace
from ...models.base import new_id, utcnow
from ...security import rate_limit as rl
from ...security.passwords import hash_password, verify_password
from ...security.sessions import (
    AuthContext,
    create_session,
    ensure_default_user,
    ensure_owner_membership,
    get_auth,
    user_workspaces,
)
from ...services.audit import audit
from ..deps import CtxDep, DbDep, api_error

router = APIRouter(prefix="/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=8, max_length=200)


def _session_payload(db, ctx: AuthContext) -> dict:
    return {
        "user": {
            "id": str(ctx.user.id),
            "username": ctx.user.username,
            "email": ctx.user.email,
            "displayName": (ctx.profile.display_name if ctx.profile else None) or ctx.user.username,
            "avatarInitials": (ctx.profile.avatar_initials if ctx.profile else None) or ctx.user.username[:2].upper(),
            "role": ctx.user.role,
        },
        "workspace": {"id": str(ctx.workspace.id), "name": ctx.workspace.name},
        "workspaces": user_workspaces(db, ctx.user),
        "mode": "single-user" if settings.healforge_single_user else "multi-user",
    }


@router.get("/session")
def session_info(db: DbDep, request: Request, response: Response) -> dict:
    ctx = get_auth(db, request)
    if ctx is not None:
        if not request.cookies.get("healforge_session"):
            create_session(db, response, ctx.user, request)
        return _session_payload(db, ctx)

    if not settings.healforge_single_user:
        raise api_error(401, "no_session", "Sign in to continue.")

    user = ensure_default_user(db)
    create_session(db, response, user, request)
    ctx = get_auth(db, request)
    if ctx is not None:
        audit(
            db,
            ctx.workspace.id,
            ctx.user.id,
            "auth",
            "Session bootstrapped",
            "Single-user development session provisioned.",
            request.client.host if request.client else "",
        )
        return _session_payload(db, ctx)

    raise api_error(401, "no_session", "Could not bootstrap session.")


@router.post("/login")
def login(body: LoginRequest, db: DbDep, request: Request, response: Response) -> dict:
    rl.rate_limit(f"login:{request.client.host if request.client else 'x'}", 10, 60)

    email_clean = body.email.lower().strip()
    user = None

    # 1. Direct Supabase auth.users verification via pgcrypto crypt() on PostgreSQL
    if not str(db.bind.url).startswith("sqlite"):
        try:
            user_row = db.execute(
                text(
                    "SELECT id, email FROM auth.users WHERE lower(email) = :email "
                    "AND encrypted_password = crypt(:password, encrypted_password)"
                ),
                {"email": email_clean, "password": body.password},
            ).fetchone()
            if user_row:
                user = UserAccount(id=user_row.id, email=user_row.email)
        except Exception:
            user = None

    # 2. SQLite local fallback for test runs
    if user is None and str(db.bind.url).startswith("sqlite"):
        candidate = db.query(UserAccount).filter(UserAccount.email == email_clean).first()
        if candidate and verify_password(body.password, candidate.password_hash):
            user = candidate

    # 3. Dev single-user fallback
    if user is None and settings.healforge_single_user:
        if email_clean == settings.healforge_default_user_email.lower():
            user = ensure_default_user(db)

    if user is None:
        raise api_error(401, "invalid_credentials", "Invalid email or password.")
    if user.deactivated_at is not None:
        raise api_error(403, "account_deactivated", "This account is deactivated.")

    create_session(db, response, user, request)
    ws = db.query(Workspace).filter(Workspace.owner_id == user.id).first()
    if ws is None:
        ws = db.query(Workspace).first()
    profile = db.query(Profile).filter(Profile.id == user.id).first()

    audit(
        db,
        ws.id if ws else "",
        user.id,
        "Auth",
        "Signed in",
        "Password authentication.",
        request.client.host if request.client else "",
    )
    return _session_payload(db, AuthContext(user=user, profile=profile, session=None, workspace=ws))


@router.post("/register")
def register(body: RegisterRequest, db: DbDep, request: Request, response: Response) -> dict:
    rl.rate_limit(f"register:{request.client.host if request.client else 'x'}", 5, 300)
    email_clean = body.email.lower().strip()
    if not _EMAIL_RE.match(email_clean):
        raise api_error(422, "invalid_email", "Enter a valid email address.")
    if not re.fullmatch(r"[a-zA-Z0-9_.-]+", body.username):
        raise api_error(422, "invalid_username", "Username may contain letters, digits, dot, dash, underscore.")

    is_sqlite = str(db.bind.url).startswith("sqlite")
    if not is_sqlite:
        raise api_error(
            400,
            "supabase_auth_required",
            "Direct backend registration is disabled when targeting Supabase PostgreSQL. Please authenticate or register via Supabase Auth.",
        )

    if db.query(UserAccount).filter(UserAccount.email == email_clean).first() or db.query(Profile).filter(Profile.email == email_clean).first():
        raise api_error(409, "email_taken", "An account with this email already exists.")
    if db.query(UserAccount).filter(UserAccount.username == body.username).first() or db.query(Profile).filter(Profile.username == body.username).first():
        raise api_error(409, "username_taken", "This username is taken.")

    user_id = new_id("usr")
    user = UserAccount(
        id=user_id,
        email=email_clean,
        username=body.username,
        password_hash=hash_password(body.password),
        role="owner",
    )
    db.add(user)
    db.flush()

    profile = Profile(
        id=user.id,
        email=email_clean,
        username=body.username,
        full_name=body.username,
        display_name=body.username,
    )
    db.add(profile)
    db.flush()

    ws = Workspace(
        id=new_id("ws"),
        name=f"{body.username}'s Workspace",
        slug=f"{body.username}-workspace",
        owner_id=user.id,
        created_at=utcnow(),
    )
    db.add(ws)
    db.flush()

    ensure_owner_membership(db, user, ws)
    db.commit()

    create_session(db, response, user, request)
    audit(
        db,
        ws.id,
        user.id,
        "Auth",
        "Signed up",
        "New account registered.",
        request.client.host if request.client else "",
    )
    return _session_payload(db, AuthContext(user=user, profile=profile, session=None, workspace=ws))


@router.post("/logout")
def logout(ctx: CtxDep, db: DbDep, request: Request, response: Response) -> dict:
    response.delete_cookie("healforge_session", path="/")
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "auth",
        "Signed out",
        "",
        request.client.host if request.client else "",
    )
    return {"ok": True}
