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
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 30},
            pool_pre_ping=True,
        )

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _record):  # pragma: no cover
            cursor = dbapi_connection.cursor()
            # WAL: readers never block the writer (the scan pipeline commits while
            # the UI polls). Without this, concurrent access deadlocks under load.
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=15000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

        return engine
    # PostgreSQL (deployment) — psycopg3 driver string expected.
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
        except Exception:
            pass
        db.close()


def session_scope() -> Session:
    """Manual session for background jobs / scripts (caller must close)."""
    return SessionLocal()
