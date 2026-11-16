"""Database engine and session helpers (SQLite via SQLAlchemy)."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes. SQLite drops the offset, so restore it on read."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):  # noqa: ARG002
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime is not allowed; use an aware UTC datetime")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value, dialect):  # noqa: ARG002
        return None if value is None else value.replace(tzinfo=UTC)


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str) -> Engine:
    kwargs: dict[str, Any] = {"connect_args": {"check_same_thread": False}}
    if database_url in ("sqlite://", "sqlite:///:memory:"):
        # One shared connection, so an in-memory database survives across sessions.
        kwargs["poolclass"] = StaticPool
    engine = create_engine(database_url, **kwargs)

    @event.listens_for(engine, "connect")
    def _configure_connection(dbapi_connection, _record):
        # Stop the driver opening transactions itself, so the BEGIN below is the only one.
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    @event.listens_for(engine, "begin")
    def _begin_immediate(connection):
        # Take SQLite's write lock at the start of every transaction, so a check and the
        # write that depends on it (last active admin, password still current, and later a
        # stake against the remaining budget) cannot interleave with another request.
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    return engine
