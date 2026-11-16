import pytest

from .test_slips import festival, lucky15, post_slip  # noqa: F401 - festival is a fixture


def single(day_id, stake, horse="Tullyhill", time="1:30", settle_day=None):
    return {
        "day_id": day_id,
        "bet_type": "single",
        "unit_stake_pence": stake,
        "selections": [{"day_id": settle_day or day_id, "race_time": time, "horse_name": horse}],
    }


def settle(client, slip, pence):
    response = client.put(f"/api/slips/{slip['id']}/return", json={"return_pence": pence})
    assert response.status_code == 200, response.text


@pytest.fixture
def played(admin, member, festival):  # noqa: F811 - pytest fixture reuse
    tue, wed, jacko = festival["tue"], festival["wed"], festival["jacko"]
    # Maurizio: £30 Lucky 15 on Tuesday returning £86.50; £10 single on Wednesday, lost.
    first = post_slip(member, festival, lucky15(tue)).json()
    settle(member, first, 8_650)
    second = post_slip(member, festival, single(wed, 1_000, "Stumptown")).json()
    settle(member, second, 0)
    # Jacko: £100 single placed Tuesday on a Wednesday horse returning £250; £20 pending.
    third = post_slip(
        admin, festival, single(tue, 10_000, "STUMP TOWN", settle_day=wed) | {"user_id": jacko}
    ).json()
    settle(admin, third, 25_000)
    post_slip(admin, festival, single(wed, 2_000, "Ndaawi") | {"user_id": jacko})
    return festival


def standings(client, competition):
    return client.get(f"/api/competitions/{competition['id']}/standings").json()


def test_standings_totals_and_ranks(member, played):
    table = standings(member, played)
    rows = {row["display_name"]: row for row in table["rows"]}
    jacko, mo = rows["Jacko"], rows["Maurizio"]
    assert (jacko["staked_pence"], jacko["returned_pence"], jacko["profit_pence"]) == (
        12_000,
        25_000,
        13_000,
    )
    assert (mo["staked_pence"], mo["returned_pence"], mo["profit_pence"]) == (4_000, 8_650, 4_650)
    assert (jacko["rank"], mo["rank"]) == (1, 2)
    assert jacko["remaining_pence"] == 38_000
    assert jacko["pending_returns"] == 1
    assert mo["pending_returns"] == 0
    assert jacko["budget_status"] == mo["budget_status"] == "under"
    assert table["bob_addis_user_ids"] == [played["jacko"]]
    assert table["jfk_user_ids"] == [2]
    assert table["totals"] == {
        "staked_pence": 16_000,
        "returned_pence": 33_650,
        "pending_returns": 1,
        "slip_count": 4,
    }


def test_stakes_count_on_the_day_placed_and_returns_on_the_last_leg(member, played):
    rows = {row["display_name"]: row for row in standings(member, played)["rows"]}
    tue, wed = rows["Jacko"]["days"]
    assert (tue["staked_pence"], tue["returned_pence"], tue["profit_pence"]) == (10_000, 0, -10_000)
    assert (wed["staked_pence"], wed["returned_pence"], wed["profit_pence"]) == (
        2_000,
        25_000,
        23_000,
    )
    assert wed["cumulative_profit_pence"] == 13_000
    assert wed["cumulative_staked_pence"] == 12_000
    mo_tue, mo_wed = rows["Maurizio"]["days"]
    assert mo_tue["profit_pence"] == 5_650
    assert mo_wed["profit_pence"] == -1_000
    # After Tuesday Maurizio led; after Wednesday Jacko did.
    assert (mo_tue["rank"], tue["rank"]) == (1, 2)
    assert (mo_wed["rank"], wed["rank"]) == (2, 1)


def test_daily_winners(member, played):
    table = standings(member, played)
    winners = {w["day_id"]: w for w in table["daily_winners"]}
    assert winners[played["tue"]]["user_ids"] == [2]
    assert winners[played["tue"]]["profit_pence"] == 5_650
    assert winners[played["wed"]]["user_ids"] == [played["jacko"]]
    rows = {row["display_name"]: row["days_won"] for row in table["rows"]}
    assert rows == {"Jacko": 1, "Maurizio": 1}


def test_void_slips_do_not_count(member, played):
    slips = member.get(f"/api/competitions/{played['id']}/slips", params={"user_id": 2}).json()
    for slip in slips:
        member.post(f"/api/slips/{slip['id']}/void", json={})
    mo = next(r for r in standings(member, played)["rows"] if r["display_name"] == "Maurizio")
    assert (mo["staked_pence"], mo["profit_pence"], mo["slip_count"]) == (0, 0, 0)
    assert mo["remaining_pence"] == 50_000


def test_entrants_with_no_bets_are_listed_and_ties_share_a_rank(admin, festival):  # noqa: F811
    table = standings(admin, festival)
    assert [row["rank"] for row in table["rows"]] == [1, 1]
    assert table["daily_winners"] == []
    assert len(table["bob_addis_user_ids"]) == 2
    assert all(row["budget_status"] == "under" for row in table["rows"])


def test_budget_status(member, festival):  # noqa: F811
    tue = festival["tue"]
    post_slip(member, festival, single(tue, 50_000))
    mo = next(r for r in standings(member, festival)["rows"] if r["display_name"] == "Maurizio")
    assert mo["budget_status"] == "complete"
    post_slip(member, festival, single(tue, 100) | {"confirm_over_budget": True})
    mo = next(r for r in standings(member, festival)["rows"] if r["display_name"] == "Maurizio")
    assert (mo["budget_status"], mo["remaining_pence"]) == ("over", -100)


def test_stats(member, played):
    stats = member.get(f"/api/competitions/{played['id']}/stats").json()
    records = stats["records"]
    assert records["biggest_return"]["return_pence"] == 25_000
    assert records["biggest_return"]["user_id"] == played["jacko"]
    assert records["best_multiple"]["multiple"] == 2.88  # £86.50 from £30
    assert records["biggest_losing_stake"]["stake_pence"] == 1_000
    assert records["biggest_single_stake"]["stake_pence"] == 10_000
    assert records["best_day"]["profit_pence"] == 23_000
    assert records["worst_day"]["profit_pence"] == -10_000

    people = {p["user_id"]: p for p in stats["people"]}
    mo = people[2]
    assert (mo["slip_count"], mo["settled_count"], mo["winning_count"]) == (2, 2, 1)
    assert mo["strike_rate"] == 0.5
    assert (mo["longest_winning_run"], mo["longest_losing_run"]) == (1, 1)
    assert mo["each_way_share"] == 0.75
    assert mo["average_stake_pence"] == 2_000
    assert mo["biggest_stake_share_of_budget"] == 0.06
    assert people[played["jacko"]]["favourite_bet_type"] == "single"

    stumptown = next(h for h in stats["horses"] if h["horse_name"] in {"Stumptown", "STUMP TOWN"})
    assert stumptown["backer_count"] == 2
    assert stumptown["spellings"] == ["STUMP TOWN", "Stumptown"]
    # Both backed Stumptown (spelt two ways) and Ndaawi.
    assert stats["copycats"][0]["shared_count"] == 2
    lone = {h["horse_name"] for h in stats["lone_picks"]}
    assert lone == {"Quilixios", "Iberico Lord", "Love Envoi"}
    types = {t["bet_type"]: t for t in stats["bet_types"]}
    assert types["single"]["slip_count"] == 3
    assert types["lucky15"]["returned_pence"] == 8_650
    styles = {s["each_way"]: s for s in stats["styles"]}
    assert styles[True]["staked_pence"] == 3_000
    assert stats["comebacks"] == [{"user_id": played["jacko"], "places_climbed": 1}]


def test_stats_with_no_bets(member, festival):  # noqa: F811
    stats = member.get(f"/api/competitions/{festival['id']}/stats").json()
    assert all(value is None for value in stats["records"].values())
    assert stats["horses"] == []
    assert stats["people"][0]["strike_rate"] is None


def test_standings_need_sign_in_and_a_real_competition(anon, member):
    assert anon.get("/api/competitions/1/standings").status_code == 401
    assert member.get("/api/competitions/999/standings").status_code == 404
    assert member.get("/api/competitions/999/stats").status_code == 404
