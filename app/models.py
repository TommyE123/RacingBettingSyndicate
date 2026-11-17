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


class Sheet(Base):
    """A photo of a member's written bets, kept so slips can be checked against it."""

    __tablename__ = "sheets"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id", ondelete="RESTRICT"), index=True)
    day_id: Mapped[int] = mapped_column(
        ForeignKey("competition_days.id", ondelete="RESTRICT"), index=True
    )
    # Name of the stored file inside the upload directory; never a user-supplied path.
    filename: Mapped[str] = mapped_column(String(64), unique=True)
    content_type: Mapped[str] = mapped_column(String(32))
    size_bytes: Mapped[int] = mapped_column()
    # The total written on the sheet, for checking the slips entered from it.
    stated_total_pence: Mapped[int | None] = mapped_column()
    note: Mapped[str | None] = mapped_column(String(500))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

    entry: Mapped[Entry] = relationship()
    day: Mapped[CompetitionDay] = relationship()

    __table_args__ = (
        CheckConstraint(
            "stated_total_pence IS NULL OR stated_total_pence >= 0", name="ck_sheets_total"
        ),
    )


class Slip(Base):
    """One bet as placed: a bet type over some horses, with its total stake and return.

    The stake always equals unit stake x lines (x2 each-way); the database enforces it.
    The return is what the member says their bookmaker paid, or NULL until declared.
    """

    __tablename__ = "slips"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id", ondelete="RESTRICT"), index=True)
    # The day the bet was placed; its stake counts against the budget from this day.
    day_id: Mapped[int] = mapped_column(
        ForeignKey("competition_days.id", ondelete="RESTRICT"), index=True
    )
    sheet_id: Mapped[int | None] = mapped_column(
        ForeignKey("sheets.id", ondelete="SET NULL"), index=True
    )
    bet_type: Mapped[str] = mapped_column(String(16))
    fold_size: Mapped[int | None] = mapped_column()
    each_way: Mapped[bool] = mapped_column(default=False)
    unit_stake_pence: Mapped[int] = mapped_column()
    line_count: Mapped[int] = mapped_column()
    stake_pence: Mapped[int] = mapped_column()
    return_pence: Mapped[int | None] = mapped_column()
    note: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    voided_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime)
    voided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    void_reason: Mapped[str | None] = mapped_column(String(200))

    entry: Mapped[Entry] = relationship()
    day: Mapped[CompetitionDay] = relationship()
    selections: Mapped[list[SlipSelection]] = relationship(
        back_populates="slip",
        order_by="SlipSelection.position",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("unit_stake_pence > 0", name="ck_slips_unit_positive"),
        CheckConstraint("line_count > 0", name="ck_slips_lines_positive"),
        CheckConstraint(
            "stake_pence = unit_stake_pence * line_count * (CASE WHEN each_way THEN 2 ELSE 1 END)",
            name="ck_slips_stake_adds_up",
        ),
        CheckConstraint("return_pence IS NULL OR return_pence >= 0", name="ck_slips_return"),
        CheckConstraint(
            "bet_type IN ('single', 'double', 'treble', 'accumulator', 'trixie', 'patent',"
            " 'yankee', 'lucky15', 'canadian', 'lucky31', 'heinz', 'lucky63', 'super_heinz',"
            " 'goliath', 'perm')",
            name="ck_slips_bet_type",
        ),
        CheckConstraint(
            "(bet_type = 'perm') = (fold_size IS NOT NULL)", name="ck_slips_fold_only_for_perm"
        ),
    )


class SlipSelection(Base):
    """One horse on a slip, as written. Legs may run on different days."""

    __tablename__ = "slip_selections"

    id: Mapped[int] = mapped_column(primary_key=True)
    slip_id: Mapped[int] = mapped_column(ForeignKey("slips.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column()
    day_id: Mapped[int] = mapped_column(
        ForeignKey("competition_days.id", ondelete="RESTRICT"), index=True
    )
    race_time: Mapped[str] = mapped_column(String(5))
    horse_name: Mapped[str] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(String(100))

    slip: Mapped[Slip] = relationship(back_populates="selections")
    day: Mapped[CompetitionDay] = relationship()

    __table_args__ = (UniqueConstraint("slip_id", "position", name="uq_selection_position"),)
