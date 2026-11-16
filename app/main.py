"""Racing Betting Syndicate backend API."""

import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import uvicorn
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings
from app.db import Base, make_engine
from app.models import Role, User
from app.routers import admin, auth, competitions
from app.security import hash_password

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

logger = logging.getLogger(__name__)

PORT = 8420


def bootstrap_admin(db: Session, settings: Settings) -> None:
    """Create the first admin from the environment, only while there are no users at all."""
    if db.scalar(select(func.count()).select_from(User)):
        return
    username = (settings.bootstrap_admin_username or "").strip()
    password = settings.bootstrap_admin_password
    if not username or not password:
        logger.warning(
            "No users exist. Set RBS_ADMIN_USERNAME and RBS_ADMIN_PASSWORD to create the first admin."
        )
        return
    user = User(
        username=username.lower(),
        display_name=username,
        password_hash=hash_password(password),
        role=Role.ADMIN.value,
    )
    db.add(user)
    db.flush()
    audit.record(db, None, "user.bootstrapped", "user", user.id, username=user.username)
    db.commit()
    logger.info("Created the first admin user '%s'", user.username)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = make_engine(settings.database_url)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            bootstrap_admin(db, settings)
        app.state.engine = engine
        yield
        engine.dispose()

    app = FastAPI(title="Racing Betting Syndicate", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(competitions.router)
    return app


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(create_app(), host="0.0.0.0", port=PORT)  # noqa: S104 - must listen inside the container
