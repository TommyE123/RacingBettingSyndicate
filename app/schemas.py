"""Request and response shapes for the API."""

import datetime as dt  # noqa: TC003 - pydantic reads field annotations at runtime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.config import MAX_PASSWORD_LENGTH

Username = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=2,
        max_length=32,
        pattern=r"^[A-Za-z0-9._-]+$",
    ),
]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Password = Annotated[str, StringConstraints(min_length=8, max_length=MAX_PASSWORD_LENGTH)]
CompetitionName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]
# Whole pence. The upper bound is a typo guard (one million pounds), not a rule of the game.
BudgetPence = Annotated[int, Field(gt=0, le=100_000_000)]
RoleName = Literal["admin", "member"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _FromRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(_Strict):
    username: str = Field(max_length=64)
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)


class PasswordChange(_Strict):
    current_password: str = Field(max_length=MAX_PASSWORD_LENGTH)
    new_password: Password


class UserOut(_FromRow):
    id: int
    username: str
    display_name: str
    role: RoleName
    is_active: bool


class UserCreate(_Strict):
    username: Username
    display_name: DisplayName
    password: Password
    role: RoleName = "member"


class UserUpdate(_Strict):
    display_name: DisplayName | None = None
    password: Password | None = None
    role: RoleName | None = None
    is_active: bool | None = None


class CompetitionCreate(_Strict):
    name: CompetitionName
    budget_pence: BudgetPence = 50_000


class CompetitionUpdate(_Strict):
    name: CompetitionName | None = None
    budget_pence: BudgetPence | None = None


class DayCreate(_Strict):
    date: dt.date
    label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None


class DayOut(_FromRow):
    id: int
    date: dt.date
    label: str | None


class EntrantOut(BaseModel):
    user_id: int
    display_name: str


class CompetitionOut(BaseModel):
    id: int
    name: str
    budget_pence: int
    entered: bool


class CompetitionDetail(CompetitionOut):
    days: list[DayOut]
    entrants: list[EntrantOut]


# --- Bets ----------------------------------------------------------------

# Whole pence. The upper bounds are typo guards, not rules of the game.
StakePence = Annotated[int, Field(gt=0, le=10_000_000)]
ReturnPence = Annotated[int, Field(ge=0, le=1_000_000_000)]
ShortNote = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class BetTypeOut(BaseModel):
    key: str
    label: str
    min_selections: int
    max_selections: int
    fixed_lines: int | None
    description: str


class SelectionIn(_Strict):
    day_id: int
    race_time: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=8)]
    horse_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
    ]
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None


class SlipIn(_Strict):
    """A new or edited slip. Give either the unit stake or the total stake, not both."""

    day_id: int
    bet_type: str
    fold_size: int | None = Field(default=None, ge=1, le=20)
    each_way: bool = False
    unit_stake_pence: StakePence | None = None
    stake_pence: StakePence | None = None
    selections: list[SelectionIn] = Field(min_length=1, max_length=20)
    note: ShortNote | None = None
    sheet_id: int | None = None
    # Admins only: enter the slip for another entrant.
    user_id: int | None = None
    # Required to save a slip that takes the entrant over budget; it is then flagged.
    confirm_over_budget: bool = False


class SlipReturnIn(_Strict):
    return_pence: ReturnPence | None


class SlipVoidIn(_Strict):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None


class SlipRestoreIn(_Strict):
    confirm_over_budget: bool = False


class SelectionOut(BaseModel):
    position: int
    day_id: int
    race_time: str
    horse_name: str
    note: str | None


class SlipOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    day_id: int
    settle_day_id: int
    sheet_id: int | None
    bet_type: str
    bet_label: str
    fold_size: int | None
    each_way: bool
    unit_stake_pence: int
    line_count: int
    stake_pence: int
    return_pence: int | None
    profit_pence: int | None
    note: str | None
    selections: list[SelectionOut]
    created_by: int
    created_by_name: str
    created_at: dt.datetime
    updated_at: dt.datetime
    voided_at: dt.datetime | None
    void_reason: str | None
    over_budget: bool


class AuditOut(BaseModel):
    id: int
    at: dt.datetime
    actor_user_id: int | None
    actor_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    detail: dict


class SheetOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    day_id: int
    content_type: str
    size_bytes: int
    stated_total_pence: int | None
    entered_total_pence: int
    slip_count: int
    note: str | None
    uploaded_by: int
    uploaded_by_name: str
    created_at: dt.datetime


class SheetReaderOut(BaseModel):
    enabled: bool


class SheetReadOut(BaseModel):
    # A draft for a person to check against the photo, never saved as it is.
    lines: list[str]


class SheetUpdate(_Strict):
    day_id: int | None = None
    stated_total_pence: Annotated[int, Field(ge=0, le=100_000_000)] | None = None
    clear_stated_total: bool = False
    note: ShortNote | None = None
