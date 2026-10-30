"""Workspace tenancy: one user must never read another user's data."""

from __future__ import annotations


def _register_and_client(client, email: str):
    """Register a second user via the API and return an authenticated client pair."""
    # Multi-user registration with a fresh client instance sharing the app.
    from fastapi.testclient import TestClient

    from app.main import app

    client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": email.split("@", maxsplit=1)[0], "password": "password12345"},
    )
    other = TestClient(app)
    r = other.post("/api/v1/auth/login", json={"email": email, "password": "password12345"})
    assert r.status_code == 200, r.text
    return other


def test_cross_workspace_access_denied(client, seeded_project):
    import os

    os.environ["HEALFORGE_SINGLE_USER"] = "false"
    pid, _rev = seeded_project

    from app.config import settings

    settings.healforge_single_user = False  # explicit multi-user mode for this test

    other = _register_and_client(client, "mallory@example.com")

    # Mallory cannot read Alice's project.
    r = other.get(f"/api/v1/projects/{pid}")
    assert r.status_code == 404
    # ...nor upload into it.
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("evil.py", "print('pwned')\n")
    r = other.post(f"/api/v1/projects/{pid}/sources", files={"file": ("evil.zip", buf.getvalue(), "application/zip")})
    assert r.status_code == 404
    # ...nor list her (empty) workspace and see Alice's findings.
    r = other.get("/api/v1/findings")
    assert r.status_code == 200
    assert r.json()["findings"] == []
    # Audit events likewise stay scoped.
    r = other.get("/api/v1/audit-events")
    assert all("seeded-api" not in (e.get("description") or "") for e in r.json()["events"])
    settings.healforge_single_user = True
    os.environ["HEALFORGE_SINGLE_USER"] = "true"
