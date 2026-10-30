"""Risk 5 regression: persisted idempotency for retried writes.

Covers: replay (same key+payload -> same response, single execution), key
reuse with a different payload (409), tenant separation, expiry, concurrency
(unique-constraint reservation), and no-key passthrough.
"""

from __future__ import annotations

import threading

from fastapi.testclient import TestClient

from app.main import app


def _seed(client) -> tuple[str, str]:
    from tests.conftest import make_zip

    r = client.post("/api/v1/projects", json={"name": "idem-project", "runtime": "python"})
    assert r.status_code == 201, r.text
    pid = r.json()["project"]["id"]
    r = client.post(f"/api/v1/projects/{pid}/sources", files={"file": ("s.zip", make_zip(), "application/zip")})
    assert r.status_code == 200, r.text
    return pid, r.json()["revision"]["id"]


def _scan_body(pid: str, rev: str) -> dict:
    return {"projectId": pid, "revisionId": rev, "scanType": "AST Static Analysis (SAST)"}


def test_duplicate_scan_create_replays_same_scan(client):
    pid, rev = _seed(client)
    body = _scan_body(pid, rev)
    r1 = client.post("/api/v1/scans", json=body, headers={"Idempotency-Key": "scan-key-1"})
    assert r1.status_code == 202, r1.text
    r2 = client.post("/api/v1/scans", json=body, headers={"Idempotency-Key": "scan-key-1"})
    assert r2.status_code == 202, r2.text
    assert r1.json()["scanId"] == r2.json()["scanId"], "retry must return the original scan"

    from app.db import SessionLocal
    from app.models import ScanJob

    db = SessionLocal()
    try:
        assert db.query(ScanJob).filter(ScanJob.project_id == pid).count() == 1
    finally:
        db.close()


def test_same_key_different_payload_conflicts(client):
    pid, rev = _seed(client)
    r1 = client.post("/api/v1/scans", json=_scan_body(pid, rev), headers={"Idempotency-Key": "scan-key-2"})
    assert r1.status_code == 202
    body2 = _scan_body(pid, rev)
    body2["scanType"] = "Secret & Token Detection"  # a different VALID payload
    r2 = client.post("/api/v1/scans", json=body2, headers={"Idempotency-Key": "scan-key-2"})
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "idempotency_key_conflict"


def test_no_key_creates_distinct_scans(client):
    pid, rev = _seed(client)
    body = _scan_body(pid, rev)
    r1 = client.post("/api/v1/scans", json=body)
    r2 = client.post("/api/v1/scans", json=body)
    assert r1.json()["scanId"] != r2.json()["scanId"]


def test_idempotency_is_tenant_scoped(client, temp_db_url, monkeypatch):
    """The same key under a different user+workspace is an independent request."""
    from app.config import settings

    monkeypatch.setattr(settings, "healforge_single_user", False)
    a = TestClient(app)
    b = TestClient(app)
    for c, uname in ((a, "idem-a"), (b, "idem-b")):
        r = c.post(
            "/api/v1/auth/register",
            json={"email": f"{uname}@example.com", "username": uname, "password": "supersecret123"},
        )
        assert r.status_code == 200, r.text

    pid_a, rev_a = _seed(a)
    pid_b, rev_b = _seed(b)
    r1 = a.post("/api/v1/scans", json=_scan_body(pid_a, rev_a), headers={"Idempotency-Key": "shared-key"})
    r2 = b.post("/api/v1/scans", json=_scan_body(pid_b, rev_b), headers={"Idempotency-Key": "shared-key"})
    assert r1.status_code == 202 and r2.status_code == 202
    assert r1.json()["scanId"] != r2.json()["scanId"], "same key must not collide across tenants"


def test_expired_idempotency_record_allows_new_execution(client):
    pid, rev = _seed(client)
    body = _scan_body(pid, rev)
    r1 = client.post("/api/v1/scans", json=body, headers={"Idempotency-Key": "scan-key-exp"})
    assert r1.status_code == 202
    from datetime import timedelta

    from app.db import SessionLocal
    from app.models import IdempotencyRecord
    from app.models.base import utcnow

    db = SessionLocal()
    try:
        rec = db.query(IdempotencyRecord).filter(IdempotencyRecord.idempotency_key == "scan-key-exp").first()
        rec.expires_at = utcnow() - timedelta(hours=1)
        db.commit()
    finally:
        db.close()
    r2 = client.post("/api/v1/scans", json=body, headers={"Idempotency-Key": "scan-key-exp"})
    assert r2.status_code == 202
    assert r2.json()["scanId"] != r1.json()["scanId"], "expired record must allow a fresh execution"


def test_concurrent_duplicates_create_exactly_one_scan(client):
    pid, rev = _seed(client)
    body = _scan_body(pid, rev)
    results: list = []
    lock = threading.Lock()

    def fire():
        c = TestClient(app)
        r = c.post("/api/v1/scans", json=body, headers={"Idempotency-Key": "scan-key-race"})
        with lock:
            results.append((r.status_code, r.json().get("scanId")))

    threads = [threading.Thread(target=fire) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Core invariant: EXACTLY ONE scan exists and every success returns its ID.
    # Two valid race outcomes:
    #   - overlap: losers hit the in_flight reservation -> 409 idempotency_request_in_flight
    #   - stagger: the first request completed first -> later requests get a 202
    #     replay of the SAME response (same scanId) — also correct idempotency.
    ok_results = [r for r in results if r[0] == 202]
    assert ok_results, f"at least one request must succeed: {results}"
    scan_ids = {sid for _, sid in ok_results}
    assert len(scan_ids) == 1, f"all successes must reference the SAME scan: {results}"
    for status, payload in results:
        if status != 202:
            assert status == 409, f"non-success must be an idempotency conflict, got {status}: {payload}"

    from app.db import SessionLocal
    from app.models import ScanJob

    db = SessionLocal()
    try:
        assert db.query(ScanJob).filter(ScanJob.project_id == pid).count() == 1
    finally:
        db.close()


def test_report_create_is_idempotent(client):
    r1 = client.post(
        "/api/v1/reports",
        json={"type": "vulnerability-summary", "format": "JSON"},
        headers={"Idempotency-Key": "report-key-1"},
    )
    assert r1.status_code == 201, r1.text
    r2 = client.post(
        "/api/v1/reports",
        json={"type": "vulnerability-summary", "format": "JSON"},
        headers={"Idempotency-Key": "report-key-1"},
    )
    assert r2.status_code == 201
    assert r1.json()["report"]["id"] == r2.json()["report"]["id"]


def test_team_invite_is_idempotent(client):
    r1 = client.post(
        "/api/v1/account/team",
        json={"name": "Idem Guest", "email": "idem-guest@example.com", "role": "Viewer"},
        headers={"Idempotency-Key": "invite-key-1"},
    )
    assert r1.status_code == 201, r1.text
    r2 = client.post(
        "/api/v1/account/team",
        json={"name": "Idem Guest", "email": "idem-guest@example.com", "role": "Viewer"},
        headers={"Idempotency-Key": "invite-key-1"},
    )
    assert r2.status_code == 201
    assert r1.json()["member"]["id"] == r2.json()["member"]["id"]
