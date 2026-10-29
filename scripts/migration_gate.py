"""Clean-database migration gate: upgrade head -> downgrade base -> upgrade head
on a throwaway SQLite file. Proves the packaged migration chain is clean."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"


def run(url: str, *args: str) -> None:
    env = dict(os.environ, DATABASE_URL=url)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(f"FAILED: alembic {' '.join(args)}")
    print(f"OK: alembic {' '.join(args)}")


with tempfile.TemporaryDirectory() as tmp:
    db = Path(tmp) / "clean.db"
    url = f"sqlite:///{db}"
    run(url, "upgrade", "head")
    run(url, "downgrade", "base")
    run(url, "upgrade", "head")
    print("CLEAN-DB MIGRATION GATE: PASS (upgrade -> downgrade -> upgrade)")
