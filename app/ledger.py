"""Standings and statistics, worked out from slips every time and never stored.

Everything here is a pure function of plain values, so the money rules are easy to test:

- A slip's stake counts on the day it was placed.
- Its declared return counts on the day of its last leg (its "settle day").
- An undeclared return counts as nothing yet, and is reported as pending.
- Void slips are ignored.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from typing import TYPE_CHECKING

from app.bets import BET_TYPES, horse_key

if TYPE_CHECKING:
    import datetime as dt
    from collections.abc import Iterable, Sequence


@dataclass(frozen=True)
class DayInfo:
    id: int
    date: dt.date
    label: str | None


@dataclass(frozen=True)
class EntrantInfo:
    user_id: int
    display_name: str


@dataclass(frozen=True)
class SlipInfo:
    id: int
    user_id: int
    day_id: int
    settle_day_id: int
    bet_type: str
    each_way: bool
    stake_pence: int
    return_pence: int | None
    created_at: dt.datetime
    horses: tuple[str, ...]


def _rank(values: Sequence[tuple[int, int]]) -> dict[int, int]:
    """Standard competition ranking (1, 2, 2, 4) of (user_id, score), highest score first."""
    ordered = sorted(values, key=lambda item: -item[1])
    ranks: dict[int, int] = {}
    previous: int | None = None
    position = 0
    for index, (user_id, score) in enumerate(ordered, start=1):
        if score != previous:
            position = index
            previous = score
        ranks[user_id] = position
    return ranks


def budget_status(staked: int, budget: int) -> str:
    if staked > budget:
        return "over"
    if staked == budget:
        return "complete"
    return "under"


def standings(
    budget: int,
    days: Sequence[DayInfo],
    entrants: Sequence[EntrantInfo],
    slips: Iterable[SlipInfo],
) -> dict:
    day_order = [day.id for day in sorted(days, key=lambda day: day.date)]
    staked: dict[int, int] = defaultdict(int)
    returned: dict[int, int] = defaultdict(int)
    pending: dict[int, int] = defaultdict(int)
    slip_count: dict[int, int] = defaultdict(int)
    day_staked: dict[tuple[int, int], int] = defaultdict(int)
    day_returned: dict[tuple[int, int], int] = defaultdict(int)

    for slip in slips:
        staked[slip.user_id] += slip.stake_pence
        slip_count[slip.user_id] += 1
        day_staked[slip.user_id, slip.day_id] += slip.stake_pence
        if slip.return_pence is None:
            pending[slip.user_id] += 1
        else:
            returned[slip.user_id] += slip.return_pence
            day_returned[slip.user_id, slip.settle_day_id] += slip.return_pence

    def profit(user_id: int) -> int:
        return returned[user_id] - staked[user_id]

    ranks = _rank([(entrant.user_id, profit(entrant.user_id)) for entrant in entrants])

    rows = []
    for entrant in entrants:
        uid = entrant.user_id
        cumulative_profit = 0
        cumulative_staked = 0
        per_day = []
        for day_id in day_order:
            stake = day_staked[uid, day_id]
            back = day_returned[uid, day_id]
            cumulative_profit += back - stake
            cumulative_staked += stake
            per_day.append(
                {
                    "day_id": day_id,
                    "staked_pence": stake,
                    "returned_pence": back,
                    "profit_pence": back - stake,
                    "cumulative_profit_pence": cumulative_profit,
                    "cumulative_staked_pence": cumulative_staked,
                }
            )
        rows.append(
            {
                "user_id": uid,
                "display_name": entrant.display_name,
                "rank": ranks[uid],
                "staked_pence": staked[uid],
                "returned_pence": returned[uid],
                "profit_pence": profit(uid),
                "remaining_pence": budget - staked[uid],
                "budget_status": budget_status(staked[uid], budget),
                "pending_returns": pending[uid],
                "slip_count": slip_count[uid],
                "days": per_day,
            }
        )
    rows.sort(key=lambda row: (row["rank"], row["display_name"].casefold(), row["user_id"]))

    # Rank after each day, on profit to date, for the position chart.
    for day_index in range(len(day_order)):
        day_ranks = _rank(
            [(row["user_id"], row["days"][day_index]["cumulative_profit_pence"]) for row in rows]
        )
        for row in rows:
            row["days"][day_index]["rank"] = day_ranks[row["user_id"]]

    # A day's winner is the best of those who staked or got a return that day; people who
    # did nothing that day are not in the running, so their £0 cannot win it.
    daily_winners = []
    for day_index, day_id in enumerate(day_order):
        players = [
            row
            for row in rows
            if row["days"][day_index]["staked_pence"] or row["days"][day_index]["returned_pence"]
        ]
        if not players:
            # Nobody played this day, even if a losing bet from an earlier day settled here.
            continue
        best = max(row["days"][day_index]["profit_pence"] for row in players)
        daily_winners.append(
            {
                "day_id": day_id,
                "profit_pence": best,
                "user_ids": [
                    row["user_id"]
                    for row in players
                    if row["days"][day_index]["profit_pence"] == best
                ],
            }
        )
    days_won = Counter(uid for winner in daily_winners for uid in winner["user_ids"])
    for row in rows:
        row["days_won"] = days_won[row["user_id"]]

    leader = [row["user_id"] for row in rows if rows and row["rank"] == 1]
    if rows:
        worst = min(row["profit_pence"] for row in rows)
        last = [row["user_id"] for row in rows if row["profit_pence"] == worst]
    else:
        last = []
    return {
        "budget_pence": budget,
        "rows": rows,
        "daily_winners": daily_winners,
        # Bob Addis Memorial Trophy: most profit. JFK Blowout Trophy: biggest loss.
        "bob_addis_user_ids": leader,
        "jfk_user_ids": last,
        "totals": {
            "staked_pence": sum(staked.values()),
            "returned_pence": sum(returned.values()),
            "pending_returns": sum(pending.values()),
            "slip_count": sum(slip_count.values()),
        },
    }


def _streaks(results: Sequence[bool]) -> tuple[int, int]:
    """Longest run of winners and of losers."""
    best_win = best_loss = run_win = run_loss = 0
    for won in results:
        if won:
            run_win += 1
            run_loss = 0
        else:
            run_loss += 1
            run_win = 0
        best_win = max(best_win, run_win)
        best_loss = max(best_loss, run_loss)
    return best_win, best_loss


def _slip_ref(slip: SlipInfo, **extra: object) -> dict:
    return {
        "slip_id": slip.id,
        "user_id": slip.user_id,
        "bet_type": slip.bet_type,
        "stake_pence": slip.stake_pence,
        "return_pence": slip.return_pence,
        **extra,
    }


def statistics(  # noqa: PLR0912, PLR0915 - one pass that builds many small boards
    budget: int,
    days: Sequence[DayInfo],
    entrants: Sequence[EntrantInfo],
    slips: Sequence[SlipInfo],
) -> dict:
    day_dates = {day.id: day.date for day in days}
    table = standings(budget, days, entrants, slips)
    settled = [slip for slip in slips if slip.return_pence is not None]
    winners = [slip for slip in settled if slip.return_pence]

    records: dict[str, dict | None] = {
        "biggest_return": None,
        "best_multiple": None,
        "biggest_losing_stake": None,
        "best_day": None,
        "worst_day": None,
        "biggest_single_stake": None,
    }
    if winners:
        top = max(winners, key=lambda slip: (slip.return_pence, -slip.id))
        records["biggest_return"] = _slip_ref(top)
        multiple = max(
            winners, key=lambda slip: ((slip.return_pence or 0) / slip.stake_pence, -slip.id)
        )
        records["best_multiple"] = _slip_ref(
            multiple, multiple=round((multiple.return_pence or 0) / multiple.stake_pence, 2)
        )
    losers = [slip for slip in settled if slip.return_pence == 0]
    if losers:
        records["biggest_losing_stake"] = _slip_ref(
            max(losers, key=lambda slip: (slip.stake_pence, -slip.id))
        )
    if slips:
        records["biggest_single_stake"] = _slip_ref(
            max(slips, key=lambda slip: (slip.stake_pence, -slip.id))
        )

    day_results = [
        {"user_id": row["user_id"], "day_id": day["day_id"], "profit_pence": day["profit_pence"]}
        for row in table["rows"]
        for day in row["days"]
        if day["staked_pence"] or day["returned_pence"]
    ]
    if day_results:
        records["best_day"] = max(day_results, key=lambda item: item["profit_pence"])
        records["worst_day"] = min(day_results, key=lambda item: item["profit_pence"])

    by_user: dict[int, list[SlipInfo]] = defaultdict(list)
    for slip in slips:
        by_user[slip.user_id].append(slip)

    people = []
    for entrant in entrants:
        mine = by_user[entrant.user_id]
        mine_settled = sorted(
            (slip for slip in mine if slip.return_pence is not None),
            key=lambda slip: (day_dates.get(slip.settle_day_id), slip.created_at, slip.id),
        )
        win_streak, loss_streak = _streaks([bool(slip.return_pence) for slip in mine_settled])
        types = Counter(slip.bet_type for slip in mine)
        favourite = types.most_common(1)[0][0] if types else None
        staked = sum(slip.stake_pence for slip in mine)
        each_way = sum(slip.stake_pence for slip in mine if slip.each_way)
        people.append(
            {
                "user_id": entrant.user_id,
                "slip_count": len(mine),
                "settled_count": len(mine_settled),
                "winning_count": sum(1 for slip in mine_settled if slip.return_pence),
                "strike_rate": (
                    round(
                        sum(1 for slip in mine_settled if slip.return_pence) / len(mine_settled), 3
                    )
                    if mine_settled
                    else None
                ),
                "longest_winning_run": win_streak,
                "longest_losing_run": loss_streak,
                "favourite_bet_type": favourite,
                "average_stake_pence": staked // len(mine) if mine else 0,
                "each_way_share": round(each_way / staked, 3) if staked else None,
                "biggest_stake_share_of_budget": (
                    round(max(slip.stake_pence for slip in mine) / budget, 3) if mine else None
                ),
            }
        )

    bet_types = []
    for key, rule in BET_TYPES.items():
        of_type = [slip for slip in slips if slip.bet_type == key]
        if not of_type:
            continue
        type_settled = [slip for slip in of_type if slip.return_pence is not None]
        bet_types.append(
            {
                "bet_type": key,
                "label": rule.label,
                "slip_count": len(of_type),
                "staked_pence": sum(slip.stake_pence for slip in of_type),
                "returned_pence": sum(slip.return_pence or 0 for slip in of_type),
                "settled_staked_pence": sum(slip.stake_pence for slip in type_settled),
                "settled_returned_pence": sum(slip.return_pence or 0 for slip in type_settled),
                "winning_count": sum(1 for slip in type_settled if slip.return_pence),
                "settled_count": len(type_settled),
            }
        )

    styles = []
    for each_way in (False, True):
        group = [slip for slip in slips if slip.each_way == each_way]
        styles.append(
            {
                "each_way": each_way,
                "slip_count": len(group),
                "staked_pence": sum(slip.stake_pence for slip in group),
                "returned_pence": sum(slip.return_pence or 0 for slip in group),
            }
        )

    # Horses: spelling-tolerant, shown with the most common spelling.
    spellings: dict[str, Counter[str]] = defaultdict(Counter)
    backers: dict[str, set[int]] = defaultdict(set)
    horse_slips: Counter[str] = Counter()
    horses_by_user: dict[int, set[str]] = defaultdict(set)
    for slip in slips:
        on_this_slip: set[str] = set()
        for name in slip.horses:
            key = horse_key(name)
            if not key:
                continue
            spellings[key][name.strip()] += 1
            on_this_slip.add(key)
        for key in on_this_slip:
            backers[key].add(slip.user_id)
            horse_slips[key] += 1
            horses_by_user[slip.user_id].add(key)
    horses = sorted(
        (
            {
                "horse_name": spellings[key].most_common(1)[0][0],
                "backer_count": len(backers[key]),
                "slip_count": horse_slips[key],
                "user_ids": sorted(backers[key]),
                "spellings": sorted(spellings[key]),
            }
            for key in horse_slips
        ),
        key=lambda horse: (
            -horse["backer_count"],
            -horse["slip_count"],
            horse["horse_name"].casefold(),
        ),
    )
    lone_picks = [horse for horse in horses if horse["backer_count"] == 1]

    pairs = []
    for first, second in combinations(sorted(horses_by_user), 2):
        shared = horses_by_user[first] & horses_by_user[second]
        if not shared:
            continue
        union = horses_by_user[first] | horses_by_user[second]
        pairs.append(
            {
                "user_ids": [first, second],
                "shared_count": len(shared),
                "overlap": round(len(shared) / len(union), 3),
            }
        )
    pairs.sort(key=lambda pair: (-pair["shared_count"], -pair["overlap"], pair["user_ids"]))

    # Comeback: the biggest climb from a worst position at any day's end to the latest one.
    comebacks = []
    for row in table["rows"]:
        ranked_days = [day["rank"] for day in row["days"] if "rank" in day]
        if len(ranked_days) < 2:  # noqa: PLR2004 - a climb needs two days
            continue
        climb = max(ranked_days[:-1]) - ranked_days[-1]
        if climb > 0:
            comebacks.append({"user_id": row["user_id"], "places_climbed": climb})
    comebacks.sort(key=lambda item: -item["places_climbed"])

    return {
        "records": records,
        "people": people,
        "bet_types": bet_types,
        "styles": styles,
        "horses": horses[:25],
        "lone_picks": lone_picks[:25],
        "copycats": pairs[:10],
        "comebacks": comebacks[:5],
        "horse_count": len(horses),
    }
