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
- reading a sheet photo's text (OCR) into the bet form as a draft to check, when set up
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
| `RBS_OCR_ENDPOINT`, `RBS_OCR_KEY`          | Azure AI Vision resource that reads sheet photos (see below)        | unset (reading is off)        |

### Reading sheet photos (OCR)

The "Read from photo" button on the bet form sends the sheet photo to the Read feature of
[Azure AI Vision](https://learn.microsoft.com/azure/ai-services/computer-vision/concept-ocr)
and puts the lines it finds into the "Paste a list" box. Handwriting is often misread, so the
text is only a draft: the person entering the bet checks it against the photo, and nothing is
saved until they save the bet. Only the sheet's owner or an admin can read a sheet, and HEIC
photos cannot be read.

To turn it on, create an Azure AI Vision (Computer Vision) resource in the Azure portal and set
`RBS_OCR_ENDPOINT` to its endpoint (`https://<name>.cognitiveservices.azure.com/`) and
`RBS_OCR_KEY` to one of its keys. Keep the key out of the repository, for example in a local
`.env` file. The button stays hidden while either setting is missing.

The free F0 pricing tier is enough for the syndicate: it stops reading once its allowance
runs out instead of charging, and it limits how many reads it takes each minute (the app asks
people to try again in a minute when Azure refuses for that reason). To move to the paid tier,
for example on an MSDN or Visual Studio subscription's Azure credit, change the resource's
pricing tier in the portal to S1 (the paid tier of a Computer Vision resource), or create a paid
resource and point the two settings at it. A multi-service Azure AI services resource, whose
paid tier is S0, works too. Nothing in the app depends on the tier. Microsoft plans to retire
this Image Analysis 4.0 API on 25 September 2028.

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
