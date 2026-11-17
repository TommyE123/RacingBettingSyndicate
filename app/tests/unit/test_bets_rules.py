from math import comb

import pytest

from app.bets import (
    BET_TYPES,
    BetError,
    horse_key,
    line_count,
    normalise_race_time,
    total_stake,
    unit_stake_from_total,
)


@pytest.mark.parametrize(
    ("bet_type", "selections", "lines"),
    [
        ("single", 1, 1),
        ("double", 2, 1),
        ("treble", 3, 1),
        ("accumulator", 6, 1),
        ("trixie", 3, 4),
        ("patent", 3, 7),
        ("yankee", 4, 11),
        ("lucky15", 4, 15),
        ("canadian", 5, 26),
        ("lucky31", 5, 31),
        ("heinz", 6, 57),
        ("lucky63", 6, 63),
        ("super_heinz", 7, 120),
        ("goliath", 8, 247),
    ],
)
def test_fixed_line_counts(bet_type, selections, lines):
    assert line_count(bet_type, selections, None) == lines


@pytest.mark.parametrize(
    ("bet_type", "selections", "smallest_fold", "with_singles"),
    [
        ("trixie", 3, 2, False),
        ("patent", 3, 2, True),
        ("yankee", 4, 2, False),
        ("lucky15", 4, 2, True),
        ("canadian", 5, 2, False),
        ("lucky31", 5, 2, True),
        ("heinz", 6, 2, False),
        ("lucky63", 6, 2, True),
        ("super_heinz", 7, 2, False),
        ("goliath", 8, 2, False),
    ],
)
def test_full_cover_line_counts_are_the_sum_of_combinations(
    bet_type, selections, smallest_fold, with_singles
):
    first = 1 if with_singles else smallest_fold
    expected = sum(comb(selections, size) for size in range(first, selections + 1))
    assert BET_TYPES[bet_type].fixed_lines == expected


@pytest.mark.parametrize(
    ("selections", "fold", "lines"), [(5, 4, 5), (5, 2, 10), (3, 1, 3), (4, 4, 1), (6, 3, 20)]
)
def test_perm_line_counts(selections, fold, lines):
    assert line_count("perm", selections, fold) == lines


@pytest.mark.parametrize(
    ("bet_type", "selections", "fold", "message"),
    [
        ("yankee", 3, None, "needs 4 horses"),
        ("accumulator", 1, None, "needs 2 to 20 horses"),
        ("perm", 5, None, "perm size"),
        ("perm", 3, 4, "perm size"),
        ("perm", 3, 0, "perm size"),
        ("double", 2, 2, "Only a Perm"),
        ("forecast", 2, None, "Unknown bet type"),
    ],
)
def test_line_count_rejects_slips_that_do_not_add_up(bet_type, selections, fold, message):
    with pytest.raises(BetError, match=message):
        line_count(bet_type, selections, fold)


@pytest.mark.parametrize(
    ("unit", "lines", "each_way", "total"),
    [
        # The worked totals from real sheets.
        (100, 15, True, 3000),  # £1 e/w Lucky 15 = £30
        (500, 7, False, 3500),  # £5 win Patent = £35
        (200, 26, False, 5200),  # £2 win Canadian = £52
        (200, 11, True, 4400),  # £2 e/w Yankee = £44
        (300, 11, True, 6600),  # £3 e/w Yankee = £66
        (50, 15, True, 1500),  # 50p e/w Lucky 15 = £15
        (250, 1, True, 500),  # £2.50 e/w double = £5
    ],
)
def test_total_stake(unit, lines, each_way, total):
    assert total_stake(unit, lines, each_way) == total
    assert unit_stake_from_total(total, lines, each_way) == unit


def test_total_must_split_into_whole_pence():
    assert unit_stake_from_total(1500, 5, False) == 300  # "4-folds £15" from 5
    assert unit_stake_from_total(600, 15, True) == 20  # "E/W Lucky 15 £6" = 20p a line
    with pytest.raises(BetError, match="does not split evenly"):
        unit_stake_from_total(1000, 3, False)


@pytest.mark.parametrize(
    ("written", "stored"),
    [
        ("1:30", "13:30"),
        ("2.10", "14:10"),
        ("14:10", "14:10"),
        (" 5 : 30 ", "17:30"),
        ("9:59", "21:59"),
        ("12:45", "12:45"),
        ("10:15", "10:15"),
        ("0:05", "00:05"),
    ],
)
def test_race_times_are_read_as_racing_hours(written, stored):
    assert normalise_race_time(written) == stored


@pytest.mark.parametrize("written", ["130", "2pm", "25:00", "14:60", "", "1:3"])
def test_bad_race_times_are_rejected(written):
    with pytest.raises(BetError, match="not a race time"):
        normalise_race_time(written)


def test_horse_key_tolerates_spelling_noise():
    assert horse_key("Stumptown") == horse_key("STUMP TOWN") == horse_key(" stump-town ")
    assert horse_key("C'est Ta Chance") == horse_key("cest ta chance")
    assert horse_key("Éclat") == horse_key("eclat")
    assert horse_key("Ndaawi") != horse_key("Ndwaawi")
