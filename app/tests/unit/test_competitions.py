import json

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog

from .conftest import make_user


def make_competition(admin, name="Cheltenham 2027", **extra):
    response = admin.post("/api/admin/competitions", json={"name": name} | extra)
    assert response.status_code == 201, response.text
    return response.json()


def audit_details(app, action):
    with Session(app.state.engine) as db:
        rows = db.scalars(select(AuditLog).where(AuditLog.action == action))
        return [json.loads(row.detail) for row in rows]


def test_competition_budget_defaults_to_500_pounds_in_pence(app, admin):
    competition = make_competition(admin)
    assert competition == {"id": 1, "name": "Cheltenham 2027", "budget_pence": 50_000}
    assert audit_details(app, "competition.created") == [
        {"budget_pence": 50_000, "name": "Cheltenham 2027"}
    ]


def test_competition_budget_can_be_set(admin):
    assert make_competition(admin, budget_pence=25_050)["budget_pence"] == 25_050


@pytest.mark.parametrize(
    "body",
    [
        {"name": ""},
        {"name": "x", "budget_pence": 0},
        {"name": "x", "budget_pence": -1},
        {"name": "x", "budget_pence": 500.5},
        {"name": "x", "budget_pence": 100_000_001},
        {"name": "x", "budget": 500},
    ],
)
def test_competition_validation(admin, body):
    assert admin.post("/api/admin/competitions", json=body).status_code == 422


def test_duplicate_competition_name_is_a_conflict(admin):
    make_competition(admin)
    response = admin.post("/api/admin/competitions", json={"name": "Cheltenham 2027"})
    assert response.status_code == 409


def test_update_competition_is_audited_with_before_and_after(app, admin):
    make_competition(admin)
    response = admin.patch(
        "/api/admin/competitions/1",
        json={"name": "Cheltenham Festival 2027", "budget_pence": 60_000},
    )
    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Cheltenham Festival 2027", "budget_pence": 60_000}
    assert audit_details(app, "competition.updated") == [
        {
            "changes": {
                "budget_pence": {"from": 50_000, "to": 60_000},
                "name": {"from": "Cheltenham 2027", "to": "Cheltenham Festival 2027"},
            }
        }
    ]


def test_update_competition_with_no_change_is_not_audited(app, admin):
    make_competition(admin)
    assert (
        admin.patch("/api/admin/competitions/1", json={"budget_pence": 50_000}).status_code == 200
    )
    assert audit_details(app, "competition.updated") == []


def test_renaming_onto_an_existing_competition_is_a_conflict_and_changes_nothing(
    app, admin, member
):
    make_competition(admin, "Cheltenham 2027")
    make_competition(admin, "Aintree 2027")
    response = admin.patch("/api/admin/competitions/2", json={"name": "Cheltenham 2027"})
    assert response.status_code == 409
    assert member.get("/api/competitions/2").json()["name"] == "Aintree 2027"
    assert audit_details(app, "competition.updated") == []


def test_update_unknown_competition_is_404(admin):
    assert admin.patch("/api/admin/competitions/9", json={"name": "x"}).status_code == 404


def test_days_are_listed_in_date_order(admin, member):
    make_competition(admin)
    second = admin.post(
        "/api/admin/competitions/1/days", json={"date": "2027-03-17", "label": " Ladies Day "}
    )
    first = admin.post("/api/admin/competitions/1/days", json={"date": "2027-03-16"})
    assert second.status_code == first.status_code == 201
    assert second.json() == {"id": 1, "date": "2027-03-17", "label": "Ladies Day"}
    assert member.get("/api/competitions/1").json()["days"] == [
        {"id": 2, "date": "2027-03-16", "label": None},
        {"id": 1, "date": "2027-03-17", "label": "Ladies Day"},
    ]


def test_blank_day_label_is_stored_as_none(admin):
    make_competition(admin)
    response = admin.post(
        "/api/admin/competitions/1/days", json={"date": "2027-03-16", "label": " "}
    )
    assert response.json()["label"] is None


def test_same_date_twice_is_a_conflict_but_fine_in_another_competition(admin):
    make_competition(admin, "Cheltenham 2027")
    make_competition(admin, "Other")
    body = {"date": "2027-03-16"}
    assert admin.post("/api/admin/competitions/1/days", json=body).status_code == 201
    assert admin.post("/api/admin/competitions/1/days", json=body).status_code == 409
    assert admin.post("/api/admin/competitions/2/days", json=body).status_code == 201


def test_day_validation_and_unknown_competition(admin):
    make_competition(admin)
    assert (
        admin.post("/api/admin/competitions/1/days", json={"date": "16/03/2027"}).status_code == 422
    )
    assert (
        admin.post("/api/admin/competitions/9/days", json={"date": "2027-03-16"}).status_code == 404
    )


def test_remove_day(app, admin, member):
    make_competition(admin)
    admin.post("/api/admin/competitions/1/days", json={"date": "2027-03-16"})
    assert admin.delete("/api/admin/competitions/1/days/1").status_code == 204
    assert member.get("/api/competitions/1").json()["days"] == []
    assert audit_details(app, "day.removed") == [{"competition_id": 1, "date": "2027-03-16"}]


def test_remove_day_must_name_the_right_competition(admin, member):
    make_competition(admin, "Cheltenham 2027")
    make_competition(admin, "Other")
    admin.post("/api/admin/competitions/1/days", json={"date": "2027-03-16"})
    assert admin.delete("/api/admin/competitions/2/days/1").status_code == 404
    assert admin.delete("/api/admin/competitions/1/days/9").status_code == 404
    assert len(member.get("/api/competitions/1").json()["days"]) == 1


def test_entering_users_and_who_sees_what(app, admin, member):
    make_competition(admin)
    make_user(admin, "alf")
    assert admin.put("/api/admin/competitions/1/entries/2").status_code == 204
    assert admin.put("/api/admin/competitions/1/entries/3").status_code == 204

    detail = member.get("/api/competitions/1").json()
    assert detail["entered"] is True
    assert detail["entrants"] == [
        {"user_id": 3, "display_name": "Alf"},
        {"user_id": 2, "display_name": "Maurizio"},
    ]
    assert member.get("/api/competitions").json() == [
        {"id": 1, "name": "Cheltenham 2027", "budget_pence": 50_000, "entered": True}
    ]
    # The admin is not entered, so sees the same competition as not theirs.
    assert admin.get("/api/competitions").json()[0]["entered"] is False
    assert admin.get("/api/competitions/1").json()["entered"] is False
    assert audit_details(app, "entry.added") == [
        {"competition_id": 1, "user_id": 2},
        {"competition_id": 1, "user_id": 3},
    ]


def test_entering_twice_is_harmless_and_audited_once(app, admin, member):
    make_competition(admin)
    assert admin.put("/api/admin/competitions/1/entries/2").status_code == 204
    assert admin.put("/api/admin/competitions/1/entries/2").status_code == 204
    assert len(member.get("/api/competitions/1").json()["entrants"]) == 1
    assert len(audit_details(app, "entry.added")) == 1


def test_entry_needs_a_real_competition_and_user(admin):
    make_competition(admin)
    assert admin.put("/api/admin/competitions/9/entries/1").status_code == 404
    assert admin.put("/api/admin/competitions/1/entries/9").status_code == 404


def test_remove_entry(app, admin, member):
    make_competition(admin)
    admin.put("/api/admin/competitions/1/entries/2")
    assert admin.delete("/api/admin/competitions/1/entries/2").status_code == 204
    assert member.get("/api/competitions/1").json()["entered"] is False
    assert admin.delete("/api/admin/competitions/1/entries/2").status_code == 404
    assert audit_details(app, "entry.removed") == [{"competition_id": 1, "user_id": 2}]


def test_competitions_need_sign_in(anon):
    assert anon.get("/api/competitions").status_code == 401
    assert anon.get("/api/competitions/1").status_code == 401


def test_newest_competition_is_listed_first(admin):
    make_competition(admin, "Cheltenham 2026")
    make_competition(admin, "Cheltenham 2027")
    names = [competition["name"] for competition in admin.get("/api/competitions").json()]
    assert names == ["Cheltenham 2027", "Cheltenham 2026"]


def test_unknown_competition_is_404(member):
    assert member.get("/api/competitions/9").status_code == 404
