"""Risk 4 + 9 regression: typed API contracts and honest job-mode disclosure.

- Every error response uses ONE envelope: {"error": {code, message, request_id?}}
- List endpoints expose bounded pagination (limit/offset with server caps).
- /health discloses the job backend honestly (in-process, not durable).
- Failed scans can be retried; non-failed scans cannot.
"""

from __future__ import annotations

from tests.conftest import wait_for_scan


def test_error_envelope_is_uniform(client, monkeypatch):
    from app.config import settings

    # 401 (multi-user, no session)
    monkeypatch.setattr(settings, "healforge_single_user", False)
    r = client.get("/api/v1/projects")
    assert r.status_code == 401
    assert set(r.json().keys()) == {"error"}
    assert r.json()["error"]["code"] == "unauthorized"
    # back to single-user dev mode for the remaining (authenticated) checks
    monkeypatch.setattr(settings, "healforge_single_user", True)

    # 404
    r = client.get("/api/v1/scans/scan_doesnotexist")
    assert r.status_code == 404
    assert set(r.json().keys()) == {"error"}
    assert r.json()["error"]["code"] == "scan_not_found"

    # 422 validation (bounded field constraints)
    r = client.post("/api/v1/projects", json={"name": "x"})
    assert r.status_code == 422
    assert set(r.json().keys()) == {"error"}
    assert r.json()["error"]["code"] == "validation_error"


def test_pagination_bounded_and_reported(client, seeded_project):
    pid, rev = seeded_project
    # Create 3 scans
    for _ in range(3):
        r = client.post(
            "/api/v1/scans",
            json={"projectId": pid, "revisionId": rev, "scanType": "AST Static Analysis (SAST)"},
        )
        assert r.status_code == 202

    r = client.get("/api/v1/scans?limit=2")
    body = r.json()
    assert len(body["scans"]) == 2
    assert body["pagination"] == {"limit": 2, "offset": 0, "total": 3, "returned": 2}

    r = client.get("/api/v1/scans?limit=2&offset=2")
    body = r.json()
    assert len(body["scans"]) == 1
    assert body["pagination"]["offset"] == 2

    # Over-limit is rejected, not silently clamped
    r = client.get("/api/v1/scans?limit=10000")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"

    r = client.get("/api/v1/findings?limit=999")
    assert r.status_code == 422

    r = client.get("/api/v1/projects?limit=0")
    assert r.status_code == 422


def test_health_discloses_job_mode_and_auth(client):
    body = client.get("/api/v1/health").json()
    assert body["jobs"]["mode"] == "in_process_local_dev"
    assert body["jobs"]["durable"] is False
    assert body["jobs"]["restart_behavior"] == "interrupted_jobs_marked_failed"
    assert body["jobs"]["retry_endpoint"] == "POST /api/v1/scans/{id}/retry"
    assert "single_user_bootstrap" in body["auth"]


def test_retry_only_failed_scans(client, seeded_project):
    pid, rev = seeded_project
    r = client.post(
        "/api/v1/scans",
        json={"projectId": pid, "revisionId": rev, "scanType": "AST Static Analysis (SAST)"},
    )
    scan_id = r.json()["scanId"]
    scan = wait_for_scan(client, scan_id)
    assert scan["statusRaw"] == "completed"

    # Completed scans are not retryable
    r = client.post(f"/api/v1/scans/{scan_id}/retry")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "not_retryable"


def test_failed_scan_can_be_retried(client, seeded_project):
    pid, rev = seeded_project
    r = client.post(
        "/api/v1/scans",
        json={"projectId": pid, "revisionId": rev, "scanType": "AST Static Analysis (SAST)"},
    )
    scan_id = r.json()["scanId"]
    wait_for_scan(client, scan_id)

    # Force a failed state (simulates an interrupted/restart-killed job).
    from app.db import SessionLocal
    from app.models import ScanJob
    from app.models.base import utcnow

    db = SessionLocal()
    try:
        job = db.get(ScanJob, scan_id)
        job.status = "failed"
        job.error_code = "interrupted_by_restart"
        job.finished_at = utcnow()
        db.commit()
    finally:
        db.close()

    r = client.post(f"/api/v1/scans/{scan_id}/retry")
    assert r.status_code == 202, r.text
    assert r.json()["scanId"] == scan_id  # same job record reused
    scan = wait_for_scan(client, scan_id)
    assert scan["statusRaw"] == "completed"
    assert scan["error"] is None  # error cleared after successful retry
