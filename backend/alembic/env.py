from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, text

from alembic import context
from app import models  # noqa: F401 — registers all models on Base.metadata
from app.config import settings
from app.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    if settings.database_schema == "public" or settings.skip_alembic_migrations or "supabase" in settings.database_url:
        print("[alembic] Target database is Supabase authoritative schema. Alembic migrations skipped.")
        return
    is_postgres = "postgres" in settings.database_url
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        version_table_schema=settings.database_schema if is_postgres else None,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Protect Supabase public schema: do not run Alembic migrations against Supabase
    if settings.database_schema == "public" or settings.skip_alembic_migrations or "supabase" in settings.database_url:
        print("[alembic] Target database is Supabase authoritative schema. Alembic migrations skipped.")
        return

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        is_postgres = connection.dialect.name == "postgresql"
        if is_postgres and settings.database_schema:
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {settings.database_schema};"))
            connection.execute(text(f"SET search_path TO {settings.database_schema};"))
            connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            version_table_schema=settings.database_schema if is_postgres else None,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
