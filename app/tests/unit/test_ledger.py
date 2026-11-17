import datetime as dt

from app import ledger

TUE = ledger.DayInfo(1, dt.date(2027, 3, 16), None)
WED = ledger.DayInfo(2, dt.date(2027, 3, 17), None)
MO = ledger.EntrantInfo(1, "Mo")
JACKO = ledger.EntrantInfo(2, "Jacko")
AT = dt.datetime(2027, 3, 16, 12, tzinfo=dt.UTC)


def slip(slip_id, user_id, horses, **overrides):
    """A settled-or-pending single; overrides set stake_pence, return_pence or day."""
    day = overrides.pop("day", 1)
    fields = {
        "id": slip_id,
        "user_id": user_id,
        "day_id": day,
        "settle_day_id": day,
        "bet_type": "single",
        "each_way": False,
        "stake_pence": 100,
        "return_pence": None,
        "created_at": AT,
        "horses": tuple(horses),
    }
    return ledger.SlipInfo(**(fields | overrides))


def test_standings_with_nobody_entered():
    table = ledger.standings(50_000, [TUE], [], [])
    assert table["rows"] == []
    assert table["bob_addis_user_ids"] == table["jfk_user_ids"] == []
    assert table["daily_winners"] == []


def test_horse_names_without_letters_or_digits_are_ignored():
    stats = ledger.statistics(50_000, [TUE], [MO], [slip(1, 1, ["--", "Stumptown"])])
    assert [horse["horse_name"] for horse in stats["horses"]] == ["Stumptown"]
    assert stats["horse_count"] == 1


def test_people_with_no_horses_in_common_are_not_copycats():
    slips = [slip(1, 1, ["Stumptown"]), slip(2, 2, ["Ndaawi"])]
    assert ledger.statistics(50_000, [TUE], [MO, JACKO], slips)["copycats"] == []


def test_comebacks_need_at_least_two_days():
    slips = [slip(1, 1, ["Stumptown"], return_pence=0), slip(2, 2, ["Ndaawi"], return_pence=500)]
    assert ledger.statistics(50_000, [TUE], [MO, JACKO], slips)["comebacks"] == []


def test_comeback_counts_places_climbed_to_the_latest_day():
    slips = [
        slip(1, 1, ["A"], stake_pence=100, return_pence=1_000, day=1),
        slip(2, 2, ["B"], stake_pence=100, return_pence=0, day=1),
        slip(3, 2, ["C"], stake_pence=100, return_pence=5_000, day=2),
    ]
    stats = ledger.statistics(50_000, [TUE, WED], [MO, JACKO], slips)
    assert stats["comebacks"] == [{"user_id": 2, "places_climbed": 1}]


def test_a_day_where_only_an_earlier_losing_bet_settled_has_no_winner():
    # Placed Tuesday, last leg Wednesday, lost; nobody staked or won anything on Wednesday.
    slips = [slip(1, 1, ["A", "B"], return_pence=0, settle_day_id=2)]
    table = ledger.standings(50_000, [TUE, WED], [MO, JACKO], slips)
    assert [winner["day_id"] for winner in table["daily_winners"]] == [1]
    assert ledger.statistics(50_000, [TUE, WED], [MO, JACKO], slips)["horse_count"] == 2


def test_a_horse_written_twice_on_one_slip_counts_as_one_slip():
    stats = ledger.statistics(50_000, [TUE], [MO], [slip(1, 1, ["Stumptown", "STUMP TOWN"])])
    [horse] = stats["horses"]
    assert horse["slip_count"] == 1
    assert horse["spellings"] == ["STUMP TOWN", "Stumptown"]
