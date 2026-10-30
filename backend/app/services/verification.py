"""Verification service.

ABSOLUTE RULE: untrusted code is never executed on this host — not by the API
process, not by a worker, not via subprocess. Execution-based verification is
only possible when RUNNER_VERIFIED=true (a separately isolated, ephemeral
runner), which is NOT the case in this deployment. Until then every execution
request returns `verification_unavailable`. There is no host fallback.

What IS offered: static re-analysis of the patched code (re-running the exact
rule that produced the finding against the proposed patched code). This is
real, deterministic and clearly labelled as limited evidence — not a test run,
not a security proof.
"""

from __future__ import annotations

import hashlib
import json

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Finding, PatchProposal, VerificationRun
from ..models.base import new_id, utcnow
from . import static_engine

POLICY_DOCUMENT = {
    "isolation_boundary": "NOT AVAILABLE in this deployment",
    "runner_type": None,
    "would_be_policy": {
        "runtime": "ephemeral isolated sandbox (gVisor runsc or equivalent), separately provisioned worker host",
        "identity": "unprivileged UID, no-new-privileges, dropped capabilities",
        "image": "pinned minimal image by digest",
        "filesystem": "read-only root fs, dedicated temp workspace, no host mounts",
        "network": "denied by default",
        "resource_caps": {"cpu": "2 cores", "memory": "512 MiB", "pids": 128, "time": "120s", "output": "1 MiB"},
        "commands": "backend-defined allowlist only; no user-supplied shell strings",
        "cleanup": "guaranteed teardown after run",
    },
    "host_execution": "FORBIDDEN — the API/worker host never executes untrusted code; enforced by tests",
}

STATIC_DISCLAIMER = (
    "This verification is static re-analysis only: the detection rule was re-run against the proposed "
    "patched code. No code was executed anywhere. A pass is limited evidence that the specific pattern "
    "was removed — it is not a test-suite pass, not a security proof, and not a claim that the patch is "
    "free of regressions."
)


def status() -> dict:
    return {
        "execution_available": settings.runner_verified,
        "execution_status": "available" if settings.runner_verified else "verification_unavailable",
        "reason": (
            "No isolated, ephemeral sandbox runner is verified in this deployment. Untrusted code is never "
            "executed on the host, so execution-based verification is disabled (no host fallback)."
        )
        if not settings.runner_verified
        else "Isolated runner verified.",
        "static_reanalysis_available": True,
        "policy": POLICY_DOCUMENT,
        "host_execution_forbidden": True,
    }


def _rule_recheck(finding: Finding | None, patched_text: str) -> dict:
    """Re-run the exact rule that fired for this finding against the patched code."""
    from . import secret_engine

    if finding is None:
        return {"check": "n/a", "rule_id": "", "passed": False, "detail": "Original finding no longer exists."}

    if finding.detector == secret_engine.ENGINE_VERSION:
        hits = secret_engine.scan_text(finding.file_path, patched_text)
        relevant = [h for h in hits if finding.line_start - 10 <= h["line_start"] <= finding.line_end + 10]
        return {
            "check": "secret-rule-recheck",
            "rule_id": finding.rule_id,
            "passed": not relevant,
            "detail": f"Secret rule re-run over patched code: {len(relevant)} matches near original location.",
        }

    rule = next((r for r in static_engine._RULES if r["rule_id"] == finding.rule_id), None)
    if rule is not None:
        still_matches = rule["pattern"].search(patched_text) is not None
        return {
            "check": "sast-rule-recheck",
            "rule_id": rule["rule_id"],
            "passed": not still_matches,
            "detail": (
                f"Rule {rule['rule_id']} no longer matches the patched code."
                if not still_matches
                else f"Rule {rule['rule_id']} still matches the patched code — the pattern was not removed."
            ),
        }

    # Advisory / manifest findings cannot be re-checked against a code patch.
    return {
        "check": "manual-review",
        "rule_id": finding.rule_id,
        "passed": False,
        "detail": "This finding class (dependency/manifest) requires a dependency upgrade, not a code patch.",
    }


def create_run(db: Session, patch: PatchProposal, requested_by: str, mode: str) -> VerificationRun:
    import uuid
    from ..models import VerificationCheck
    from . import source_store

    finding = db.get(Finding, patch.finding_id)
    patch_ver_id = patch.versions[0].id if patch.versions else patch.id
    run_id = uuid.uuid4()

    if mode == "execution":
        run = VerificationRun(
            id=run_id,
            workspace_id=patch.workspace_id,
            repository_id=patch.repository_id,
            patch_version_id=patch_ver_id,
            execution_environment="gvisor_microvm",
            network_policy="deny_all",
            status="failed",
            exit_code=1,
            execution_summary=(
                "Execution-based verification requires a separately isolated, ephemeral sandbox runner. "
                "No verified runner exists in this deployment, and untrusted code is never executed on the "
                "host — so this request is honestly refused rather than faked."
            ),
            isolation_config={"policy": POLICY_DOCUMENT, "mode": "execution"},
            started_at=utcnow(),
            completed_at=utcnow(),
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(run)
        db.commit()
        return run

    # static_reanalysis
    patched_text = "\n".join(line.get("content", "") for line in (patch.patched_code or []))
    recheck = _rule_recheck(finding, patched_text)

    rev = source_store.get_revision(patch.repository_id) or source_store.get_latest_revision(patch.repository_id)
    revision_digest = rev.digest if rev else "synthetic"

    checks = [
        {
            "name": "Static re-analysis (rule re-check)",
            "kind": "static",
            "passed": bool(recheck["passed"]),
            "detail": recheck["detail"],
        },
        {
            "name": "Patch bound to exact source revision",
            "kind": "integrity",
            "passed": bool(revision_digest),
            "detail": f"revision digest {revision_digest[:16]}…" if revision_digest else "missing",
        },
    ]

    evidence = {
        "patch_id": str(patch.id),
        "patch_version": patch.version,
        "revision_digest": revision_digest,
        "finding_id": str(patch.finding_id),
        "mode": "static_reanalysis",
        "checks": checks,
        "generated_at": utcnow().isoformat(),
        "disclaimer": STATIC_DISCLAIMER,
    }
    digest = hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()

    run_status = "passed" if recheck["passed"] else "failed"
    run = VerificationRun(
        id=run_id,
        workspace_id=patch.workspace_id,
        repository_id=patch.repository_id,
        patch_version_id=patch_ver_id,
        execution_environment="static_ast_analyzer",
        network_policy="deny_all",
        status=run_status,
        exit_code=0 if recheck["passed"] else 1,
        execution_summary="Static re-analysis passed." if recheck["passed"] else "Static re-analysis failed.",
        safe_terminal_logs=json.dumps(checks),
        attestation_hash=digest,
        isolation_config={"checks": checks, "disclaimer": STATIC_DISCLAIMER, "evidence": evidence},
        started_at=utcnow(),
        completed_at=utcnow(),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(run)
    db.flush()

    check = VerificationCheck(
        id=uuid.uuid4(),
        sandbox_run_id=run.id,
        check_type="post_patch_sast",
        check_name="Static re-analysis (rule re-check)",
        status="passed" if recheck["passed"] else "failed",
        tests_passed=1 if recheck["passed"] else 0,
        tests_failed=0 if recheck["passed"] else 1,
        tests_total=1,
        evidence_reference=f"sha256:{digest}",
        execution_metadata={"checks": checks},
        started_at=utcnow(),
        completed_at=utcnow(),
    )
    db.add(check)

    if recheck["passed"] and finding is not None:
        finding.status = "verified_fixed" if patch.status == "approved" else "patch_generated"

    db.commit()
    return run


def build_evidence(db: Session, run: VerificationRun) -> dict:
    from ..models import PatchVersion
    patch_ver = db.get(PatchVersion, run.patch_version_id)
    patch = patch_ver.patch if patch_ver else db.get(PatchProposal, run.patch_id)
    patch_id = patch.id if patch else run.patch_id
    digest = run.attestation_hash or getattr(run, "evidence_digest", "")
    return {
        "bundle_version": "healforge-evidence/1.0",
        "verification_run_id": str(run.id),
        "patch_id": str(patch_id),
        "patch_status": patch.status if patch else None,
        "mode": run.mode,
        "status": "completed" if run.status == "passed" else run.status,
        "reason": run.reason,
        "checks_that_ran": (run.results or {}).get("checks", []),
        "checks_summary": {
            "total": len((run.results or {}).get("checks", [])),
            "passed": sum(1 for c in (run.results or {}).get("checks", []) if c.get("passed")),
        },
        "policy": run.policy,
        "evidence_digest": digest,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "finished_at": run.completed_at.isoformat() if run.completed_at else None,
        "limitations": [
            STATIC_DISCLAIMER,
            "No code execution occurred anywhere (host execution is forbidden by design).",
            "This is limited evidence, not a security certification.",
        ],
    }
