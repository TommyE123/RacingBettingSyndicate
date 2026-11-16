"""Runtime settings, read from environment variables."""

import os
from dataclasses import dataclass

DEFAULT_DATABASE_URL = "sqlite:////data/rbs.sqlite3"


@dataclass(frozen=True)
class Settings:
    database_url: str = DEFAULT_DATABASE_URL
    # First admin, created at startup only while the database has no users at all.
    bootstrap_admin_username: str | None = None
    bootstrap_admin_password: str | None = None
    # Send the session cookie over HTTPS only. Turn off for plain-HTTP local use.
    cookie_secure: bool = True
    session_days: int = 30

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=os.environ.get("RBS_DATABASE_URL", DEFAULT_DATABASE_URL),
            bootstrap_admin_username=os.environ.get("RBS_ADMIN_USERNAME") or None,
            bootstrap_admin_password=os.environ.get("RBS_ADMIN_PASSWORD") or None,
            cookie_secure=os.environ.get("RBS_COOKIE_SECURE", "true").strip().lower() != "false",
        )
