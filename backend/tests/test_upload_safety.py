"""Upload safety: zip-slip, symlinks, bombs, size/count limits, extension allowlist."""

from __future__ import annotations

import io
import zipfile

from conftest import make_zip


def _upload(client, pid: str, data: bytes, filename: str = "x.zip"):
    return client.post(f"/api/v1/projects/{pid}/sources", files={"file": (filename, data, "application/zip")})


def _mk_project(client) -> str:
    r = client.post("/api/v1/projects", json={"name": "upload-tests", "runtime": "python"})
    return r.json()["project"]["id"]


def test_happy_path_text_only(client):
    pid = _mk_project(client)
    r = _upload(client, pid, make_zip({"a.py": "x = 1\n", "sub/b.js": "const y = 2;\n"}))
    assert r.status_code == 200
    assert r.json()["revision"]["textFileCount"] == 2


def test_zip_slip_rejected(client):
    pid = _mk_project(client)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("../../etc/cron.d/evil", "payload")
    r = _upload(client, pid, buf.getvalue())
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "unsafe_path"


def test_absolute_path_rejected(client):
    pid = _mk_project(client)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("/etc/passwd", "root:x:0:0")
    r = _upload(client, pid, buf.getvalue())
    assert r.status_code == 422


def test_backslash_traversal_rejected(client):
    pid = _mk_project(client)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("..\\..\\windows\\evil.txt", "payload")
    r = _upload(client, pid, buf.getvalue())
    assert r.status_code == 422


def test_symlink_entry_rejected(client):
    pid = _mk_project(client)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        # external_attr encodes a symlink (S_IFLNK) mode.
        info = zipfile.ZipInfo("link.txt")
        info.create_system = 3
        info.external_attr = 0o120777 << 16
        z.writestr(info, "/etc/passwd")
    r = _upload(client, pid, buf.getvalue())
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "symlink_rejected"


def test_not_a_zip_rejected(client):
    pid = _mk_project(client)
    r = _upload(client, pid, b"this is not a zip file at all")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "not_a_zip"


def test_oversized_single_file_skipped(client):
    pid = _mk_project(client)
    big = "x" * (300 * 1024)  # > 256 KB per-file cap
    r = _upload(client, pid, make_zip({"ok.py": "a=1\n", "big.txt": big}))
    assert r.status_code == 200
    skipped = [s for s in r.json()["revision"]["skipped"] if s["reason"] == "file_exceeds_size_limit"]
    assert skipped, "oversized file must be skipped with a reason"


def test_binary_content_skipped(client):
    pid = _mk_project(client)
    r = _upload(client, pid, make_zip({"ok.py": "a = 1\n", "blob.py": "\x00\x01\x02binary"}))
    assert r.status_code == 200
    skipped = [s for s in r.json()["revision"]["skipped"] if "binary" in s["reason"] or "utf8" in s["reason"]]
    assert skipped, "binary content must be skipped with a reason"
    assert r.json()["revision"]["textFileCount"] == 1


def test_executable_extension_skipped(client):
    pid = _mk_project(client)
    r = _upload(client, pid, make_zip({"run.sh": "echo hi\n", "tool.exe": "MZ....", "notes.txt": "hello\n"}))
    assert r.status_code == 200
    paths_skipped = [s["path"] for s in r.json()["revision"]["skipped"]]
    assert "tool.exe" in paths_skipped
    assert "run.sh" not in paths_skipped  # .sh is an allowed text extension
    assert r.json()["revision"]["textFileCount"] == 2


def test_no_text_files_rejected(client):
    pid = _mk_project(client)
    r = _upload(client, pid, make_zip({"image.png": "\x89PNG binary"}))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "no_text_files"


def test_too_many_entries_rejected(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_archive_entries", 5)
    pid = _mk_project(client)
    files = {f"f{i}.py": f"x = {i}\n" for i in range(10)}
    r = _upload(client, pid, make_zip(files))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "too_many_entries"


def test_zip_bomb_ratio_rejected(client):
    pid = _mk_project(client)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("ok.py", "a = 1\n")
        z.writestr("bomb2.py", "a" * (2 * 1024 * 1024))  # 2 MB of 'a' compresses to ~2 KB
    r = _upload(client, pid, buf.getvalue())
    # Either the entry is skipped by the per-file cap or the archive is rejected as a bomb.
    assert r.status_code in (200, 422)
    if r.status_code == 200:
        skipped = r.json()["revision"]["skipped"]
        assert any(
            s["path"] == "bomb2.py" and s["reason"] in ("file_exceeds_size_limit", "total_text_budget_exceeded")
            for s in skipped
        ), skipped
        assert r.json()["revision"]["textFileCount"] == 1


def test_duplicate_project_name_rejected(client):
    client.post("/api/v1/projects", json={"name": "dup", "runtime": "python"})
    r = client.post("/api/v1/projects", json={"name": "dup", "runtime": "python"})
    assert r.status_code == 409
