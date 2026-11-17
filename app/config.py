"""Runtime settings, read from environment variables."""

import os
from dataclasses import dataclass

DEFAULT_DATABASE_URL = "sqlite:////data/rbs.sqlite3"
DEFAULT_UPLOAD_DIR = "/data/uploads"
# The longest password the sign-in request accepts (see app/schemas.py).
MAX_PASSWORD_LENGTH = 128


@dataclass(frozen=True)
class Settings:
    database_url: str = DEFAULT_DATABASE_URL
    # First admin, created at startup only while the database has no users at all.
    bootstrap_admin_username: str | None = None
    bootstrap_admin_password: str | None = None
    # Send the session cookie over HTTPS only. Turn off for plain-HTTP local use.
    cookie_secure: bool = True
    session_days: int = 30
    # Where photos of bet sheets are kept. Created on the first upload.
    upload_dir: str = DEFAULT_UPLOAD_DIR

    def __post_init__(self) -> None:
        password = self.bootstrap_admin_password
        if password is not None and len(password) > MAX_PASSWORD_LENGTH:
            # Such an admin could never sign in, and bootstrap does not run a second time.
            raise ValueError(f"RBS_ADMIN_PASSWORD must be at most {MAX_PASSWORD_LENGTH} characters")

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=os.environ.get("RBS_DATABASE_URL", DEFAULT_DATABASE_URL),
            bootstrap_admin_username=os.environ.get("RBS_ADMIN_USERNAME") or None,
            bootstrap_admin_password=os.environ.get("RBS_ADMIN_PASSWORD") or None,
            cookie_secure=os.environ.get("RBS_COOKIE_SECURE", "true").strip().lower() != "false",
            upload_dir=os.environ.get("RBS_UPLOAD_DIR", DEFAULT_UPLOAD_DIR),
        )
