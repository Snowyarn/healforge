"""Account-domain ORM models: users, sessions, profile, preferences, keys, team."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy import UniqueConstraint as sa_UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .base import new_id, utcnow


class UserAccount(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("usr"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="owner")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(128), nullable=True)  # base32 TOTP secret
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    recovery_code_hashes: Mapped[list | None] = mapped_column(JSON, nullable=True)

    profile: Mapped[UserProfile] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("prf"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128), default="")
    display_name: Mapped[str] = mapped_column(String(128), default="")
    avatar_initials: Mapped[str] = mapped_column(String(4), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    location: Mapped[str] = mapped_column(String(128), default="")
    job_title: Mapped[str] = mapped_column(String(128), default="")
    organization: Mapped[str] = mapped_column(String(128), default="")
    department: Mapped[str] = mapped_column(String(128), default="")
    expertise: Mapped[list] = mapped_column(JSON, default=list)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    github_url: Mapped[str] = mapped_column(String(255), default="")
    website_url: Mapped[str] = mapped_column(String(255), default="")
    linkedin_url: Mapped[str] = mapped_column(String(255), default="")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    pending_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped[UserAccount] = relationship(back_populates="profile")


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("prc"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    notification_prefs: Mapped[dict] = mapped_column(JSON, default=dict)
    privacy_prefs: Mapped[dict] = mapped_column(JSON, default=dict)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("ses"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user_agent: Mapped[str] = mapped_column(String(255), default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    device_label: Mapped[str] = mapped_column(String(128), default="")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("key"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
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
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    url: Mapped[str] = mapped_column(String(512))
    events: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Delivery worker is NOT configured in this deployment — registration only.


class TeamMember(Base):
    """Workspace membership + invitation lifecycle.

    Lifecycle: Invited (token outstanding) -> Active (user accepted) -> Revoked/removed.
    The workspace creator is seeded as an Owner row with user_id set (see
    security.sessions.ensure_owner_membership) so ownership checks and last-owner
    protection always operate on the same table.
    """

    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("mem"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    name: Mapped[str] = mapped_column(String(128))
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="Viewer")
    status: Mapped[str] = mapped_column(String(16), default="Invited")  # Invited | Active
    invited_by: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # --- invitation acceptance lifecycle (added 2026-10) ---
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    invite_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationConfig(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("itg"))
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    provider: Mapped[str] = mapped_column(String(32))  # github | gitlab | slack | jira
    status: Mapped[str] = mapped_column(String(32), default="not_configured")
    config: Mapped[dict] = mapped_column(JSON, default=dict)  # setup instructions, not secrets
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IdempotencyRecord(Base):
    """Persisted idempotency for retried writes (scoped to user+workspace+operation+key).

    A reservation row is inserted BEFORE the operation executes; the response is
    stored afterwards. The unique constraint makes concurrent duplicates impossible.
    """

    __tablename__ = "idempotency_records"
    __table_args__ = (
        sa_UniqueConstraint("user_id", "workspace_id", "operation", "idempotency_key", name="uq_idem_scope_key"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("idm"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[str] = mapped_column(String(48), index=True)
    operation: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(128))
    request_hash: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(16), default="in_flight")  # in_flight | completed
    response_status: Mapped[int] = mapped_column(default=0)
    response_body: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("ntf"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(48), default="notifications")
    link_screen: Mapped[str] = mapped_column(String(48), default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
