import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, User

from .conftest import ADMIN_PASSWORD, ADMIN_USERNAME, MEMBER_PASSWORD, make_user, sign_in

ADMIN_ROUTES = [
    ("get", "/api/admin/users"),
    ("post", "/api/admin/users"),
    ("patch", "/api/admin/users/1"),
    ("post", "/api/admin/competitions"),
    ("patch", "/api/admin/competitions/1"),
    ("post", "/api/admin/competitions/1/days"),
    ("delete", "/api/admin/competitions/1/days/1"),
    ("put", "/api/admin/competitions/1/entries/1"),
    ("delete", "/api/admin/competitions/1/entries/1"),
]


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_routes_reject_anonymous_callers(anon, method, path):
    assert anon.request(method, path).status_code == 401


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
def test_admin_routes_reject_members(member, method, path):
    assert member.request(method, path).status_code == 403


def test_create_user_defaults_to_member_and_can_sign_in(app, admin):
    response = admin.post(
        "/api/admin/users",
        json={
            "username": " Looker ",
            "display_name": " Looker's Bar ",
            "password": MEMBER_PASSWORD,
        },
    )
    assert response.status_code == 201
    assert response.json() == {
        "id": 2,
        "username": "looker",
        "display_name": "Looker's Bar",
        "role": "member",
        "is_active": True,
    }
    assert sign_in(app, "looker", MEMBER_PASSWORD).get("/api/auth/me").status_code == 200


def test_create_user_stores_only_a_hash_and_audits_without_the_password(app, admin):
    make_user(admin, "bob", password="a-very-secret-pw")
    with Session(app.state.engine) as db:
        stored = db.scalar(select(User.password_hash).where(User.username == "bob"))
        audit_rows = db.scalars(select(AuditLog)).all()
    assert stored is not None
    assert "a-very-secret-pw" not in stored
    created = next(row for row in audit_rows if row.action == "user.created")
    assert created.actor_user_id == 1
    assert json.loads(created.detail) == {"role": "member", "username": "bob"}
    assert all("a-very-secret-pw" not in row.detail for row in audit_rows)


def test_duplicate_username_is_a_conflict(admin):
    make_user(admin, "bob")
    response = admin.post(
        "/api/admin/users",
        json={"username": "BOB", "display_name": "Other Bob", "password": MEMBER_PASSWORD},
    )
    assert response.status_code == 409
    assert len(admin.get("/api/admin/users").json()) == 2


@pytest.mark.parametrize(
    "overrides",
    [
        {"username": "a"},
        {"username": "has space"},
        {"username": "x" * 33},
        {"display_name": "   "},
        {"password": "short"},
        {"role": "owner"},
        {"is_admin": True},
    ],
)
def test_create_user_validation(admin, overrides):
    body = {"username": "bob", "display_name": "Bob", "password": MEMBER_PASSWORD} | overrides
    assert admin.post("/api/admin/users", json=body).status_code == 422


def test_list_users_is_sorted_by_display_name(admin):
    make_user(admin, "zed")
    make_user(admin, "alf")
    names = [user["display_name"] for user in admin.get("/api/admin/users").json()]
    assert names == ["Alf", "Zed", ADMIN_USERNAME]


def test_update_unknown_user_is_404(admin):
    assert admin.patch("/api/admin/users/999", json={"display_name": "X"}).status_code == 404


def test_update_display_name_and_role_is_audited_with_before_and_after(app, admin):
    user = make_user(admin, "bob")
    response = admin.patch(
        f"/api/admin/users/{user['id']}", json={"display_name": "Bobby", "role": "admin"}
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Bobby"
    assert response.json()["role"] == "admin"
    with Session(app.state.engine) as db:
        row = db.scalars(select(AuditLog).where(AuditLog.action == "user.updated")).one()
    assert json.loads(row.detail) == {
        "changes": {
            "display_name": {"from": "Bob", "to": "Bobby"},
            "role": {"from": "member", "to": "admin"},
        }
    }


def test_update_with_no_real_change_is_not_audited(admin, audit_actions):
    user = make_user(admin, "bob")
    before = audit_actions()
    assert (
        admin.patch(f"/api/admin/users/{user['id']}", json={"display_name": "Bob"}).status_code
        == 200
    )
    assert admin.patch(f"/api/admin/users/{user['id']}", json={}).status_code == 200
    assert audit_actions() == before


def test_password_reset_signs_the_user_out_and_changes_the_password(app, admin, member):
    response = admin.patch("/api/admin/users/2", json={"password": "reset-by-admin"})
    assert response.status_code == 200
    assert member.get("/api/auth/me").status_code == 401
    login = TestClient(app).post(
        "/api/auth/login", json={"username": "maurizio", "password": MEMBER_PASSWORD}
    )
    assert login.status_code == 401
    assert sign_in(app, "maurizio", "reset-by-admin").get("/api/auth/me").status_code == 200
    with Session(app.state.engine) as db:
        row = db.scalars(select(AuditLog).where(AuditLog.action == "user.updated")).one()
    assert json.loads(row.detail) == {"changes": {"password": "reset"}}


def test_deactivating_a_user_signs_them_out_immediately(admin, member):
    assert admin.patch("/api/admin/users/2", json={"is_active": False}).status_code == 200
    assert member.get("/api/auth/me").status_code == 401


def test_renaming_a_user_keeps_them_signed_in(admin, member):
    admin.patch("/api/admin/users/2", json={"display_name": "Mo"})
    assert member.get("/api/auth/me").json()["display_name"] == "Mo"


@pytest.mark.parametrize("change", [{"role": "member"}, {"is_active": False}])
def test_last_active_admin_cannot_be_demoted_or_deactivated(admin, change):
    make_user(admin, "bob")
    response = admin.patch("/api/admin/users/1", json=change)
    assert response.status_code == 409
    assert admin.get("/api/auth/me").json()["role"] == "admin"


def test_an_inactive_admin_does_not_count_as_a_spare(admin):
    spare = make_user(admin, "spare", role="admin")
    admin.patch(f"/api/admin/users/{spare['id']}", json={"is_active": False})
    assert admin.patch("/api/admin/users/1", json={"role": "member"}).status_code == 409


def test_last_admin_can_still_be_renamed_and_have_password_reset(app, admin):
    response = admin.patch(
        "/api/admin/users/1", json={"display_name": "The Boss", "password": "new-admin-pass"}
    )
    assert response.status_code == 200
    assert sign_in(app, ADMIN_USERNAME, "new-admin-pass").get("/api/auth/me").status_code == 200


@pytest.mark.parametrize("change", [{"role": "member"}, {"is_active": False}])
def test_an_admin_can_step_down_when_another_admin_remains(app, admin, change):
    make_user(admin, "second", role="admin", password=ADMIN_PASSWORD)
    assert admin.patch("/api/admin/users/1", json=change).status_code == 200
    second = sign_in(app, "second", ADMIN_PASSWORD)
    assert second.get("/api/admin/users").status_code == 200
    assert admin.get("/api/admin/users").status_code in (401, 403)


def test_a_demoted_inactive_admin_can_be_changed_freely(admin):
    spare = make_user(admin, "spare", role="admin")
    admin.patch(f"/api/admin/users/{spare['id']}", json={"is_active": False})
    response = admin.patch(f"/api/admin/users/{spare['id']}", json={"role": "member"})
    assert response.status_code == 200


def test_audit_log_is_admin_only_newest_first_and_filterable(admin, member):
    assert member.get("/api/admin/audit").status_code == 403
    rows = admin.get("/api/admin/audit").json()
    assert rows[0]["id"] > rows[-1]["id"]
    assert {row["action"] for row in rows} >= {"user.bootstrapped", "user.created", "auth.login"}
    created = next(row for row in rows if row["action"] == "user.created")
    assert created["actor_name"] == ADMIN_USERNAME
    assert created["detail"] == {"role": "member", "username": "maurizio"}
    only_users = admin.get("/api/admin/audit", params={"entity_type": "user", "limit": 2}).json()
    assert len(only_users) == 2
    assert all(row["entity_type"] == "user" for row in only_users)
    older = admin.get("/api/admin/audit", params={"before_id": rows[0]["id"]}).json()
    assert all(row["id"] < rows[0]["id"] for row in older)
    mine = admin.get("/api/admin/audit", params={"actor_user_id": 2}).json()
    assert all(row["actor_user_id"] == 2 for row in mine)
    bootstrapped = next(row for row in rows if row["action"] == "user.bootstrapped")
    assert bootstrapped["actor_name"] is None
