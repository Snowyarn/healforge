"""Auth routes: session bootstrap (single-user dev mode), login/register (multi-user), logout."""

from __future__ import annotations

import re

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from ...config import settings
from ...models import UserAccount, UserProfile, Workspace
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
    password: str = Field(min_length=10, max_length=200)


def _session_payload(db, ctx: AuthContext) -> dict:
    return {
        "user": {
            "id": ctx.user.id,
            "username": ctx.user.username,
            "email": ctx.user.email,
            "displayName": (ctx.profile.display_name if ctx.profile else None) or ctx.user.username,
            "avatarInitials": (ctx.profile.avatar_initials if ctx.profile else None) or ctx.user.username[:2].upper(),
            "role": ctx.user.role,
        },
        "workspace": {"id": ctx.workspace.id, "name": ctx.workspace.name},
        "workspaces": user_workspaces(db, ctx.user),
        "mode": "single-user" if settings.healforge_single_user else "multi-user",
    }


@router.get("/session")
def session_info(db: DbDep, request: Request, response: Response) -> dict:
    ctx = get_auth(db, request)
    if ctx is not None:
        return _session_payload(db, ctx)
    if not settings.healforge_single_user:
        raise api_error(401, "no_session", "Sign in to continue.")
    user = ensure_default_user(db)
    create_session(db, response, user, request)
    ws = db.query(Workspace).filter(Workspace.owner_user_id == user.id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    audit(
        db,
        ws.id if ws else "",
        user.id,
        "Auth",
        "Session bootstrapped",
        "Single-user development session provisioned.",
        request.client.host if request.client else "",
    )
    return _session_payload(db, AuthContext(user=user, profile=profile, session=None, workspace=ws))  # type: ignore[arg-type]


@router.post("/login")
def login(body: LoginRequest, db: DbDep, request: Request, response: Response) -> dict:
    rl.rate_limit(f"login:{request.client.host if request.client else 'x'}", 10, 60)
    user = db.query(UserAccount).filter(UserAccount.email == body.email.lower().strip()).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise api_error(401, "invalid_credentials", "Invalid email or password.")
    if user.deactivated_at is not None:
        raise api_error(403, "account_deactivated", "This account is deactivated.")
    create_session(db, response, user, request)
    ws = db.query(Workspace).filter(Workspace.owner_user_id == user.id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    audit(
        db,
        ws.id if ws else "",
        user.id,
        "Auth",
        "Signed in",
        "Password login.",
        request.client.host if request.client else "",
    )
    db.commit()
    return _session_payload(db, AuthContext(user=user, profile=profile, session=None, workspace=ws))  # type: ignore[arg-type]


@router.post("/register")
def register(body: RegisterRequest, db: DbDep, request: Request, response: Response) -> dict:
    rl.rate_limit(f"register:{request.client.host if request.client else 'x'}", 5, 300)
    if not _EMAIL_RE.match(body.email):
        raise api_error(422, "invalid_email", "Enter a valid email address.")
    if not re.fullmatch(r"[a-zA-Z0-9_.-]+", body.username):
        raise api_error(422, "invalid_username", "Username may contain letters, digits, dot, dash, underscore.")
    if db.query(UserAccount).filter(UserAccount.email == body.email.lower().strip()).first():
        raise api_error(409, "email_taken", "An account with this email already exists.")
    if db.query(UserAccount).filter(UserAccount.username == body.username).first():
        raise api_error(409, "username_taken", "This username is taken.")
    user = UserAccount(
        id=new_id("usr"),
        email=body.email.lower().strip(),
        username=body.username,
        password_hash=hash_password(body.password),
        role="owner",
    )
    db.add(user)
    db.flush()
    db.add(
        UserProfile(
            user_id=user.id,
            full_name=body.username,
            display_name=body.username,
            avatar_initials=body.username[:2].upper(),
            email_verified=False,
        )
    )
    ws = Workspace(name=f"{body.username}'s Workspace", owner_user_id=user.id, created_at=utcnow())
    db.add(ws)
    db.flush()
    ensure_owner_membership(db, user, ws)
    db.commit()
    create_session(db, response, user, request)
    ws = db.query(Workspace).filter(Workspace.owner_user_id == user.id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    audit(
        db,
        ws.id if ws else "",
        user.id,
        "Auth",
        "Account created",
        "Registered a new account.",
        request.client.host if request.client else "",
    )
    db.commit()
    return _session_payload(db, AuthContext(user=user, profile=profile, session=None, workspace=ws))  # type: ignore[arg-type]


@router.post("/logout")
def logout(ctx: CtxDep, db: DbDep, request: Request, response: Response) -> dict:
    from ...security.sessions import revoke_session

    if ctx.session is not None:
        revoke_session(db, ctx.session.id)
    response.delete_cookie("healforge_session", path="/")
    audit(db, ctx.workspace.id, ctx.user.id, "Auth", "Signed out", "", request.client.host if request.client else "")
    db.commit()
    return {"ok": True}
