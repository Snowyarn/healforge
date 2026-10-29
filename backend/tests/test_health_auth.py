"""Health, session bootstrap, multi-user auth."""

from __future__ import annotations

import uuid


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["runner"]["host_execution_forbidden"] is True
    # The NVIDIA status must never include the API key (even when set).
    assert "nvidia_api_key" not in body["nvidia"]
    assert "apiKey" not in body["nvidia"]


def test_session_bootstrap_single_user(client):
    r = client.get("/api/v1/auth/session")
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "single-user"
    assert body["user"]["username"]
    assert str(uuid.UUID(body["workspace"]["id"])) == body["workspace"]["id"]


def test_register_login_flow(client, temp_db_url, monkeypatch):
    monkeypatch.setattr("app.config.settings.healforge_single_user", False)
    r = client.post(
        "/api/v1/auth/register", json={"email": "alice@example.com", "username": "alice", "password": "supersecret123"}
    )
    assert r.status_code == 200, r.text
    # Duplicate email rejected.
    r2 = client.post(
        "/api/v1/auth/register", json={"email": "alice@example.com", "username": "alice2", "password": "supersecret123"}
    )
    assert r2.status_code == 409
    # Logout, then login with the password.
    client.post("/api/v1/auth/logout")
    r3 = client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "supersecret123"})
    assert r3.status_code == 200
    r4 = client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "wrong-password"})
    assert r4.status_code == 401


def test_password_hash_not_plaintext(client, temp_db_url):
    from app.db import session_scope
    from app.models import UserAccount

    client.get("/api/v1/auth/session")
    db = session_scope()
    try:
        user = db.query(UserAccount).first()
        assert user.password_hash.startswith("pbkdf2_sha256$")
        assert "supersecret" not in user.password_hash
    finally:
        db.close()
