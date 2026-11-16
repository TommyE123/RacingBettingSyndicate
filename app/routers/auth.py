"""Sign in, sign out, and the signed-in user's own account."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import delete, select

from app import audit
from app.db import utcnow
from app.deps import SESSION_COOKIE, CurrentUser, DbSession, find_auth_session
from app.models import AuthSession, User
from app.schemas import LoginRequest, PasswordChange, UserOut
from app.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, db: DbSession) -> UserOut:
    settings = request.app.state.settings
    user = db.scalar(select(User).where(User.username == body.username.strip().lower()))
    password_ok = verify_password(
        body.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_ok or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")

    now = utcnow()
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
    token = new_session_token()
    lifetime = timedelta(days=settings.session_days)
    db.add(
        AuthSession(
            token_hash=hash_session_token(token), user_id=user.id, expires_at=now + lifetime
        )
    )
    audit.record(db, user, "auth.login", "user", user.id)
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession) -> None:
    auth_session = find_auth_session(db, request.cookies.get(SESSION_COOKIE))
    if auth_session is not None:
        db.delete(auth_session)
        db.commit()
    response.delete_cookie(SESSION_COOKIE)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange, request: Request, user: CurrentUser, db: DbSession
) -> None:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong")
    user.password_hash = hash_password(body.new_password)
    # Sign out everywhere else; keep this session.
    current_hash = hash_session_token(request.cookies[SESSION_COOKIE])
    db.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id, AuthSession.token_hash != current_hash
        )
    )
    audit.record(db, user, "user.password_changed", "user", user.id)
    db.commit()
