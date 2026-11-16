"""Shared FastAPI dependencies: database session and the signed-in user."""

from collections.abc import Iterator  # noqa: TC003 - FastAPI reads this annotation at runtime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import utcnow
from app.models import AuthSession, Role, User
from app.security import hash_session_token

SESSION_COOKIE = "rbs_session"


def get_db(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as db:
        yield db


DbSession = Annotated[Session, Depends(get_db)]


def find_auth_session(db: Session, token: str | None) -> AuthSession | None:
    if not token:
        return None
    return db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_session_token(token)))


def get_current_user(request: Request, db: DbSession) -> User:
    auth_session = find_auth_session(db, request.cookies.get(SESSION_COOKIE))
    if (
        auth_session is None
        or auth_session.expires_at <= utcnow()
        or not auth_session.user.is_active
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return auth_session.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_admin(user: CurrentUser) -> User:
    if user.role != Role.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user


AdminUser = Annotated[User, Depends(get_admin)]
