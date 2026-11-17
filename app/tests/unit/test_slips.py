import json

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog

from .conftest import make_user, sign_in

TUESDAY = "2027-03-16"
WEDNESDAY = "2027-03-17"


@pytest.fixture
def festival(admin, member):
    """A £500 competition with two days, the member and one more entrant."""
    competition = admin.post("/api/admin/competitions", json={"name": "Cheltenham 2027"}).json()
    cid = competition["id"]
    tuesday = admin.post(f"/api/admin/competitions/{cid}/days", json={"date": TUESDAY}).json()
    wednesday = admin.post(f"/api/admin/competitions/{cid}/days", json={"date": WEDNESDAY}).json()
    other = make_user(admin, "jacko")
    for user_id in (2, other["id"]):
        assert admin.put(f"/api/admin/competitions/{cid}/entries/{user_id}").status_code == 204
    return {"id": cid, "tue": tuesday["id"], "wed": wednesday["id"], "jacko": other["id"]}


def lucky15(day_id, **overrides):
    body = {
        "day_id": day_id,
        "bet_type": "lucky15",
        "each_way": True,
        "unit_stake_pence": 100,
        "selections": [
            {"day_id": day_id, "race_time": "2:10", "horse_name": "Quilixios"},
            {"day_id": day_id, "race_time": "3:30", "horse_name": "Iberico Lord"},
            {"day_id": day_id, "race_time": "4:10", "horse_name": "Love  Envoi"},
            {"day_id": day_id, "race_time": "4:50", "horse_name": "Ndaawi", "note": "w/out fav"},
        ],
    }
    return body | overrides


def post_slip(client, festival, body):
    return client.post(f"/api/competitions/{festival['id']}/slips", json=body)


def test_member_enters_a_lucky15_and_the_cost_is_worked_out(member, festival):
    response = post_slip(member, festival, lucky15(festival["tue"]))
    assert response.status_code == 201, response.text
    slip = response.json()
    assert slip["bet_label"] == "Lucky 15"
    assert (slip["line_count"], slip["unit_stake_pence"], slip["stake_pence"]) == (15, 100, 3000)
    assert slip["return_pence"] is None
    assert slip["profit_pence"] is None
    assert slip["display_name"] == slip["created_by_name"] == "Maurizio"
    assert [s["race_time"] for s in slip["selections"]] == ["14:10", "15:30", "16:10", "16:50"]
    assert slip["selections"][2]["horse_name"] == "Love Envoi"
    assert slip["selections"][3]["note"] == "w/out fav"
    assert slip["over_budget"] is False


def test_total_stake_can_be_given_instead_of_the_unit(member, festival):
    body = lucky15(festival["tue"], unit_stake_pence=None, stake_pence=600)
    slip = post_slip(member, festival, body).json()
    assert (slip["unit_stake_pence"], slip["stake_pence"]) == (20, 600)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"unit_stake_pence": None}, "either the stake per bet or the total"),
        ({"stake_pence": 3000}, "either the stake per bet or the total"),
        ({"unit_stake_pence": None, "stake_pence": 1001}, "does not split evenly"),
        ({"bet_type": "yankee", "selections": []}, None),
        ({"bet_type": "canadian"}, "needs 5 horses"),
        ({"bet_type": "perm"}, "perm size"),
        ({"fold_size": 2}, "Only a Perm"),
        ({"bet_type": "exacta"}, "Unknown bet type"),
        ({"day_id": 9999}, "not part of this competition"),
    ],
)
def test_slips_that_do_not_add_up_are_rejected(member, festival, overrides, message):
    response = post_slip(member, festival, lucky15(festival["tue"]) | overrides)
    assert response.status_code == 422
    if message:
        assert message in response.text


def test_a_leg_on_a_day_outside_the_competition_is_rejected(member, festival):
    body = lucky15(festival["tue"])
    body["selections"][1]["day_id"] = 9999
    response = post_slip(member, festival, body)
    assert response.status_code == 422
    assert "Horse 2" in response.text


def test_a_bad_race_time_names_the_problem(member, festival):
    body = lucky15(festival["tue"])
    body["selections"][0]["race_time"] = "2pm"
    response = post_slip(member, festival, body)
    assert response.status_code == 422
    assert "not a race time" in response.text


def test_perm_four_folds_from_five(member, festival):
    tue = festival["tue"]
    body = {
        "day_id": tue,
        "bet_type": "perm",
        "fold_size": 4,
        "stake_pence": 1500,
        "selections": [
            {"day_id": tue, "race_time": time, "horse_name": name}
            for time, name in [
                ("1:30", "Mystical Power"),
                ("2:10", "Gaelic Warrior"),
                ("3:30", "State Man"),
                ("4:10", "Lossiemouth"),
                ("5:30", "Embassy Gardens"),
            ]
        ],
    }
    slip = post_slip(member, festival, body).json()
    assert (slip["line_count"], slip["unit_stake_pence"], slip["fold_size"]) == (5, 300, 4)


def test_anonymous_and_non_entrants_cannot_enter_slips(anon, admin, festival):
    assert post_slip(anon, festival, lucky15(festival["tue"])).status_code == 401
    response = post_slip(admin, festival, lucky15(festival["tue"]))
    assert response.status_code == 409
    assert "You are not entered" in response.text


def test_members_cannot_enter_for_others_but_admins_can(app, admin, member, festival):
    body = lucky15(festival["tue"], user_id=festival["jacko"])
    assert post_slip(member, festival, body).status_code == 403
    slip = post_slip(admin, festival, body).json()
    assert (slip["user_id"], slip["display_name"]) == (festival["jacko"], "Jacko")
    assert slip["created_by_name"] == "boss"
    lapsed = make_user(admin, "lapsed")
    missing = post_slip(admin, festival, lucky15(festival["tue"], user_id=lapsed["id"]))
    assert missing.status_code == 409
    assert "That person is not entered" in missing.text


def test_going_over_budget_needs_confirmation_and_is_flagged(member, festival):
    tue = festival["tue"]
    big = {
        "day_id": tue,
        "bet_type": "single",
        "unit_stake_pence": 48_000,
        "selections": [{"day_id": tue, "race_time": "1:30", "horse_name": "Tullyhill"}],
    }
    assert post_slip(member, festival, big).json()["over_budget"] is False

    refused = post_slip(member, festival, lucky15(tue))
    assert refused.status_code == 409
    detail = refused.json()["detail"]
    assert detail["code"] == "over_budget"
    assert (detail["remaining_pence"], detail["total_after_pence"]) == (2000, 51_000)
    assert "£510.00" in detail["message"]

    accepted = post_slip(member, festival, lucky15(tue, confirm_over_budget=True))
    assert accepted.status_code == 201
    assert accepted.json()["over_budget"] is True
    listed = member.get(f"/api/competitions/{festival['id']}/slips").json()
    assert all(slip["over_budget"] for slip in listed)


def test_exactly_the_budget_is_allowed_without_confirmation(member, festival):
    tue = festival["tue"]
    body = {
        "day_id": tue,
        "bet_type": "single",
        "unit_stake_pence": 50_000,
        "selections": [{"day_id": tue, "race_time": "1:30", "horse_name": "Tullyhill"}],
    }
    assert post_slip(member, festival, body).status_code == 201


def test_everyone_sees_every_slip_with_filters(admin, member, festival):
    tue, wed = festival["tue"], festival["wed"]
    post_slip(member, festival, lucky15(tue))
    post_slip(member, festival, lucky15(wed))
    post_slip(admin, festival, lucky15(tue, user_id=festival["jacko"]))
    jacko = sign_in(admin.app, "jacko", "member-password")
    base = f"/api/competitions/{festival['id']}/slips"
    assert len(jacko.get(base).json()) == 3
    assert [s["day_id"] for s in jacko.get(base).json()] == [wed, tue, tue]
    assert len(jacko.get(base, params={"user_id": 2}).json()) == 2
    assert len(jacko.get(base, params={"day_id": tue}).json()) == 2
    assert jacko.get("/api/competitions/999/slips").status_code == 404


def test_return_is_declared_changed_and_cleared_with_history(app, member, festival):
    slip = post_slip(member, festival, lucky15(festival["tue"])).json()
    url = f"/api/slips/{slip['id']}/return"
    declared = member.put(url, json={"return_pence": 8_650}).json()
    assert (declared["return_pence"], declared["profit_pence"]) == (8_650, 5_650)
    assert member.put(url, json={"return_pence": 8_650}).status_code == 200  # no change
    lost = member.put(url, json={"return_pence": 0}).json()
    assert lost["profit_pence"] == -3_000
    cleared = member.put(url, json={"return_pence": None}).json()
    assert cleared["return_pence"] is None
    assert member.put(url, json={"return_pence": -1}).status_code == 422

    history = member.get(f"/api/slips/{slip['id']}/history").json()
    assert [h["action"] for h in history] == [
        "slip.created",
        "slip.return_set",
        "slip.return_set",
        "slip.return_cleared",
    ]
    assert history[1]["detail"] == {"changes": {"return_pence": {"from": None, "to": 8650}}}
    assert history[0]["actor_name"] == "Maurizio"


def test_only_the_owner_or_an_admin_can_change_a_slip(app, admin, member, festival):
    slip = post_slip(member, festival, lucky15(festival["tue"])).json()
    jacko = sign_in(app, "jacko", "member-password")
    sid = slip["id"]
    assert jacko.put(f"/api/slips/{sid}/return", json={"return_pence": 1}).status_code == 403
    assert jacko.post(f"/api/slips/{sid}/void", json={}).status_code == 403
    assert jacko.put(f"/api/slips/{sid}", json=lucky15(festival["tue"])).status_code == 403
    assert admin.put(f"/api/slips/{sid}/return", json={"return_pence": 1}).status_code == 200
    assert jacko.get(f"/api/slips/{sid}").status_code == 200


def test_editing_a_slip_replaces_it_and_records_what_changed(app, member, festival):
    slip = post_slip(member, festival, lucky15(festival["tue"])).json()
    body = lucky15(festival["tue"], bet_type="yankee", unit_stake_pence=200)
    edited = member.put(f"/api/slips/{slip['id']}", json=body).json()
    assert (edited["bet_type"], edited["line_count"], edited["stake_pence"]) == ("yankee", 11, 4400)
    assert edited["id"] == slip["id"]
    history = member.get(f"/api/slips/{slip['id']}/history").json()
    changes = history[-1]["detail"]["changes"]
    assert set(changes) == {"bet_type", "line_count", "stake_pence", "unit_stake_pence"}
    assert changes["stake_pence"] == {"from": 3000, "to": 4400}
    # Saving the same content again records nothing new.
    member.put(f"/api/slips/{slip['id']}", json=body)
    assert len(member.get(f"/api/slips/{slip['id']}/history").json()) == len(history)


def test_a_slip_cannot_be_moved_to_someone_else(admin, member, festival):
    slip = post_slip(member, festival, lucky15(festival["tue"])).json()
    body = lucky15(festival["tue"], user_id=festival["jacko"])
    response = admin.put(f"/api/slips/{slip['id']}", json=body)
    assert response.status_code == 422


def test_editing_over_budget_needs_confirmation(member, festival):
    slip = post_slip(member, festival, lucky15(festival["tue"])).json()
    body = lucky15(festival["tue"], unit_stake_pence=2_000)  # £600
    assert member.put(f"/api/slips/{slip['id']}", json=body).status_code == 409
    body["confirm_over_budget"] = True
    assert member.put(f"/api/slips/{slip['id']}", json=body).json()["over_budget"] is True


def test_void_and_restore(member, festival):
    slip = post_slip(member, festival, lucky15(festival["tue"])).json()
    sid = slip["id"]
    voided = member.post(f"/api/slips/{sid}/void", json={"reason": " entered twice "}).json()
    assert voided["voided_at"] is not None
    assert voided["void_reason"] == "entered twice"
    assert member.post(f"/api/slips/{sid}/void", json={}).status_code == 409
    assert member.put(f"/api/slips/{sid}/return", json={"return_pence": 5}).status_code == 409
    assert member.put(f"/api/slips/{sid}", json=lucky15(festival["tue"])).status_code == 409

    base = f"/api/competitions/{festival['id']}/slips"
    assert member.get(base).json() == []
    assert len(member.get(base, params={"include_void": True}).json()) == 1

    restored = member.post(f"/api/slips/{sid}/restore", json={}).json()
    assert restored["voided_at"] is None
    assert member.post(f"/api/slips/{sid}/restore", json={}).status_code == 409


def test_restoring_over_budget_needs_confirmation(member, festival):
    tue = festival["tue"]
    first = post_slip(member, festival, lucky15(tue)).json()
    member.post(f"/api/slips/{first['id']}/void", json={})
    single = {
        "day_id": tue,
        "bet_type": "single",
        "unit_stake_pence": 49_000,
        "selections": [{"day_id": tue, "race_time": "1:30", "horse_name": "Tullyhill"}],
    }
    post_slip(member, festival, single)
    assert member.post(f"/api/slips/{first['id']}/restore", json={}).status_code == 409
    restored = member.post(f"/api/slips/{first['id']}/restore", json={"confirm_over_budget": True})
    assert restored.json()["over_budget"] is True


def test_slip_audit_records_who_and_the_content(app, admin, festival):
    post_slip(admin, festival, lucky15(festival["tue"], user_id=festival["jacko"]))
    with Session(app.state.engine) as db:
        row = db.scalars(select(AuditLog).where(AuditLog.action == "slip.created")).one()
    detail = json.loads(row.detail)
    assert row.actor_user_id == 1
    assert detail["user_id"] == festival["jacko"]
    assert detail["stake_pence"] == 3000
    assert detail["selections"][0] == [festival["tue"], "14:10", "Quilixios", None]


def test_unknown_slip_is_404(member):
    assert member.get("/api/slips/999").status_code == 404
    assert member.get("/api/slips/999/history").status_code == 404


def test_bet_types_are_listed_for_signed_in_users(anon, member):
    assert anon.get("/api/bet-types").status_code == 401
    types = member.get("/api/bet-types").json()
    assert [t["key"] for t in types][:3] == ["single", "double", "treble"]
    assert next(t for t in types if t["key"] == "lucky15")["fixed_lines"] == 15


def test_a_day_or_entry_with_slips_cannot_be_removed(admin, member, festival):
    post_slip(member, festival, lucky15(festival["tue"]))
    cid = festival["id"]
    assert admin.delete(f"/api/admin/competitions/{cid}/days/{festival['tue']}").status_code == 409
    assert admin.delete(f"/api/admin/competitions/{cid}/entries/2").status_code == 409


def test_an_absurd_total_stake_is_refused(member, festival):
    # £100,000 a bet on an each-way Lucky 15 would be £3 million.
    body = lucky15(festival["tue"], unit_stake_pence=10_000_000)
    response = post_slip(member, festival, body)
    assert response.status_code == 422
    assert "too large" in response.text
