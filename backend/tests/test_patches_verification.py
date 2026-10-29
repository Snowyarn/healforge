"""Patch review lifecycle and verification honesty (no host execution, ever)."""

from __future__ import annotations

import pytest
from conftest import wait_for_scan


@pytest.fixture()
def patch_row(seeded_project, client):
    """Create a patch proposal directly (NVIDIA not configured in tests) for review tests."""
    from app.db import session_scope
    from app.models import Finding, PatchProposal
    from app.models.base import new_id, utcnow

    pid, rev = seeded_project
    r = client.post(
        "/api/v1/scans",
        json={
            "projectId": pid,
            "revisionId": rev,
            "scanType": "AST Static Analysis (SAST)",
            "options": {"taintFlow": True, "modelEnrichment": False},
        },
    )
    scan = wait_for_scan(client, r.json()["scanId"])
    findings = client.get(f"/api/v1/scans/{scan['id']}/findings").json()["findings"]
    f = findings[0]

    db = session_scope()
    try:
        finding = db.query(Finding).filter(Finding.id == f["internalId"]).first()
        patched = 'cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))'
        patch = PatchProposal(
            id=new_id("pat"),
            workspace_id=finding.workspace_id,
            finding_id=finding.id,
            project_id=finding.project_id,
            revision_id=finding.revision_id,
            version=1,
            title="Parameterize user lookup query",
            description="Replace f-string SQL with a bound parameter.",
            file_path=finding.file_path,
            lines_range=f"L{finding.line_start}-L{finding.line_end}",
            added_count=1,
            removed_count=1,
            diff='- cursor.execute(f"... \'{user_id}\'")\n+ cursor.execute("... ?", (user_id,))',
            original_code=[
                {
                    "lineNumber": finding.line_start,
                    "content": f"cursor.execute(f\"SELECT * FROM users WHERE id = '{finding.line_start}'\")",
                    "type": "removed",
                }
            ],
            patched_code=[{"lineNumber": finding.line_start, "content": patched, "type": "added"}],
            rationale={
                "syntaxConventions": "SQLite parameter binding",
                "dependencySafety": "No new deps",
                "performanceImpact": "None",
            },
            generator="test-fixture",
            status="pending_review",
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(patch)
        db.commit()
        return {"patchId": patch.id, "findingInternalId": finding.id, "findingDisplayId": finding.display_id}
    finally:
        db.close()


def test_patch_detail_shape(client, patch_row):
    r = client.get(f"/api/v1/patches/{patch_row['patchId']}")
    assert r.status_code == 200
    p = r.json()["patch"]
    assert p["status"] == "Pending Review"
    assert p["vulnerabilityId"] == patch_row["findingDisplayId"]
    assert p["verificationLog"], "honest log must mention unavailable execution or checks"
    assert any("UNAVAILABLE" in ln for ln in p["verificationLog"])


def test_review_lifecycle_and_version_conflict(client, patch_row):
    pid = patch_row["patchId"]
    # Wrong expected version is rejected (optimistic concurrency).
    r = client.post(f"/api/v1/patches/{pid}/review", json={"action": "approve", "expectedVersion": 99})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "version_conflict"
    # Legit approve.
    r = client.post(f"/api/v1/patches/{pid}/review", json={"action": "approve", "expectedVersion": 1, "notes": "lgtm"})
    assert r.status_code == 200
    assert r.json()["patch"]["status"] == "Approved"
    # Double review rejected.
    r = client.post(f"/api/v1/patches/{pid}/review", json={"action": "reject", "expectedVersion": 1})
    assert r.status_code == 409
    # Finding got resolved by approval.
    d = client.get(f"/api/v1/findings/{patch_row['findingInternalId']}").json()["finding"]
    assert d["status"] == "resolved"
    assert d["autofixStatus"] == "Applied"
    # Review history visible.
    p = client.get(f"/api/v1/patches/{pid}").json()["patch"]
    assert p["reviews"][0]["action"] == "approve"


def test_request_changes_flow(client, patch_row):
    r = client.post(
        f"/api/v1/patches/{patch_row['patchId']}/review",
        json={"action": "request_changes", "expectedVersion": 1, "notes": "bind params properly"},
    )
    assert r.status_code == 200
    p = r.json()["patch"]
    assert p["status"] == "Changes Requested"
    assert p["reviews"][0]["notes"] == "bind params properly"


def test_execution_verification_refused_honestly(client, patch_row):
    r = client.post("/api/v1/verification-runs", json={"patchId": patch_row["patchId"], "mode": "execution"})
    assert r.status_code == 202
    run = r.json()["run"]
    assert run["status"] == "verification_unavailable"
    assert "never executed" in run["reason"].lower() or "isolated" in run["reason"].lower()


def test_static_reanalysis_real_result(client, patch_row):
    r = client.post("/api/v1/verification-runs", json={"patchId": patch_row["patchId"], "mode": "static_reanalysis"})
    assert r.status_code == 202
    run = r.json()["run"]
    assert run["status"] == "completed", run
    checks = run["checks"]
    assert checks[0]["name"].startswith("Static re-analysis")
    assert checks[0]["passed"] is True  # patched code removed the f-string SQL
    assert run["evidenceDigest"]
    assert "No code was executed" in run["disclaimer"]

    # Evidence bundle download matches the record.
    ev = client.get(f"/api/v1/verification-runs/{run['id']}/evidence")
    assert ev.status_code == 200
    body = ev.json()
    assert body["patch_id"] == patch_row["patchId"]
    assert body["checks_summary"]["passed"] >= 1
    assert body["limitations"]

    # The run is listed for the patch.
    runs = client.get(f"/api/v1/verification-runs?patchId={patch_row['patchId']}").json()["runs"]
    assert any(x["id"] == run["id"] for x in runs)


def test_verified_fixes_requires_real_verification_and_approval(client, patch_row):
    # Before verification: no verified fixes.
    assert client.get("/api/v1/verified-fixes").json()["fixes"] == []
    # Approve + static verify.
    client.post(f"/api/v1/patches/{patch_row['patchId']}/review", json={"action": "approve", "expectedVersion": 1})
    client.post("/api/v1/verification-runs", json={"patchId": patch_row["patchId"], "mode": "static_reanalysis"})
    fixes = client.get("/api/v1/verified-fixes").json()["fixes"]
    assert len(fixes) == 1
    fix = fixes[0]
    assert fix["verificationResult"] == "Static Analysis Verified"
    assert fix["regressionRisk"] == "Not Execution-Verified"
    assert fix["attestationKind"].startswith("sha256-evidence-digest")


def test_verification_status_policy(client):
    st = client.get("/api/v1/verification/status").json()
    assert st["execution_available"] is False
    assert st["host_execution_forbidden"] is True
    assert st["policy"]["would_be_policy"]["network"] == "denied by default"
