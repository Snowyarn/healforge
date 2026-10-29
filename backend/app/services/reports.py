"""Report generation from persisted records. Every report records exactly which
checks ran (engine versions, model enrichment state) — no fabricated evidence."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ..models import (
    Finding,
    PatchProposal,
    Project,
    Report,
    ScanJob,
    SourceRevision,
    VerificationRun,
)
from ..models.base import new_id, utcnow
from . import static_engine
from .pdfgen import build_pdf

REPORT_TYPES = ("vulnerability-summary", "scan-audit", "project-assessment")
FORMATS = ("PDF", "Markdown", "JSON")


def _findings_summary(
    db: Session, workspace_id: str, project_id: str | None = None, scan_id: str | None = None
) -> dict:
    q = db.query(Finding).filter(Finding.workspace_id == workspace_id, Finding.status == "open")
    if project_id:
        q = q.filter(Finding.project_id == project_id)
    if scan_id:
        q = q.filter(Finding.scan_id == scan_id)
    findings = q.order_by(Finding.cvss_score.desc()).all()
    by_severity = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    by_cwe: dict[str, int] = {}
    by_owasp: dict[str, int] = {}
    for f in findings:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        cwe_key = f.cwe.split(":")[0] if f.cwe else "n/a"
        by_cwe[cwe_key] = by_cwe.get(cwe_key, 0) + 1
        if f.owasp_category:
            by_owasp[f.owasp_category] = by_owasp.get(f.owasp_category, 0) + 1
    return {
        "findings": findings,
        "by_severity": by_severity,
        "by_cwe": by_cwe,
        "by_owasp": by_owasp,
        "total": len(findings),
    }


def generate_report(
    db: Session,
    workspace_id: str,
    report_type: str,
    fmt: str,
    project_id: str | None,
    scan_id: str | None,
    generated_by: str,
) -> Report:
    if report_type not in REPORT_TYPES:
        raise ValueError("invalid_report_type")
    if fmt not in FORMATS:
        raise ValueError("invalid_format")

    project = db.get(Project, project_id) if project_id else None
    scan = db.get(ScanJob, scan_id) if scan_id else None
    summary_data = _findings_summary(db, workspace_id, project_id, scan_id)
    revisions = db.query(SourceRevision).filter(SourceRevision.project_id == project.id).count() if project else 0
    scans_count = (
        db.query(ScanJob).filter(ScanJob.workspace_id == workspace_id).count()
        if project_id is None
        else db.query(ScanJob).filter(ScanJob.project_id == project.id).count()
    )
    patches = db.query(PatchProposal).filter(PatchProposal.workspace_id == workspace_id).all()
    verifications = db.query(VerificationRun).filter(VerificationRun.workspace_id == workspace_id).all()

    if report_type == "vulnerability-summary":
        title = f"Vulnerability Summary — {project.name if project else 'Workspace'}"
        summary = (
            f"{summary_data['total']} open findings "
            f"({summary_data['by_severity']['Critical']} critical, {summary_data['by_severity']['High']} high)."
        )
    elif report_type == "scan-audit":
        title = f"Scan Audit — {scan.scan_type if scan else 'unknown scan'}"
        summary = (
            f"Scan {scan.id if scan else 'n/a'} status {scan.status if scan else 'n/a'} with "
            f"{scan.findings_count if scan else 0} findings; full log trail retained."
        )
    else:
        title = f"Project Assessment — {project.name if project else 'Workspace'}"
        summary = (
            f"{revisions} source revisions, {scans_count} scans, {summary_data['total']} open findings, "
            f"{len(patches)} patch proposals, {len(verifications)} verification runs."
        )

    checks_that_ran = []
    if scan is not None and scan.engine_versions:
        for engine, version in scan.engine_versions.items():
            if version:
                checks_that_ran.append(f"{engine}: {version}")
    else:
        checks_that_ran.append(f"static: {static_engine.ENGINE_VERSION}")
    checks_that_ran.append("secret detection: pattern + entropy rules")
    if scan is not None:
        checks_that_ran.append(f"model enrichment: {scan.model_enrichment}")

    payload = {
        "title": title,
        "report_type": report_type,
        "project": project.name if project else None,
        "scan_id": scan.id if scan else None,
        "generated_at": utcnow().isoformat(),
        "generated_by": generated_by,
        "summary": summary,
        "severity_breakdown": summary_data["by_severity"],
        "cwe_distribution": summary_data["by_cwe"],
        "owasp_distribution": summary_data["by_owasp"],
        "top_findings": [
            {
                "id": f.display_id,
                "title": f.title,
                "severity": f.severity,
                "cwe": f.cwe,
                "file": f.file_path,
                "lines": f"{f.line_start}-{f.line_end}",
                "detector": f.detector,
                "cvss_basis": f.cvss_basis,
            }
            for f in summary_data["findings"][:25]
        ],
        "patches": [
            {"id": p.id, "finding": p.finding_id, "status": p.status, "generator": p.generator} for p in patches[:25]
        ],
        "verifications": [
            {"id": v.id, "patch": v.patch_id, "mode": v.mode, "status": v.status} for v in verifications[:25]
        ],
        "checks_that_ran": checks_that_ran,
        "limitations": [
            "CVSS scores are static estimates (cvss_basis: estimated-static) unless stated otherwise.",
            "Model-generated analysis (if present) is AI context, not verification evidence.",
            "Verification entries list exactly which checks ran; execution-based verification is "
            "unavailable in this deployment.",
        ],
    }

    report = Report(
        id=new_id("rpt"),
        workspace_id=workspace_id,
        report_type=report_type,
        title=title[:250],
        project_id=project_id,
        scan_id=scan_id,
        summary=summary,
        findings_count=summary_data["total"],
        critical_count=summary_data["by_severity"]["Critical"],
        format=fmt,
        payload=payload,
        generated_by=generated_by[:120],
        created_at=utcnow(),
    )
    db.add(report)
    db.commit()
    return report


def render_report(report: Report) -> tuple[bytes, str, str]:
    """Return (bytes, media_type, filename)."""
    p = report.payload or {}
    fname_base = f"HealForge-Report-{report.id}"
    if report.format == "JSON":
        return json.dumps(p, indent=2).encode(), "application/json", f"{fname_base}.json"
    if report.format == "Markdown":
        lines = [f"# {p.get('title', report.title)}", ""]
        lines += [
            f"- Generated: {p.get('generated_at')}",
            f"- By: {p.get('generated_by')}",
            f"- Summary: {p.get('summary')}",
            "",
        ]
        lines.append("## Severity breakdown")
        for k, v in (p.get("severity_breakdown") or {}).items():
            lines.append(f"- {k}: {v}")
        lines.append("")
        lines.append("## Checks that ran")
        for c in p.get("checks_that_ran", []):
            lines.append(f"- {c}")
        lines.append("")
        lines.append("## Top findings")
        for f in p.get("top_findings", []):
            lines.append(f"- **{f['id']}** ({f['severity']}) {f['title']} — {f['file']}:{f['lines']} [{f['detector']}]")
        lines.append("")
        lines.append("## Limitations")
        for lim in p.get("limitations", []):
            lines.append(f"- {lim}")
        return "\n".join(lines).encode(), "text/markdown", f"{fname_base}.md"
    # PDF
    sections: list[tuple[str, str]] = [
        (p.get("title", report.title), ""),
        ("Summary", p.get("summary", "")),
        ("Generated", f"{p.get('generated_at')} by {p.get('generated_by')}"),
        ("Severity breakdown", json.dumps(p.get("severity_breakdown") or {}, indent=1)),
        ("CWE distribution", json.dumps(p.get("cwe_distribution") or {}, indent=1)),
        ("Checks that ran", "\n".join(f"- {c}" for c in p.get("checks_that_ran", []))),
        (
            "Top findings",
            "\n".join(
                f"{f['id']} ({f['severity']}) {f['title']} — {f['file']}:{f['lines']} [{f['detector']}]"
                for f in p.get("top_findings", [])[:15]
            ),
        ),
        ("Limitations", "\n".join(f"- {lim}" for lim in p.get("limitations", []))),
    ]
    return build_pdf(report.title, sections), "application/pdf", f"{fname_base}.pdf"
