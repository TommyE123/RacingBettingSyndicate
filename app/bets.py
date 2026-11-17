"""UK bet types and the cost of a slip.

Only the stake is calculated here: a bet type fixes how many individual bets ("lines") a
slip contains, so its total cost is exact. Returns are never calculated; members declare
what their bookmaker paid.
"""

import re
import unicodedata
from dataclasses import dataclass
from math import comb

MAX_SELECTIONS = 20


@dataclass(frozen=True)
class BetType:
    key: str
    label: str
    min_selections: int
    max_selections: int
    # None when the number of lines depends on the selections (accumulator, perm).
    fixed_lines: int | None
    description: str


BET_TYPES: dict[str, BetType] = {
    bet.key: bet
    for bet in (
        BetType("single", "Single", 1, 1, 1, "One horse"),
        BetType("double", "Double", 2, 2, 1, "Two horses in one bet"),
        BetType("treble", "Treble", 3, 3, 1, "Three horses in one bet"),
        BetType("accumulator", "Accumulator", 2, MAX_SELECTIONS, 1, "Every horse in one bet"),
        BetType("trixie", "Trixie", 3, 3, 4, "3 doubles and a treble"),
        BetType("patent", "Patent", 3, 3, 7, "3 singles, 3 doubles and a treble"),
        BetType("yankee", "Yankee", 4, 4, 11, "6 doubles, 4 trebles and a 4-fold"),
        BetType("lucky15", "Lucky 15", 4, 4, 15, "4 singles plus a Yankee"),
        BetType("canadian", "Canadian", 5, 5, 26, "10 doubles, 10 trebles, 5 4-folds, a 5-fold"),
        BetType("lucky31", "Lucky 31", 5, 5, 31, "5 singles plus a Canadian"),
        BetType("heinz", "Heinz", 6, 6, 57, "Every double up to the 6-fold"),
        BetType("lucky63", "Lucky 63", 6, 6, 63, "6 singles plus a Heinz"),
        BetType("super_heinz", "Super Heinz", 7, 7, 120, "Every double up to the 7-fold"),
        BetType("goliath", "Goliath", 8, 8, 247, "Every double up to the 8-fold"),
        BetType(
            "perm",
            "Perm",
            1,
            MAX_SELECTIONS,
            None,
            "Every combination of one size, such as doubles from 5 or singles on 3",
        ),
    )
}

BET_TYPE_KEYS = tuple(BET_TYPES)


class BetError(ValueError):
    """A slip that does not add up. The message is shown to the member."""


def line_count(bet_type: str, selections: int, fold_size: int | None) -> int:
    """How many individual bets the slip contains."""
    rule = BET_TYPES.get(bet_type)
    if rule is None:
        raise BetError(f"Unknown bet type '{bet_type}'")
    if not rule.min_selections <= selections <= rule.max_selections:
        if rule.min_selections == rule.max_selections:
            needed = str(rule.min_selections)
        else:
            needed = f"{rule.min_selections} to {rule.max_selections}"
        raise BetError(f"A {rule.label} needs {needed} horses; this slip has {selections}")
    if bet_type == "perm":
        if fold_size is None or not 1 <= fold_size <= selections:
            raise BetError(f"Choose a perm size from 1 to {selections} (2 for doubles, and so on)")
        return comb(selections, fold_size)
    if fold_size is not None:
        raise BetError("Only a Perm takes a size")
    assert rule.fixed_lines is not None  # noqa: S101 - every non-perm type has one
    return rule.fixed_lines


def total_stake(unit_stake_pence: int, lines: int, each_way: bool) -> int:
    return unit_stake_pence * lines * (2 if each_way else 1)


def unit_stake_from_total(total_pence: int, lines: int, each_way: bool) -> int:
    parts = lines * (2 if each_way else 1)
    if total_pence % parts:
        raise BetError(
            f"£{total_pence / 100:.2f} does not split evenly into {parts} bets of whole pence"
        )
    return total_pence // parts


_RACE_TIME = re.compile(r"^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$")
# Racing runs in the afternoon and evening, so "1:30" to "9:59" mean pm.
_LAST_AFTERNOON_HOUR_WRITTEN_SHORT = 9


def normalise_race_time(text: str) -> str:
    """Read a race time as written ("1:30", "13.30", "5:30") into 24-hour "HH:MM"."""
    match = _RACE_TIME.match(text)
    if not match:
        raise BetError(f"'{text}' is not a race time; write it like 2:10 or 14:10")
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour > 23 or minute > 59:  # noqa: PLR2004 - clock limits
        raise BetError(f"'{text}' is not a race time; write it like 2:10 or 14:10")
    if 1 <= hour <= _LAST_AFTERNOON_HOUR_WRITTEN_SHORT:
        hour += 12
    return f"{hour:02d}:{minute:02d}"


def horse_key(name: str) -> str:
    """A spelling-tolerant key, so "Stumptown" and "STUMP TOWN" count as one horse."""
    folded = unicodedata.normalize("NFKD", name).casefold()
    return "".join(ch for ch in folded if ch.isalnum())
