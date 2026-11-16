import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import AuditLog

ADMIN_USERNAME = "boss"
ADMIN_PASSWORD = "admin-password"
MEMBER_PASSWORD = "member-password"


@pytest.fixture
def app():
    return create_app(
        Settings(
            database_url="sqlite://",
            bootstrap_admin_username=ADMIN_USERNAME,
            bootstrap_admin_password=ADMIN_PASSWORD,
            cookie_secure=False,
        )
    )


@pytest.fixture
def anon(app):
    """A client that is not signed in."""
    with TestClient(app) as client:
        yield client


def sign_in(app, username, password):
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
def admin(app, anon):
    return sign_in(app, ADMIN_USERNAME, ADMIN_PASSWORD)


def make_user(admin, username, role="member", password=MEMBER_PASSWORD):
    response = admin.post(
        "/api/admin/users",
        json={
            "username": username,
            "display_name": username.title(),
            "password": password,
            "role": role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def member(app, admin):
    make_user(admin, "maurizio")
    return sign_in(app, "maurizio", MEMBER_PASSWORD)


@pytest.fixture
def audit_actions(app, anon):
    def actions():
        with Session(app.state.engine) as db:
            return list(db.scalars(select(AuditLog.action).order_by(AuditLog.id)))

    return actions
