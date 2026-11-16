from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import utcnow
from app.deps import SESSION_COOKIE
from app.models import AuthSession

from .conftest import ADMIN_PASSWORD, ADMIN_USERNAME, MEMBER_PASSWORD, make_user, sign_in


def login(client, username, password):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def test_login_returns_the_user_without_any_password_material(anon):
    response = login(anon, ADMIN_USERNAME, ADMIN_PASSWORD)
    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "username": ADMIN_USERNAME,
        "display_name": ADMIN_USERNAME,
        "role": "admin",
        "is_active": True,
    }


def test_login_sets_a_long_lived_http_only_cookie(anon):
    header = login(anon, ADMIN_USERNAME, ADMIN_PASSWORD).headers["set-cookie"]
    assert header.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in header
    assert "SameSite=lax" in header
    assert f"Max-Age={30 * 24 * 3600}" in header
    assert "Secure" not in header  # the test app turns cookie_secure off


def test_cookie_is_secure_by_default():
    from app.config import Settings
    from app.main import create_app

    app = create_app(
        Settings(
            database_url="sqlite://",
            bootstrap_admin_username=ADMIN_USERNAME,
            bootstrap_admin_password=ADMIN_PASSWORD,
        )
    )
    with TestClient(app) as client:
        assert "Secure" in login(client, ADMIN_USERNAME, ADMIN_PASSWORD).headers["set-cookie"]


def test_username_is_case_and_space_insensitive(anon):
    assert login(anon, f"  {ADMIN_USERNAME.upper()} ", ADMIN_PASSWORD).status_code == 200


def test_wrong_password_and_unknown_user_look_the_same(anon):
    wrong = login(anon, ADMIN_USERNAME, "not-the-password")
    unknown = login(anon, "nobody", ADMIN_PASSWORD)
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert "set-cookie" not in wrong.headers


def test_only_the_token_hash_is_stored(app, anon):
    token = login(anon, ADMIN_USERNAME, ADMIN_PASSWORD).cookies[SESSION_COOKIE]
    with Session(app.state.engine) as db:
        stored = db.scalars(select(AuthSession.token_hash)).one()
    assert stored != token
    assert len(stored) == 64


def test_me_requires_sign_in(anon):
    assert anon.get("/api/auth/me").status_code == 401


def test_me_rejects_a_made_up_cookie(anon):
    anon.cookies.set(SESSION_COOKIE, "made-up")
    assert anon.get("/api/auth/me").status_code == 401


def test_me_returns_the_signed_in_user(member):
    assert member.get("/api/auth/me").json()["username"] == "maurizio"


def test_expired_session_is_rejected_and_cleared_on_next_login(app, admin):
    with Session(app.state.engine) as db:
        db.execute(update(AuthSession).values(expires_at=utcnow() - timedelta(seconds=1)))
        db.commit()
    assert admin.get("/api/auth/me").status_code == 401
    sign_in(app, ADMIN_USERNAME, ADMIN_PASSWORD)
    with Session(app.state.engine) as db:
        assert len(db.scalars(select(AuthSession)).all()) == 1


def test_logout_ends_the_session_on_the_server(app, admin):
    token = admin.cookies[SESSION_COOKIE]
    assert admin.post("/api/auth/logout").status_code == 204
    assert admin.cookies.get(SESSION_COOKIE) is None
    stolen = TestClient(app)
    stolen.cookies.set(SESSION_COOKIE, token)
    assert stolen.get("/api/auth/me").status_code == 401


def test_logout_when_not_signed_in_is_harmless(anon):
    assert anon.post("/api/auth/logout").status_code == 204


def test_inactive_user_cannot_sign_in(app, admin):
    user = make_user(admin, "lapsed")
    admin.patch(f"/api/admin/users/{user['id']}", json={"is_active": False})
    assert login(TestClient(app), "lapsed", MEMBER_PASSWORD).status_code == 401


def test_change_password(app, member, audit_actions):
    other_device = sign_in(app, "maurizio", MEMBER_PASSWORD)
    response = member.post(
        "/api/auth/password",
        json={"current_password": MEMBER_PASSWORD, "new_password": "brand-new-pass"},
    )
    assert response.status_code == 204
    assert member.get("/api/auth/me").status_code == 200  # this device stays signed in
    assert other_device.get("/api/auth/me").status_code == 401  # others are signed out
    assert login(TestClient(app), "maurizio", MEMBER_PASSWORD).status_code == 401
    assert login(TestClient(app), "maurizio", "brand-new-pass").status_code == 200
    assert "user.password_changed" in audit_actions()


def test_change_password_needs_the_current_one(app, member):
    response = member.post(
        "/api/auth/password",
        json={"current_password": "guess-guess", "new_password": "brand-new-pass"},
    )
    assert response.status_code == 400
    assert login(TestClient(app), "maurizio", MEMBER_PASSWORD).status_code == 200


def test_change_password_rejects_a_short_password(member):
    response = member.post(
        "/api/auth/password", json={"current_password": MEMBER_PASSWORD, "new_password": "short"}
    )
    assert response.status_code == 422


def test_login_is_audited(admin, audit_actions):
    assert audit_actions() == ["user.bootstrapped", "auth.login"]
