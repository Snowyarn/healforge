"""Comprehensive verification of Supabase 15-table schema mappings,
JWT authentication, workspace isolation, and Alembic migration guards.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest
from app.config import settings
from app.models import (
    Analysis,
    AnalysisFinding,
    AuditLog,
    Finding,
    IntegrationConnection,
    Patch,
    PatchReview,
    PatchVersion,
    Profile,
    Repository,
    SandboxRun,
    SavedReport,
    VerificationCheck,
    Workspace,
    WorkspaceMember,
)
from app.models.enums import (
    AuditCategoryEnum,
    AuditStatusEnum,
    ConnectionStatusEnum,
    FindingConfidenceEnum,
    FindingStatusEnum,
    PatchStatusEnum,
    RepositoryProviderEnum,
    ReviewDecisionEnum,
    SandboxStatusEnum,
    ScanStatusEnum,
    ScanTypeEnum,
    VerificationCheckStatusEnum,
    VerificationCheckTypeEnum,
    VulnerabilitySeverityEnum,
)
from app.security.sessions import mint_supabase_jwt, verify_supabase_jwt


def test_supabase_15_tables_registered():
    """Verify that all 15 authoritative Supabase application tables are declared in Base metadata."""
    from app.db import Base

    table_names = set(Base.metadata.tables.keys())
    expected_supabase_tables = {
        "profiles",
        "workspaces",
        "workspace_members",
        "repositories",
        "integration_connections",
        "analyses",
        "findings",
        "analysis_findings",
        "patches",
        "patch_versions",
        "patch_reviews",
        "sandbox_runs",
        "verification_checks",
        "audit_logs",
        "saved_reports",
    }
    missing = expected_supabase_tables - table_names
    assert not missing, f"Missing Supabase tables in SQLAlchemy metadata: {missing}"


def test_supabase_jwt_mint_and_verify():
    """Verify Supabase JWT HS256 token minting and signature verification."""
    user_id = str(uuid.uuid4())
    email = "engineer@healforge.security"
    token = mint_supabase_jwt(user_id, email, role="authenticated")
    assert token

    claims = verify_supabase_jwt(token)
    assert claims is not None
    assert claims["sub"] == user_id
    assert claims["email"] == email
    assert claims["role"] == "authenticated"
    assert claims["aud"] == "authenticated"

    # Tampered token must fail verification
    tampered = token[:-4] + "xxxx"
    assert verify_supabase_jwt(tampered) is None


def test_alembic_supabase_guard(monkeypatch):
    """Verify that Alembic migrations refuse to run against Supabase public schema."""
    from pathlib import Path

    env_path = Path(__file__).resolve().parent.parent / "alembic" / "env.py"
    assert env_path.exists()
    content = env_path.read_text()
    assert 'settings.database_schema == "public"' in content
    assert "Alembic migrations skipped" in content
    assert settings.skip_alembic_migrations is True


def test_workspace_isolation_and_rbac(client, temp_db_url):
    """Verify multi-tenant workspace isolation and unauthorized access rejection."""
    owner_id = str(uuid.uuid4())
    other_user_id = str(uuid.uuid4())

    owner_token = mint_supabase_jwt(owner_id, "owner@example.com")
    other_token = mint_supabase_jwt(other_user_id, "intruder@example.com")

    # 1. Owner registers / gets session
    r1 = client.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {owner_token}"})
    assert r1.status_code == 200
    owner_ws_id = r1.json()["workspace"]["id"]

    # 2. Other user tries to access owner's workspace via X-Workspace-Id header
    r2 = client.get(
        "/api/v1/auth/session",
        headers={"Authorization": f"Bearer {other_token}", "X-Workspace-Id": owner_ws_id},
    )
    assert r2.status_code == 200
    # Server-derived workspace must NOT be the requested unauthorized workspace
    assert r2.json()["workspace"]["id"] != owner_ws_id
