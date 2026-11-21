# RacingBettingSyndicate

Racing tournament betting, league management &amp; results automation platform

## Backend

The FastAPI backend lives in `app/` and stores everything in a SQLite database
(`/data/rbs.sqlite3` in the container, on the `backend-data` volume).

What exists so far:

- sign in and sign out, with admin and member accounts (admins create all accounts)
- admin management of users, competitions, competition days and who is entered
- bet slips: any UK bet type from a single to a Goliath, plus perms, over horses on one or more
  days; the cost is worked out from the bet type and checked against the budget
- photos of written bet sheets, with the slips entered from each one totalled against it
- returns declared per slip by the member or an admin; nothing is settled
  from prices. Changing what was bet (stake, type, each way or a horse's day)
  clears the return so it is entered again; correcting a name, race time or
  note keeps it
- the leaderboard, daily winners, both trophies, and statistics, all worked out from the slips
- an audit log of every change, recording who made it and when

Going over the budget needs a confirmation and is flagged. Void slips are kept, not deleted.
The racecard and automatic settlement are not built.

### Settings

| Variable                                   | Purpose                                                             | Default                       |
|--------------------------------------------|---------------------------------------------------------------------|-------------------------------|
| `RBS_DATABASE_URL`                         | SQLAlchemy URL of the SQLite database                               | `sqlite:////data/rbs.sqlite3` |
| `RBS_ADMIN_USERNAME`, `RBS_ADMIN_PASSWORD` | First admin, created only while there are no users                  | unset                         |
| `RBS_COOKIE_SECURE`                        | Send the session cookie over HTTPS only; set `false` for plain HTTP | `true`                        |
| `RBS_UPLOAD_DIR`                           | Where bet sheet photos are stored                                   | `/data/uploads`               |

### Running locally

```bash
mkdir -p data
pip install -r requirements-dev.txt
RBS_DATABASE_URL=sqlite:///./data/rbs.sqlite3 \
  RBS_UPLOAD_DIR=./data/uploads RBS_ADMIN_USERNAME=admin \
  RBS_ADMIN_PASSWORD=change-me-please RBS_COOKIE_SECURE=false \
  python -m app.main
```

The API is then on <http://localhost:8420>, with interactive documentation at `/docs`.
Run the tests with `pytest`.

## Web UI

The Next.js app in `frontend/` started from the Devias Kit (see `frontend/SOURCE.md`) and is
now the syndicate's site: home, add a bet, all bets, enter returns, leaderboard, stats, bet
sheets, rules and my account, plus admin pages for users, competitions and the audit log.

The browser only talks to the web UI. Requests to `/api/...` are passed on to the backend by
`frontend/src/app/api/[...path]/route.ts`, so the session cookie stays on one site.

| Variable      | Purpose                                  | Default                 |
|---------------|------------------------------------------|-------------------------|
| `BACKEND_URL` | Where the web UI reaches the backend API | `http://localhost:8420` |

To run it locally, start the backend as above, then:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev -p 3420
```

Open <http://localhost:3420> and sign in with the first admin's username and password.
Browsers only keep the session cookie over plain HTTP when `RBS_COOKIE_SECURE=false`, so set
that for local use or whenever the site is not served over HTTPS (Compose included).

## UI E2E suite (Playwright)

End-to-end tests in `frontend/e2e-ui/` drive the real web UI in Chromium against a running
backend. One script, `frontend/e2e-ui/run.sh [scope] [mode]`, runs them in CI and from the
`RBS: Run UI E2E` VS Code task, so a CI failure reproduces locally with the same command.

|                   | CI                                                        | Development                                                 |
|-------------------|-----------------------------------------------------------|-------------------------------------------------------------|
| Started by        | `production-smoke-test.yml`, called by `docker-build.yml` | The VS Code task, or `bash frontend/e2e-ui/run.sh`          |
| Stack             | The images built in the same run                          | `docker-compose.yml` + `docker-compose.dev.yml`, built here |
| Web UI / backend  | Ports 3421 / 8421                                         | Ports 3420 / 8420                                           |
| `UI_E2E_BASE_URL` | Set, so the script uses the running stack                 | Unset, so the script starts it, and removes it if it did    |
| Scope and mode    | `full headless`                                           | Picked when the task runs; `smoke headless` by default      |

- **Scopes** are tags on the tests: `smoke` (the default), `full` (everything), or one area:
  `auth`, `betslips`, `standings` or `admin`.
- **Modes**: `headless` (the default, as in CI), or `ui` to watch and debug in Playwright UI
  mode at <http://localhost:9323>. It listens on 127.0.0.1; set `UI_E2E_UI_HOST=0.0.0.0` only
  to reach it from another machine, since anyone who can reach it can read the project's files.
- **One run at a time** uses the dev stack: a second run started while one is active exits 3
  rather than replacing the stack and its admin password.
- **Exit codes**: 0 passed, 1 a test failed, 2 bad arguments, 3 the environment could not be
  set up (the stack did not start, or the test admin could not sign in).
- **Test data** is synthetic. The backend starts with an empty, throwaway database and makes
  its first admin from `RBS_ADMIN_USERNAME` and `RBS_ADMIN_PASSWORD`; the script or CI
  generates a new password for each run. Each test then creates its own users and
  competition through the admin API, so tests do not depend on each other. Nothing new is
  switched on in production: the first-admin bootstrap already exists and only runs while the
  database has no users.
- **Reports**: `frontend/playwright-report-ui/` and `frontend/test-results-ui/` (gitignored),
  with screenshots and traces kept only for failing tests. CI uploads them as the
  `ui-e2e-report` artifact when the suite fails.

To run against a stack you started yourself, point the script at it and give it the admin it
can use. That admin must be the stack's first admin, created in an empty database:

```bash
UI_E2E_BASE_URL=http://localhost:3420 UI_E2E_ADMIN_USERNAME=admin \
  UI_E2E_ADMIN_PASSWORD=change-me-please bash frontend/e2e-ui/run.sh smoke
```

The script needs `pnpm install --frozen-lockfile` in `frontend/` and Chromium
(`pnpm exec playwright install --with-deps chromium`), both done by the Dev Container.
Specs that change state other tests can see go in `frontend/e2e-ui/exclusive/`, which runs
one test at a time after the rest; everything else goes in `frontend/e2e-ui/parallel/`.
