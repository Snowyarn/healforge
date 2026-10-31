"""SQLAlchemy 2 engine/session setup. SQLite for local dev, PostgreSQL for deployment."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    if url.startswith("sqlite"):
        # Ensure the SQLite file lives next to the backend app (predictable location).
        if url == "sqlite:///./healforge.db":
            db_path = Path(__file__).resolve().parent.parent / "healforge.db"
            url = f"sqlite:///{db_path}"

        connect_args = {"check_same_thread": False, "timeout": 30}
        engine_kwargs = {
            "connect_args": connect_args,
            "pool_pre_ping": True,
        }
        if ":memory:" in url or "mode=memory" in url:
            from sqlalchemy.pool import StaticPool
            engine_kwargs["poolclass"] = StaticPool

        engine = create_engine(url, **engine_kwargs)

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _record):  # pragma: no cover
            cursor = dbapi_connection.cursor()
            # WAL: readers never block the writer (the scan pipeline commits while
            # the UI polls). Without this, concurrent access deadlocks under load.
            if ":memory:" not in url and "mode=memory" not in url:
                cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=15000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

        return engine
    # PostgreSQL (deployment) — psycopg3 driver string expected.
    # If running inside a Docker container and targeting host loopback, translate to host.docker.internal
    import os
    if os.path.exists("/.dockerenv"):
        url = url.replace("@127.0.0.1:", "@host.docker.internal:").replace("@localhost:", "@host.docker.internal:")

    # Uses public schema by default to connect directly to existing Supabase tables.
    connect_args = {}
    if settings.database_schema and settings.database_schema != "public":
        connect_args["options"] = f"-c search_path={settings.database_schema}"
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args,
    )


engine = _make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Explicitly create all database tables.

    Essential for in-memory SQLite (:memory: or mode=memory) on Vercel cold starts.
    """
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


try:
    init_db()
except Exception as _exc:  # noqa: BLE001
    print(f"[healforge] init_db note: {_exc}", flush=True)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: scoped DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        try:
            if not str(db.bind.url).startswith("sqlite"):
                from sqlalchemy import text
                db.execute(text("RESET role"))
                db.execute(text("SELECT set_config('request.jwt.claims', '', false)"))
        except Exception:  # noqa: S110, BLE001
            pass
        db.close()


def session_scope() -> Session:
    """Manual session for background jobs / scripts (caller must close)."""
    return SessionLocal()
