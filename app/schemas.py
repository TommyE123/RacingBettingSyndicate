"""Request and response shapes for the API."""

import datetime as dt  # noqa: TC003 - pydantic reads field annotations at runtime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
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
    password: str = Field(max_length=128)


class PasswordChange(_Strict):
    current_password: str = Field(max_length=128)
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
