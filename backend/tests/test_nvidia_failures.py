"""Risk 6 regression: NVIDIA provider failure matrix.

Every failure mode the provider can produce is mapped to an honest, typed
error code — and none of the errors ever leak the API key, source code, or
provider response text. All provider responses here are MOCKED (tests only);
the live application never mocks the provider.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import nvidia

FAKE_KEY = "nvapi-TESTKEYdoNOTuseEVERinPROD"


@pytest.fixture()
def configured(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "nvidia_api_key", FAKE_KEY)
    return settings


def _provider(monkeypatch, *, content=None, choices=None, exc=None, usage=None):
    """Patch nvidia._client to a fake OpenAI-compatible client (tests only)."""
    captured: dict = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured["request"] = kwargs
            if exc is not None:
                raise exc
            return SimpleNamespace(
                choices=choices if choices is not None else [SimpleNamespace(message=SimpleNamespace(content=content))],
                usage=usage,
            )

    class FakeClient:
        def __init__(self):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(nvidia, "_client", lambda: FakeClient())
    return captured


FINDING = {
    "title": "SQL Injection",
    "cwe": "CWE-89",
    "severity": "Critical",
    "file_path": "app/db.py",
    "line_start": 5,
    "line_end": 5,
    "description": "f-string SQL",
}


def _enrich():
    return nvidia.enrich_finding(FINDING, "cursor.execute(f'SELECT {user_id}')", "digest123")


# ------------------------------------------------------------------ happy path


def test_valid_response_is_parsed_and_bounded(configured, monkeypatch):
    _provider(
        monkeypatch,
        content='{"impact": "row exfiltration", "recommendation": "use parameters", "confidence": "high"}',
    )
    data, prov = _enrich()
    assert data["impact"] == "row exfiltration"
    assert prov.model_id  # provenance recorded


# ------------------------------------------------------------------- error modes


def test_missing_key_is_honest(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "nvidia_api_key", "")
    with pytest.raises(nvidia.NvidiaNotConfigured):
        _enrich()


def test_auth_failure(configured, monkeypatch):
    _provider(monkeypatch, exc=RuntimeError("401 Unauthorized: invalid api key"))
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_auth_failed"


def test_rate_limited(configured, monkeypatch):
    _provider(monkeypatch, exc=RuntimeError("429 rate limit exceeded"))
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_rate_limited"


def test_timeout(configured, monkeypatch):
    _provider(monkeypatch, exc=RuntimeError("Request timed out after 60s"))
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_timeout"


def test_provider_outage(configured, monkeypatch):
    _provider(monkeypatch, exc=ConnectionError("connection refused"))
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_request_failed"
    assert "connection refused" not in ei.value.message  # provider text never surfaced


def test_empty_choices(configured, monkeypatch):
    _provider(monkeypatch, choices=[])
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_invalid_output"


def test_none_content(configured, monkeypatch):
    _provider(monkeypatch, content=None)
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_invalid_output"


def test_refusal(configured, monkeypatch):
    _provider(monkeypatch, content="I cannot assist with this request.")
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_refusal"


def test_malformed_json(configured, monkeypatch):
    _provider(monkeypatch, content='```json\n{"impact": "unterminated\n```')
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_invalid_output"


def test_non_object_json(configured, monkeypatch):
    _provider(monkeypatch, content='{"result": [1, 2, 3]} extra')  # parses to dict, missing impact
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_invalid_output"


def test_schema_mismatch_missing_impact(configured, monkeypatch):
    _provider(monkeypatch, content='{"something": "else"}')
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        _enrich()
    assert ei.value.code == "nvidia_invalid_output"


def test_patch_schema_mismatch_missing_code(configured, monkeypatch):
    _provider(monkeypatch, content='{"title": "x", "description": "y"}')
    with pytest.raises(nvidia.NvidiaRequestError) as ei:
        nvidia.synthesize_patch(FINDING, "code", "digest")
    assert ei.value.code == "nvidia_invalid_output"


def test_unexpected_field_types_are_bounded(configured, monkeypatch):
    _provider(
        monkeypatch,
        content='{"impact": {"nested": "object"}, "recommendation": 42, "confidence": "ultra"}',
    )
    data, _prov = _enrich()
    assert isinstance(data["impact"], str) and len(data["impact"]) <= 4000
    assert data["confidence"] == "medium"  # invalid enum falls back, never crashes


# ------------------------------------------------------------------- no leakage


def test_no_key_or_source_leakage_across_all_failures(configured, monkeypatch):
    source = "AWS_SECRET = 'AKIAIOSFODNN7EXAMPLE'"
    cases = [
        RuntimeError("401 Unauthorized key nvapi-TESTKEYdoNOTuseEVERinPROD rejected"),
        RuntimeError("429 rate limited"),
        RuntimeError("timed out"),
        ConnectionError(f"boom {source}"),
    ]
    for exc in cases:
        _provider(monkeypatch, exc=exc)
        with pytest.raises(nvidia.NvidiaRequestError) as ei:
            nvidia.enrich_finding(FINDING, source, "digest")
        msg = ei.value.message
        assert FAKE_KEY not in msg, "API key leaked in error message"
        assert "AKIA" not in msg, "source secret leaked in error message"


def test_patch_fields_are_length_bounded(configured, monkeypatch):
    _provider(
        monkeypatch,
        content='{"title": "'
        + "T" * 5000
        + '", "description": "'
        + "D" * 100000
        + '", "patched_code": "'
        + "C" * 100000
        + '"}',
    )
    data, _ = nvidia.synthesize_patch(FINDING, "code", "digest")
    assert len(data["title"]) <= 250
    assert len(data["description"]) <= 4000
    assert len(data["patched_code"]) <= 20000
