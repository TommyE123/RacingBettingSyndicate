import logging

import pytest

from app import ocr
from app.config import Settings
from app.main import create_app

from .conftest import ADMIN_PASSWORD, ADMIN_USERNAME, sign_in
from .test_sheets import JPEG, upload
from .test_slips import festival  # noqa: F401 - a fixture

ENDPOINT = "https://example.cognitiveservices.azure.com"
KEY = "test-key"
HEIC = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 64


@pytest.fixture
def app(tmp_path):
    """The usual test app, with the photo reader set up."""
    return create_app(
        Settings(
            database_url="sqlite://",
            bootstrap_admin_username=ADMIN_USERNAME,
            bootstrap_admin_password=ADMIN_PASSWORD,
            cookie_secure=False,
            upload_dir=str(tmp_path / "uploads"),
            ocr_endpoint=ENDPOINT,
            ocr_key=KEY,
        )
    )


@pytest.fixture
def reader(monkeypatch):
    """Stands in for the Azure service and records what it was sent."""
    calls = []

    def fake_read_lines(endpoint, key, image):
        calls.append((endpoint, key, image))
        return ["1:30 Mystical Power", "2:10 Gaelic Warrior"]

    monkeypatch.setattr(ocr, "read_lines", fake_read_lines)
    return calls


def test_the_reader_reports_whether_it_is_set_up(anon, member, tmp_path):
    assert anon.get("/api/sheet-reader").status_code == 401
    assert member.get("/api/sheet-reader").json() == {"enabled": True}
    off = create_app(Settings(database_url="sqlite://", upload_dir=str(tmp_path)))
    assert not off.state.settings.ocr_enabled


def test_reading_a_sheet_saves_nothing(member, festival, reader, audit_actions):  # noqa: F811
    sheet = upload(member, festival).json()
    before = audit_actions()
    response = member.post(f"/api/sheets/{sheet['id']}/read")
    assert response.status_code == 200, response.text
    assert response.json() == {"lines": ["1:30 Mystical Power", "2:10 Gaelic Warrior"]}
    assert reader == [(ENDPOINT, KEY, JPEG)]
    assert audit_actions() == before
    slips = member.get(
        f"/api/competitions/{festival['id']}/slips", params={"sheet_id": sheet["id"]}
    )
    assert slips.json() == []


def test_only_the_owner_or_an_admin_can_read_a_sheet(app, admin, member, festival, reader):  # noqa: F811
    sheet = upload(member, festival).json()
    jacko = sign_in(app, "jacko", "member-password")
    assert jacko.post(f"/api/sheets/{sheet['id']}/read").status_code == 403
    assert admin.post(f"/api/sheets/{sheet['id']}/read").status_code == 200
    assert member.post("/api/sheets/999/read").status_code == 404
    assert len(reader) == 1


def test_reading_is_refused_when_not_set_up(tmp_path, reader):
    app = create_app(
        Settings(
            database_url="sqlite://",
            bootstrap_admin_username=ADMIN_USERNAME,
            bootstrap_admin_password=ADMIN_PASSWORD,
            cookie_secure=False,
            upload_dir=str(tmp_path / "uploads"),
            ocr_endpoint=ENDPOINT,
        )
    )
    from fastapi.testclient import TestClient

    with TestClient(app):
        admin = sign_in(app, ADMIN_USERNAME, ADMIN_PASSWORD)
        assert admin.get("/api/sheet-reader").json() == {"enabled": False}
        competition = admin.post("/api/admin/competitions", json={"name": "Aintree"}).json()
        day = admin.post(
            f"/api/admin/competitions/{competition['id']}/days", json={"date": "2027-04-08"}
        ).json()
        assert (
            admin.put(f"/api/admin/competitions/{competition['id']}/entries/1").status_code == 204
        )
        sheet = upload(admin, {"id": competition["id"], "tue": day["id"]}).json()
        response = admin.post(f"/api/sheets/{sheet['id']}/read")
    assert response.status_code == 503
    assert response.json()["detail"] == "Reading photos automatically is not set up"
    assert reader == []


def test_heic_photos_are_not_sent_to_the_reader(member, festival, reader):  # noqa: F811
    sheet = upload(member, festival, data=HEIC).json()
    assert sheet["content_type"] == "image/heic"
    response = member.post(f"/api/sheets/{sheet['id']}/read")
    assert response.status_code == 415
    assert "Type the bets in" in response.json()["detail"]
    assert reader == []


def test_a_missing_photo_file_is_404(member, festival, reader, tmp_path):  # noqa: F811
    sheet = upload(member, festival).json()
    for path in (tmp_path / "uploads").iterdir():
        path.unlink()
    assert member.post(f"/api/sheets/{sheet['id']}/read").status_code == 404
    assert reader == []


def test_a_busy_reader_asks_to_try_again(member, festival, monkeypatch):  # noqa: F811
    def busy(*_args):
        raise ocr.ReaderBusyError("the service is limiting requests")

    monkeypatch.setattr(ocr, "read_lines", busy)
    sheet = upload(member, festival).json()
    response = member.post(f"/api/sheets/{sheet['id']}/read")
    assert response.status_code == 503
    assert response.headers["retry-after"] == "60"
    assert "Try again in a minute" in response.json()["detail"]


def test_a_failed_read_is_logged_and_reported(member, festival, monkeypatch, caplog):  # noqa: F811
    def broken(*_args):
        raise ocr.ReaderError("the service answered 500")

    monkeypatch.setattr(ocr, "read_lines", broken)
    sheet = upload(member, festival).json()
    with caplog.at_level(logging.WARNING, logger="app.routers.sheets"):
        response = member.post(f"/api/sheets/{sheet['id']}/read")
    assert response.status_code == 502
    assert (
        response.json()["detail"] == "The photo could not be read. Try again, or type the bets in."
    )
    assert "answered 500" in caplog.text
    assert KEY not in caplog.text
