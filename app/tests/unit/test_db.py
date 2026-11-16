import sqlite3
from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy import insert, select, text
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.orm import Session

from app.db import Base, make_engine, utcnow
from app.models import AuthSession, Competition, Entry, User


@pytest.fixture
def db():
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def add_user(db, username="tom"):
    user = User(username=username, display_name="Tom", password_hash="x")
    db.add(user)
    db.flush()
    return user


def test_utcnow_is_timezone_aware():
    assert utcnow().utcoffset() == timedelta(0)


def test_datetimes_are_stored_as_utc_and_read_back_aware(db):
    user = add_user(db)
    plus_two = timezone(timedelta(hours=2))
    db.add(
        AuthSession(
            token_hash="h",
            user_id=user.id,
            expires_at=datetime(2027, 3, 16, 14, 0, tzinfo=plus_two),
        )
    )
    db.commit()
    db.expire_all()
    assert db.scalar(select(AuthSession.expires_at)) == datetime(2027, 3, 16, 12, 0, tzinfo=UTC)
    assert db.scalar(text("SELECT expires_at FROM auth_sessions")).startswith("2027-03-16 12:00")


def test_naive_datetimes_are_rejected(db):
    user = add_user(db)
    db.add(AuthSession(token_hash="h", user_id=user.id, expires_at=datetime(2027, 3, 16)))  # noqa: DTZ001
    with pytest.raises(StatementError, match="naive datetime"):
        db.flush()


def test_null_datetime_passes_through_the_type_and_is_rejected_by_the_column(db):
    statement = insert(User).values(
        username="n", display_name="N", password_hash="x", created_at=None
    )
    with pytest.raises(IntegrityError):
        db.execute(statement)


def test_foreign_keys_are_enforced(db):
    db.add(Entry(competition_id=999, user_id=999))
    with pytest.raises(IntegrityError):
        db.flush()


def test_budget_must_be_positive(db):
    db.add(Competition(name="Cheltenham", budget_pence=0))
    with pytest.raises(IntegrityError):
        db.flush()


def test_role_must_be_known(db):
    db.add(User(username="x", display_name="X", password_hash="x", role="owner"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_file_database_is_created(tmp_path):
    path = tmp_path / "rbs.sqlite3"
    engine = make_engine(f"sqlite:///{path}")
    Base.metadata.create_all(engine)
    assert path.exists()
    engine.dispose()


def test_a_transaction_holds_the_write_lock_from_its_first_statement(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'rbs.sqlite3'}")
    Base.metadata.create_all(engine)
    other = sqlite3.connect(tmp_path / "rbs.sqlite3", timeout=0.05, isolation_level=None)
    try:
        with Session(engine) as first:
            first.scalar(select(User.id))  # only a read, but the check-then-write starts here
            with pytest.raises(sqlite3.OperationalError, match="locked"):
                other.execute("BEGIN IMMEDIATE")
            first.commit()
        other.execute("BEGIN IMMEDIATE")  # free again once the first transaction ends
        other.execute("ROLLBACK")
    finally:
        other.close()
        engine.dispose()


def test_rolled_back_work_is_not_kept(db):
    add_user(db)
    db.rollback()
    assert db.scalar(select(User.id)) is None
