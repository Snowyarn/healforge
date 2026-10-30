"""Tests for Nebius Token Factory AI Provider integration.

Validates:
1. Honest unconfigured state when NEBIUS_API_KEY is missing.
2. Successful finding enrichment and patch synthesis via Nebius Token Factory.
3. Strict error mapping without credential or payload leakage.
4. Secret redaction defense prior to model dispatch.
5. Model listing / discovery.
6. Live Nebius execution path when NEBIUS_API_KEY is supplied.
"""

from __future__ import annotations

import json
import os
from types import SimpleNamespace

import pytest

from app.config import settings
from app.services import ai_provider

FAKE_NEBIUS_KEY = "neb-TESTKEYdoNOTuseEVERinPROD12345"


@pytest.fixture()
def configured_nebius(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "nebius")
    monkeypatch.setattr(settings, "nebius_api_key", FAKE_NEBIUS_KEY)
    monkeypatch.setattr(settings, "nebius_base_url", "https://api.tokenfactory.nebius.com/v1")
    monkeypatch.setattr(settings, "nebius_model", "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF")
    return settings


def _mock_nebius(monkeypatch, *, content=None, choices=None, exc=None, usage=None):
    """Patch OpenAI client used in ai_provider._get_client_and_model."""
    captured: dict = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured["request"] = kwargs
            if exc is not None:
                raise exc
            return SimpleNamespace(
                choices=choices if choices is not None else [SimpleNamespace(message=SimpleNamespace(content=content))],
                usage=usage or SimpleNamespace(prompt_tokens=42, completion_tokens=88),
            )

    class FakeModels:
        def list(self):
            return SimpleNamespace(
                data=[
                    SimpleNamespace(id="nvidia/Llama-3.1-Nemotron-70B-Instruct-HF"),
                    SimpleNamespace(id="meta-llama/Meta-Llama-3.1-70B-Instruct"),
                ]
            )

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())
            self.models = FakeModels()

    monkeypatch.setattr(ai_provider, "OpenAI", FakeClient)
    return captured


FINDING = {
    "title": "SQL Injection in User Lookup",
    "cwe": "CWE-89",
    "severity": "Critical",
    "file_path": "app/users.py",
    "line_start": 42,
    "line_end": 45,
    "description": "User input directly interpolated into SQL string.",
    "remediation": "Use parameterized queries.",
}


def test_nebius_unconfigured_raises_typed_error(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "nebius")
    monkeypatch.setattr(settings, "nebius_api_key", "")
    with pytest.raises(ai_provider.AiNotConfigured) as exc:
        ai_provider.enrich_finding(FINDING, "code context", "rev123")
    assert "NEBIUS_API_KEY is not set" in str(exc.value)


def test_nebius_enrich_finding_success(configured_nebius, monkeypatch):
    fake_json = json.dumps(
        {
            "impact": "Remote attacker can dump full database contents.",
            "recommendation": "Replace format strings with bind variables.",
            "confidence": "high",
            "exploit_scenario": "Pass `' OR 1=1 --` into user_id field.",
        }
    )
    captured = _mock_nebius(monkeypatch, content=fake_json)

    analysis, prov = ai_provider.enrich_finding(FINDING, "query = f'SELECT * FROM users WHERE id = {uid}'", "sha256abc")
    assert analysis["confidence"] == "high"
    assert "Remote attacker" in analysis["impact"]
    assert prov.provider == "nebius"
    assert prov.model_id == "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF"
    assert captured["request"]["model"] == "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF"


def test_nebius_synthesize_patch_success(configured_nebius, monkeypatch):
    fake_patch = json.dumps(
        {
            "title": "Parameterize SQL query in user lookup",
            "description": "Replaces f-string with positional parameter binding.",
            "patched_code": "cursor.execute('SELECT * FROM users WHERE id = %s', (uid,))",
            "rationale": {
                "syntax_conventions": "Standard DB-API 2.0 placeholder syntax.",
                "dependency_safety": "Uses existing database driver.",
                "performance_impact": "Negligible.",
            },
        }
    )
    captured = _mock_nebius(monkeypatch, content=fake_patch)

    patch, prov = ai_provider.synthesize_patch(
        FINDING,
        "cursor.execute(f'SELECT * FROM users WHERE id = {uid}')",
        "sha256abc",
    )
    assert "cursor.execute" in patch["patched_code"]
    assert "%s" in patch["patched_code"]
    assert prov.provider == "nebius"
    assert captured["request"]["max_tokens"] == settings.nebius_max_output_tokens


def test_nebius_auth_failure_mapping(configured_nebius, monkeypatch):
    _mock_nebius(monkeypatch, exc=RuntimeError("401 Client Error: Unauthorized for url https://..."))
    with pytest.raises(ai_provider.AiRequestError) as exc:
        ai_provider.enrich_finding(FINDING, "some code", "rev123")
    assert exc.value.code == "nebius_auth_failed"
    assert FAKE_NEBIUS_KEY not in str(exc.value)


def test_nebius_rate_limit_mapping(configured_nebius, monkeypatch):
    _mock_nebius(monkeypatch, exc=RuntimeError("429 Too Many Requests: Rate limit exceeded"))
    with pytest.raises(ai_provider.AiRequestError) as exc:
        ai_provider.enrich_finding(FINDING, "some code", "rev123")
    assert exc.value.code == "nebius_rate_limited"


def test_nebius_timeout_mapping(configured_nebius, monkeypatch):
    _mock_nebius(monkeypatch, exc=RuntimeError("Request timed out after 60 seconds"))
    with pytest.raises(ai_provider.AiRequestError) as exc:
        ai_provider.enrich_finding(FINDING, "some code", "rev123")
    assert exc.value.code == "nebius_timeout"


def test_nebius_refusal_detection(configured_nebius, monkeypatch):
    refusal_msg = "I cannot assist with generating exploit scenarios or code for this vulnerability."
    _mock_nebius(monkeypatch, content=refusal_msg)
    with pytest.raises(ai_provider.AiRequestError) as exc:
        ai_provider.enrich_finding(FINDING, "some code", "rev123")
    assert exc.value.code == "ai_refusal"


def test_nebius_secret_redaction_before_dispatch(configured_nebius, monkeypatch):
    code_with_secret = (
        'AWS_KEY = "AKIAIOSFODNN7EXAMPLE"\n'
        'GITHUB_TOKEN = "ghp_TESTTOKENdoNOTuseEVERinPROD123456789"\n'
        "cursor.execute(f\"SELECT * FROM users WHERE id = '{user_id}'\")\n"
    )
    fake_json = json.dumps({"impact": "i", "recommendation": "r", "confidence": "low", "exploit_scenario": "s"})
    captured = _mock_nebius(monkeypatch, content=fake_json)

    ai_provider.enrich_finding(FINDING, code_with_secret, "rev123")
    sent_prompt = captured["request"]["messages"][1]["content"]
    assert "AKIAIOSFODNN7EXAMPLE" not in sent_prompt
    assert "ghp_TESTTOKENdoNOTuseEVERinPROD123456789" not in sent_prompt
    assert "[REDACTED:aws-access-key-id]" in sent_prompt
    assert "[REDACTED:github-pat]" in sent_prompt


def test_nebius_list_models(configured_nebius, monkeypatch):
    _mock_nebius(monkeypatch)
    models = ai_provider.list_nebius_models()
    assert "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF" in models


def test_nebius_status_reporting(configured_nebius):
    stat = ai_provider.status()
    assert stat["configured"] is True
    assert stat["active_provider"] == "nebius"
    assert stat["nebius"]["base_url"] == "https://api.tokenfactory.nebius.com/v1"
    assert stat["model_id"] == "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF"


@pytest.mark.skipif(
    not os.environ.get("NEBIUS_API_KEY"),
    reason="Live Nebius test requires real NEBIUS_API_KEY in environment",
)
def test_live_nebius_token_factory_e2e():
    """Live verification test against real Nebius Token Factory endpoints.

    Only runs when NEBIUS_API_KEY is supplied in the execution environment.
    """
    settings.ai_provider = "nebius"
    settings.nebius_api_key = os.environ["NEBIUS_API_KEY"]

    models = ai_provider.list_nebius_models()
    assert len(models) > 0, "Nebius Token Factory returned an empty model list."

    analysis, prov = ai_provider.enrich_finding(
        FINDING,
        "query = f'SELECT * FROM accounts WHERE id = {acc_id}'",
        "live-test-digest",
    )
    assert analysis["confidence"] in ("high", "medium", "low")
    assert prov.provider == "nebius"
    assert prov.duration_ms > 0
