"""Risk 2 regression: server-side RBAC, invitation lifecycle, last-owner
protection, tenant isolation and member-deletion safety.

Multi-user posture: bootstrap disabled; every user registers/logs in and gets
their own cookie jar (separate TestClient instances).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def multi_user(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "healforge_single_user", False)
    return client


TEST_PASSWORD = "supersecret123"


def _register(email: str, username: str, password: str = TEST_PASSWORD) -> TestClient:
    c = TestClient(app)
    r = c.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert r.status_code == 200, r.text
    return c


def _invite(owner: TestClient, email: str, role: str = "Viewer") -> dict:
    r = owner.post(
        "/api/v1/account/team",
        json={"name": email.split("@")[0], "email": email, "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _accept(member: TestClient, invite_url: str):
    token = invite_url.rstrip("/").split("/")[-1]
    return member.post(f"/api/v1/account/team/invitations/{token}/accept")


def _ws_id(user: TestClient) -> str:
    return user.get("/api/v1/auth/session").json()["workspace"]["id"]


# ------------------------------------------------------------- invitation lifecycle


def test_invitation_lifecycle_end_to_end(multi_user):
    owner = _register("owner@example.com", "owner-owa")
    member = _register("member@example.com", "member-mem")

    inv = _invite(owner, "member@example.com", "Developer")
    assert inv["emailSent"] is False  # email delivery honestly not configured
    assert inv["inviteUrl"].startswith("/account/team-invite/")

    # Public invitation preview works without a session and masks the email.
    token = inv["inviteUrl"].rstrip("/").split("/")[-1]
    anon = TestClient(app)
    info = anon.get(f"/api/v1/account/team/invitations/{token}").json()
    assert info["valid"] is True
    assert info["role"] == "Developer"
    assert "***" in info["invitedEmail"] and info["invitedEmail"] != "member@example.com"

    # Wrong-email account cannot accept (the token alone is not the capability).
    stranger = _register("stranger@example.com", "stranger-st")
    r = _accept(stranger, inv["inviteUrl"])
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "invitation_email_mismatch"

    # Correct account accepts -> membership active, token burned (single use).
    r = _accept(member, inv["inviteUrl"])
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "Developer"

    r2 = _accept(member, inv["inviteUrl"])
    assert r2.status_code == 404  # token hash cleared after acceptance

    team = owner.get("/api/v1/account/team").json()["team"]
    accepted = [m for m in team if m["email"] == "member@example.com"]
    assert accepted and accepted[0]["status"] == "Active"


def test_expired_invitation_cannot_be_accepted(multi_user, temp_db_url):
    owner = _register("expiry-owner@example.com", "expiry-owner")
    member = _register("expiry-member@example.com", "expiry-member")
    inv = _invite(owner, "expiry-member@example.com")

    from app.db import SessionLocal
    from app.models import TeamMember

    db = SessionLocal()
    try:
        row = (
            db.query(TeamMember)
            .filter(TeamMember.email == "expiry-member@example.com", TeamMember.status == "Invited")
            .first()
        )
        assert row is not None, "invitation row must exist (status Invited)"
        from datetime import timedelta

        from app.models.base import utcnow

        row.invite_expires_at = utcnow() - timedelta(days=1)
        db.commit()
    finally:
        db.close()

    r = _accept(member, inv["inviteUrl"])
    assert r.status_code == 410
    assert r.json()["error"]["code"] == "invitation_expired"


# ------------------------------------------------------------------- RBAC matrix


def _role_matrix_case(multi_user, role: str, allowed: dict, denied: dict):
    slug = role.lower().replace(" ", "-")
    owner = _register(f"mx-owner-{slug}@example.com", f"mxo-{slug}")
    member = _register(f"mx-member-{slug}@example.com", f"mxm-{slug}")
    inv = _invite(owner, f"mx-member-{slug}@example.com", role)
    assert _accept(member, inv["inviteUrl"]).status_code == 200

    ws = _ws_id(owner)
    headers = {"X-Workspace-Id": ws}

    # project creation needs manage_projects
    if "create_project" in allowed:
        r = member.post("/api/v1/projects", headers=headers, json={"name": f"proj-{slug}", "runtime": "python"})
        assert r.status_code == 201, f"{role} should manage projects: {r.text}"
    if "create_project" in denied:
        r = member.post("/api/v1/projects", headers=headers, json={"name": f"proj-{slug}", "runtime": "python"})
        assert r.status_code == 403, f"{role} must not manage projects"
        assert r.json()["error"]["code"] == "permission_denied"

    # scan creation needs run_scans (project must exist: owner makes one)
    r = owner.post("/api/v1/projects", headers=headers, json={"name": f"scan-src-{slug}", "runtime": "python"})
    assert r.status_code == 201
    pid = r.json()["project"]["id"]
    from tests.conftest import make_zip

    r = owner.post(
        f"/api/v1/projects/{pid}/sources", headers=headers, files={"file": ("s.zip", make_zip(), "application/zip")}
    )
    assert r.status_code == 200, r.text
    rev = r.json()["revision"]["id"]

    if "create_scan" in allowed:
        r = member.post(
            "/api/v1/scans",
            headers=headers,
            json={"projectId": pid, "revisionId": rev, "scanType": "AST Static Analysis (SAST)"},
        )
        assert r.status_code == 202, f"{role} should run scans: {r.text}"
    if "create_scan" in denied:
        r = member.post(
            "/api/v1/scans",
            headers=headers,
            json={"projectId": pid, "revisionId": rev, "scanType": "AST Static Analysis (SAST)"},
        )
        assert r.status_code == 403, f"{role} must not run scans"

    # team invite needs manage_team
    if "invite" in allowed:
        r = member.post(
            "/api/v1/account/team",
            headers=headers,
            json={"name": "Extra Person", "email": f"mx-extra-{slug}@example.com", "role": "Viewer"},
        )
        assert r.status_code == 201, f"{role} should manage team: {r.text}"
    if "invite" in denied:
        r = member.post(
            "/api/v1/account/team",
            headers=headers,
            json={"name": "Extra Person", "email": f"mx-extra-{slug}@example.com", "role": "Viewer"},
        )
        assert r.status_code == 403, f"{role} must not manage team"


def test_rbac_viewer_is_read_only(multi_user):
    _role_matrix_case(
        multi_user,
        "Viewer",
        allowed={},
        denied={"create_project", "create_scan", "invite"},
    )


def test_rbac_developer_can_build_and_scan_but_not_manage_team(multi_user):
    _role_matrix_case(
        multi_user,
        "Developer",
        allowed={"create_project", "create_scan"},
        denied={"invite"},
    )


def test_rbac_security_engineer_scans_but_not_projects_or_team(multi_user):
    _role_matrix_case(
        multi_user,
        "Security Engineer",
        allowed={"create_scan"},
        denied={"create_project", "invite"},
    )


def test_rbac_admin_manages_team_and_projects(multi_user):
    _role_matrix_case(
        multi_user,
        "Admin",
        allowed={"create_project", "create_scan", "invite"},
        denied={},
    )


def test_member_cannot_self_promote(multi_user):
    owner = _register("selfprom-owner@example.com", "selfprom-owner")
    member = _register("selfprom-member@example.com", "selfprom-member")
    inv = _invite(owner, "selfprom-member@example.com", "Viewer")
    assert _accept(member, inv["inviteUrl"]).status_code == 200

    # Operate inside the OWNER's workspace (X-Workspace-Id), where the member is a Viewer.
    headers = {"X-Workspace-Id": _ws_id(owner)}
    team = member.get("/api/v1/account/team", headers=headers).json()["team"]
    me = next(m for m in team if m["email"] == "selfprom-member@example.com")
    r = member.patch(f"/api/v1/account/team/{me['id']}", json={"role": "Admin"}, headers=headers)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "permission_denied"


# ---------------------------------------------------------- last-owner protection


def test_last_owner_cannot_be_removed(multi_user):
    owner = _register("lastown-owner@example.com", "lastown-owner")
    team = owner.get("/api/v1/account/team").json()["team"]
    owner_row = next(m for m in team if m["role"] == "Owner")
    r = owner.delete(f"/api/v1/account/team/{owner_row['id']}")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "last_owner_protected"


def test_owner_role_cannot_be_changed(multi_user):
    owner = _register("roleown-owner@example.com", "roleown-owner")
    team = owner.get("/api/v1/account/team").json()["team"]
    owner_row = next(m for m in team if m["role"] == "Owner")
    r = owner.patch(f"/api/v1/account/team/{owner_row['id']}", json={"role": "Admin"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "owner_protected"


# ------------------------------------------------------------- tenant boundaries


def test_workspace_header_only_for_members(multi_user):
    """A user cannot point X-Workspace-Id at a workspace they do not belong to;
    resolution falls back to their own workspace instead of leaking data."""
    a = _register("tenant-a@example.com", "tenant-a")
    b = _register("tenant-b@example.com", "tenant-b")
    r = a.post("/api/v1/projects", json={"name": "a-secret-project", "runtime": "python"})
    assert r.status_code == 201

    # b tries to select a's workspace
    a_ws = _ws_id(a)
    r = b.get("/api/v1/projects", headers={"X-Workspace-Id": a_ws})
    assert r.status_code == 200
    names = [p["name"] for p in r.json()["projects"]]
    assert "a-secret-project" not in names, "cross-tenant workspace selection leaked data"

    # member access works with the header
    inv = _invite(a, "tenant-b@example.com", "Viewer")
    assert _accept(b, inv["inviteUrl"]).status_code == 200
    r = b.get("/api/v1/projects", headers={"X-Workspace-Id": a_ws})
    assert r.status_code == 200
    names = [p["name"] for p in r.json()["projects"]]
    assert "a-secret-project" in names, "accepted member must reach the workspace via header"


# ----------------------------------------------- member account-deletion safety


def test_member_deleting_account_does_not_destroy_owner_workspace(multi_user):
    owner = _register("delown-owner@example.com", "delown-owner")
    member = _register("delmem-member@example.com", "delmem-member")
    inv = _invite(owner, "delmem-member@example.com", "Viewer")
    assert _accept(member, inv["inviteUrl"]).status_code == 200
    owner_ws = _ws_id(owner)
    r = owner.post("/api/v1/projects", json={"name": "must-survive", "runtime": "python"})
    assert r.status_code == 201

    # Owner cannot delete while an active member exists (last-owner protection).
    r = owner.delete("/api/v1/account")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "workspace_has_members"

    # Member deletes their own account: only their own (empty) workspace dies.
    r = member.delete("/api/v1/account")
    assert r.status_code == 200, r.text

    from app.db import SessionLocal
    from app.models import Project, TeamMember, UserAccount, Workspace

    db = SessionLocal()
    try:
        assert db.query(UserAccount).filter(UserAccount.email == "delmem-member@example.com").first() is None
        assert db.query(TeamMember).filter(TeamMember.email == "delmem-member@example.com").first() is None
        ws = db.query(Workspace).filter(Workspace.id == owner_ws).first()
        assert ws is not None, "owner workspace must survive member deletion"
        assert db.query(Project).filter(Project.workspace_id == owner_ws).count() == 1
    finally:
        db.close()

    # Owner can now delete their own account (no active members left).
    r = owner.delete("/api/v1/account")
    assert r.status_code == 200


def test_member_export_lists_memberships_not_owner_data(multi_user):
    owner = _register("expown-owner@example.com", "expown-owner")
    member = _register("expmem-member@example.com", "expmem-member")
    inv = _invite(owner, "expmem-member@example.com", "Viewer")
    assert _accept(member, inv["inviteUrl"]).status_code == 200
    owner.post("/api/v1/projects", json={"name": "owners-private", "runtime": "python"})

    bundle = member.get("/api/v1/account/export").json()
    assert "memberships" in bundle
    assert any(m["workspaceId"] == _ws_id(owner) for m in bundle["memberships"])
    assert all(p["name"] != "owners-private" for p in bundle.get("projects", [])), (
        "member export must not include the owner's workspace data"
    )
