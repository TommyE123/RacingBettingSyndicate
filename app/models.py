"""Database tables.

Hierarchy: Competition -> CompetitionDay, and Competition -> Entry (a user's place in a
competition). Bets will hang off Entry and CompetitionDay. Money is whole pence, never floats.
"""

import datetime as dt  # noqa: TC003 - SQLAlchemy reads Mapped[...] annotations at runtime
import enum

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, utcnow


class Role(enum.StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    display_name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default=Role.MEMBER.value)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    __table_args__ = (CheckConstraint("role IN ('admin', 'member')", name="ck_users_role"),)


class AuthSession(Base):
    """A login. Only a hash of the cookie token is stored."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[dt.datetime] = mapped_column(UTCDateTime)

    user: Mapped[User] = relationship()


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    # Total each entrant may stake across the whole competition.
    budget_pence: Mapped[int] = mapped_column()
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    days: Mapped[list[CompetitionDay]] = relationship(
        back_populates="competition", order_by="CompetitionDay.date"
    )
    entries: Mapped[list[Entry]] = relationship(back_populates="competition")

    __table_args__ = (CheckConstraint("budget_pence > 0", name="ck_competitions_budget_positive"),)


class CompetitionDay(Base):
    __tablename__ = "competition_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    competition_id: Mapped[int] = mapped_column(
        ForeignKey("competitions.id", ondelete="RESTRICT"), index=True
    )
    date: Mapped[dt.date] = mapped_column()
    label: Mapped[str | None] = mapped_column(String(80))

    competition: Mapped[Competition] = relationship(back_populates="days")

    __table_args__ = (UniqueConstraint("competition_id", "date", name="uq_competition_day"),)


class Entry(Base):
    """A user's participation in a competition."""

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    competition_id: Mapped[int] = mapped_column(
        ForeignKey("competitions.id", ondelete="RESTRICT"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    competition: Mapped[Competition] = relationship(back_populates="entries")
    user: Mapped[User] = relationship()

    __table_args__ = (UniqueConstraint("competition_id", "user_id", name="uq_entry"),)


class AuditLog(Base):
    """Append-only record of who changed what. Never updated or deleted by the application."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    # No foreign key: the record must outlive any change to the user row.
    actor_user_id: Mapped[int | None] = mapped_column()
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[int | None] = mapped_column()
    detail: Mapped[str] = mapped_column(Text, default="{}")
