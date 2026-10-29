"""Secret & token detection: specific provider patterns + guarded generic-assignment
matching + entropy. Runs on stored text — never executes anything. Also provides
redaction of matched values before any external model submission."""

from __future__ import annotations

import math
import re

ENGINE_VERSION = "healforge-secret-engine/1.0"

_SPECIFIC_RULES: list[dict] = [
    {
        "rule_id": "HF-SEC-001",
        "name": "AWS Access Key ID",
        "severity": "Critical",
        "pattern": re.compile(r"AKIA[0-9A-Z]{16}"),
        "redact_hint": "aws-access-key-id",
    },
    {
        "rule_id": "HF-SEC-002",
        "name": "GitHub Personal Access Token",
        "severity": "Critical",
        "pattern": re.compile(r"gh[pousr]_[A-Za-z0-9]{36,255}"),
        "redact_hint": "github-pat",
    },
    {
        "rule_id": "HF-SEC-003",
        "name": "Google API Key",
        "severity": "Critical",
        "pattern": re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
        "redact_hint": "google-api-key",
    },
    {
        "rule_id": "HF-SEC-004",
        "name": "Slack Token",
        "severity": "High",
        "pattern": re.compile(r"xox[baprs]-[0-9A-Za-z\-]{10,}"),
        "redact_hint": "slack-token",
    },
    {
        "rule_id": "HF-SEC-005",
        "name": "JSON Web Token",
        "severity": "High",
        "pattern": re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]*"),
        "redact_hint": "jwt",
    },
    {
        "rule_id": "HF-SEC-006",
        "name": "Private Key Material",
        "severity": "Critical",
        "pattern": re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"),
        "redact_hint": "private-key",
    },
]

_GENERIC_RE = re.compile(
    r"(?i)\b([a-z][a-z0-9_\-]*(?:password|passwd|secret|api[_-]?key|access[_-]?key|auth[_-]?key|"
    r"private[_-]?key|client[_-]?secret|token|credential)[a-z0-9_\-]*)\b"
    r"[\s\"']{0,4}[:=][\s\"']{0,4}['\"]([^'\"\s]{10,128})['\"]"
)

_PLACEHOLDER_RE = re.compile(
    r"(?i)^(x+|\.+|\*+|change[_-]?me|placeholder|example|your[_-].*|test[_-]?.*|dummy|sample|secret[_-]?here|key[_-]?here|"
    r"[0-9]+|none|null|undefined|true|false|password|secret|token|\$\{.*\}|%s|\{\{.*\}\}|<.*>|\[.*\])$"
)

_COMMON_VALUES = {
    "password",
    "secret",
    "token",
    "changeme",
    "example",
    "welcome",
    "letmein",
    "admin",
    "keyboard cat",
    "supersecret",
    "your_api_key_here",
    "xxxxxxxxxxxx",
    "1234567890",
}


def shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts: dict[str, int] = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    n = len(value)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _is_generic_secret_plausible(value: str) -> bool:
    if _PLACEHOLDER_RE.match(value) or value.lower() in _COMMON_VALUES:
        return False
    if value.isdigit():
        return False
    if re.fullmatch(r"[0-9.]+", value) or re.fullmatch(r"[a-z_]+", value):
        return False
    entropy = shannon_entropy(value)
    has_mixed = bool(re.search(r"[a-zA-Z]", value) and re.search(r"[0-9_-]", value))
    return entropy >= 3.4 or (entropy >= 3.0 and has_mixed)


def scan_text(path: str, text: str) -> list[dict]:
    """Return secret findings for one file (line-anchored, values NOT included in evidence)."""
    findings: list[dict] = []
    lines = text.split("\n")
    seen_spans: set[tuple[int, int, str]] = set()

    def add(rule_id: str, name: str, severity: str, line_no: int, redact_hint: str, value: str):
        key = (line_no, line_no, rule_id)
        if key in seen_spans:
            return
        seen_spans.add(key)
        findings.append(
            {
                "rule_id": rule_id,
                "name": name,
                "severity": severity,
                "line_start": line_no,
                "line_end": line_no,
                "redact_hint": redact_hint,
                "value": value,  # internal only — never persisted or returned to clients
                "evidence_line": lines[line_no - 1][:200] if 0 < line_no <= len(lines) else "",
            }
        )

    for rule in _SPECIFIC_RULES:
        for m in rule["pattern"].finditer(text):
            line_no = text.count("\n", 0, m.start()) + 1
            add(rule["rule_id"], rule["name"], rule["severity"], line_no, rule["redact_hint"], m.group(0))

    for m in _GENERIC_RE.finditer(text):
        value = m.group(2)
        if not _is_generic_secret_plausible(value):
            continue
        line_no = text.count("\n", 0, m.start()) + 1
        add("HF-SEC-100", "Hardcoded Credential (pattern + entropy)", "High", line_no, "credential", value)

    return findings


def redact_secrets(text: str, secret_findings: list[dict]) -> str:
    """Replace exact matched secret values with labelled placeholders before external submission."""
    redacted = text
    for f in secret_findings:
        value = f.get("value")
        if value and len(value) >= 6:
            redacted = redacted.replace(value, f"[REDACTED:{f['redact_hint']}]")
    return redacted


def redact_line(line: str) -> str:
    """Redact anything after an assignment for a key-looking context (used for evidence)."""
    m = _GENERIC_RE.search(line)
    if m:
        return line[: m.start(2)] + "[REDACTED]"
    for rule in _SPECIFIC_RULES:
        if rule["pattern"].search(line):
            return rule["pattern"].sub(f"[REDACTED:{rule['redact_hint']}]", line)
    return line
