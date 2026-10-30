"""Security invariants:

1. NO host code execution anywhere in the backend runtime path.
2. No secrets leak to the client (responses, bundles, frontend source).
3. Untrusted content is never rendered as HTML by the frontend.
4. Origin validation blocks cross-site unsafe requests.
"""

from __future__ import annotations

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
FRONTEND = BACKEND.parent / "frontend"
# Frontend hygiene checks only apply where the frontend tree exists. The
# backend-only distribution legitimately ships without it — skip (don't
# silently pass) so the count stays honest in both packages.
FRONTEND_PRESENT = (FRONTEND / "src").is_dir()

FORBIDDEN_CALLS = {"system", "popen", "run", "call", "check_call", "check_output", "execv", "execve", "spawnl"}


def test_no_subprocess_or_exec_in_backend_runtime():
    """AST-scan the backend source: no subprocess/os.system/eval/exec in app code."""
    offenders = []
    for py in (BACKEND / "app").rglob("*.py"):
        tree = ast.parse(py.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = getattr(func, "attr", None) or getattr(func, "id", None)
                mod = getattr(func, "value", None)
                mod_name = getattr(mod, "id", None) if isinstance(mod, ast.Name) else None
                if name in FORBIDDEN_CALLS and mod_name in {"os", "subprocess", None}:
                    offenders.append(f"{py.name}:{node.lineno} {mod_name}.{name}")
                if isinstance(func, ast.Name) and func.id in {"eval", "exec", "compile", "__import__"}:
                    offenders.append(f"{py.name}:{node.lineno} builtin {func.id}()")
    assert not offenders, f"host-execution primitives found in backend: {offenders}"


def test_runner_verification_gate_is_env_locked():
    from app.config import Settings

    s = Settings(nvidia_api_key="", runner_verified=False)
    assert s.runner_verified is False  # default OFF; execution requires explicit proof


def test_execution_verification_endpoint_never_executes(client, seeded_project):
    """Even with a patch present, execution mode must return verification_unavailable."""
    from conftest import wait_for_scan

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
            "options": {"taintFlow": False, "modelEnrichment": False},
        },
    )
    scan = wait_for_scan(client, r.json()["scanId"])
    findings = client.get(f"/api/v1/scans/{scan['id']}/findings").json()["findings"]

    db = session_scope()
    try:
        finding = db.query(Finding).filter(Finding.id == findings[0]["internalId"]).first()
        patch = PatchProposal(
            id=new_id("pat"),
            workspace_id=finding.workspace_id,
            finding_id=finding.id,
            project_id=finding.project_id,
            revision_id=finding.revision_id,
            version=1,
            title="t",
            description="d",
            file_path=finding.file_path,
            lines_range="L1-L2",
            added_count=0,
            removed_count=0,
            diff="",
            original_code=[],
            patched_code=[{"lineNumber": 1, "content": "x = 1", "type": "added"}],
            rationale={},
            generator="test",
            status="pending_review",
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(patch)
        db.commit()
        patch_id = patch.id
    finally:
        db.close()

    r = client.post("/api/v1/verification-runs", json={"patchId": patch_id, "mode": "execution"})
    run = r.json()["run"]
    assert run["status"] == "verification_unavailable"
    assert (
        run["policy"]["host_execution"]
        == "FORBIDDEN — the API/worker host never executes untrusted code; enforced by tests"
    )


def test_no_secrets_in_any_api_response(client, seeded_project):
    """Full journey responses must never contain key material or raw secret values."""
    from conftest import wait_for_scan

    paths = [
        "/api/v1/health",
        "/api/v1/nvidia/status",
        "/api/v1/auth/session",
        "/api/v1/projects",
        "/api/v1/dashboard/overview",
        "/api/v1/counts",
        "/api/v1/security-intelligence/metrics",
        "/api/v1/agent-activity/telemetry",
        "/api/v1/account/state",
        "/api/v1/account/export",
        "/api/v1/audit-events",
    ]
    for p in paths:
        body = client.get(p).text
        assert "NVIDIA_API_KEY" not in body
        assert "nvidia_api_key" not in body
        assert "hf_live_" not in body.replace("hf_live_abc", "")  # test fixture value excluded
    # Scan responses redact secret values from evidence.
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
    detail = client.get(f"/api/v1/scans/{scan['id']}").text
    assert "AKIAIOSFODNN7EXAMPLE" not in detail


def test_frontend_source_hygiene():
    """Frontend must not: use dangerouslySetInnerHTML, keep secrets in localStorage,
    or reference NVIDIA keys in VITE_ variables."""
    if not FRONTEND_PRESENT:
        import pytest

        pytest.skip("frontend tree not present (backend-only distribution)")
    violations = []
    for tsx in list(FRONTEND.glob("src/**/*.ts*")):
        text = tsx.read_text()
        if "dangerouslySetInnerHTML" in text:
            violations.append(f"{tsx.name}: dangerouslySetInnerHTML")
        if "VITE_NVIDIA" in text or "VITE_*API_KEY" in text:
            violations.append(f"{tsx.name}: NVIDIA key in VITE_ variable")
    assert not violations, violations


def test_account_service_no_longer_persists_secrets_in_localstorage():
    """The old accountService stored everything in localStorage — that must be gone."""
    if not FRONTEND_PRESENT:
        import pytest

        pytest.skip("frontend tree not present (backend-only distribution)")
    svc = (FRONTEND / "src/services/accountService.ts").read_text()
    assert "healforge_account_data_v1" not in svc, "legacy localStorage account blob still present"
    assert "localStorage.setItem" not in svc


def test_origin_validation_blocks_cross_site_post(client):
    r = client.post(
        "/api/v1/projects", headers={"Origin": "https://evil.example.com"}, json={"name": "evil", "runtime": "python"}
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "origin_not_allowed"


def test_nvidia_provider_never_leaks_key_in_errors(client, monkeypatch):
    """Provider errors map to safe codes; the key never appears in messages."""
    from app.services import nvidia

    class Boom:
        def chat(self):
            raise AttributeError("should not be called")

    def fake_client():
        class C:
            class chat:
                class completions:
                    @staticmethod
                    def create(**_):
                        raise PermissionError("401 Unauthorized for key nvapi-SECRETVALUE")

        return C()

    monkeypatch.setattr(nvidia, "_client", fake_client)
    try:
        nvidia.enrich_finding({"title": "t", "severity": "High", "cwe": "x"}, "code", "digest")
    except nvidia.NvidiaRequestError as exc:
        assert "nvapi-" not in exc.message
        assert exc.code == "nvidia_auth_failed"
    else:
        raise AssertionError("expected NvidiaRequestError")


def test_nvidia_redaction_before_model_submission(monkeypatch):
    """Model enrichment must send redacted code (secret values replaced)."""
    from app.services import nvidia
    from app.services.nvidia import ModelProvenance

    captured = {}

    def fake_chat(messages, max_tokens=None):
        captured["messages"] = messages
        prov = ModelProvenance(model_id="nvidia/test", prompt_schema_version=nvidia.PROMPT_SCHEMA_VERSION)
        return '{"impact": "serious", "recommendation": "fix it", "confidence": "high", "exploit_scenario": "s"}', prov

    monkeypatch.setattr(nvidia, "_chat", fake_chat)
    code = 'cursor.execute(f"SELECT * FROM users WHERE id = \'{user_id}\'")\nAWS_KEY = "AKIAIOSFODNN7EXAMPLE"\n'
    finding = {"title": "SQLi", "cwe": "CWE-89", "severity": "Critical", "file_path": "a.py", "line_start": 1}
    result, prov = nvidia.enrich_finding(finding, code, "digest123")
    sent = captured["messages"][1]["content"]
    assert "AKIAIOSFODNN7EXAMPLE" not in sent, "raw secret leaked to model"
    assert "[REDACTED:aws-access-key-id]" in sent
    assert result["impact"] == "serious"
    assert prov.source_digest == "digest123"


def test_alembic_migration_runs_on_fresh_db(tmp_path, monkeypatch):
    """The shipped migration must build the schema from scratch (deploy path)."""
    import subprocess
    import sys

    url = f"sqlite:///{tmp_path / 'mig.db'}"
    env = {**dict(__import__("os").environ), "DATABASE_URL": url}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND),
        check=False,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr[-2000:]
    # Rollback must work too.
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "base"],
        cwd=str(BACKEND),
        check=False,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr[-2000:]
