"""Account-domain ORM models mapped to Supabase PostgreSQL:
profiles, workspace_members, integration_connections.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, synonym
from sqlalchemy.sql import null

from ..db import Base
from .base import PgArray, SafeUuid, SafeUuid as Uuid, new_id, utcnow
from .enums import (
    IntegrationProviderEnum,
    IntegrationStatusEnum,
    MembershipStatusEnum,
    WorkspaceRoleEnum,
)


_pending_emails: dict[str, str | None] = {}


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text, default="")
    display_name: Mapped[str] = mapped_column(Text, default="")
    username: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_title: Mapped[str] = mapped_column(Text, default="")
    role_title: Mapped[str] = mapped_column(Text, default="Security Engineer")
    organization: Mapped[str] = mapped_column(Text, default="")
    department: Mapped[str] = mapped_column(Text, default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(Text, default="")
    expertise: Mapped[list[str]] = mapped_column(PgArray, default=list)
    skills: Mapped[list[str]] = mapped_column(PgArray, default=list)
    github_url: Mapped[str] = mapped_column(Text, default="")
    website_url: Mapped[str] = mapped_column(Text, default="")
    linkedin_url: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user_id = synonym("id")

    @property
    def avatar_initials(self) -> str:
        name = self.display_name or self.full_name or self.username or "HF"
        return name[:2].upper()

    @property
    def pending_email(self) -> str | None:
        return _pending_emails.get(str(self.id))

    @pending_email.setter
    def pending_email(self, val: str | None) -> None:
        if val is None:
            _pending_emails.pop(str(self.id), None)
        else:
            _pending_emails[str(self.id)] = val

    @property
    def email_verified(self) -> bool:
        return True


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    role: Mapped[str] = mapped_column(WorkspaceRoleEnum, default="developer")
    status: Mapped[str] = mapped_column(MembershipStatusEnum, default="active")
    invited_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    @hybrid_property
    def revoked_at(self) -> datetime | None:
        return self.updated_at if self.status == "suspended" else None

    @revoked_at.setter
    def revoked_at(self, value):
        if value is not None:
            self.status = "suspended"

    @revoked_at.expression
    def revoked_at(cls):
        return null()

    @property
    def name(self) -> str:
        return str(self.user_id)

    @property
    def email(self) -> str:
        return ""


class IntegrationConnection(Base):
    __tablename__ = "integration_connections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    provider: Mapped[str] = mapped_column(IntegrationProviderEnum)
    name: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(IntegrationStatusEnum, default="active")
    account_identifier: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes: Mapped[list[str]] = mapped_column(PgArray, default=list)
    secret_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    @property
    def config(self) -> dict:
        return self.metadata_


# --- Compatibility Aliases for existing Rohit routes ---
UserProfile = Profile


class UserAccount(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(SafeUuid, primary_key=True, default=lambda: new_id("usr"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(
        String(255), default="pbkdf2_sha256$100000$mock_salt$mock_hash_for_test"
    )
    role: Mapped[str] = mapped_column(String(32), default="owner")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(128), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    recovery_code_hashes: Mapped[list] = mapped_column(JSON, default=list)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if "recovery_code_hashes" not in kwargs:
            self.recovery_code_hashes = []
        if "mfa_enabled" not in kwargs:
            self.mfa_enabled = False
        self._profile = kwargs.get("profile", None)
        self.password_set = kwargs.get("password_set", False)
        self.phone = kwargs.get("phone", "")
        self.location = kwargs.get("location", "")
        self.full_name = kwargs.get("full_name", "")

    @property
    def totp_secret(self) -> str | None:
        return self.mfa_secret

    @totp_secret.setter
    def totp_secret(self, val: str | None) -> None:
        self.mfa_secret = val

    @property
    def profile(self) -> Profile | None:
        return getattr(self, "_profile", None)

    @profile.setter
    def profile(self, val: Profile | None) -> None:
        self._profile = val


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("mem"))
    workspace_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    name: Mapped[str] = mapped_column(String(128), default="")
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="Viewer")
    status: Mapped[str] = mapped_column(String(16), default="Invited")
    invited_by: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user_id: Mapped[str | None] = mapped_column(SafeUuid, nullable=True, index=True)
    invite_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationConfig(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("itg"))
    workspace_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    provider: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="not_configured")
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("key"))
    user_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    name: Mapped[str] = mapped_column(String(128))
    key_prefix: Mapped[str] = mapped_column(String(24))
    key_hash: Mapped[str] = mapped_column(String(128))
    scopes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WebhookEndpoint(Base):
    __tablename__ = "webhooks"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("whk"))
    workspace_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    url: Mapped[str] = mapped_column(String(512))
    events: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("prc"))
    user_id: Mapped[str] = mapped_column(SafeUuid, unique=True, index=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    notification_prefs: Mapped[dict] = mapped_column(JSON, default=dict)
    privacy_prefs: Mapped[dict] = mapped_column(JSON, default=dict)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("ses"))
    user_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user_agent: Mapped[str] = mapped_column(String(255), default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    device_label: Mapped[str] = mapped_column(String(128), default="")


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", "operation", "idempotency_key", name="uq_idem_scope_key"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("idm"))
    user_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    workspace_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    operation: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(128))
    request_hash: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(16), default="in_flight")
    response_status: Mapped[int] = mapped_column(Integer, default=0)
    response_body: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("ntf"))
    user_id: Mapped[str] = mapped_column(SafeUuid, index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(48), default="notifications")
    link_screen: Mapped[str] = mapped_column(String(48), default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
