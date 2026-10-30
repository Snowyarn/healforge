"""Safe source-archive intake: bounded, zip-slip/symlink-proof, stored as DB rows.

Nothing here ever executes or imports the uploaded code. Files are decoded as text,
hashed and persisted; binaries are skipped and recorded as skipped.
"""

from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass, field

from ..config import settings

TEXT_EXTENSIONS = {
    ".py",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".go",
    ".rs",
    ".java",
    ".rb",
    ".php",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".cc",
    ".cs",
    ".sql",
    ".sh",
    ".bash",
    ".zsh",
    ".yml",
    ".yaml",
    ".json",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".env",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".md",
    ".txt",
    ".xml",
    ".svg",
    ".lock",
    ".vue",
    ".svelte",
    ".kt",
    ".swift",
    ".scala",
    ".tf",
    ".dockerfile",
    ".gitignore",
    ".editorconfig",
    ".properties",
    ".gradle",
    ".mod",
    ".sum",
}

LANGUAGE_BY_EXT = {
    ".py": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".jsx": "jsx",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".php": "php",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".cs": "csharp",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".conf": "ini",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".md": "markdown",
    ".txt": "text",
    ".xml": "xml",
    ".vue": "vue",
    ".svelte": "svelte",
    ".kt": "kotlin",
    ".swift": "swift",
    ".scala": "scala",
    ".tf": "terraform",
    ".gradle": "gradle",
    ".mod": "gomod",
}

_DOCKERFILE_RE = re.compile(r"^dockerfile(\..+)?$", re.IGNORECASE)
_BINARY_HEURISTIC_LIMIT = 2  # allowed NUL/control chars before we call it binary

MAX_DEPTH = 12
MAX_PATH_LEN = 400


class UploadError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class ExtractedFile:
    path: str
    is_dir: bool
    size: int
    language: str
    content: str | None
    content_sha256: str
    line_count: int


@dataclass
class ExtractionResult:
    files: list[ExtractedFile] = field(default_factory=list)
    skipped: list[dict] = field(default_factory=list)
    digest: str = ""
    total_text_bytes: int = 0
    text_file_count: int = 0


def _is_text_ext(name: str) -> bool:
    lowered = name.lower()
    if _DOCKERFILE_RE.match(lowered):
        return True
    dot = lowered.rfind(".")
    if dot == -1:
        return lowered in {"makefile", "procfile", "gemfile", "rakefile", "license", "readme"}
    return lowered[dot:] in TEXT_EXTENSIONS


def _safe_relpath(raw_name: str) -> str:
    """Normalize an archive member name; reject traversal/absolute/symlink artifacts."""
    name = raw_name.replace("\\", "/")
    if not name or name.startswith(("/", "~")):
        raise UploadError("unsafe_path", f"Rejected unsafe archive entry: {raw_name!r}")
    if re.match(r"^[a-zA-Z]:", name):
        raise UploadError("unsafe_path", f"Rejected drive-absolute entry: {raw_name!r}")
    parts = []
    for part in name.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise UploadError("unsafe_path", f"Rejected path traversal entry: {raw_name!r}")
        parts.append(part)
    if not parts:
        raise UploadError("unsafe_path", "Rejected empty entry")
    path = "/".join(parts)
    if len(parts) > MAX_DEPTH or len(path) > MAX_PATH_LEN:
        raise UploadError("unsafe_path", f"Rejected overly deep/long entry: {raw_name!r}")
    return path


def _looks_binary(data: bytes) -> bool:
    if b"\x00" in data:
        return True
    control = sum(1 for b in data[:4096] if b < 9 or (13 < b < 32))
    return control > _BINARY_HEURISTIC_LIMIT


def extract_archive(data: bytes) -> ExtractionResult:
    if len(data) > settings.max_archive_bytes:
        raise UploadError("archive_too_large", f"Archive exceeds {settings.max_archive_bytes} bytes.")
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise UploadError("not_a_zip", "Uploaded file is not a valid ZIP archive.")

    result = ExtractionResult()
    seen_dirs: set[str] = set()
    total_uncompressed = 0

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = zf.infolist()
        if len(infos) > settings.max_archive_entries:
            raise UploadError(
                "too_many_entries", f"Archive has {len(infos)} entries; limit is {settings.max_archive_entries}."
            )

        for info in infos:
            mode = (info.external_attr >> 16) & 0o170000
            if mode == 0o120000 or (mode == 0o040000 and info.flag_bits & 0x800):
                raise UploadError("symlink_rejected", f"Symlink entry rejected: {info.filename!r}")
            path = _safe_relpath(info.filename)

            if info.is_dir():
                seen_dirs.add(path.rstrip("/"))
                result.files.append(ExtractedFile(path, True, 0, "", None, "", 0))
                continue

            if info.file_size > settings.max_file_bytes:
                result.skipped.append({"path": path, "reason": "file_exceeds_size_limit", "size": info.file_size})
                continue
            if info.compress_size > 0 and info.file_size / max(info.compress_size, 1) > 200:
                raise UploadError("zip_bomb", f"Suspicious compression ratio in entry: {info.filename!r}")

            total_uncompressed += info.file_size
            if total_uncompressed > settings.max_total_text_bytes * 4:
                raise UploadError("zip_bomb", "Total uncompressed size exceeds safe limit.")

            raw = zf.read(info)
            if not _is_text_ext(path):
                result.skipped.append({"path": path, "reason": "non_text_extension_skipped", "size": len(raw)})
                continue
            if _looks_binary(raw):
                result.skipped.append({"path": path, "reason": "binary_content_skipped", "size": len(raw)})
                continue

            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                result.skipped.append({"path": path, "reason": "not_utf8_skipped", "size": len(raw)})
                continue

            if len(text) > settings.max_file_bytes:
                result.skipped.append({"path": path, "reason": "file_exceeds_size_limit", "size": len(text)})
                continue
            if result.total_text_bytes + len(text) > settings.max_total_text_bytes:
                result.skipped.append({"path": path, "reason": "total_text_budget_exceeded", "size": len(text)})
                continue

            dot = path.rfind(".")
            ext = path[dot:].lower() if dot != -1 else ""
            language = (
                "dockerfile" if _DOCKERFILE_RE.match(path.rsplit("/", 1)[-1]) else LANGUAGE_BY_EXT.get(ext, "text")
            )

            result.files.append(
                ExtractedFile(
                    path=path,
                    is_dir=False,
                    size=len(text),
                    language=language,
                    content=text,
                    content_sha256=hashlib.sha256(text.encode()).hexdigest(),
                    line_count=text.count("\n") + 1,
                )
            )
            result.total_text_bytes += len(text)

    text_files = [f for f in result.files if not f.is_dir]
    result.text_file_count = len(text_files)
    if not text_files:
        raise UploadError("no_text_files", "Archive contains no analyzable text source files.")

    digest_payload = "\n".join(f"{f.path}:{f.content_sha256}" for f in sorted(text_files, key=lambda x: x.path))
    result.digest = hashlib.sha256(digest_payload.encode()).hexdigest()
    return result
