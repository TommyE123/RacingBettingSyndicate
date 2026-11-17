import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Entry
from app.routers import sheets as sheets_router
from app.routers.sheets import MAX_IMAGE_BYTES, sniff_image

from .conftest import sign_in
from .test_slips import festival, lucky15, post_slip  # noqa: F401 - festival is a fixture

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def upload(client, festival, data=JPEG, **params):  # noqa: F811
    params.setdefault("day_id", festival["tue"])
    return client.post(
        f"/api/competitions/{festival['id']}/sheets",
        params=params,
        content=data,
        headers={"Content-Type": "image/jpeg"},
    )


def test_upload_view_and_list(app, member, festival, tmp_path):  # noqa: F811
    response = upload(member, festival, stated_total_pence=10_300, note=" Day 1 ")
    assert response.status_code == 201, response.text
    sheet = response.json()
    assert (sheet["content_type"], sheet["size_bytes"]) == ("image/jpeg", len(JPEG))
    assert (sheet["stated_total_pence"], sheet["entered_total_pence"], sheet["slip_count"]) == (
        10_300,
        0,
        0,
    )
    assert sheet["note"] == "Day 1"
    assert sheet["display_name"] == "Maurizio"
    stored = list((tmp_path / "uploads").iterdir())
    assert len(stored) == 1
    assert stored[0].suffix == ".jpg"

    image = member.get(f"/api/sheets/{sheet['id']}/image")
    assert image.status_code == 200
    assert image.content == JPEG
    assert image.headers["content-type"] == "image/jpeg"
    assert image.headers["x-content-type-options"] == "nosniff"

    jacko = sign_in(app, "jacko", "member-password")
    listed = jacko.get(f"/api/competitions/{festival['id']}/sheets").json()
    assert [s["id"] for s in listed] == [sheet["id"]]
    assert (
        jacko.get(
            f"/api/competitions/{festival['id']}/sheets", params={"user_id": festival["jacko"]}
        ).json()
        == []
    )
    assert (
        jacko.get(
            f"/api/competitions/{festival['id']}/sheets", params={"day_id": festival["wed"]}
        ).json()
        == []
    )


def test_png_is_recognised_from_its_bytes_not_its_header(member, festival):  # noqa: F811
    sheet = upload(member, festival, data=PNG).json()
    assert sheet["content_type"] == "image/png"


@pytest.mark.parametrize(
    "data", [b"", b"not an image", b"<svg xmlns='http://www.w3.org/2000/svg'/>"]
)
def test_non_images_are_refused(member, festival, data):  # noqa: F811
    assert upload(member, festival, data=data).status_code == 415


def test_oversized_upload_is_refused(member, festival):  # noqa: F811
    big = JPEG + b"\x00" * (15 * 1024 * 1024)
    assert upload(member, festival, data=big).status_code == 413


def test_upload_permissions(anon, admin, member, festival):  # noqa: F811
    assert upload(anon, festival).status_code == 401
    assert upload(member, festival, user_id=festival["jacko"]).status_code == 403
    for_jacko = upload(admin, festival, user_id=festival["jacko"])
    assert for_jacko.status_code == 201
    assert for_jacko.json()["uploaded_by_name"] == "boss"
    assert upload(admin, festival).status_code == 409  # the admin is not entered
    assert upload(member, festival, day_id=9999).status_code == 422


def test_slips_entered_from_a_sheet_are_totalled_against_it(member, festival):  # noqa: F811
    sheet = upload(member, festival, stated_total_pence=3_000).json()
    post_slip(member, festival, lucky15(festival["tue"], sheet_id=sheet["id"]))
    refreshed = member.get(f"/api/sheets/{sheet['id']}").json()
    assert (refreshed["entered_total_pence"], refreshed["slip_count"]) == (3_000, 1)
    by_sheet = member.get(
        f"/api/competitions/{festival['id']}/slips", params={"sheet_id": sheet["id"]}
    ).json()
    assert len(by_sheet) == 1


def test_a_slip_cannot_use_someone_elses_sheet(admin, member, festival):  # noqa: F811
    theirs = upload(admin, festival, user_id=festival["jacko"]).json()
    response = post_slip(member, festival, lucky15(festival["tue"], sheet_id=theirs["id"]))
    assert response.status_code == 422


def test_update_sheet(app, member, festival):  # noqa: F811
    sheet = upload(member, festival).json()
    url = f"/api/sheets/{sheet['id']}"
    updated = member.patch(
        url, json={"day_id": festival["wed"], "stated_total_pence": 500, "note": "x"}
    ).json()
    assert (updated["day_id"], updated["stated_total_pence"], updated["note"]) == (
        festival["wed"],
        500,
        "x",
    )
    cleared = member.patch(url, json={"clear_stated_total": True, "note": ""}).json()
    assert (cleared["stated_total_pence"], cleared["note"]) == (None, None)
    assert member.patch(url, json={"day_id": 9999}).status_code == 422
    jacko = sign_in(app, "jacko", "member-password")
    assert jacko.patch(url, json={"note": "mine"}).status_code == 403


def test_delete_sheet(member, festival, tmp_path):  # noqa: F811
    sheet = upload(member, festival).json()
    slip = post_slip(member, festival, lucky15(festival["tue"], sheet_id=sheet["id"])).json()
    url = f"/api/sheets/{sheet['id']}"
    assert member.delete(url).status_code == 409
    member.post(f"/api/slips/{slip['id']}/void", json={})
    assert member.delete(url).status_code == 204
    assert member.get(url).status_code == 404
    assert list((tmp_path / "uploads").iterdir()) == []
    voided = member.get(f"/api/slips/{slip['id']}").json()
    assert voided["sheet_id"] is None


def test_missing_image_file_is_404(member, festival, tmp_path):  # noqa: F811
    sheet = upload(member, festival).json()
    for path in (tmp_path / "uploads").iterdir():
        path.unlink()
    assert member.get(f"/api/sheets/{sheet['id']}/image").status_code == 404
    assert member.get("/api/sheets/999/image").status_code == 404


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (b"\xff\xd8\xff\xe0rest", ("image/jpeg", "jpg")),
        (b"\x89PNG\r\n\x1a\nrest", ("image/png", "png")),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", ("image/webp", "webp")),
        (b"\x00\x00\x00\x18ftypheic\x00\x00", ("image/heic", "heic")),
        (b"\x00\x00\x00\x18ftypmif1\x00\x00", ("image/heic", "heic")),
        (b"GIF89a\x01\x00", ("image/gif", "gif")),
        (b"RIFF\x00\x00\x00\x00WAVEfmt ", None),
        (b"\x00\x00\x00\x18ftypisom\x00\x00", None),
        (b"%PDF-1.7", None),
    ],
)
def test_image_types_are_recognised_from_their_first_bytes(data, expected):
    assert sniff_image(data) == expected


def test_an_oversized_upload_without_a_size_header_is_refused(member, festival):  # noqa: F811
    def chunks():
        yield JPEG
        yield b"\x00" * MAX_IMAGE_BYTES

    response = member.post(
        f"/api/competitions/{festival['id']}/sheets",
        params={"day_id": festival["tue"]},
        content=chunks(),
        headers={"Content-Type": "image/jpeg"},
    )
    assert "content-length" not in {key.lower() for key in response.request.headers}
    assert response.status_code == 413


def test_a_failed_save_leaves_no_orphan_photo(app, member, festival, tmp_path, monkeypatch):  # noqa: F811
    def broken(*_args, **_kwargs):
        raise RuntimeError("audit write failed")

    monkeypatch.setattr(sheets_router.audit, "record", broken)
    client = TestClient(app, cookies=member.cookies)
    with pytest.raises(RuntimeError, match="audit write failed"):
        upload(client, festival)
    assert list((tmp_path / "uploads").iterdir()) == []
    assert member.get(f"/api/competitions/{festival['id']}/sheets").json() == []


def test_updating_a_sheet_with_nothing_new_records_nothing(member, festival, audit_actions):  # noqa: F811
    sheet = upload(member, festival, stated_total_pence=500, note="Day 1").json()
    before = audit_actions()
    url = f"/api/sheets/{sheet['id']}"
    for body in ({}, {"stated_total_pence": 500}, {"note": "Day 1"}, {"day_id": festival["tue"]}):
        assert member.patch(url, json=body).status_code == 200
    assert audit_actions() == before


def test_a_failed_file_write_leaves_no_partial_photo(app, member, festival, tmp_path, monkeypatch):  # noqa: F811
    def broken(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(sheets_router.Path, "replace", broken)
    client = TestClient(app, cookies=member.cookies)
    with pytest.raises(OSError, match="disk full"):
        upload(client, festival)
    assert list((tmp_path / "uploads").iterdir()) == []
    assert member.get(f"/api/competitions/{festival['id']}/sheets").json() == []


def test_upload_is_checked_again_once_the_photo_arrives(app, member, festival, monkeypatch):  # noqa: F811
    # The database is free while the photo arrives, so an entry removed meanwhile is caught.
    real_read = sheets_router._read_photo
    calls = []

    async def read_then_withdraw(request):
        data = await real_read(request)
        calls.append(len(data))
        with Session(app.state.engine) as db:
            member_entry = (Entry.competition_id == festival["id"], Entry.user_id == 2)
            db.execute(delete(Entry).where(*member_entry))
            db.commit()
        return data

    monkeypatch.setattr(sheets_router, "_read_photo", read_then_withdraw)
    assert upload(member, festival).status_code == 409
    assert calls == [len(JPEG)]
