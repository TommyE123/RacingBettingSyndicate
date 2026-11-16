# RacingBettingSyndicate

Racing tournament betting, league management &amp; results automation platform

## Backend

The FastAPI backend lives in `app/` and stores everything in a SQLite database
(`/data/rbs.sqlite3` in the container, on the `backend-data` volume).

What exists so far:

- sign in and sign out, with admin and member accounts (admins create all accounts)
- admin management of users, competitions, competition days and who is entered
- an audit log of every change, recording who made it and when

Bets, the racecard, settlement and the leaderboard are not built yet.

### Settings

| Variable | Purpose | Default |
|---|---|---|
| `RBS_DATABASE_URL` | SQLAlchemy URL of the SQLite database | `sqlite:////data/rbs.sqlite3` |
| `RBS_ADMIN_USERNAME`, `RBS_ADMIN_PASSWORD` | First admin, created only while there are no users | unset |
| `RBS_COOKIE_SECURE` | Send the session cookie over HTTPS only; set `false` for plain HTTP | `true` |

### Running locally

```bash
pip install -r requirements-dev.txt
RBS_DATABASE_URL=sqlite:///./data/rbs.sqlite3 RBS_ADMIN_USERNAME=admin \
  RBS_ADMIN_PASSWORD=change-me-please RBS_COOKIE_SECURE=false python -m app.main
```

The API is then on <http://localhost:8420>, with interactive documentation at `/docs`.
Run the tests with `pytest`.
