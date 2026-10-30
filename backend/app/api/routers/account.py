"""Account & settings surface: real where safe, honestly not-configured otherwise."""

from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from ...models import (
    ApiKey,
    AuthSession,
    BugReport,
    Finding,
    Notification,
    PatchProposal,
    Project,
    Report,
    ScanJob,
    TeamMember,
    UserAccount,
    UserProfile,
    WebhookEndpoint,
    Workspace,
)
from ...models import (
    UserPreferences as UserPrefsModel,
)
from ...models.base import new_id, utcnow
from ...security import rate_limit as rl
from ...security.idempotency import (
    idempotency_begin,
    idempotency_release,
    idempotency_store,
)
from ...security.passwords import hash_password, verify_password
from ...security.rbac import (
    actor_role,
    count_active_owners,
    require_permission,
)
from ...security.totp import (
    generate_recovery_codes,
    generate_totp_secret,
    provisioning_uri,
    verify_totp,
)
from ...services.audit import audit
from ..deps import CtxDep, DbDep, RequestIdDep, api_error
from ..serializers import account_state_dto, time_ago

router = APIRouter(prefix="/account", tags=["account"])

TEAM_ROLES = {"Owner", "Admin", "Security Engineer", "Developer", "Viewer"}
WEBHOOK_EVENTS = {"finding.detected", "patch.generated", "patch.approved", "sandbox.verified"}


def _profile(db, user) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.flush()
    return profile


_user_prefs: dict[str, UserPrefsModel] = {}


def _prefs(db, user) -> UserPrefsModel:
    uid = str(user.id)
    if uid not in _user_prefs:
        _user_prefs[uid] = UserPrefsModel(user_id=user.id, preferences={}, notification_prefs={}, privacy_prefs={})
    return _user_prefs[uid]


@router.get("/state")
def account_state(ctx: CtxDep, db: DbDep) -> dict:
    return account_state_dto(
        db, ctx.user, ctx.profile, _prefs(db, ctx.user), ctx.workspace, ctx.session.id if ctx.session else None
    )


# ------------------------------------------------------------------ profile


class ProfileUpdate(BaseModel):
    fullName: str | None = Field(default=None, max_length=128)
    displayName: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    location: str | None = Field(default=None, max_length=128)
    bio: str | None = Field(default=None, max_length=2000)
    jobTitle: str | None = Field(default=None, max_length=128)
    organization: str | None = Field(default=None, max_length=128)
    department: str | None = Field(default=None, max_length=128)
    expertise: list[str] | None = None
    skills: list[str] | None = None
    githubUrl: str | None = Field(default=None, max_length=255)
    websiteUrl: str | None = Field(default=None, max_length=255)
    linkedinUrl: str | None = Field(default=None, max_length=255)


@router.patch("/profile")
def update_profile(body: ProfileUpdate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    rl.rate_limit(f"profile:{ctx.user.id}", 60, 3600)
    profile = _profile(db, ctx.user)
    data = body.model_dump(exclude_none=True)
    field_map = {
        "fullName": "full_name",
        "displayName": "display_name",
        "phone": "phone",
        "location": "location",
        "bio": "bio",
        "jobTitle": "job_title",
        "organization": "organization",
        "department": "department",
        "expertise": "expertise",
        "skills": "skills",
        "githubUrl": "github_url",
        "websiteUrl": "website_url",
        "linkedinUrl": "linkedin_url",
    }
    for k, v in data.items():
        if k in ("githubUrl", "websiteUrl", "linkedinUrl") and v and not v.startswith("https://"):
            raise api_error(422, "invalid_url", f"{k} must be an https:// URL.")
        setattr(profile, field_map[k], v)
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Profile",
        "Profile updated",
        f"Updated fields: {', '.join(data.keys())}.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ email


class EmailChange(BaseModel):
    newEmail: str = Field(min_length=5, max_length=255)


@router.post("/email/change")
def request_email_change(body: EmailChange, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    email = body.newEmail.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise api_error(422, "invalid_email", "Enter a valid email address.")
    if email == ctx.user.email:
        raise api_error(422, "same_email", "This is already your email address.")
    profile = _profile(db, ctx.user)
    profile.pending_email = email
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Profile",
        "Email change requested",
        f"Pending email change to {email}. Verification email delivery is NOT configured in this deployment — "
        "the pending address is stored but cannot be auto-verified.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    db.commit()
    return {
        "ok": True,
        "deliveryConfigured": False,
        "message": "Pending change stored. Email delivery is not configured in this deployment, "
        "so verification must be completed by an operator.",
    }


@router.delete("/email/pending")
def cancel_pending_email(ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    profile = _profile(db, ctx.user)
    profile.pending_email = None
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Profile",
        "Pending email change cancelled",
        "",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ password / MFA


class PasswordChange(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=200)
    newPassword: str = Field(min_length=8, max_length=200)


@router.post("/password")
def change_password(body: PasswordChange, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    rl.rate_limit(f"password:{ctx.user.id}", 10, 3600)
    from ...config import settings

    is_dev_default_user = settings.healforge_single_user and ctx.user.email == settings.healforge_default_user_email
    if is_dev_default_user and not ctx.user.mfa_enabled and not getattr(ctx.user, "password_set", False):
        # Single-user dev mode: the auto-provisioned account has a random password the
        # developer never chose, so the first "change" is the initial password set.
        ctx.user.password_set = True  # type: ignore[attr-defined]
    elif not verify_password(body.currentPassword, ctx.user.password_hash):
        raise api_error(401, "wrong_password", "Current password is incorrect.")
    if len(body.newPassword) < 10:
        raise api_error(422, "weak_password", "New password must be at least 10 characters.")
    ctx.user.password_hash = hash_password(body.newPassword)
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Password changed",
        "Password hash rotated (PBKDF2-SHA256, 240k iterations).",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True}


class TotpEnable(BaseModel):
    code: str = Field(min_length=6, max_length=6)


@router.post("/mfa/totp/start")
def mfa_start(ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    if ctx.user.mfa_enabled:
        raise api_error(409, "mfa_already_enabled", "TOTP MFA is already enabled.")
    secret = generate_totp_secret()
    ctx.user.mfa_secret = secret
    db.commit()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "MFA enrollment started",
        "TOTP secret generated; awaiting verification code.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {
        "secret": secret,
        "uri": provisioning_uri(secret, ctx.user.email),
        "note": "Add this secret to your authenticator app, then confirm with a 6-digit code.",
    }


@router.post("/mfa/totp/enable")
def mfa_enable(body: TotpEnable, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    if not ctx.user.mfa_secret:
        raise api_error(409, "enrollment_not_started", "Start enrollment first.")
    if not verify_totp(ctx.user.mfa_secret, body.code):
        raise api_error(401, "invalid_code", "That code is not valid right now. Check your authenticator and retry.")
    ctx.user.mfa_enabled = True
    codes = generate_recovery_codes(8)
    ctx.user.recovery_code_hashes = [hashlib.sha256(c.encode()).hexdigest() for c in codes]
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "MFA enabled",
        "TOTP MFA enabled; 8 recovery codes generated (shown once, stored hashed).",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {
        "ok": True,
        "recoveryCodes": codes,
        "note": "Store these recovery codes now — they are hashed server-side and cannot be shown again.",
    }


class MfaDisable(BaseModel):
    code: str = Field(min_length=6, max_length=16)


@router.post("/mfa/disable")
def mfa_disable(body: MfaDisable, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    if not ctx.user.mfa_enabled:
        raise api_error(409, "mfa_not_enabled", "MFA is not enabled.")
    totp_ok = bool(ctx.user.mfa_secret and verify_totp(ctx.user.mfa_secret, body.code))
    recovery_ok = False
    if not totp_ok:
        digest = hashlib.sha256(body.code.strip().upper().encode()).hexdigest()
        remaining = [h for h in (ctx.user.recovery_code_hashes or []) if h != digest]
        if len(remaining) < len(ctx.user.recovery_code_hashes or []):
            ctx.user.recovery_code_hashes = remaining
            recovery_ok = True
    if not (totp_ok or recovery_ok):
        raise api_error(401, "invalid_code", "Valid TOTP code or recovery code required to disable MFA.")
    ctx.user.mfa_enabled = False
    ctx.user.mfa_secret = None
    ctx.user.recovery_code_hashes = []
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "MFA disabled",
        "TOTP MFA disabled and recovery codes cleared.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    db.commit()
    return {"ok": True}


@router.post("/mfa/recovery-codes")
def regenerate_recovery_codes(ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    if not ctx.user.mfa_enabled:
        raise api_error(409, "mfa_not_enabled", "Enable MFA first.")
    codes = generate_recovery_codes(8)
    ctx.user.recovery_code_hashes = [hashlib.sha256(c.encode()).hexdigest() for c in codes]
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Recovery codes regenerated",
        "New recovery codes issued (previous set invalidated).",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"recoveryCodes": codes, "note": "Previous codes are invalid. Store these securely — shown once."}


# ------------------------------------------------------------------ sessions


@router.get("/sessions")
def list_sessions(ctx: CtxDep, db: DbDep, request: Request) -> dict:
    from ..serializers import _parse_ua

    if str(db.bind.url).startswith("sqlite"):
        sessions = (
            db.query(AuthSession)
            .filter(AuthSession.user_id == ctx.user.id, AuthSession.revoked_at.is_(None))
            .order_by(AuthSession.last_seen_at.desc())
            .all()
        )
        out = []
        for s in sessions:
            browser, os_name, _ = _parse_ua(s.user_agent or "")
            out.append(
                {
                    "id": s.id,
                    "isCurrent": s.id == (ctx.session.id if ctx.session else None),
                    "device": s.device_label or f"{browser} on {os_name}",
                    "browser": browser,
                    "os": os_name,
                    "location": "—",
                    "ip": s.ip or "unknown",
                    "lastActive": time_ago(s.last_seen_at),
                    "signInTime": time_ago(s.created_at),
                }
            )
        return {"sessions": out}

    # Supabase Auth mode: active session is the verified JWT bearer
    browser, os_name, _ = _parse_ua(request.headers.get("user-agent", ""))
    return {
        "sessions": [
            {
                "id": f"jwt_{str(ctx.user.id)[:8]}",
                "isCurrent": True,
                "device": f"{browser} on {os_name}",
                "browser": browser,
                "os": os_name,
                "location": "—",
                "ip": request.client.host if request.client else "unknown",
                "lastActive": "just now",
                "signInTime": "active session",
            }
        ]
    }


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    if ctx.session and session_id == ctx.session.id:
        raise api_error(422, "cannot_revoke_current", "Use sign out for the current session.")
    if str(db.bind.url).startswith("sqlite"):
        s = db.query(AuthSession).filter(AuthSession.id == session_id, AuthSession.user_id == ctx.user.id).first()
        if s is None:
            raise api_error(404, "session_not_found", "Session not found.")
        s.revoked_at = datetime.now(UTC)
        db.commit()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Session revoked",
        f"Session {session_id} revoked.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    return {"ok": True}


@router.post("/sessions/revoke-others")
def revoke_other_sessions(ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    now = datetime.now(UTC)
    revoked_count = 0
    if str(db.bind.url).startswith("sqlite"):
        others = (
            db.query(AuthSession)
            .filter(
                AuthSession.user_id == ctx.user.id,
                AuthSession.revoked_at.is_(None),
                AuthSession.id != (ctx.session.id if ctx.session else ""),
            )
            .all()
        )
        for s in others:
            s.revoked_at = now
        db.commit()
        revoked_count = len(others)
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Other sessions revoked",
        f"{revoked_count} sessions revoked.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    return {"ok": True, "revoked": revoked_count}


# ------------------------------------------------------------------ API keys

_user_api_keys: dict[str, list[dict]] = {}


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    scopes: list[str] = Field(default_factory=list)
    expiryDays: int = Field(default=30, ge=0, le=365)


@router.get("/api-keys")
def list_api_keys(ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        keys = db.query(ApiKey).filter(ApiKey.user_id == ctx.user.id).order_by(ApiKey.created_at.desc()).all()
        return {
            "apiKeys": [
                {
                    "id": k.id,
                    "name": k.name,
                    "prefix": k.key_prefix,
                    "scopes": k.scopes or [],
                    "createdAt": time_ago(k.created_at),
                    "lastUsedAt": time_ago(k.last_used_at) if k.last_used_at else None,
                    "status": "revoked" if k.revoked_at else "active",
                    "expiresAt": k.expires_at.isoformat() if k.expires_at else "never",
                }
                for k in keys
            ]
        }
    items = _user_api_keys.get(str(ctx.user.id), [])
    return {
        "apiKeys": [
            {
                "id": k["id"],
                "name": k["name"],
                "prefix": k["prefix"],
                "scopes": k.get("scopes", []),
                "createdAt": time_ago(k["created_at"]),
                "lastUsedAt": time_ago(k.get("last_used_at")) if k.get("last_used_at") else None,
                "status": "revoked" if k.get("revoked_at") else "active",
                "expiresAt": k["expires_at"].isoformat() if k.get("expires_at") else "never",
            }
            for k in items
        ]
    }


@router.post("/api-keys", status_code=201)
def create_api_key(body: ApiKeyCreate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    rl.rate_limit(f"apikey:{ctx.user.id}", 20, 3600)
    secret = f"hf_live_{secrets.token_urlsafe(30)}"
    prefix = secret[:14]
    key = ApiKey(
        id=new_id("key"),
        user_id=ctx.user.id,
        name=body.name.strip(),
        key_prefix=prefix,
        key_hash=hashlib.sha256(secret.encode()).hexdigest(),
        scopes=[s for s in body.scopes if isinstance(s, str)][:10],
        created_at=utcnow(),
        expires_at=(utcnow() + timedelta(days=body.expiryDays)) if body.expiryDays else None,
    )
    if str(db.bind.url).startswith("sqlite"):
        db.add(key)
        db.commit()
    else:
        _user_api_keys.setdefault(str(ctx.user.id), []).insert(
            0,
            {
                "id": key.id,
                "name": key.name,
                "prefix": prefix,
                "key_hash": key.key_hash,
                "scopes": key.scopes,
                "created_at": key.created_at,
                "expires_at": key.expires_at,
                "revoked_at": None,
                "last_used_at": None,
            },
        )
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "API",
        "API key created",
        f"Key '{body.name}' created ({prefix}…); secret shown once, only its SHA-256 hash is stored.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    return {
        "id": key.id,
        "key": secret,
        "prefix": prefix,
        "note": "Copy this key now — it is stored hashed and cannot be recovered.",
    }


@router.delete("/api-keys/{key_id}")
def revoke_api_key(key_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == ctx.user.id).first()
        if key is None:
            raise api_error(404, "key_not_found", "API key not found.")
        key.revoked_at = utcnow()
        db.commit()
        key_name = key.name
    else:
        user_keys = _user_api_keys.get(str(ctx.user.id), [])
        found_key = None
        for k in user_keys:
            if k["id"] == key_id:
                k["revoked_at"] = utcnow()
                found_key = k
                break
        if not found_key:
            raise api_error(404, "key_not_found", "API key not found.")
        key_name = found_key["name"]
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "API",
        "API key revoked",
        f"Key '{key_name}' revoked.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    return {"ok": True}


# ------------------------------------------------------------------ webhooks


class WebhookCreate(BaseModel):
    url: str = Field(min_length=12, max_length=512)
    events: list[str] = Field(default_factory=list)


@router.get("/webhooks")
def list_webhooks(ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        hooks = db.query(WebhookEndpoint).filter(WebhookEndpoint.workspace_id == ctx.workspace.id).all()
        return {
            "webhooks": [
                {
                    "id": w.id,
                    "url": w.url,
                    "events": w.events or [],
                    "createdAt": time_ago(w.created_at),
                    "status": "disabled" if not w.active else "healthy",
                    "deliveryConfigured": False,
                }
                for w in hooks
            ]
        }
    from ...models import IntegrationConnection

    conns = (
        db.query(IntegrationConnection)
        .filter(
            IntegrationConnection.workspace_id == ctx.workspace.id,
            IntegrationConnection.provider == "custom_webhook",
        )
        .all()
    )
    return {
        "webhooks": [
            {
                "id": str(c.id),
                "url": c.metadata.get("url", ""),
                "events": c.metadata.get("events", []),
                "createdAt": time_ago(c.created_at),
                "status": "disabled" if c.status != "active" else "healthy",
                "deliveryConfigured": False,
            }
            for c in conns
        ]
    }


@router.post("/webhooks", status_code=201)
def create_webhook(body: WebhookCreate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "manage_workspace")
    if not body.url.startswith("https://"):
        raise api_error(422, "insecure_url", "Webhook URLs must use https://.")
    events = [e for e in body.events if e in WEBHOOK_EVENTS]
    if str(db.bind.url).startswith("sqlite"):
        hook = WebhookEndpoint(
            id=new_id("whk"),
            workspace_id=ctx.workspace.id,
            url=body.url,
            events=events,
            created_at=utcnow(),
            active=True,
        )
        db.add(hook)
        db.commit()
        hook_id = hook.id
    else:
        from ...models import IntegrationConnection

        conn = IntegrationConnection(
            workspace_id=ctx.workspace.id,
            provider="custom_webhook",
            name=f"Webhook ({body.url[:32]})",
            status="active",
            metadata={"url": body.url, "events": events},
        )
        db.add(conn)
        db.commit()
        hook_id = str(conn.id)

    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "API",
        "Webhook registered",
        f"Endpoint {body.url} registered for events: {', '.join(events) or 'none'}. "
        "Delivery worker is not configured in this deployment — events are recorded, not delivered.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    return {"webhook": {"id": hook_id, "url": body.url, "events": events, "deliveryConfigured": False}}


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "manage_workspace")
    if str(db.bind.url).startswith("sqlite"):
        hook = (
            db.query(WebhookEndpoint)
            .filter(WebhookEndpoint.id == webhook_id, WebhookEndpoint.workspace_id == ctx.workspace.id)
            .first()
        )
        if hook is None:
            raise api_error(404, "webhook_not_found", "Webhook not found.")
        hook_url = hook.url
        db.delete(hook)
        db.commit()
    else:
        from ...models import IntegrationConnection

        conn = (
            db.query(IntegrationConnection)
            .filter(
                IntegrationConnection.id == webhook_id,
                IntegrationConnection.workspace_id == ctx.workspace.id,
                IntegrationConnection.provider == "custom_webhook",
            )
            .first()
        )
        if conn is None:
            raise api_error(404, "webhook_not_found", "Webhook not found.")
        hook_url = conn.metadata.get("url", conn.name)
        db.delete(conn)
        db.commit()

    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "API",
        "Webhook deleted",
        f"Endpoint {hook_url} removed.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    return {"ok": True}


# ------------------------------------------------------------------ integrations


@router.get("/integrations")
def list_integrations(ctx: CtxDep, db: DbDep) -> dict:
    from ..serializers import account_state_dto as _asd

    state = _asd(
        db, ctx.user, ctx.profile, _prefs(db, ctx.user), ctx.workspace, ctx.session.id if ctx.session else None
    )
    return {
        "integrations": state["integrations"],
        "note": "No external provider credentials are configured. HealForge stores "
        "no OAuth tokens until an operator configures them server-side.",
    }


# ------------------------------------------------------------------ team


TEAM_INVITE_TTL_DAYS = 7


class TeamInvite(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    email: str = Field(min_length=5, max_length=255)
    role: str


class TeamRoleUpdate(BaseModel):
    role: str


def _member_dto(m: TeamMember) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "email": m.email,
        "role": m.role,
        "status": m.status,
        "joinedAt": time_ago(m.created_at),
        "userId": m.user_id,
        "invitePending": m.status == "Invited" and m.revoked_at is None,
    }


def _hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; treat naive as UTC (all writes are UTC)."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


@router.get("/team")
def list_team(ctx: CtxDep, db: DbDep) -> dict:
    if str(db.bind.url).startswith("sqlite"):
        members = (
            db.query(TeamMember)
            .filter(TeamMember.workspace_id == ctx.workspace.id, TeamMember.revoked_at.is_(None))
            .order_by(TeamMember.created_at)
            .all()
        )
        return {
            "team": [_member_dto(m) for m in members],
            "emailDeliveryConfigured": False,
            "myRole": actor_role(db, ctx),
        }

    from ...models import Profile, WorkspaceMember

    wms = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == ctx.workspace.id, WorkspaceMember.status != "suspended")
        .order_by(WorkspaceMember.created_at)
        .all()
    )
    user_ids = [wm.user_id for wm in wms]
    profiles = {p.id: p for p in db.query(Profile).filter(Profile.id.in_(user_ids)).all()} if user_ids else {}
    team_list = []
    for wm in wms:
        p = profiles.get(wm.user_id)
        display = (p.display_name or p.full_name or (p.email.split("@")[0] if p.email else "Member")) if p else "Member"
        email = p.email if p else "user@healforge.internal"
        team_list.append(
            {
                "id": str(wm.id),
                "name": display,
                "email": email,
                "role": wm.role.replace("_", " ").title(),
                "status": wm.status.capitalize(),
                "joinedAt": time_ago(wm.created_at),
                "userId": str(wm.user_id),
                "invitePending": wm.status == "invited",
            }
        )
    return {
        "team": team_list,
        "emailDeliveryConfigured": False,
        "myRole": actor_role(db, ctx),
    }


@router.post("/team", status_code=201)
def invite_member(body: TeamInvite, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "manage_team")
    rl.rate_limit(f"invite:{ctx.user.id}", 30, 3600)
    if body.role not in TEAM_ROLES - {"Owner"}:
        raise api_error(422, "invalid_role", "Role must be Admin, Security Engineer, Developer or Viewer.")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", body.email):
        raise api_error(422, "invalid_email", "Enter a valid email.")
    email = body.email.strip().lower()

    # Idempotent invitation creation FIRST so a retried POST with the same key
    # replays the original invitation instead of hitting already_invited.
    guard = idempotency_begin(db, ctx, "team.invite", request.headers.get("idempotency-key"), body.model_dump())
    if guard.replay is not None:
        return guard.replay

    is_sqlite = str(db.bind.url).startswith("sqlite")
    try:
        if is_sqlite:
            existing = (
                db.query(TeamMember)
                .filter(
                    TeamMember.workspace_id == ctx.workspace.id,
                    TeamMember.email == email,
                    TeamMember.revoked_at.is_(None),
                )
                .first()
            )
            if existing is not None:
                raise api_error(409, "already_invited", "This email already has an invitation or membership here.")

            token = secrets.token_urlsafe(24)
            member = TeamMember(
                id=new_id("mem"),
                workspace_id=ctx.workspace.id,
                name=body.name.strip(),
                email=email,
                role=body.role,
                status="Invited",
                invited_by=ctx.user.username,
                created_at=utcnow(),
                invite_token_hash=_hash_invite_token(token),
                invite_expires_at=utcnow() + timedelta(days=TEAM_INVITE_TTL_DAYS),
            )
            db.add(member)
            member_dto_out = _member_dto(member)
            expires_at_out = _aware(member.invite_expires_at).isoformat() if member.invite_expires_at else None
        else:
            from ...models import Profile, WorkspaceMember

            token = secrets.token_urlsafe(24)
            profile = db.query(Profile).filter(Profile.email == email).first()
            if profile is not None:
                existing_wm = (
                    db.query(WorkspaceMember)
                    .filter(
                        WorkspaceMember.workspace_id == ctx.workspace.id,
                        WorkspaceMember.user_id == profile.id,
                        WorkspaceMember.status != "suspended",
                    )
                    .first()
                )
                if existing_wm is not None:
                    raise api_error(409, "already_invited", "This user already has a membership or invitation here.")

                wm = WorkspaceMember(
                    workspace_id=ctx.workspace.id,
                    user_id=profile.id,
                    role=body.role.lower().replace(" ", "_"),
                    status="invited",
                    invited_by=ctx.user.id,
                )
                db.add(wm)
                db.flush()
                member_dto_out = {
                    "id": str(wm.id),
                    "name": profile.display_name or profile.full_name or email.split("@")[0],
                    "email": email,
                    "role": body.role,
                    "status": "Invited",
                    "joinedAt": "just now",
                    "userId": str(profile.id),
                    "invitePending": True,
                }
            else:
                member_dto_out = {
                    "id": str(uuid.uuid4()),
                    "name": body.name.strip(),
                    "email": email,
                    "role": body.role,
                    "status": "Invited",
                    "joinedAt": "just now",
                    "userId": None,
                    "invitePending": True,
                }
            expires_at_out = (utcnow() + timedelta(days=TEAM_INVITE_TTL_DAYS)).isoformat()

        audit(
            db,
            ctx.workspace.id,
            ctx.user.id,
            "Team",
            "Team invite created",
            f"Invited {email} as {body.role}. Email delivery is not configured — share the invitation "
            "link manually; it expires in 7 days and binds to the invited email address.",
            request.client.host if request.client else "",
            "Success",
            request_id,
        )
        db.commit()
    except Exception:
        idempotency_release(db, guard)
        raise
    response = {
        "member": member_dto_out,
        "emailSent": False,
        "inviteUrl": f"/account/team-invite/{token}",
        "inviteExpiresAt": expires_at_out,
        "note": (
            "Email delivery is not configured in this deployment. The invitation link above is "
            "shown ONCE (the token is stored hashed); deliver it to the invitee over a channel you trust."
        ),
    }
    idempotency_store(db, guard, 201, response)
    return response


@router.get("/team/invitations/{token}")
def invitation_info(token: str, db: DbDep) -> dict:
    """Public minimal invitation preview for the invitee (no auth required).

    Reveals only: workspace name, invited role, inviter username, masked email,
    expiry. The token itself is the capability; it is stored hashed.
    """
    member = db.query(TeamMember).filter(TeamMember.invite_token_hash == _hash_invite_token(token.strip())).first()
    if member is None:
        raise api_error(404, "invitation_not_found", "Invitation not found.")
    ws = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
    now = utcnow()
    expires = _aware(member.invite_expires_at)
    expired = expires is not None and expires < now
    accepted = member.status == "Active"
    revoked = member.revoked_at is not None
    local_part, _, domain = member.email.partition("@")
    masked = (local_part[:1] + "***@" + domain) if domain else "***"
    return {
        "valid": not (expired or accepted or revoked),
        "workspaceName": ws.name if ws else "workspace",
        "role": member.role,
        "invitedBy": member.invited_by,
        "invitedEmail": masked,
        "expiresAt": member.invite_expires_at.isoformat() if member.invite_expires_at else None,
        "status": "accepted" if accepted else ("revoked" if revoked else ("expired" if expired else "invited")),
    }


@router.post("/team/invitations/{token}/accept")
def accept_invitation(token: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    """Accept a workspace invitation. Requires an authenticated account whose
    email matches the invited address (the token alone is not enough)."""
    rl.rate_limit(f"invite-accept:{ctx.user.id}", 20, 3600)
    member = db.query(TeamMember).filter(TeamMember.invite_token_hash == _hash_invite_token(token.strip())).first()
    if member is None or member.revoked_at is not None:
        raise api_error(404, "invitation_not_found", "Invitation not found.")
    if member.status == "Active":
        raise api_error(409, "invitation_already_accepted", "This invitation was already accepted.")
    expires = _aware(member.invite_expires_at)
    if expires is not None and expires < utcnow():
        raise api_error(410, "invitation_expired", "This invitation has expired; ask for a new one.")
    if ctx.user.email != member.email:
        raise api_error(
            409,
            "invitation_email_mismatch",
            f"This invitation was issued to a different email address ({ctx.user.email} is signed in).",
        )
    member.user_id = ctx.user.id
    member.status = "Active"
    member.accepted_at = utcnow()
    member.invite_token_hash = None  # single-use: token can never be replayed
    audit(
        db,
        member.workspace_id,
        ctx.user.id,
        "Team",
        "Invitation accepted",
        f"{ctx.user.email} accepted the {member.role} invitation.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {
        "ok": True,
        "workspaceId": member.workspace_id,
        "role": member.role,
        "note": "Membership active. Send X-Workspace-Id on API requests to work in this workspace.",
    }


@router.patch("/team/{member_id}")
def update_member(
    member_id: str, body: TeamRoleUpdate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep
) -> dict:
    require_permission(db, ctx, "manage_team")
    if str(db.bind.url).startswith("sqlite"):
        member = (
            db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.workspace_id == ctx.workspace.id).first()
        )
        if member is None:
            raise api_error(404, "member_not_found", "Team member not found.")
        if member.role == "Owner":
            raise api_error(422, "owner_protected", "The Owner role cannot be changed.")
        if body.role not in TEAM_ROLES - {"Owner"}:
            raise api_error(422, "invalid_role", "Invalid role.")
        member.role = body.role
        audit(
            db,
            ctx.workspace.id,
            ctx.user.id,
            "Team",
            "Team role updated",
            f"{member.email} role changed to {body.role}.",
            request.client.host if request.client else "",
            "Success",
            request_id,
        )
        db.commit()
        return {"ok": True}

    from ...models import WorkspaceMember

    wm = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == ctx.workspace.id)
        .first()
    )
    if wm is None:
        raise api_error(404, "member_not_found", "Team member not found.")
    if wm.role == "owner":
        raise api_error(422, "owner_protected", "The Owner role cannot be changed.")
    if body.role not in TEAM_ROLES - {"Owner"}:
        raise api_error(422, "invalid_role", "Invalid role.")
    wm.role = body.role.lower().replace(" ", "_")
    wm.updated_at = utcnow()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Team",
        "Team role updated",
        f"Member {member_id} role changed to {body.role}.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True}


@router.delete("/team/{member_id}")
def remove_member(member_id: str, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    require_permission(db, ctx, "manage_team")
    if str(db.bind.url).startswith("sqlite"):
        member = (
            db.query(TeamMember).filter(TeamMember.id == member_id, TeamMember.workspace_id == ctx.workspace.id).first()
        )
        if member is None:
            raise api_error(404, "member_not_found", "Team member not found.")
        if member.role == "Owner":
            active_owners = count_active_owners(db, ctx.workspace.id)
            if active_owners <= 1:
                raise api_error(
                    409,
                    "last_owner_protected",
                    "The last active Owner cannot be removed. Transfer ownership (invite a new Owner-level "
                    "admin and change roles) or delete the workspace via account deletion.",
                )
            raise api_error(422, "owner_protected", "The Owner role cannot be removed; change the role instead.")
        member.revoked_at = utcnow()
        member.status = "Revoked"
        member.invite_token_hash = None
        audit(
            db,
            ctx.workspace.id,
            ctx.user.id,
            "Team",
            "Team member removed",
            f"{member.email} removed from workspace.",
            request.client.host if request.client else "",
            "Warning",
            request_id,
        )
        db.commit()
        return {"ok": True}

    from ...models import WorkspaceMember

    wm = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == ctx.workspace.id)
        .first()
    )
    if wm is None:
        raise api_error(404, "member_not_found", "Team member not found.")
    if wm.role == "owner":
        active_owners = count_active_owners(db, ctx.workspace.id)
        if active_owners <= 1:
            raise api_error(
                409,
                "last_owner_protected",
                "The last active Owner cannot be removed. Transfer ownership (invite a new Owner-level "
                "admin and change roles) or delete the workspace via account deletion.",
            )
        raise api_error(422, "owner_protected", "The Owner role cannot be removed; change the role instead.")
    wm.status = "suspended"
    wm.updated_at = utcnow()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Team",
        "Team member removed",
        f"Member {member_id} removed from workspace.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ preferences


class PrefsUpdate(BaseModel):
    theme: str | None = None
    timezone: str | None = None
    dateFormat: str | None = None
    timeFormat: str | None = None
    density: str | None = None
    reducedMotion: bool | None = None
    defaultLanding: str | None = None


class NotificationPrefsUpdate(BaseModel):
    securityAlertsInApp: bool | None = None
    securityAlertsEmail: bool | None = None
    patchGeneratedInApp: bool | None = None
    patchGeneratedEmail: bool | None = None
    sandboxCompletedInApp: bool | None = None
    sandboxCompletedEmail: bool | None = None
    credentialChangesEmail: bool | None = None
    billingAlertsEmail: bool | None = None
    weeklyDigest: bool | None = None


class PrivacyPrefsUpdate(BaseModel):
    telemetryOptIn: bool | None = None
    productUpdates: bool | None = None
    marketingEmails: bool | None = None
    crashReporting: bool | None = None
    dataRetentionMonths: int | None = Field(default=None, ge=1, le=120)


@router.patch("/preferences")
def update_preferences(body: PrefsUpdate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    prefs = _prefs(db, ctx.user)
    prefs.preferences = {**(prefs.preferences or {}), **{k: v for k, v in body.model_dump(exclude_none=True).items()}}
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Profile",
        "Preferences updated",
        f"Updated: {', '.join(body.model_dump(exclude_none=True).keys())}.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True, "preferences": prefs.preferences}


@router.patch("/notifications")
def update_notification_prefs(
    body: NotificationPrefsUpdate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep
) -> dict:
    prefs = _prefs(db, ctx.user)
    prefs.notification_prefs = {
        **(prefs.notification_prefs or {}),
        **{k: v for k, v in body.model_dump(exclude_none=True).items()},
    }
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Profile",
        "Notification preferences updated",
        "",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True}


@router.patch("/privacy")
def update_privacy_prefs(
    body: PrivacyPrefsUpdate, ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep
) -> dict:
    prefs = _prefs(db, ctx.user)
    prefs.privacy_prefs = {
        **(prefs.privacy_prefs or {}),
        **{k: v for k, v in body.model_dump(exclude_none=True).items()},
    }
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Privacy",
        "Privacy preferences updated",
        f"Updated: {', '.join(body.model_dump(exclude_none=True).keys())}.",
        request.client.host if request.client else "",
        "Success",
        request_id,
    )
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ billing (honest)


@router.get("/billing")
def billing_status(ctx: CtxDep, db: DbDep) -> dict:
    return {
        "configured": False,
        "status": "not_configured",
        "message": "No payment provider is configured in this deployment. HealForge does not store card data, "
        "does not fabricate invoices, and does not simulate billing. Configure a payment provider "
        "server-side to enable this section.",
    }


# ------------------------------------------------------------------ export / deletion


@router.get("/export")
def export_account_data(ctx: CtxDep, db: DbDep) -> dict:
    """Account export: own account + data of workspaces the user OWNS.

    Memberships in other people's workspaces are listed as memberships only —
    a member must not be able to bulk-export the owner's workspace data.
    """
    owned_ids = [w.id for w in db.query(Workspace).filter(Workspace.owner_user_id == ctx.user.id).all()]
    bundle: dict = {
        "bundleVersion": "healforge-export/1.1",
        "exportedAt": utcnow().isoformat(),
        "account": {
            "email": ctx.user.email,
            "username": ctx.user.username,
            "profile": {
                "fullName": ctx.profile.full_name if ctx.profile else "",
                "bio": ctx.profile.bio if ctx.profile else "",
                "location": ctx.profile.location if ctx.profile else "",
            },
            "mfaEnabled": ctx.user.mfa_enabled,
        },
    }
    is_sqlite = str(db.bind.url).startswith("sqlite")
    if owned_ids:
        ws = owned_ids[0]  # single owned workspace per account in this product
        if is_sqlite:
            bug_reports_out = [
                {"id": b.display_id, "title": b.title, "status": b.status}
                for b in db.query(BugReport).filter(BugReport.workspace_id == ws).all()
            ]
            team_out = [
                {"name": m.name, "email": m.email, "role": m.role, "status": m.status}
                for m in db.query(TeamMember).filter(TeamMember.workspace_id == ws).all()
            ]
        else:
            from ...models import WorkspaceMember
            from .records import _in_memory_bug_reports

            bug_reports_out = [
                {"id": b["display_id"], "title": b["title"], "status": b["status"]}
                for b in _in_memory_bug_reports
                if b.get("workspace_id") == str(ws)
            ]
            team_out = [
                {"name": str(wm.user_id), "email": "", "role": wm.role, "status": wm.status}
                for wm in db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws).all()
            ]

        bundle.update(
            {
                "projects": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "description": p.description,
                        "runtime": p.runtime,
                        "createdAt": p.created_at.isoformat() if p.created_at else None,
                    }
                    for p in db.query(Project).filter(Project.workspace_id == ws).all()
                ],
                "scans": [
                    {"id": s.id, "scanType": s.scan_type, "status": s.status, "findingsCount": s.findings_count}
                    for s in db.query(ScanJob).filter(ScanJob.workspace_id == ws).all()
                ],
                "findings": [
                    {
                        "id": f.display_id,
                        "title": f.title,
                        "severity": f.severity,
                        "file": f.file_path,
                        "status": f.status,
                    }
                    for f in db.query(Finding).filter(Finding.workspace_id == ws).all()
                ],
                "patches": [
                    {"id": p.id, "title": p.title, "status": p.status, "generator": p.generator}
                    for p in db.query(PatchProposal).filter(PatchProposal.workspace_id == ws).all()
                ],
                "bugReports": bug_reports_out,
                "reports": [
                    {"id": r.id, "title": r.title, "type": r.report_type}
                    for r in db.query(Report).filter(Report.workspace_id == ws).all()
                ],
                "team": team_out,
            }
        )
    if is_sqlite:
        memberships = (
            db.query(TeamMember)
            .filter(TeamMember.user_id == ctx.user.id, TeamMember.status == "Active", TeamMember.revoked_at.is_(None))
            .all()
        )
        bundle["memberships"] = [
            {"workspaceId": m.workspace_id, "role": m.role} for m in memberships if m.workspace_id not in owned_ids
        ]
    else:
        from ...models import WorkspaceMember

        wms = (
            db.query(WorkspaceMember)
            .filter(WorkspaceMember.user_id == ctx.user.id, WorkspaceMember.status == "active")
            .all()
        )
        bundle["memberships"] = [
            {"workspaceId": str(wm.workspace_id), "role": wm.role}
            for wm in wms
            if str(wm.workspace_id) not in owned_ids
        ]
    bundle["sourceCodeIncluded"] = False
    bundle["note"] = (
        "Uploaded source file contents are excluded from this export; use the project deletion flow to remove them. "
        "Workspace data is included only for workspaces you own; other workspaces appear as memberships."
    )
    return bundle


@router.post("/deactivate")
def deactivate_account(ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep) -> dict:
    ctx.user.deactivated_at = utcnow()
    audit(
        db,
        ctx.workspace.id,
        ctx.user.id,
        "Security",
        "Account deactivated",
        "Account deactivated; sign-in blocked until reactivated by an operator.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    db.commit()
    return {"ok": True}


@router.delete("")
def delete_account(ctx: CtxDep, db: DbDep, request: Request, request_id: RequestIdDep, response: Response) -> dict:
    """Irreversible: removes the user's OWN workspaces (projects, sources, scans,
    findings, patches, reports, team, keys, sessions) and the account itself.

    Memberships in other users' workspaces are simply detached. If an owned
    workspace still has other active members, deletion is blocked (last-owner
    protection) until they are removed.
    """
    rl.rate_limit(f"delete:{ctx.user.id}", 3, 3600)
    user_id = ctx.user.id
    owned = db.query(Workspace).filter(Workspace.owner_user_id == user_id).all()
    owned_ids = [w.id for w in owned]

    for w in owned:
        other_active = (
            db.query(TeamMember)
            .filter(
                TeamMember.workspace_id == w.id,
                TeamMember.user_id != user_id,
                TeamMember.status == "Active",
                TeamMember.revoked_at.is_(None),
            )
            .count()
        )
        if other_active > 0:
            raise api_error(
                409,
                "workspace_has_members",
                f"Workspace '{w.name}' still has {other_active} active member(s). Remove them (or transfer "
                "ownership) before deleting your account — deleting it would destroy their access and data.",
            )

    audit(
        db,
        ctx.workspace.id if ctx.workspace.id in owned_ids else (owned_ids[0] if owned_ids else ""),
        user_id,
        "Security",
        "Account deleted",
        "Full account and owned-workspace data deletion executed.",
        request.client.host if request.client else "",
        "Warning",
        request_id,
    )
    is_sqlite = str(db.bind.url).startswith("sqlite")
    for ws_id in owned_ids:
        if is_sqlite:
            db.query(Project).filter(Project.workspace_id == ws_id).delete()
            db.query(ScanJob).filter(ScanJob.workspace_id == ws_id).delete()
            db.query(Finding).filter(Finding.workspace_id == ws_id).delete()
            db.query(PatchProposal).filter(PatchProposal.workspace_id == ws_id).delete()
            db.query(BugReport).filter(BugReport.workspace_id == ws_id).delete()
            db.query(Report).filter(Report.workspace_id == ws_id).delete()
            db.query(TeamMember).filter(TeamMember.workspace_id == ws_id).delete()
            db.query(WebhookEndpoint).filter(WebhookEndpoint.workspace_id == ws_id).delete()
        db.query(Workspace).filter(Workspace.id == ws_id).delete()
    # Detach memberships in workspaces owned by OTHER users (their data stays intact).
    from ...models import WorkspaceMember

    db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).delete(synchronize_session=False)
    if is_sqlite:
        db.query(TeamMember).filter(TeamMember.user_id == user_id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id == user_id).delete()
        db.query(ApiKey).filter(ApiKey.user_id == user_id).delete()
        db.query(AuthSession).filter(AuthSession.user_id == user_id).delete()
        db.query(UserPrefsModel).filter(UserPrefsModel.user_id == user_id).delete()
        db.query(UserAccount).filter(UserAccount.id == user_id).delete()
    db.commit()
    response.delete_cookie("healforge_session", path="/")
    return {"ok": True}
