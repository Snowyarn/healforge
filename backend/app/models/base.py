"""Shared model helpers: UTC datetimes, prefixed IDs."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def new_id(prefix: str = "") -> str:
    return str(uuid.uuid4())


from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import JSON, Text, TypeDecorator


class PgArray(TypeDecorator):
    """PostgreSQL ARRAY(Text) mapped to JSON on SQLite for portable test execution."""

    impl = ARRAY(Text)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "sqlite":
            return dialect.type_descriptor(JSON())
        return dialect.type_descriptor(ARRAY(Text))

    def process_bind_param(self, value, dialect):
        if value is None:
            return []
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        return list(value)


from sqlalchemy.types import Uuid as SaUuid


class SafeUuid(TypeDecorator):
    """Uuid that seamlessly accepts either str or uuid.UUID across PostgreSQL and SQLite."""

    impl = SaUuid(as_uuid=False)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return str(value)
