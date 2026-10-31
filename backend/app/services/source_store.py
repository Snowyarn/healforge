"""Ephemeral and disk cache for imported repository sources.

Supabase PostgreSQL is the authoritative system of record for all business data
(workspaces, repositories, analyses, findings, patches, reviews, sandbox runs, audit logs).
Because Supabase PostgreSQL does not store full multi-megabyte source code files,
source archives and files are maintained in this local cache store.
"""

from __future__ import annotations

import os
import sqlite3
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime

DB_PATH = os.environ.get("HEALFORGE_SOURCE_DB", ":memory:")


def _utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class SourceRevision:
    id: str
    project_id: str
    digest: str
    archive_filename: str = "archive.zip"
    branch_label: str = "main"
    size_bytes: int = 0
    file_count: int = 0
    text_file_count: int = 0
    total_text_bytes: int = 0
    created_by: str = ""
    created_at: datetime = field(default_factory=_utcnow)
    skipped: list = field(default_factory=list)


@dataclass
class SourceFile:
    id: str
    revision_id: str
    path: str
    is_dir: bool = False
    size: int = 0
    language: str = "text"
    content: str | None = None
    content_sha256: str = ""
    line_count: int = 0


# Shared in-memory connection container for serverless lifecycle (zero /tmp disk I/O)
_MEM_STORE: dict[str, sqlite3.Connection | None] = {"conn": None}


def _get_conn() -> sqlite3.Connection:
    conn = _MEM_STORE["conn"]
    if conn is None:
        try:
            from ..db import init_db

            init_db()
        except Exception:  # noqa: S110, BLE001
            pass
        if DB_PATH == ":memory:" or not DB_PATH:
            conn = sqlite3.connect(
                "file:healforge_mem?mode=memory&cache=shared", uri=True, check_same_thread=False
            )
        else:
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS source_revisions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                digest TEXT,
                archive_filename TEXT,
                branch_label TEXT,
                size_bytes INTEGER,
                file_count INTEGER,
                text_file_count INTEGER,
                total_text_bytes INTEGER,
                created_by TEXT,
                created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS source_files (
                id TEXT PRIMARY KEY,
                revision_id TEXT,
                path TEXT,
                is_dir INTEGER,
                size INTEGER,
                language TEXT,
                content TEXT,
                content_sha256 TEXT,
                line_count INTEGER
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rev_proj ON source_revisions (project_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_rev ON source_files (revision_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_path ON source_files (revision_id, path)")
        conn.commit()
        _MEM_STORE["conn"] = conn
    return conn


def save_revision(
    project_id: str | uuid.UUID,
    digest: str,
    archive_filename: str,
    branch_label: str,
    files: Sequence[object],
    user_id: str | uuid.UUID = "",
    revision_id: str | None = None,
) -> SourceRevision:
    rev_id = revision_id or str(uuid.uuid4())
    proj_id_str = str(project_id)
    uid_str = str(user_id)
    now = _utcnow()
    total_bytes = sum(getattr(f, "size", 0) for f in files)
    text_files = [f for f in files if not getattr(f, "is_dir", False)]

    rev = SourceRevision(
        id=rev_id,
        project_id=proj_id_str,
        digest=digest,
        archive_filename=archive_filename,
        branch_label=branch_label,
        size_bytes=total_bytes,
        file_count=len(files),
        text_file_count=len(text_files),
        total_text_bytes=total_bytes,
        created_by=uid_str,
        created_at=now,
    )

    with _get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO source_revisions
            (id, project_id, digest, archive_filename, branch_label,
             size_bytes, file_count, text_file_count, total_text_bytes,
             created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                rev.id,
                rev.project_id,
                rev.digest,
                rev.archive_filename,
                rev.branch_label,
                rev.size_bytes,
                rev.file_count,
                rev.text_file_count,
                rev.total_text_bytes,
                rev.created_by,
                now.isoformat(),
            ),
        )

        for f in files:
            file_id = getattr(f, "id", None) or str(uuid.uuid4())
            conn.execute(
                """
                INSERT OR REPLACE INTO source_files
                (id, revision_id, path, is_dir, size, language, content, content_sha256, line_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    file_id,
                    rev_id,
                    getattr(f, "path", ""),
                    1 if getattr(f, "is_dir", False) else 0,
                    getattr(f, "size", 0),
                    getattr(f, "language", "text"),
                    getattr(f, "content", None),
                    getattr(f, "content_sha256", ""),
                    getattr(f, "line_count", 0),
                ),
            )
        conn.commit()

    return rev


def get_revision(revision_id: str | uuid.UUID) -> SourceRevision | None:
    rev_id_str = str(revision_id)
    with _get_conn() as conn:
        cur = conn.execute(
            """
            SELECT id, project_id, digest, archive_filename, branch_label,
                   size_bytes, file_count, text_file_count, total_text_bytes, created_by, created_at
            FROM source_revisions WHERE id = ?
        """,
            (rev_id_str,),
        )
        row = cur.fetchone()
        if not row:
            return None
        created_at = datetime.fromisoformat(row[10]) if row[10] else _utcnow()
        return SourceRevision(
            id=row[0],
            project_id=row[1],
            digest=row[2],
            archive_filename=row[3],
            branch_label=row[4],
            size_bytes=row[5],
            file_count=row[6],
            text_file_count=row[7],
            total_text_bytes=row[8],
            created_by=row[9],
            created_at=created_at,
        )


def get_latest_revision(project_id: str | uuid.UUID) -> SourceRevision | None:
    proj_id_str = str(project_id)
    with _get_conn() as conn:
        cur = conn.execute(
            """
            SELECT id, project_id, digest, archive_filename, branch_label,
                   size_bytes, file_count, text_file_count, total_text_bytes, created_by, created_at
            FROM source_revisions WHERE project_id = ?
            ORDER BY created_at DESC LIMIT 1
        """,
            (proj_id_str,),
        )
        row = cur.fetchone()
        if not row:
            return None
        created_at = datetime.fromisoformat(row[10]) if row[10] else _utcnow()
        return SourceRevision(
            id=row[0],
            project_id=row[1],
            digest=row[2],
            archive_filename=row[3],
            branch_label=row[4],
            size_bytes=row[5],
            file_count=row[6],
            text_file_count=row[7],
            total_text_bytes=row[8],
            created_by=row[9],
            created_at=created_at,
        )


def list_revisions(project_id: str | uuid.UUID) -> list[SourceRevision]:
    proj_id_str = str(project_id)
    with _get_conn() as conn:
        cur = conn.execute(
            """
            SELECT id, project_id, digest, archive_filename, branch_label,
                   size_bytes, file_count, text_file_count, total_text_bytes, created_by, created_at
            FROM source_revisions WHERE project_id = ?
            ORDER BY created_at DESC
        """,
            (proj_id_str,),
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            created_at = datetime.fromisoformat(row[10]) if row[10] else _utcnow()
            result.append(
                SourceRevision(
                    id=row[0],
                    project_id=row[1],
                    digest=row[2],
                    archive_filename=row[3],
                    branch_label=row[4],
                    size_bytes=row[5],
                    file_count=row[6],
                    text_file_count=row[7],
                    total_text_bytes=row[8],
                    created_by=row[9],
                    created_at=created_at,
                )
            )
        return result


def get_files(revision_id: str | uuid.UUID) -> list[SourceFile]:
    rev_id_str = str(revision_id)
    with _get_conn() as conn:
        cur = conn.execute(
            """
            SELECT id, revision_id, path, is_dir, size, language, content, content_sha256, line_count
            FROM source_files WHERE revision_id = ?
            ORDER BY path ASC
        """,
            (rev_id_str,),
        )
        rows = cur.fetchall()
        return [
            SourceFile(
                id=row[0],
                revision_id=row[1],
                path=row[2],
                is_dir=bool(row[3]),
                size=row[4],
                language=row[5],
                content=row[6],
                content_sha256=row[7],
                line_count=row[8],
            )
            for row in rows
        ]


def get_file(revision_id: str | uuid.UUID, path: str) -> SourceFile | None:
    rev_id_str = str(revision_id)
    with _get_conn() as conn:
        cur = conn.execute(
            """
            SELECT id, revision_id, path, is_dir, size, language, content, content_sha256, line_count
            FROM source_files WHERE revision_id = ? AND path = ?
            LIMIT 1
        """,
            (rev_id_str, path),
        )
        row = cur.fetchone()
        if not row:
            return None
        return SourceFile(
            id=row[0],
            revision_id=row[1],
            path=row[2],
            is_dir=bool(row[3]),
            size=row[4],
            language=row[5],
            content=row[6],
            content_sha256=row[7],
            line_count=row[8],
        )


DOCKER_GO_CONTENT = """package handlers

import (
	"context"
	"net/http"
	"strings"
)

// HandleDockerAuth verifies inbound authorization plugin tokens.
func HandleDockerAuth(w http.ResponseWriter, r *http.Request) {
	pluginHeader := r.Header.Get("X-Docker-Auth-Plugin")
	if pluginHeader == "" || strings.HasPrefix(pluginHeader, "bypass/") {
		ctx := context.WithValue(r.Context(), "role", "anonymous")
		return
	}
	w.WriteHeader(http.StatusOK)
}
"""

MERGE_JS_CONTENT = """function deepMerge(target, source) {
  for (let key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

module.exports = { deepMerge };
"""

REPORTS_GO_CONTENT = """package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
)

func GenerateReport(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	filter := r.URL.Query().Get("filter")
	query := fmt.Sprintf("SELECT id, amount, status FROM transactions WHERE status = '%s'", filter)
	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	w.WriteHeader(http.StatusOK)
}
"""


def get_demo_files(demo_key: str) -> list[SourceFile]:
    """Retrieve pre-packaged mock repository source files for quick demo."""
    import hashlib

    key = demo_key.strip().lower()
    if "payment" in key:
        return [
            SourceFile(
                id="demo-reports-go",
                revision_id="",
                path="backend/handlers/reports.go",
                is_dir=False,
                size=len(REPORTS_GO_CONTENT),
                language="go",
                content=REPORTS_GO_CONTENT,
                content_sha256=hashlib.sha256(REPORTS_GO_CONTENT.encode()).hexdigest(),
                line_count=len(REPORTS_GO_CONTENT.splitlines()),
            ),
        ]
    return [
        SourceFile(
            id="demo-docker-go",
            revision_id="",
            path="api/handlers/docker.go",
            is_dir=False,
            size=len(DOCKER_GO_CONTENT),
            language="go",
            content=DOCKER_GO_CONTENT,
            content_sha256=hashlib.sha256(DOCKER_GO_CONTENT.encode()).hexdigest(),
            line_count=len(DOCKER_GO_CONTENT.splitlines()),
        ),
        SourceFile(
            id="demo-merge-js",
            revision_id="",
            path="lib/utils/merge.js",
            is_dir=False,
            size=len(MERGE_JS_CONTENT),
            language="javascript",
            content=MERGE_JS_CONTENT,
            content_sha256=hashlib.sha256(MERGE_JS_CONTENT.encode()).hexdigest(),
            line_count=len(MERGE_JS_CONTENT.splitlines()),
        ),
    ]


def seed_default_sources():
    """Populate default source files for seeded Supabase analyses."""
    # 1. auth-service: revision 40000000-0000-0000-0000-000000000001
    auth_rev_id = "40000000-0000-0000-0000-000000000001"
    auth_proj_id = "20000000-0000-0000-0000-000000000001"
    if not get_revision(auth_rev_id):
        files = [
            SourceFile(
                id="sfl-docker-go",
                revision_id=auth_rev_id,
                path="api/handlers/docker.go",
                is_dir=False,
                size=len(DOCKER_GO_CONTENT),
                language="go",
                content=DOCKER_GO_CONTENT,
                content_sha256="sha-docker-go",
                line_count=len(DOCKER_GO_CONTENT.splitlines()),
            ),
            SourceFile(
                id="sfl-merge-js",
                revision_id=auth_rev_id,
                path="lib/utils/merge.js",
                is_dir=False,
                size=len(MERGE_JS_CONTENT),
                language="javascript",
                content=MERGE_JS_CONTENT,
                content_sha256="sha-merge-js",
                line_count=len(MERGE_JS_CONTENT.splitlines()),
            ),
        ]
        save_revision(
            project_id=auth_proj_id,
            digest="c42e190f84a1e94017a421b8c6e2671bf5039a01",
            archive_filename="auth-service-v1.zip",
            branch_label="main",
            files=files,
            user_id="00000000-0000-0000-0000-000000000001",
            revision_id=auth_rev_id,
        )

    # 2. payments-api: revision 40000000-0000-0000-0000-000000000002
    payments_rev_id = "40000000-0000-0000-0000-000000000002"
    payments_proj_id = "20000000-0000-0000-0000-000000000002"
    if not get_revision(payments_rev_id):
        files = [
            SourceFile(
                id="sfl-reports-go",
                revision_id=payments_rev_id,
                path="backend/handlers/reports.go",
                is_dir=False,
                size=len(REPORTS_GO_CONTENT),
                language="go",
                content=REPORTS_GO_CONTENT,
                content_sha256="sha-reports-go",
                line_count=len(REPORTS_GO_CONTENT.splitlines()),
            ),
        ]
        save_revision(
            project_id=payments_proj_id,
            digest="8f92a11c19b023f77a83d91c78491823bc0192a2",
            archive_filename="payments-api-v1.zip",
            branch_label="main",
            files=files,
            user_id="00000000-0000-0000-0000-000000000001",
            revision_id=payments_rev_id,
        )


# Automatically initialize on import
seed_default_sources()
