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


def test_register_validation(client, temp_db_url, monkeypatch):
    monkeypatch.setattr("app.config.settings.healforge_single_user", False)
    # Invalid email
    r1 = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "username": "validuser", "password": "password123"},
    )
    assert r1.status_code == 422
    # Invalid username (too short)
    r2 = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "username": "a", "password": "password123"},
    )
    assert r2.status_code == 422
    # Weak password (< 8 chars)
    r3 = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "username": "validuser", "password": "123"},
    )
    assert r3.status_code == 422


def test_logout_clears_session(client, temp_db_url, monkeypatch):
    monkeypatch.setattr("app.config.settings.healforge_single_user", False)
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "bob@example.com", "username": "bobby", "password": "supersecret123"},
    )
    assert r.status_code == 200
    # Session is active
    s = client.get("/api/v1/auth/session")
    assert s.status_code == 200
    # Logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    # Session returns 401
    s2 = client.get("/api/v1/auth/session")
    assert s2.status_code == 401


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


def test_production_posture_fails_closed(client, temp_db_url, monkeypatch):
    import pytest

    from app.db import session_scope
    from app.security.sessions import ensure_default_profile, ensure_default_user

    monkeypatch.setattr("app.config.settings.healforge_env", "production")
    monkeypatch.setattr("app.config.settings.healforge_single_user", False)
    monkeypatch.setattr("app.config.settings.healforge_allow_single_user_in_production", False)

    # In production without auth cookie, session returns 401
    res = client.get("/api/v1/auth/session")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "no_session"

    # Single-user bootstrap helpers strictly raise RuntimeError in production
    db = session_scope()
    try:
        with pytest.raises(RuntimeError, match="disabled in production mode"):
            ensure_default_profile(db)
        with pytest.raises(RuntimeError, match="disabled in production mode"):
            ensure_default_user(db)
    finally:
        db.close()


def test_root_and_api_health_endpoints(client, temp_db_url):
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json()["service"] == "healforge-backend"

    r2 = client.get("/api/v1/health")
    assert r2.status_code == 200
    assert r2.json()["service"] == "healforge-backend"
