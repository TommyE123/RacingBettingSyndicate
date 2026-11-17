"""Slips (bets): entry, editing, declared returns, voiding and history.

Every signed-in member can see every slip, as on the WhatsApp group. Members manage their
own slips; admins can manage anyone's. Every change is written to the audit log.
"""

import json
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app import audit
from app.bets import (
    BET_TYPES,
    BetError,
    line_count,
    normalise_race_time,
    total_stake,
    unit_stake_from_total,
)
from app.db import utcnow
from app.deps import CurrentUser, DbSession  # noqa: TC001 - FastAPI reads these at runtime
from app.models import (
    AuditLog,
    Competition,
    CompetitionDay,
    Entry,
    Role,
    Sheet,
    Slip,
    SlipSelection,
    User,
)
from app.schemas import (
    AuditOut,
    BetTypeOut,
    SelectionOut,
    SlipIn,
    SlipOut,
    SlipRestoreIn,
    SlipReturnIn,
    SlipVoidIn,
)

if TYPE_CHECKING:
    from collections.abc import Iterable

    from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["bets"])


def is_admin(user: User) -> bool:
    return user.role == Role.ADMIN.value


def competition_or_404(db: Session, competition_id: int) -> Competition:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")
    return competition


def entry_for(db: Session, competition_id: int, user_id: int) -> Entry | None:
    return db.scalar(
        select(Entry).where(Entry.competition_id == competition_id, Entry.user_id == user_id)
    )


def require_manager(user: User, owner_id: int) -> None:
    if user.id != owner_id and not is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an admin can do that")


def user_names(db: Session, user_ids: Iterable[int]) -> dict[int, str]:
    ids = set(user_ids)
    if not ids:
        return {}
    return dict(db.execute(select(User.id, User.display_name).where(User.id.in_(ids))).all())


def live_stake(db: Session, entry_id: int, exclude_slip_id: int | None = None) -> int:
    query = select(func.coalesce(func.sum(Slip.stake_pence), 0)).where(
        Slip.entry_id == entry_id, Slip.voided_at.is_(None)
    )
    if exclude_slip_id is not None:
        query = query.where(Slip.id != exclude_slip_id)
    return db.scalar(query) or 0


def settle_day_id(slip: Slip) -> int:
    """The day of the slip's last leg, when its return counts."""
    latest = max(slip.selections, key=lambda selection: (selection.day.date, selection.day_id))
    return latest.day_id


def slip_out(slip: Slip, names: dict[int, str], over_budget: bool) -> SlipOut:
    owner_id = slip.entry.user_id
    return SlipOut(
        id=slip.id,
        user_id=owner_id,
        display_name=names.get(owner_id, "?"),
        day_id=slip.day_id,
        settle_day_id=settle_day_id(slip),
        sheet_id=slip.sheet_id,
        bet_type=slip.bet_type,
        bet_label=BET_TYPES[slip.bet_type].label,
        fold_size=slip.fold_size,
        each_way=slip.each_way,
        unit_stake_pence=slip.unit_stake_pence,
        line_count=slip.line_count,
        stake_pence=slip.stake_pence,
        return_pence=slip.return_pence,
        profit_pence=None if slip.return_pence is None else slip.return_pence - slip.stake_pence,
        note=slip.note,
        selections=[
            SelectionOut(
                position=selection.position,
                day_id=selection.day_id,
                race_time=selection.race_time,
                horse_name=selection.horse_name,
                note=selection.note,
            )
            for selection in slip.selections
        ],
        created_by=slip.created_by,
        created_by_name=names.get(slip.created_by, "?"),
        created_at=slip.created_at,
        updated_at=slip.updated_at,
        voided_at=slip.voided_at,
        void_reason=slip.void_reason,
        over_budget=over_budget,
    )


def slips_out(db: Session, slips: list[Slip]) -> list[SlipOut]:
    names = user_names(db, [s.entry.user_id for s in slips] + [s.created_by for s in slips])
    budgets: dict[int, bool] = {}
    for slip in slips:
        if slip.entry_id not in budgets:
            budgets[slip.entry_id] = (
                live_stake(db, slip.entry_id) > slip.entry.competition.budget_pence
            )
    return [slip_out(slip, names, budgets[slip.entry_id]) for slip in slips]


def slip_summary(slip: Slip) -> dict:
    """What the audit log records about a slip's content."""
    return {
        "day_id": slip.day_id,
        "bet_type": slip.bet_type,
        "fold_size": slip.fold_size,
        "each_way": slip.each_way,
        "unit_stake_pence": slip.unit_stake_pence,
        "line_count": slip.line_count,
        "stake_pence": slip.stake_pence,
        "note": slip.note,
        "sheet_id": slip.sheet_id,
        "selections": [
            [selection.day_id, selection.race_time, selection.horse_name, selection.note]
            for selection in slip.selections
        ],
    }


def load_slip(db: Session, slip_id: int) -> Slip:
    slip = db.scalar(
        select(Slip)
        .where(Slip.id == slip_id)
        .options(selectinload(Slip.selections).selectinload(SlipSelection.day))
    )
    if slip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bet not found")
    return slip


def _unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)


def _day_ids(db: Session, competition_id: int) -> set[int]:
    return set(
        db.scalars(select(CompetitionDay.id).where(CompetitionDay.competition_id == competition_id))
    )


def apply_slip(db: Session, slip: Slip, body: SlipIn, competition: Competition) -> None:
    """Validate the body and write it onto the slip, replacing its selections."""
    valid_days = _day_ids(db, competition.id)
    if body.day_id not in valid_days:
        raise _unprocessable("That day is not part of this competition")
    selections = []
    try:
        for position, item in enumerate(body.selections, start=1):
            if item.day_id not in valid_days:
                raise _unprocessable(f"Horse {position}: that day is not part of this competition")
            selections.append(
                SlipSelection(
                    position=position,
                    day_id=item.day_id,
                    race_time=normalise_race_time(item.race_time),
                    horse_name=" ".join(item.horse_name.split()),
                    note=item.note or None,
                )
            )
        lines = line_count(body.bet_type, len(selections), body.fold_size)
        if (body.unit_stake_pence is None) == (body.stake_pence is None):
            raise _unprocessable("Give either the stake per bet or the total stake")
        if body.unit_stake_pence is not None:
            unit = body.unit_stake_pence
            total = total_stake(unit, lines, body.each_way)
        else:
            assert body.stake_pence is not None  # noqa: S101 - checked just above
            total = body.stake_pence
            unit = unit_stake_from_total(total, lines, body.each_way)
    except BetError as exc:
        raise _unprocessable(str(exc)) from exc
    if total > 100_000_000:  # noqa: PLR2004 - a typo guard: one million pounds
        raise _unprocessable("That stake is too large")
    if body.sheet_id is not None:
        sheet = db.get(Sheet, body.sheet_id)
        if sheet is None or sheet.entry_id != slip.entry_id:
            raise _unprocessable("That sheet does not belong to this person in this competition")

    slip.day_id = body.day_id
    slip.bet_type = body.bet_type
    slip.fold_size = body.fold_size if body.bet_type == "perm" else None
    slip.each_way = body.each_way
    slip.unit_stake_pence = unit
    slip.line_count = lines
    slip.stake_pence = total
    slip.note = body.note or None
    slip.sheet_id = body.sheet_id
    if slip.id is not None:
        # Remove the old legs first, so their positions are free for the new ones.
        slip.selections.clear()
        db.flush()
    slip.selections = selections


def check_budget(
    db: Session,
    slip: Slip,
    competition: Competition,
    confirmed: bool,
) -> None:
    others = live_stake(db, slip.entry_id, exclude_slip_id=slip.id)
    after = others + slip.stake_pence
    if after > competition.budget_pence and not confirmed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "code": "over_budget",
                "message": (
                    f"This takes the total staked to £{after / 100:,.2f}, over the "
                    f"£{competition.budget_pence / 100:,.2f} budget. Save anyway to flag it."
                ),
                "remaining_pence": competition.budget_pence - others,
                "total_after_pence": after,
            },
        )


@router.get("/bet-types")
def list_bet_types(_user: CurrentUser) -> list[BetTypeOut]:
    return [
        BetTypeOut(
            key=bet.key,
            label=bet.label,
            min_selections=bet.min_selections,
            max_selections=bet.max_selections,
            fixed_lines=bet.fixed_lines,
            description=bet.description,
        )
        for bet in BET_TYPES.values()
    ]


@router.get("/competitions/{competition_id}/slips")
def list_slips(  # noqa: PLR0913 - each filter is a query parameter
    competition_id: int,
    *,
    _user: CurrentUser,
    db: DbSession,
    user_id: int | None = None,
    day_id: int | None = None,
    sheet_id: int | None = None,
    include_void: bool = False,
) -> list[SlipOut]:
    competition_or_404(db, competition_id)
    query = (
        select(Slip)
        .join(Entry, Slip.entry_id == Entry.id)
        .join(CompetitionDay, Slip.day_id == CompetitionDay.id)
        .where(Entry.competition_id == competition_id)
        .options(
            selectinload(Slip.selections).selectinload(SlipSelection.day),
            selectinload(Slip.entry).selectinload(Entry.competition),
        )
        .order_by(CompetitionDay.date.desc(), Slip.created_at.desc(), Slip.id.desc())
    )
    if user_id is not None:
        query = query.where(Entry.user_id == user_id)
    if day_id is not None:
        query = query.where(Slip.day_id == day_id)
    if sheet_id is not None:
        query = query.where(Slip.sheet_id == sheet_id)
    if not include_void:
        query = query.where(Slip.voided_at.is_(None))
    return slips_out(db, list(db.scalars(query)))


@router.post("/competitions/{competition_id}/slips", status_code=status.HTTP_201_CREATED)
def create_slip(competition_id: int, body: SlipIn, user: CurrentUser, db: DbSession) -> SlipOut:
    competition = competition_or_404(db, competition_id)
    owner_id = body.user_id if body.user_id is not None else user.id
    if owner_id != user.id and not is_admin(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only admins can enter bets for someone else"
        )
    entry = entry_for(db, competition.id, owner_id)
    if entry is None:
        who = "You are" if owner_id == user.id else "That person is"
        raise HTTPException(status.HTTP_409_CONFLICT, f"{who} not entered in this competition")
    slip = Slip(entry_id=entry.id, created_by=user.id)
    apply_slip(db, slip, body, competition)
    db.add(slip)
    db.flush()
    check_budget(db, slip, competition, body.confirm_over_budget)
    over = live_stake(db, entry.id) > competition.budget_pence
    audit.record(
        db,
        user,
        "slip.created",
        "slip",
        slip.id,
        competition_id=competition.id,
        user_id=owner_id,
        over_budget=over,
        **slip_summary(slip),
    )
    db.commit()
    return slips_out(db, [load_slip(db, slip.id)])[0]


@router.get("/slips/{slip_id}")
def get_slip(slip_id: int, _user: CurrentUser, db: DbSession) -> SlipOut:
    return slips_out(db, [load_slip(db, slip_id)])[0]


@router.put("/slips/{slip_id}")
def update_slip(slip_id: int, body: SlipIn, user: CurrentUser, db: DbSession) -> SlipOut:
    slip = load_slip(db, slip_id)
    require_manager(user, slip.entry.user_id)
    if slip.voided_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore this bet before editing it")
    if body.user_id is not None and body.user_id != slip.entry.user_id:
        raise _unprocessable("A bet cannot be moved to someone else; void it and enter it again")
    competition = slip.entry.competition
    before = slip_summary(slip)
    apply_slip(db, slip, body, competition)
    db.flush()
    check_budget(db, slip, competition, body.confirm_over_budget)
    after = slip_summary(slip)
    if after != before:
        changes = {
            key: {"from": before[key], "to": after[key]}
            for key in after
            if before[key] != after[key]
        }
        audit.record(db, user, "slip.updated", "slip", slip.id, changes=changes)
    db.commit()
    return slips_out(db, [load_slip(db, slip.id)])[0]


@router.put("/slips/{slip_id}/return")
def set_return(slip_id: int, body: SlipReturnIn, user: CurrentUser, db: DbSession) -> SlipOut:
    slip = load_slip(db, slip_id)
    require_manager(user, slip.entry.user_id)
    if slip.voided_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This bet is void")
    if slip.return_pence != body.return_pence:
        audit.record(
            db,
            user,
            "slip.return_set" if body.return_pence is not None else "slip.return_cleared",
            "slip",
            slip.id,
            changes={"return_pence": {"from": slip.return_pence, "to": body.return_pence}},
        )
        slip.return_pence = body.return_pence
        db.commit()
    return slips_out(db, [load_slip(db, slip.id)])[0]


@router.post("/slips/{slip_id}/void")
def void_slip(slip_id: int, body: SlipVoidIn, user: CurrentUser, db: DbSession) -> SlipOut:
    slip = load_slip(db, slip_id)
    require_manager(user, slip.entry.user_id)
    if slip.voided_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This bet is already void")
    slip.voided_at = utcnow()
    slip.voided_by = user.id
    slip.void_reason = body.reason or None
    audit.record(db, user, "slip.voided", "slip", slip.id, reason=slip.void_reason)
    db.commit()
    return slips_out(db, [load_slip(db, slip.id)])[0]


@router.post("/slips/{slip_id}/restore")
def restore_slip(slip_id: int, body: SlipRestoreIn, user: CurrentUser, db: DbSession) -> SlipOut:
    slip = load_slip(db, slip_id)
    require_manager(user, slip.entry.user_id)
    if slip.voided_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This bet is not void")
    slip.voided_at = None
    slip.voided_by = None
    slip.void_reason = None
    db.flush()
    check_budget(db, slip, slip.entry.competition, body.confirm_over_budget)
    audit.record(db, user, "slip.restored", "slip", slip.id)
    db.commit()
    return slips_out(db, [load_slip(db, slip.id)])[0]


def audit_out(db: Session, rows: list[AuditLog]) -> list[AuditOut]:
    names = user_names(db, [row.actor_user_id for row in rows if row.actor_user_id is not None])
    return [
        AuditOut(
            id=row.id,
            at=row.at,
            actor_user_id=row.actor_user_id,
            actor_name=names.get(row.actor_user_id) if row.actor_user_id else None,
            action=row.action,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            detail=json.loads(row.detail),
        )
        for row in rows
    ]


@router.get("/slips/{slip_id}/history")
def slip_history(
    slip_id: int,
    _user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[AuditOut]:
    load_slip(db, slip_id)
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.entity_type == "slip", AuditLog.entity_id == slip_id)
        .order_by(AuditLog.id)
        .limit(limit)
    )
    return audit_out(db, list(rows))
