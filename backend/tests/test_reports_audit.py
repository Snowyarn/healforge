"""Reports, audit trail, bug reports, evidence upload safety."""

from __future__ import annotations


def test_report_generation_all_formats(client, seeded_project):
    pid, rev = seeded_project
    from conftest import wait_for_scan

    r = client.post(
        "/api/v1/scans",
        json={
            "projectId": pid,
            "revisionId": rev,
            "scanType": "AST Static Analysis (SAST)",
            "options": {"taintFlow": False, "modelEnrichment": False},
        },
    )
    scan = wait_for_scan(client, r.json()["scanId"])

    for fmt, marker in (("JSON", b"{"), ("Markdown", b"# "), ("PDF", b"%PDF-")):
        r = client.post(
            "/api/v1/reports",
            json={"type": "vulnerability-summary", "format": fmt, "projectId": pid, "scanId": scan["id"]},
        )
        assert r.status_code == 201, r.text
        report = r.json()["report"]
        assert report["checksThatRan"], "reports must state which checks ran"
        rid = report["id"]
        dl = client.get(f"/api/v1/reports/{rid}/download")
        assert dl.status_code == 200
        assert dl.content.startswith(marker), f"{fmt} payload invalid"
    # Invalid type/format rejected.
    assert client.post("/api/v1/reports", json={"type": "bogus", "format": "JSON"}).status_code == 422
    assert client.post("/api/v1/reports", json={"type": "scan-audit", "format": "Word"}).status_code == 422


def test_scan_audit_report_lists_logs(client, seeded_project):
    from conftest import wait_for_scan

    pid, rev = seeded_project
    r = client.post(
        "/api/v1/scans",
        json={
            "projectId": pid,
            "revisionId": rev,
            "scanType": "Secret & Token Detection",
            "options": {"taintFlow": False, "modelEnrichment": False},
        },
    )
    scan = wait_for_scan(client, r.json()["scanId"])
    r = client.post("/api/v1/reports", json={"type": "scan-audit", "format": "JSON", "scanId": scan["id"]})
    assert r.status_code == 201
    payload = r.json()["report"]
    assert payload["summary"].startswith("Scan ")


def test_bug_report_crud_and_validation(client, seeded_project):
    pid, _ = seeded_project
    r = client.post(
        "/api/v1/bug-reports",
        json={
            "title": "Auth bypass candidate",
            "description": "Session check missing on endpoint X",
            "category": "Authorization Bypass",
            "severity": "High",
            "affectedRepo": "seeded-api",
            "affectedFile": "app/db.py",
            "stepsToReproduce": "call /api/x",
            "expectedBehavior": "401",
            "actualBehavior": "200",
            "projectId": pid,
        },
    )
    assert r.status_code == 201
    report_id = r.json()["report"]["id"]
    assert report_id.startswith("BUG-")
    # Invalid category/severity rejected.
    bad = {
        "title": "x" * 5,
        "description": "y" * 10,
        "category": "Crypto",
        "severity": "High",
        "affectedRepo": "seeded-api",
        "affectedFile": "a.py",
    }
    assert client.post("/api/v1/bug-reports", json=bad).status_code == 422
    # Evidence upload: text accepted, executable rejected.
    r = client.post(
        f"/api/v1/bug-reports/{report_id}/evidence", files={"file": ("poc.txt", b"step 1: do thing", "text/plain")}
    )
    assert r.status_code == 200 and r.json()["sha256"]
    r = client.post(
        f"/api/v1/bug-reports/{report_id}/evidence",
        files={"file": ("poc.exe", b"MZ\x90\x00", "application/octet-stream")},
    )
    assert r.status_code == 422
    r = client.post(
        f"/api/v1/bug-reports/{report_id}/evidence", files={"file": ("big.txt", b"a" * (3 * 1024 * 1024), "text/plain")}
    )
    assert r.status_code == 413
    # List contains our report.
    reports = client.get("/api/v1/bug-reports").json()["reports"]
    assert any(b["id"] == report_id for b in reports)


def test_every_mutation_writes_audit(client, seeded_project):
    before = len(client.get("/api/v1/audit-events").json()["events"])
    client.patch("/api/v1/account/profile", json={"bio": "audit test"})
    client.post("/api/v1/account/api-keys", json={"name": "kk", "scopes": [], "expiryDays": 0})
    client.post("/api/v1/account/team", json={"name": "Cara", "email": "cara@example.com", "role": "Viewer"})
    after = client.get("/api/v1/audit-events").json()["events"]
    assert len(after) >= before + 3
    categories = {e["category"] for e in after}
    assert {"Security", "Profile", "Team", "API"} & categories
    # Filters work.
    profile_events = client.get("/api/v1/audit-events", params={"category": "Profile"}).json()["events"]
    assert all(e["category"] == "Profile" for e in profile_events)


def test_notifications_flow(client, seeded_project):
    from conftest import wait_for_scan

    pid, rev = seeded_project
    r = client.post(
        "/api/v1/scans",
        json={
            "projectId": pid,
            "revisionId": rev,
            "scanType": "Secret & Token Detection",
            "options": {"taintFlow": False, "modelEnrichment": False},
        },
    )
    wait_for_scan(client, r.json()["scanId"])
    notes = client.get("/api/v1/notifications").json()
    assert notes["unread"] >= 1
    nid = notes["notifications"][0]["id"]
    assert client.post(f"/api/v1/notifications/{nid}/read").status_code == 200
    assert client.get("/api/v1/notifications").json()["unread"] == notes["unread"] - 1
