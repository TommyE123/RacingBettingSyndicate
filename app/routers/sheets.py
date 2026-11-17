"""Photos of bet sheets: upload, list, view, update and delete.

The image is sent as the raw request body with its Content-Type, and its type is checked
from the file's own first bytes. Files are stored under random names in the upload
directory, never under a name the client chose.
"""

import secrets
from pathlib import Path
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from app import audit
from app.deps import CurrentUser, DbSession  # noqa: TC001 - FastAPI reads these at runtime
from app.models import CompetitionDay, Entry, Sheet, Slip, User
from app.routers.bets import (
    competition_or_404,
    entry_for,
    is_admin,
    require_manager,
    user_names,
)
from app.schemas import SheetOut, SheetUpdate

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["sheets"])

MAX_IMAGE_BYTES = 15 * 1024 * 1024


def sniff_image(data: bytes) -> tuple[str, str] | None:
    """(content type, extension) from the file's signature, or None if not a known image."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    if data[4:8] == b"ftyp" and data[8:12] in {b"heic", b"heix", b"mif1", b"msf1", b"hevc"}:
        return "image/heic", "heic"
    if data[:6] in {b"GIF87a", b"GIF89a"}:
        return "image/gif", "gif"
    return None


def upload_dir(request: Request) -> Path:
    return Path(request.app.state.settings.upload_dir)


def sheets_out(db: Session, sheets: list[Sheet]) -> list[SheetOut]:
    names = user_names(db, [s.entry.user_id for s in sheets] + [s.uploaded_by for s in sheets])
    totals = dict(
        db.execute(
            select(Slip.sheet_id, func.sum(Slip.stake_pence))
            .where(Slip.sheet_id.in_([s.id for s in sheets]), Slip.voided_at.is_(None))
            .group_by(Slip.sheet_id)
        ).all()
    )
    counts = dict(
        db.execute(
            select(Slip.sheet_id, func.count())
            .where(Slip.sheet_id.in_([s.id for s in sheets]), Slip.voided_at.is_(None))
            .group_by(Slip.sheet_id)
        ).all()
    )
    return [
        SheetOut(
            id=sheet.id,
            user_id=sheet.entry.user_id,
            display_name=names.get(sheet.entry.user_id, "?"),
            day_id=sheet.day_id,
            content_type=sheet.content_type,
            size_bytes=sheet.size_bytes,
            stated_total_pence=sheet.stated_total_pence,
            entered_total_pence=totals.get(sheet.id, 0),
            slip_count=counts.get(sheet.id, 0),
            note=sheet.note,
            uploaded_by=sheet.uploaded_by,
            uploaded_by_name=names.get(sheet.uploaded_by, "?"),
            created_at=sheet.created_at,
        )
        for sheet in sheets
    ]


def sheet_or_404(db: Session, sheet_id: int) -> Sheet:
    sheet = db.get(Sheet, sheet_id)
    if sheet is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sheet not found")
    return sheet


def _check_day(db: Session, competition_id: int, day_id: int) -> None:
    day = db.get(CompetitionDay, day_id)
    if day is None or day.competition_id != competition_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "That day is not part of this competition"
        )


def _check_upload(
    db: Session, user: User, competition_id: int, owner_id: int, day_id: int
) -> Entry:
    competition = competition_or_404(db, competition_id)
    if owner_id != user.id and not is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can upload for someone else")
    entry = entry_for(db, competition.id, owner_id)
    if entry is None:
        who = "You are" if owner_id == user.id else "That person is"
        raise HTTPException(status.HTTP_409_CONFLICT, f"{who} not entered in this competition")
    _check_day(db, competition.id, day_id)
    return entry


async def _read_photo(request: Request) -> bytes:
    """Read the body, refusing it as soon as it passes the limit, with or without a size header."""
    too_big = HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Photos must be 15 MB or smaller")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
        raise too_big
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_IMAGE_BYTES:
            raise too_big
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/competitions/{competition_id}/sheets", status_code=status.HTTP_201_CREATED)
async def upload_sheet(  # noqa: PLR0913 - metadata travels as query parameters
    competition_id: int,
    *,
    request: Request,
    user: CurrentUser,
    db: DbSession,
    day_id: int,
    user_id: int | None = None,
    stated_total_pence: Annotated[int | None, Query(ge=0, le=100_000_000)] = None,
    note: Annotated[str | None, Query(max_length=500)] = None,
) -> SheetOut:
    owner_id = user_id if user_id is not None else user.id
    _check_upload(db, user, competition_id, owner_id, day_id)
    # Every transaction holds SQLite's write lock, so end this one before waiting for the
    # photo: a slow upload must not hold up everyone else. Nothing has been written.
    db.rollback()
    data = await _read_photo(request)
    sniffed = sniff_image(data)
    if sniffed is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Send a photo (JPEG, PNG, WebP, HEIC or GIF)"
        )
    content_type, extension = sniffed

    # A fresh, short transaction: check again, as things may have changed while it arrived.
    entry = _check_upload(db, user, competition_id, owner_id, day_id)
    folder = upload_dir(request)
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_hex(16)}.{extension}"
    partial = folder / f".{filename}.part"
    final = folder / filename
    sheet = Sheet(
        entry_id=entry.id,
        day_id=day_id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(data),
        stated_total_pence=stated_total_pence,
        note=(note or "").strip() or None,
        uploaded_by=user.id,
    )
    try:
        partial.write_bytes(data)
        partial.replace(final)
        db.add(sheet)
        db.flush()
        audit.record(
            db,
            user,
            "sheet.uploaded",
            "sheet",
            sheet.id,
            competition_id=competition_id,
            user_id=owner_id,
            day_id=day_id,
            size_bytes=len(data),
            stated_total_pence=stated_total_pence,
        )
        db.commit()
    except Exception:
        partial.unlink(missing_ok=True)
        final.unlink(missing_ok=True)
        raise
    return sheets_out(db, [sheet])[0]


@router.get("/competitions/{competition_id}/sheets")
def list_sheets(
    competition_id: int,
    _user: CurrentUser,
    db: DbSession,
    user_id: int | None = None,
    day_id: int | None = None,
) -> list[SheetOut]:
    competition_or_404(db, competition_id)
    query = (
        select(Sheet)
        .join(Entry, Sheet.entry_id == Entry.id)
        .join(CompetitionDay, Sheet.day_id == CompetitionDay.id)
        .where(Entry.competition_id == competition_id)
        .order_by(CompetitionDay.date.desc(), Sheet.created_at.desc(), Sheet.id.desc())
    )
    if user_id is not None:
        query = query.where(Entry.user_id == user_id)
    if day_id is not None:
        query = query.where(Sheet.day_id == day_id)
    return sheets_out(db, list(db.scalars(query)))


@router.get("/sheets/{sheet_id}")
def get_sheet(sheet_id: int, _user: CurrentUser, db: DbSession) -> SheetOut:
    return sheets_out(db, [sheet_or_404(db, sheet_id)])[0]


@router.get("/sheets/{sheet_id}/image")
def sheet_image(sheet_id: int, request: Request, _user: CurrentUser, db: DbSession) -> FileResponse:
    sheet = sheet_or_404(db, sheet_id)
    path = upload_dir(request) / sheet.filename
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The photo file is missing")
    return FileResponse(
        path,
        media_type=sheet.content_type,
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


@router.patch("/sheets/{sheet_id}")
def update_sheet(sheet_id: int, body: SheetUpdate, user: CurrentUser, db: DbSession) -> SheetOut:
    sheet = sheet_or_404(db, sheet_id)
    require_manager(user, sheet.entry.user_id)
    changes = {}
    if body.day_id is not None and body.day_id != sheet.day_id:
        _check_day(db, sheet.entry.competition_id, body.day_id)
        changes["day_id"] = {"from": sheet.day_id, "to": body.day_id}
        sheet.day_id = body.day_id
    new_total = None if body.clear_stated_total else body.stated_total_pence
    if (body.clear_stated_total or body.stated_total_pence is not None) and (
        new_total != sheet.stated_total_pence
    ):
        changes["stated_total_pence"] = {"from": sheet.stated_total_pence, "to": new_total}
        sheet.stated_total_pence = new_total
    if body.note is not None and (body.note or None) != sheet.note:
        changes["note"] = {"from": sheet.note, "to": body.note or None}
        sheet.note = body.note or None
    if changes:
        audit.record(db, user, "sheet.updated", "sheet", sheet.id, changes=changes)
        db.commit()
    return sheets_out(db, [sheet])[0]


@router.delete("/sheets/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sheet(sheet_id: int, request: Request, user: CurrentUser, db: DbSession) -> None:
    sheet = sheet_or_404(db, sheet_id)
    require_manager(user, sheet.entry.user_id)
    in_use = db.scalar(
        select(func.count())
        .select_from(Slip)
        .where(Slip.sheet_id == sheet.id, Slip.voided_at.is_(None))
    )
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Bets were entered from this sheet; void them first"
        )
    filename = sheet.filename
    audit.record(
        db,
        user,
        "sheet.deleted",
        "sheet",
        sheet.id,
        user_id=sheet.entry.user_id,
        day_id=sheet.day_id,
    )
    db.delete(sheet)
    db.commit()
    (upload_dir(request) / filename).unlink(missing_ok=True)
