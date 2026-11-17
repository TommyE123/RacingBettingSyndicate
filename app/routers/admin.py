"""Admin-only management of users, competitions, days and entries."""

from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app import audit
from app.deps import AdminUser, DbSession  # noqa: TC001 - FastAPI reads these at runtime
from app.models import AuditLog, AuthSession, Competition, CompetitionDay, Entry, Role, User
from app.routers.bets import audit_out
from app.schemas import (
    AuditOut,
    CompetitionCreate,
    CompetitionUpdate,
    DayCreate,
    DayOut,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.security import hash_password

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _get_or_404[T](db: Session, model: type[T], row_id: int, what: str) -> T:
    row = db.get(model, row_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")
    return row


def _commit_or_conflict(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, message) from exc


def _other_active_admins(db: Session, user: User) -> int:
    return db.scalars(
        select(func.count())
        .select_from(User)
        .where(User.role == Role.ADMIN.value, User.is_active, User.id != user.id)
    ).one()


# --- Users ---------------------------------------------------------------


@router.get("/users")
def list_users(_admin: AdminUser, db: DbSession) -> list[UserOut]:
    users = db.scalars(select(User).order_by(User.display_name, User.id))
    return [UserOut.model_validate(user) for user in users]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, admin: AdminUser, db: DbSession) -> UserOut:
    user = User(
        username=body.username,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken") from exc
    audit.record(db, admin, "user.created", "user", user.id, username=user.username, role=user.role)
    db.commit()
    return UserOut.model_validate(user)


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, admin: AdminUser, db: DbSession) -> UserOut:
    user = _get_or_404(db, User, user_id, "User")
    changes = body.model_dump(exclude_none=True)
    password = changes.pop("password", None)

    will_be_admin = changes.get("role", user.role) == Role.ADMIN.value
    will_be_active = changes.get("is_active", user.is_active)
    is_working_admin = user.role == Role.ADMIN.value and user.is_active
    if (
        is_working_admin
        and not (will_be_admin and will_be_active)
        and _other_active_admins(db, user) == 0
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "The last active admin cannot be removed")

    changed = {}
    for field, value in changes.items():
        if getattr(user, field) != value:
            changed[field] = {"from": getattr(user, field), "to": value}
            setattr(user, field, value)
    if password is not None:
        user.password_hash = hash_password(password)
        changed["password"] = "reset"  # noqa: S105 - a marker, never the password itself
    if password is not None or not user.is_active:
        db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    if changed:
        audit.record(db, admin, "user.updated", "user", user.id, changes=changed)
    db.commit()
    return UserOut.model_validate(user)


# --- Competitions --------------------------------------------------------


@router.post("/competitions", status_code=status.HTTP_201_CREATED)
def create_competition(body: CompetitionCreate, admin: AdminUser, db: DbSession) -> dict:
    competition = Competition(name=body.name, budget_pence=body.budget_pence)
    db.add(competition)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A competition with that name already exists"
        ) from exc
    audit.record(
        db,
        admin,
        "competition.created",
        "competition",
        competition.id,
        name=competition.name,
        budget_pence=competition.budget_pence,
    )
    db.commit()
    return {
        "id": competition.id,
        "name": competition.name,
        "budget_pence": competition.budget_pence,
    }


@router.patch("/competitions/{competition_id}")
def update_competition(
    competition_id: int, body: CompetitionUpdate, admin: AdminUser, db: DbSession
) -> dict:
    competition = _get_or_404(db, Competition, competition_id, "Competition")
    changed = {}
    for field, value in body.model_dump(exclude_none=True).items():
        if getattr(competition, field) != value:
            changed[field] = {"from": getattr(competition, field), "to": value}
            setattr(competition, field, value)
    if changed:
        audit.record(
            db, admin, "competition.updated", "competition", competition.id, changes=changed
        )
    _commit_or_conflict(db, "A competition with that name already exists")
    return {
        "id": competition.id,
        "name": competition.name,
        "budget_pence": competition.budget_pence,
    }


@router.post("/competitions/{competition_id}/days", status_code=status.HTTP_201_CREATED)
def add_day(competition_id: int, body: DayCreate, admin: AdminUser, db: DbSession) -> DayOut:
    competition = _get_or_404(db, Competition, competition_id, "Competition")
    day = CompetitionDay(competition_id=competition.id, date=body.date, label=body.label or None)
    db.add(day)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That date is already in the competition"
        ) from exc
    audit.record(
        db,
        admin,
        "day.added",
        "competition_day",
        day.id,
        competition_id=competition.id,
        date=day.date,
    )
    db.commit()
    return DayOut.model_validate(day)


@router.delete(
    "/competitions/{competition_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_day(competition_id: int, day_id: int, admin: AdminUser, db: DbSession) -> None:
    day = db.get(CompetitionDay, day_id)
    if day is None or day.competition_id != competition_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Day not found")
    audit.record(
        db,
        admin,
        "day.removed",
        "competition_day",
        day.id,
        competition_id=competition_id,
        date=day.date,
    )
    db.delete(day)
    _commit_or_conflict(db, "That day is in use and cannot be removed")


@router.put(
    "/competitions/{competition_id}/entries/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def add_entry(competition_id: int, user_id: int, admin: AdminUser, db: DbSession) -> None:
    """Enter a user into a competition. Safe to repeat."""
    competition = _get_or_404(db, Competition, competition_id, "Competition")
    user = _get_or_404(db, User, user_id, "User")
    existing = db.scalar(
        select(Entry).where(Entry.competition_id == competition.id, Entry.user_id == user.id)
    )
    if existing is not None:
        return
    entry = Entry(competition_id=competition.id, user_id=user.id)
    db.add(entry)
    db.flush()
    audit.record(
        db, admin, "entry.added", "entry", entry.id, competition_id=competition.id, user_id=user.id
    )
    db.commit()


@router.delete(
    "/competitions/{competition_id}/entries/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_entry(competition_id: int, user_id: int, admin: AdminUser, db: DbSession) -> None:
    entry = db.scalar(
        select(Entry).where(Entry.competition_id == competition_id, Entry.user_id == user_id)
    )
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    audit.record(
        db,
        admin,
        "entry.removed",
        "entry",
        entry.id,
        competition_id=competition_id,
        user_id=user_id,
    )
    db.delete(entry)
    _commit_or_conflict(db, "That entry is in use and cannot be removed")


# --- Audit log ------------------------------------------------------------


@router.get("/audit")
def list_audit(
    _admin: AdminUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    before_id: int | None = None,
    entity_type: str | None = None,
    actor_user_id: int | None = None,
) -> list[AuditOut]:
    query = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
    if before_id is not None:
        query = query.where(AuditLog.id < before_id)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if actor_user_id is not None:
        query = query.where(AuditLog.actor_user_id == actor_user_id)
    return audit_out(db, list(db.scalars(query)))
