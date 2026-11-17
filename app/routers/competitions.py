"""Competitions as any signed-in member sees them."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app import ledger
from app.deps import CurrentUser, DbSession  # noqa: TC001 - FastAPI reads these at runtime
from app.models import Competition, Entry, Slip, SlipSelection
from app.routers.bets import competition_or_404, settle_day_id
from app.schemas import CompetitionDetail, CompetitionOut, DayOut, EntrantOut

router = APIRouter(prefix="/api/competitions", tags=["competitions"])


@router.get("")
def list_competitions(user: CurrentUser, db: DbSession) -> list[CompetitionOut]:
    entered_ids = set(db.scalars(select(Entry.competition_id).where(Entry.user_id == user.id)))
    competitions = db.scalars(select(Competition).order_by(Competition.id.desc()))
    return [
        CompetitionOut(
            id=competition.id,
            name=competition.name,
            budget_pence=competition.budget_pence,
            entered=competition.id in entered_ids,
        )
        for competition in competitions
    ]


@router.get("/{competition_id}")
def get_competition(competition_id: int, user: CurrentUser, db: DbSession) -> CompetitionDetail:
    competition = db.get(Competition, competition_id)
    if competition is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")
    entrants = sorted(
        (
            EntrantOut(user_id=entry.user_id, display_name=entry.user.display_name)
            for entry in competition.entries
        ),
        key=lambda entrant: (entrant.display_name.lower(), entrant.user_id),
    )
    return CompetitionDetail(
        id=competition.id,
        name=competition.name,
        budget_pence=competition.budget_pence,
        entered=any(entrant.user_id == user.id for entrant in entrants),
        days=[DayOut.model_validate(day) for day in competition.days],
        entrants=entrants,
    )


def _ledger_inputs(
    db: DbSession, competition: Competition
) -> tuple[list[ledger.DayInfo], list[ledger.EntrantInfo], list[ledger.SlipInfo]]:
    days = [ledger.DayInfo(day.id, day.date, day.label) for day in competition.days]
    entrants = [
        ledger.EntrantInfo(entry.user_id, entry.user.display_name) for entry in competition.entries
    ]
    entry_users = {entry.id: entry.user_id for entry in competition.entries}
    slips = db.scalars(
        select(Slip)
        .where(Slip.entry_id.in_(entry_users), Slip.voided_at.is_(None))
        .options(selectinload(Slip.selections).selectinload(SlipSelection.day))
    )
    infos = [
        ledger.SlipInfo(
            id=slip.id,
            user_id=entry_users[slip.entry_id],
            day_id=slip.day_id,
            settle_day_id=settle_day_id(slip),
            bet_type=slip.bet_type,
            each_way=slip.each_way,
            stake_pence=slip.stake_pence,
            return_pence=slip.return_pence,
            created_at=slip.created_at,
            horses=tuple(selection.horse_name for selection in slip.selections),
        )
        for slip in slips
    ]
    return days, entrants, infos


@router.get("/{competition_id}/standings")
def get_standings(competition_id: int, _user: CurrentUser, db: DbSession) -> dict:
    competition = competition_or_404(db, competition_id)
    days, entrants, slips = _ledger_inputs(db, competition)
    return ledger.standings(competition.budget_pence, days, entrants, slips)


@router.get("/{competition_id}/stats")
def get_stats(competition_id: int, _user: CurrentUser, db: DbSession) -> dict:
    competition = competition_or_404(db, competition_id)
    days, entrants, slips = _ledger_inputs(db, competition)
    return ledger.statistics(competition.budget_pence, days, entrants, slips)
