"""Competitions as any signed-in member sees them."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession  # noqa: TC001 - FastAPI reads these at runtime
from app.models import Competition, Entry
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
