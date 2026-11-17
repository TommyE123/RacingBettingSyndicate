# Contributing to RacingBettingSyndicate

Thanks for your interest in contributing. This page gets you from a fresh clone to a running
dev environment and a passing test suite. What the backend and web UI do, their settings and
how to run them are in the [README](README.md).

## Ways to contribute

- Report bugs or propose features through
  [GitHub Issues](https://github.com/TommyE123/RacingBettingSyndicate/issues).
- Fix bugs or implement features and open a pull request.
- Report security problems privately, as described in [SECURITY.md](SECURITY.md), not in an
  issue.

## Getting set up

You'll need:

- Python 3, matching the version in the `Dockerfile`'s `FROM python:X.Y-slim` line
- Node.js 24 and pnpm (only if you're working on the web UI)
- Docker (to run both services the way they are deployed)

Alternatively, the repository ships a Dev Container that provides all of the above plus the
project's local linting and security-scanning tools. Open the repository in VS Code and choose
**Dev Containers: Reopen in Container**, or start a GitHub Codespace.

To run the backend and web UI locally, follow
[Running locally](README.md#running-locally) and [Web UI](README.md#web-ui) in the README.
`docker compose up --build` runs both services in containers.

## Before opening a pull request

1. **Run the unit test suite:**

   ```bash
   pip install -r requirements-dev.txt
   pytest --cov=app --cov-report=term-missing
   ```

2. **If you changed the web UI**, confirm it still lints, type-checks and builds:

   ```bash
   cd frontend
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

3. **Keep documentation in sync.** If your change affects behaviour people rely on (settings,
   API endpoints, ports, betting or scoring rules), update the README in the same PR.

4. CI runs the unit tests (`.github/workflows/tests.yml`) on every pull request, against the
   Python version in the `Dockerfile`. MegaLinter (`.github/workflows/mega-linter.yml`, configured
   in `.linter-rules/.mega-linter.yml`) also runs on every pull request to `main`. Both must pass
   before a PR can be merged.

## Pull request guidelines

- Keep changes focused. A PR that fixes one bug or adds one feature is easier to review than one
  that bundles several.
- Describe *why* a change is needed, not just what it does.
- Changes to bets, stakes, payouts, scoring, standings or results need particular care, and
  tests that show the numbers are right.
- PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`type: description`, for example `fix: ...` or `docs: ...`). PRs that change behaviour or
  add real scope should link an issue (`Closes #N`). See [`CLAUDE.md`](CLAUDE.md) for the full
  set of repository conventions.
- The repository owner merges pull requests after review. Contributors shouldn't merge their
  own.

## Dependency updates

Dependencies are kept current by Renovate (see `renovate.json`). Application dependencies are
pinned. The Dev Container's local tools float to the latest release on purpose.
