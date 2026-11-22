import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import DEFAULT_DATABASE_URL, Settings
from app.main import create_app
from app.models import User

from .conftest import ADMIN_PASSWORD, ADMIN_USERNAME


def user_count(app):
    with Session(app.state.engine) as db:
        return db.scalar(select(func.count()).select_from(User))


def test_health_needs_no_sign_in(anon):
    response = anon.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_starts_without_bootstrap_credentials_and_creates_nobody():
    app = create_app(Settings(database_url="sqlite://"))
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert user_count(app) == 0


def test_bootstrap_needs_both_username_and_password():
    app = create_app(Settings(database_url="sqlite://", bootstrap_admin_username="boss"))
    with TestClient(app):
        assert user_count(app) == 0


def test_bootstrap_creates_one_admin_and_is_audited(app, anon, audit_actions):
    with Session(app.state.engine) as db:
        user = db.scalars(select(User)).one()
    assert (user.username, user.role, user.is_active) == (ADMIN_USERNAME, "admin", True)
    assert ADMIN_PASSWORD not in user.password_hash
    assert audit_actions() == ["user.bootstrapped"]


def test_bootstrap_does_nothing_once_any_user_exists(tmp_path):
    url = f"sqlite:///{tmp_path / 'rbs.sqlite3'}"
    first = create_app(
        Settings(database_url=url, bootstrap_admin_username="one", bootstrap_admin_password="p" * 8)
    )
    with TestClient(first):
        pass
    second = create_app(
        Settings(database_url=url, bootstrap_admin_username="two", bootstrap_admin_password="p" * 8)
    )
    with TestClient(second), Session(second.state.engine) as db:
        assert list(db.scalars(select(User.username))) == ["one"]


def test_settings_defaults(monkeypatch):
    for name in (
        "RBS_DATABASE_URL",
        "RBS_ADMIN_USERNAME",
        "RBS_ADMIN_PASSWORD",
        "RBS_COOKIE_SECURE",
    ):
        monkeypatch.delenv(name, raising=False)
    settings = Settings.from_env()
    assert settings.database_url == DEFAULT_DATABASE_URL
    assert settings.bootstrap_admin_username is None
    assert settings.bootstrap_admin_password is None
    assert settings.cookie_secure is True


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("RBS_DATABASE_URL", "sqlite://")
    monkeypatch.setenv("RBS_ADMIN_USERNAME", "boss")
    monkeypatch.setenv("RBS_ADMIN_PASSWORD", "secret-pass")
    monkeypatch.setenv("RBS_COOKIE_SECURE", " False ")
    settings = Settings.from_env()
    assert settings.database_url == "sqlite://"
    assert settings.bootstrap_admin_username == "boss"
    assert settings.bootstrap_admin_password == "secret-pass"
    assert settings.cookie_secure is False


def test_create_app_reads_the_environment_by_default(monkeypatch):
    monkeypatch.setenv("RBS_DATABASE_URL", "sqlite://")
    assert create_app().state.settings.database_url == "sqlite://"


def test_blank_bootstrap_username_creates_nobody():
    app = create_app(
        Settings(
            database_url="sqlite://",
            bootstrap_admin_username="   ",
            bootstrap_admin_password="p" * 8,
        )
    )
    with TestClient(app):
        assert user_count(app) == 0


def test_bootstrap_username_is_trimmed_and_lower_cased():
    app = create_app(
        Settings(
            database_url="sqlite://",
            bootstrap_admin_username=" Tom ",
            bootstrap_admin_password="p" * 8,
        )
    )
    with TestClient(app), Session(app.state.engine) as db:
        user = db.scalars(select(User)).one()
        assert (user.username, user.display_name) == ("tom", "Tom")


def test_bootstrap_password_too_long_to_sign_in_with_is_refused_at_start_up():
    assert Settings(bootstrap_admin_password="p" * 128).bootstrap_admin_password == "p" * 128
    with pytest.raises(ValueError, match="at most 128 characters"):
        Settings(bootstrap_admin_password="p" * 129)


def test_upload_dir_setting(monkeypatch):
    monkeypatch.setenv("RBS_UPLOAD_DIR", "/srv/sheets")
    assert Settings.from_env().upload_dir == "/srv/sheets"
    monkeypatch.delenv("RBS_UPLOAD_DIR")
    assert Settings.from_env().upload_dir == "/data/uploads"


def test_ocr_settings(monkeypatch):
    assert not Settings().ocr_enabled
    monkeypatch.setenv("RBS_OCR_ENDPOINT", " https://rbs.cognitiveservices.azure.com/ ")
    monkeypatch.setenv("RBS_OCR_KEY", " key ")
    settings = Settings.from_env()
    assert (settings.ocr_endpoint, settings.ocr_key) == (
        "https://rbs.cognitiveservices.azure.com/",
        "key",
    )
    assert settings.ocr_enabled
    assert "ocr_key" not in repr(settings)
    monkeypatch.setenv("RBS_OCR_KEY", "  ")
    assert not Settings.from_env().ocr_enabled


def test_ocr_endpoint_must_be_https():
    with pytest.raises(ValueError, match="must start with https://"):
        Settings(ocr_endpoint="http://rbs.cognitiveservices.azure.com")
