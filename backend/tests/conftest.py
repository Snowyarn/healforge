"""Shared fixtures: isolated temp DB, app client, workspace helpers."""

from __future__ import annotations

import io
import os
import zipfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Tests explicitly opt into single-user local-dev bootstrap (the production
# default is fail-closed: HEALFORGE_SINGLE_USER defaults to false).
os.environ.setdefault("HEALFORGE_SINGLE_USER", "true")
os.environ.setdefault("HEALFORGE_ENV", "local")


@pytest.fixture(autouse=True)
def _reset_rate_limit_buckets():
    """Test isolation: rate-limit buckets are process-global and the shared
    single-user bootstrap actor would otherwise inherit limits across tests."""
    from app.security import rate_limit as _rl

    _rl._BUCKETS.clear()
    yield
    _rl._BUCKETS.clear()


@pytest.fixture()
def temp_db_url(tmp_path, monkeypatch) -> str:
    url = f"sqlite:///{tmp_path / 'test.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    # Rebuild engine/session factories for the isolated DB.
    import importlib

    import app.db as db_mod

    new_engine = db_mod._make_engine(url)
    db_mod.engine = new_engine
    db_mod.SessionLocal.configure(bind=new_engine)
    import app.models  # noqa: F401
    from app.db import Base

    Base.metadata.create_all(bind=new_engine)
    yield url
    new_engine.dispose()
    _ = importlib


@pytest.fixture()
def client(temp_db_url):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


VULNERABLE_ZIP_FILES = {
    "app/db.py": (
        "import sqlite3\n\n"
        "from flask import request\n\n"
        "@app.route('/user')\n"
        "def get_user(user_id):\n"
        "    conn = sqlite3.connect('app.db')\n"
        "    cursor = conn.cursor()\n"
        "    cursor.execute(f\"SELECT * FROM users WHERE id = '{user_id}'\")\n"
        "    return cursor.fetchone()\n"
    ),
    "app/config.py": ('AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"\nSECRET_TOKEN = "hf_live_abc123def456ghi789xyz0"\n'),
    "requirements.txt": "flask==1.0\nrequests==2.25.0\npyyaml==5.3.1\n",
    "Dockerfile": (
        "FROM python:3.11\n"
        "RUN pip install -r requirements.txt\n"
        "COPY . /app\n"
        'ENV API_TOKEN="sk_live_abcdef1234567890abcdef"\n'
        'CMD ["python", "app.py"]\n'
    ),
}


def make_zip(files: dict[str, str] | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, content in (files if files is not None else VULNERABLE_ZIP_FILES).items():
            z.writestr(name, content)
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture()
def seeded_project(client):
    """Create a project + imported vulnerable source; returns (project_id, revision_id)."""
    r = client.post("/api/v1/projects", json={"name": "seeded-api", "description": "seed", "runtime": "python"})
    assert r.status_code == 201, r.text
    pid = r.json()["project"]["id"]
    r = client.post(f"/api/v1/projects/{pid}/sources", files={"file": ("seed.zip", make_zip(), "application/zip")})
    assert r.status_code == 200, r.text
    return pid, r.json()["revision"]["id"]


def wait_for_scan(client, scan_id: str, timeout_s: float = 15.0) -> dict:
    import time

    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        r = client.get(f"/api/v1/scans/{scan_id}")
        scan = r.json()["scan"]
        if scan["statusRaw"] in ("completed", "failed", "cancelled"):
            return scan
        time.sleep(0.25)
    raise TimeoutError(f"scan {scan_id} did not finish in {timeout_s}s")
