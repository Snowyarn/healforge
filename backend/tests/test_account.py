"""Account surface: profile, TOTP, keys, sessions, team, preferences, export, deletion."""

from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time as time_mod


def _totp_now(secret: str) -> str:
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8), casefold=True)
    counter = int(time_mod.time()) // 30
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = digest[-1] & 15
    return f"{(struct.unpack('>I', digest[o : o + 4])[0] & 0x7FFFFFFF) % 1000000:06d}"


def test_profile_update_and_state(client):
    r = client.patch(
        "/api/v1/account/profile",
        json={
            "fullName": "Alice Dev",
            "bio": "Security engineer",
            "location": "Remote",
            "githubUrl": "https://github.com/alice",
        },
    )
    assert r.status_code == 200
    state = client.get("/api/v1/account/state").json()
    assert state["profile"]["fullName"] == "Alice Dev"
    assert state["billingNotConfigured"] is True
    assert state["subscription"] is None
    # Non-https URLs rejected.
    r = client.patch("/api/v1/account/profile", json={"githubUrl": "http://github.com/alice"})
    assert r.status_code == 422


def test_email_change_honest_no_delivery(client):
    r = client.post("/api/v1/account/email/change", json={"newEmail": "new@example.com"})
    assert r.status_code == 200
    assert r.json()["deliveryConfigured"] is False
    state = client.get("/api/v1/account/state").json()
    assert state["profile"]["pendingEmail"] == "new@example.com"
    r = client.delete("/api/v1/account/email/pending")
    assert r.status_code == 200
    assert client.get("/api/v1/account/state").json()["profile"]["pendingEmail"] is None


def test_totp_full_lifecycle(client):
    r = client.post("/api/v1/account/mfa/totp/start")
    assert r.status_code == 200
    secret = r.json()["secret"]
    assert r.json()["uri"].startswith("otpauth://totp/HealForge:")
    # Wrong code rejected.
    r = client.post("/api/v1/account/mfa/totp/enable", json={"code": "000000"})
    assert r.status_code == 401
    # Correct code enables and returns recovery codes ONCE.
    r = client.post("/api/v1/account/mfa/totp/enable", json={"code": _totp_now(secret)})
    assert r.status_code == 200
    codes = r.json()["recoveryCodes"]
    assert len(codes) == 8
    state = client.get("/api/v1/account/state").json()
    assert state["security"]["mfaEnabled"] is True
    assert state["security"]["recoveryCodesRemaining"] == 8
    # Recovery codes are stored hashed, not plaintext.
    from app.db import session_scope
    from app.models import UserAccount

    db = session_scope()
    try:
        user = db.query(UserAccount).first()
        assert all(h != c for h in (user.recovery_code_hashes or []) for c in codes)
        assert all(len(h) == 64 for h in user.recovery_code_hashes)  # sha256 hex
    finally:
        db.close()
    # Disable with a recovery code.
    r = client.post("/api/v1/account/mfa/disable", json={"code": codes[0]})
    assert r.status_code == 200
    assert client.get("/api/v1/account/state").json()["security"]["mfaEnabled"] is False


def test_api_keys_hashed_and_shown_once(client):
    r = client.post("/api/v1/account/api-keys", json={"name": "CI", "scopes": ["read:findings"], "expiryDays": 30})
    assert r.status_code == 201
    secret = r.json()["key"]
    assert secret.startswith("hf_live_")
    key_id = r.json()["id"]
    keys = client.get("/api/v1/account/api-keys").json()["apiKeys"]
    assert len(keys) == 1
    assert secret not in str(keys)  # full secret never appears again
    from app.db import session_scope
    from app.models import ApiKey

    db = session_scope()
    try:
        row = db.query(ApiKey).first()
        assert row.key_hash == hashlib.sha256(secret.encode()).hexdigest()
    finally:
        db.close()
    r = client.delete(f"/api/v1/account/api-keys/{key_id}")
    assert r.status_code == 200
    assert client.get("/api/v1/account/api-keys").json()["apiKeys"][0]["status"] == "revoked"


def test_webhook_validation(client):
    r = client.post("/api/v1/account/webhooks", json={"url": "http://insecure.example.com/hook", "events": []})
    assert r.status_code == 422  # https required
    r = client.post(
        "/api/v1/account/webhooks",
        json={"url": "https://hooks.example.com/h", "events": ["patch.generated", "bogus.event"]},
    )
    assert r.status_code == 201
    assert r.json()["webhook"]["events"] == ["patch.generated"]
    assert r.json()["webhook"]["deliveryConfigured"] is False  # honest
    r = client.delete(f"/api/v1/account/webhooks/{r.json()['webhook']['id']}")
    assert r.status_code == 200


def test_team_invite_and_owner_protection(client):
    r = client.post("/api/v1/account/team", json={"name": "Bob", "email": "bob@example.com", "role": "Developer"})
    assert r.status_code == 201
    assert r.json()["emailSent"] is False  # honest: no delivery configured
    member_id = r.json()["member"]["id"]
    # Invalid role rejected; Owner role cannot be assigned.
    assert (
        client.post("/api/v1/account/team", json={"name": "X", "email": "x@example.com", "role": "Owner"}).status_code
        == 422
    )
    assert (
        client.post("/api/v1/account/team", json={"name": "X", "email": "x@example.com", "role": "Wizard"}).status_code
        == 422
    )
    r = client.patch(f"/api/v1/account/team/{member_id}", json={"role": "Security Engineer"})
    assert r.status_code == 200
    r = client.delete(f"/api/v1/account/team/{member_id}")
    assert r.status_code == 200


def test_preferences_and_privacy(client):
    r = client.patch(
        "/api/v1/account/preferences", json={"theme": "dark", "timezone": "UTC", "defaultLanding": "dashboard"}
    )
    assert r.status_code == 200
    r = client.patch("/api/v1/account/notifications", json={"weeklyDigest": True, "securityAlertsEmail": False})
    assert r.status_code == 200
    r = client.patch("/api/v1/account/privacy", json={"telemetryOptIn": True, "dataRetentionMonths": 6})
    assert r.status_code == 200
    state = client.get("/api/v1/account/state").json()
    assert state["preferences"]["theme"] == "dark"
    assert state["notifications"]["weeklyDigest"] is True
    assert state["privacy"]["dataRetentionMonths"] == 6


def test_billing_is_honestly_not_configured(client):
    r = client.get("/api/v1/account/billing")
    assert r.status_code == 200
    assert r.json()["configured"] is False
    # No billing mutation routes exist at all (404/405 on attempted plan change).
    assert client.patch("/api/v1/account/billing/plan").status_code in (404, 405)


def test_integrations_stay_not_configured(client):
    integrations = client.get("/api/v1/account/integrations").json()["integrations"]
    assert len(integrations) == 4
    assert all(not i["connected"] for i in integrations)
    assert all(i["notConfigured"] for i in integrations)
    assert all(i["setupInstructions"] for i in integrations)


def test_sessions_list_and_revoke_others(client):
    r = client.get("/api/v1/account/sessions")
    sessions = r.json()["sessions"]
    assert len(sessions) >= 1 and sessions[0]["isCurrent"] is True
    current_id = sessions[0]["id"]
    r = client.delete(f"/api/v1/account/sessions/{current_id}")
    assert r.status_code == 422  # cannot revoke current via this route
    r = client.post("/api/v1/account/sessions/revoke-others")
    assert r.status_code == 200


def test_export_and_delete_account_cascade(client, seeded_project):
    _pid, _rev = seeded_project
    # Make some data.
    client.post(
        "/api/v1/bug-reports",
        json={
            "title": "Some bug",
            "description": "descriptive text here",
            "category": "Other",
            "severity": "Low",
            "affectedRepo": "seeded-api",
            "affectedFile": "x.py",
        },
    )
    export = client.get("/api/v1/account/export").json()
    assert export["account"]["username"]
    assert any(p["name"] == "seeded-api" for p in export["projects"])
    assert export["sourceCodeIncluded"] is False  # source excluded from export

    r = client.delete("/api/v1/account")
    assert r.status_code == 200
    # After deletion, the old session is dead. In single-user dev mode the next request
    # bootstraps a FRESH default user whose workspace must be empty (data truly deleted).
    state = client.get("/api/v1/account/state")
    assert state.status_code in (200, 401)
    if state.status_code == 200:
        assert client.get("/api/v1/projects").json()["projects"] == []
        assert client.get("/api/v1/findings").json()["findings"] == []
