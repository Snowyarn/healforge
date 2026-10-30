"""Auth routes: session bootstrap (Supabase Auth integration), login, logout."""

from __future__ import annotations

import json
import re
import uuid

import httpx
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, text

from ...config import settings
from ...models import Profile, UserAccount, Workspace
from ...models.base import new_id, utcnow
from ...security import rate_limit as rl
from ...security.passwords import hash_password, verify_password
from ...security.sessions import (
    AuthContext,
    _resolve_workspace_and_role,
    create_session,
    ensure_default_user,
    ensure_owner_membership,
    ensure_user_workspace,
    get_auth,
    revoke_session,
    user_workspaces,
)
from ...services.audit import audit
from ..deps import DbDep, api_error

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
    username = (
        getattr(ctx.user, "username", None)
        or (ctx.profile.username if ctx.profile else None)
        or (ctx.user.email.split("@")[0] if ctx.user.email else "user")
    )
    display_name = (
        (ctx.profile.display_name if ctx.profile else None)
        or (ctx.profile.full_name if ctx.profile else None)
        or username
    )
    avatar_initials = (ctx.profile.avatar_initials if ctx.profile else None) or username[:2].upper()
    role = getattr(ctx.user, "role", None) or "Owner"
    return {
        "user": {
            "id": str(ctx.user.id),
            "username": username,
            "email": ctx.user.email,
            "displayName": display_name,
            "avatarInitials": avatar_initials,
            "role": role,
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

    allow_single_user = settings.healforge_single_user and (
        settings.healforge_env != "production" or settings.healforge_allow_single_user_in_production
    )
    if not allow_single_user:
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
    user_id = None

    # 1. Supabase PostgreSQL verification
    if not str(db.bind.url).startswith("sqlite"):
        # 1a. Try GoTrue token endpoint
        token_url = f"{settings.effective_supabase_url}/auth/v1/token?grant_type=password"
        headers = {
            "apikey": settings.supabase_anon_key,
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.post(token_url, json={"email": email_clean, "password": body.password}, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    user_info = data.get("user") or {}
                    if user_info.get("id"):
                        user_id = uuid.UUID(user_info["id"])
                        user = UserAccount(id=user_id, email=email_clean)
        except Exception:  # noqa: BLE001
            user = None

        # 1b. Direct Supabase auth.users verification via pgcrypto crypt()
        # (for seed/direct users or when GoTrue HTTP is down)
        if user is None:
            try:
                user_row = db.execute(
                    text(
                        "SELECT id, email FROM auth.users WHERE lower(email) = :email "
                        "AND encrypted_password = crypt(:password, encrypted_password)"
                    ),
                    {"email": email_clean, "password": body.password},
                ).fetchone()
                if user_row:
                    user_id = user_row.id
                    user = UserAccount(id=user_id, email=user_row.email)
            except Exception:  # noqa: BLE001
                user = None

    # 2. SQLite local fallback for test runs
    if user is None and str(db.bind.url).startswith("sqlite"):
        candidate = db.query(UserAccount).filter(UserAccount.email == email_clean).first()
        if candidate and verify_password(body.password, candidate.password_hash):
            user = candidate
            user_id = user.id

    # 3. Dev single-user fallback
    allow_single_user = settings.healforge_single_user and (
        settings.healforge_env != "production" or settings.healforge_allow_single_user_in_production
    )
    if user is None and allow_single_user and email_clean == settings.healforge_default_user_email.lower():
        user = ensure_default_user(db)
        user_id = user.id

    if user is None:
        raise api_error(401, "invalid_credentials", "Invalid email or password.")
    if user.deactivated_at is not None:
        raise api_error(403, "account_deactivated", "This account is deactivated.")

    # Load profile to get username and display name
    profile = None
    try:
        profile = db.get(Profile, user_id)
    except Exception:  # noqa: BLE001
        db.rollback()
    if profile is None:
        try:
            profile = db.query(Profile).filter(func.lower(Profile.email) == email_clean).first()
        except Exception:  # noqa: BLE001
            db.rollback()

    if profile and profile.username:
        user.username = profile.username
    elif not getattr(user, "username", None):
        user.username = email_clean.split("@")[0]

    # Resolve workspace and role
    ws, role = _resolve_workspace_and_role(db, user_id, request)
    if ws is None:
        ws, role = ensure_user_workspace(db, user_id, user.username)

    user.role = role
    user.profile = profile

    create_session(db, response, user, request)
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
    username_clean = body.username.strip()

    if not _EMAIL_RE.match(email_clean):
        raise api_error(422, "invalid_email", "Enter a valid email address.")
    if len(username_clean) < 3:
        raise api_error(422, "invalid_username", "Username must be at least 3 characters.")
    if not re.fullmatch(r"[a-zA-Z0-9_.-]+", username_clean):
        raise api_error(422, "invalid_username", "Username may contain letters, digits, dot, dash, underscore.")
    if len(body.password) < 8:
        raise api_error(422, "weak_password", "Password must be at least 8 characters long.")

    is_sqlite = str(db.bind.url).startswith("sqlite")

    # 1. SQLite registration (used by local unit tests)
    if is_sqlite:
        existing_email = (
            db.query(UserAccount).filter(UserAccount.email == email_clean).first()
            or db.query(Profile).filter(Profile.email == email_clean).first()
        )
        if existing_email:
            raise api_error(409, "email_taken", "An account with this email already exists.")

        existing_user = (
            db.query(UserAccount).filter(UserAccount.username == username_clean).first()
            or db.query(Profile).filter(Profile.username == username_clean).first()
        )
        if existing_user:
            raise api_error(409, "username_taken", "This username is taken.")

        user_id = new_id("usr")
        user = UserAccount(
            id=user_id,
            email=email_clean,
            username=username_clean,
            password_hash=hash_password(body.password),
            role="owner",
        )
        db.add(user)
        db.flush()

        profile = Profile(
            id=user.id,
            email=email_clean,
            username=username_clean,
            full_name=username_clean,
            display_name=username_clean,
        )
        db.add(profile)
        db.flush()

        ws = Workspace(
            id=new_id("ws"),
            name=f"{username_clean}'s Workspace",
            slug=f"{username_clean}-workspace",
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

    # 2. Supabase PostgreSQL registration
    # Check duplicate email or username in public.profiles and auth.users
    existing_profile = (
        db.query(Profile)
        .filter((func.lower(Profile.email) == email_clean) | (func.lower(Profile.username) == username_clean.lower()))
        .first()
    )
    if existing_profile:
        if existing_profile.email and existing_profile.email.lower() == email_clean:
            raise api_error(409, "email_taken", "An account with this email already exists.")
        raise api_error(409, "username_taken", "This username is taken.")

    user_exists = db.execute(
        text("SELECT id FROM auth.users WHERE lower(email) = :email"),
        {"email": email_clean},
    ).fetchone()
    if user_exists:
        raise api_error(409, "email_taken", "An account with this email already exists.")

    user_id = None
    confirmed = True

    # Register with Supabase GoTrue
    signup_url = f"{settings.effective_supabase_url}/auth/v1/signup"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Content-Type": "application/json",
    }
    signup_data = {
        "email": email_clean,
        "password": body.password,
        "data": {
            "username": username_clean,
            "full_name": username_clean,
            "display_name": username_clean,
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(signup_url, json=signup_data, headers=headers)
            if res.status_code in (200, 201):
                data = res.json()
                user_info = data.get("user") or {}
                if user_info.get("id"):
                    user_id = uuid.UUID(user_info["id"])
                    confirmed = bool(user_info.get("email_confirmed_at"))
            elif res.status_code == 422:
                err_data = res.json()
                msg = err_data.get("msg", "")
                err_code = err_data.get("error_code", "")
                if "already" in msg.lower() or err_code == "user_already_exists":
                    raise api_error(409, "email_taken", "An account with this email already exists.")
                elif "password" in msg.lower() or err_code == "weak_password":
                    raise api_error(422, "weak_password", msg or "Password is too weak.")
                else:
                    raise api_error(422, "invalid_registration", msg or "Registration validation failed.")
            elif res.status_code == 429:
                raise api_error(429, "rate_limit", "Too many signup requests. Please try again later.")
    except api_error:
        raise
    except Exception:  # noqa: BLE001, S110
        # Fallback to direct PostgreSQL insert into auth.users if GoTrue HTTP is unavailable
        pass

    # Direct auth.users insert fallback if GoTrue HTTP did not complete
    if user_id is None:
        user_id = uuid.uuid4()
        user_meta = json.dumps(
            {
                "username": username_clean,
                "full_name": username_clean,
                "display_name": username_clean,
                "avatar_url": "",
            }
        )
        try:
            db.execute(
                text(
                    "INSERT INTO auth.users ("
                    "  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, "
                    "  raw_app_meta_data, raw_user_meta_data, created_at, updated_at"
                    ") VALUES ("
                    "  :id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', "
                    "  :email, crypt(:password, gen_salt('bf')), timezone('utc', now()), "
                    '  \'{"provider": "email", "providers": ["email"]}\'::jsonb, '
                    "  :user_meta::jsonb, timezone('utc', now()), timezone('utc', now())"
                    ")"
                ),
                {
                    "id": user_id,
                    "email": email_clean,
                    "password": body.password,
                    "user_meta": user_meta,
                },
            )
            db.commit()
            confirmed = True
        except Exception as exc:
            db.rollback()
            raise api_error(500, "signup_failed", "Unable to create account. Please try again.") from exc

    # Verify or ensure profile in public.profiles (the trigger handle_new_user() runs on auth.users insert)
    profile = db.get(Profile, user_id)
    if profile is None:
        profile = Profile(
            id=user_id,
            email=email_clean,
            username=username_clean,
            full_name=username_clean,
            display_name=username_clean,
        )
        try:
            db.add(profile)
            db.commit()
            db.refresh(profile)
        except Exception:  # noqa: BLE001
            db.rollback()
            profile = db.get(Profile, user_id)

    # Ensure dedicated workspace and owner membership
    ws, role = ensure_user_workspace(db, user_id, username_clean)

    user_obj = UserAccount(
        id=user_id,
        email=email_clean,
        username=username_clean,
        role=role,
    )
    user_obj.profile = profile

    if not confirmed:
        return {
            "user": {
                "id": str(user_id),
                "username": username_clean,
                "email": email_clean,
                "displayName": username_clean,
                "avatarInitials": username_clean[:2].upper(),
                "role": role,
            },
            "requires_confirmation": True,
            "message": "Account created. Please check your email to confirm your account before signing in.",
            "mode": "multi-user",
        }

    create_session(db, response, user_obj, request)
    audit(
        db,
        ws.id,
        user_obj.id,
        "Auth",
        "Signed up",
        "New account registered via Supabase Auth.",
        request.client.host if request.client else "",
    )
    return _session_payload(db, AuthContext(user=user_obj, profile=profile, session=None, workspace=ws))


@router.post("/logout")
def logout(db: DbDep, request: Request, response: Response) -> dict:
    ctx = get_auth(db, request)
    is_secure = False
    if settings.healforge_env == "production" and request is not None:
        client_host = request.headers.get("host", "") or (request.client.host if request.client else "")
        is_local = "localhost" in client_host or "127.0.0.1" in client_host
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        is_secure = (proto == "https") or (not is_local)

    samesite = settings.cookie_samesite.lower()
    if samesite == "none":
        is_secure = True

    response.delete_cookie(
        "healforge_session",
        path="/",
        httponly=True,
        samesite=samesite,
        secure=is_secure,
    )
    if ctx is not None:
        if ctx.session:
            revoke_session(db, ctx.session.id)
        audit(
            db,
            ctx.workspace.id if ctx.workspace else "",
            ctx.user.id if ctx.user else "",
            "auth",
            "Signed out",
            "",
            request.client.host if request.client else "",
        )
    return {"ok": True}
