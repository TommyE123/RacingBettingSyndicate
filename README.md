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

### Installing the app

The web UI is a Progressive Web App, so members can install it to a phone's home screen or a
computer and open it full screen like an app.

- Chrome and Edge (Android and desktop) show an **Install app** button in the top bar when the
  browser offers installation.
- iOS has no install prompt, so iPhone and iPad users see a dismissible hint: tap Share, then
  **Add to Home Screen**.

It is made of `frontend/src/app/manifest.ts` (served at `/manifest.webmanifest`, built from
`config.site` in `frontend/src/config.ts`), the icons in `frontend/public/icons/` (rendered from
`icon.svg` and `icon-maskable.svg` in the same folder), and the service worker
`frontend/public/sw.js`, registered by `frontend/src/components/core/pwa/pwa-provider.tsx`. The
service worker never caches pages or `/api` requests, so no bets, returns or standings are stored
on the device and signing out leaves nothing behind. It caches only Next's content-hashed build
files, and shows `frontend/public/offline.html` when a page can't load. Bump `CACHE_VERSION` in
`sw.js` whenever `offline.html` changes.

The service worker is registered only by production builds. To check installability locally:

```bash
cd frontend
pnpm build
pnpm start -p 3420
```

Then open <http://localhost:3420> in Chrome and look at DevTools, Application, Manifest. Browsers
allow installing only over HTTPS, or from `localhost`, so a deployment needs HTTPS for the app to
be installable (which also suits the default `RBS_COOKIE_SECURE=true`).
