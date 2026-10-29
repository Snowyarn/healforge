"""Risk 1 regression: single-user bootstrap must FAIL CLOSED.

- The Settings default for healforge_single_user is False (opt-in only).
- Production startup refuses to boot with single-user bootstrap enabled unless
  the explicit documented escape hatch is set.
- Multi-user mode (the production posture) returns 401 without a session.
- Deployment files (compose, .env.example) default to the safe value.
"""

from __future__ import annotations

from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


def test_single_user_defaults_to_off(monkeypatch):
    from app.config import Settings

    monkeypatch.delenv("HEALFORGE_SINGLE_USER", raising=False)
    monkeypatch.delenv("HEALFORGE_ENV", raising=False)
    s = Settings(_env_file=None)
    assert s.healforge_single_user is False, "single-user bootstrap must default to False (fail closed)"


def test_production_guard_refuses_single_user():
    from app.config import Settings
    from app.main import validate_startup

    with pytest.raises(RuntimeError, match="REFUSING TO START"):
        validate_startup(Settings(healforge_single_user=True, healforge_env="production"))


def test_production_guard_escape_hatch_is_explicit():
    from app.config import Settings
    from app.main import validate_startup

    # Only the documented double opt-in allows the shared dev owner in production.
    validate_startup(
        Settings(
            healforge_single_user=True,
            healforge_env="production",
            healforge_allow_single_user_in_production=True,
        )
    )


def test_local_env_with_single_user_is_allowed():
    from app.config import Settings
    from app.main import validate_startup

    validate_startup(Settings(healforge_single_user=True, healforge_env="local"))


def test_production_without_single_user_boots():
    from app.config import Settings
    from app.main import validate_startup

    validate_startup(Settings(healforge_single_user=False, healforge_env="production"))


def test_multi_user_mode_requires_login(client, monkeypatch):
    """With bootstrap disabled, unauthenticated API access is a 401 — never an
    auto-provisioned shared owner."""
    from app.config import settings

    monkeypatch.setattr(settings, "healforge_single_user", False)
    r = client.get("/api/v1/auth/session")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "no_session"
    r = client.get("/api/v1/projects")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_docker_compose_defaults_single_user_off():
    compose_path = ROOT_DIR / "docker-compose.yml"
    if not compose_path.exists():
        pytest.skip("root docker-compose.yml not present (backend-only distribution)")
    compose = compose_path.read_text()
    assert "HEALFORGE_SINGLE_USER: ${HEALFORGE_SINGLE_USER:-false}" in compose, (
        "deployment compose must default single-user bootstrap to false"
    )


def test_env_example_documents_safe_default():
    env_path = ROOT_DIR / ".env.example"
    if not env_path.exists():
        pytest.skip("root .env.example not present (backend-only distribution)")
    env_example = env_path.read_text()
    assert "HEALFORGE_SINGLE_USER=false" in env_example
    assert "HEALFORGE_ENV" in env_example


def test_register_in_single_user_mode_yields_own_session(client, temp_db_url):
    """Regression: the single-user bootstrap middleware must NOT overwrite the
    session cookie issued by /auth/register (it used to replace the new user's
    session with the shared dev session)."""
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "own-session@example.com", "username": "own-session", "password": "supersecret123"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == "own-session@example.com"
    # The session cookie now points at the REGISTERED user, not the dev account:
    r = client.get("/api/v1/auth/session")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "own-session@example.com"
