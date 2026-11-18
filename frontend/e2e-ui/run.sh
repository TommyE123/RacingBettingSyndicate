#!/usr/bin/env bash
# Runs the Playwright UI end-to-end suite. CI and the "RBS: Run UI E2E" VS Code task both use
# this script, so a CI failure reproduces locally with the same scope and command.
#
# Usage: frontend/e2e-ui/run.sh [scope] [mode]
#   scope: smoke (default), full, auth, betslips, standings or admin
#   mode:  headless (default), or ui for Playwright UI mode on port 9323
#
# Playwright UI listens on 127.0.0.1. Set UI_E2E_UI_HOST=0.0.0.0 to reach it from another
# machine; anyone who can reach it can read the project's files and run its tests.
#
# With UI_E2E_BASE_URL set (CI), the suite runs against a stack something else started. The
# backend behind it must have started with an empty database and RBS_ADMIN_USERNAME and
# RBS_ADMIN_PASSWORD equal to UI_E2E_ADMIN_USERNAME and UI_E2E_ADMIN_PASSWORD.
#
# Without it (development), the script starts the dev stack (docker-compose.yml plus
# docker-compose.dev.yml, project racingbettingsyndicate-dev) with a throwaway database and a
# generated admin password, runs the suite, prints the stack's logs on failure, and removes the
# stack only if it started it. A lock stops a second such run from replacing the stack (and its
# admin password) while the first is still using it.
#
# Exit codes: 0 all tests passed, 1 a test failed, 2 bad arguments, 3 environment setup failed.
set -uo pipefail

readonly SCOPES="smoke full auth betslips standings admin"
readonly MODES="headless ui"
readonly DEV_PROJECT="racingbettingsyndicate-dev"
readonly DEV_BASE_URL="http://localhost:3420"
readonly UI_PORT=9323
readonly UI_HOST="${UI_E2E_UI_HOST:-127.0.0.1}"
# A fixed path, not TMPDIR, so runs with different TMPDIR values still share one lock.
readonly LOCK_DIR="/tmp/${DEV_PROJECT}-ui-e2e.lock"

usage() {
  echo "Usage: $0 [scope] [mode]" >&2
  echo "  scope: one of: ${SCOPES} (default smoke)" >&2
  echo "  mode:  one of: ${MODES} (default headless)" >&2
}

is_one_of() {
  local value="$1" word
  for word in $2; do
    [ "${value}" = "${word}" ] && return 0
  done
  return 1
}

if [ "$#" -gt 2 ]; then
  usage
  exit 2
fi
scope="${1:-smoke}"
mode="${2:-headless}"
if ! is_one_of "${scope}" "${SCOPES}"; then
  echo "Unknown scope '${scope}'." >&2
  usage
  exit 2
fi
if ! is_one_of "${mode}" "${MODES}"; then
  echo "Unknown mode '${mode}'." >&2
  usage
  exit 2
fi

frontend_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(dirname "${frontend_dir}")"
compose=(docker compose --project-name "${DEV_PROJECT}"
  --file "${repo_dir}/docker-compose.yml" --file "${repo_dir}/docker-compose.dev.yml")
started_stack=false
dev_stack=false
held_lock=false

setup_failed() {
  echo "UI E2E setup failed: $*" >&2
  exit 3
}

# shellcheck disable=SC2329 # Called by the EXIT trap below.
cleanup() {
  if [ "${started_stack}" = true ]; then
    echo "Removing the dev stack this run started"
    "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  if [ "${held_lock}" = true ]; then
    rm -rf "${LOCK_DIR}"
  fi
}
trap cleanup EXIT

# Takes the dev stack lock, or exits 3 if the lock directory already exists. mkdir is atomic, so
# only one run can win. A lock left by a run that was killed is not taken over automatically,
# because two runs could both decide it was stale and one would delete the other's new lock.
acquire_lock() {
  local owner
  if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
    owner="$(cat "${LOCK_DIR}/pid" 2>/dev/null || true)"
    setup_failed "another UI E2E run (PID ${owner:-unknown}) may be using the dev stack." \
      "Wait for it to finish, or remove ${LOCK_DIR} if no run is active."
  fi
  held_lock=true
  echo "$$" >"${LOCK_DIR}/pid"
}

if ! command -v pnpm >/dev/null 2>&1; then
  setup_failed "pnpm is not installed. Install it with 'corepack enable' (see CLAUDE.md)."
fi
if [ ! -x "${frontend_dir}/node_modules/.bin/playwright" ]; then
  setup_failed "Playwright is not installed. Run 'pnpm install --frozen-lockfile' in frontend/."
fi

if ! (cd "${frontend_dir}" && node -e '
  const { existsSync } = require("node:fs");
  const { chromium } = require("@playwright/test");
  process.exit(existsSync(chromium.executablePath()) ? 0 : 1);
'); then
  setup_failed "Chromium for Playwright is not installed. Run" \
    "'pnpm exec playwright install --with-deps chromium' in frontend/."
fi

export UI_E2E_ADMIN_USERNAME="${UI_E2E_ADMIN_USERNAME:-e2e-admin}"

if [ -n "${UI_E2E_BASE_URL:-}" ]; then
  echo "Running against the existing instance at ${UI_E2E_BASE_URL}"
  if [ -z "${UI_E2E_ADMIN_PASSWORD:-}" ]; then
    setup_failed "UI_E2E_ADMIN_PASSWORD must be set when UI_E2E_BASE_URL is."
  fi
else
  command -v docker >/dev/null 2>&1 || setup_failed "Docker is needed to start the dev stack."
  acquire_lock
  dev_stack=true
  # A new password each run. Compose recreates the backend when it changes, which also gives
  # it a fresh database, so the bootstrap admin always matches this run.
  UI_E2E_ADMIN_PASSWORD="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  export UI_E2E_ADMIN_PASSWORD
  export RBS_ADMIN_USERNAME="${UI_E2E_ADMIN_USERNAME}"
  export RBS_ADMIN_PASSWORD="${UI_E2E_ADMIN_PASSWORD}"
  if [ -z "$("${compose[@]}" ps --quiet --status running 2>/dev/null)" ]; then
    started_stack=true
  fi
  echo "Starting the dev stack (project ${DEV_PROJECT})"
  if ! "${compose[@]}" up --build --detach --wait; then
    "${compose[@]}" logs --no-color || true
    setup_failed "the dev stack did not become healthy."
  fi
  export UI_E2E_BASE_URL="${DEV_BASE_URL}"
fi

# Check the stack and the test admin before Playwright starts, so a stack that is down or was
# started with other credentials exits 3 rather than looking like failing tests.
if ! node "${frontend_dir}/e2e-ui/check-admin.mjs"; then
  setup_failed "the test admin '${UI_E2E_ADMIN_USERNAME}' could not sign in at ${UI_E2E_BASE_URL}." \
    "The backend must start with an empty database and RBS_ADMIN_USERNAME/RBS_ADMIN_PASSWORD" \
    "equal to UI_E2E_ADMIN_USERNAME/UI_E2E_ADMIN_PASSWORD."
fi

export UI_E2E_TAG="@${scope}"
export UI_E2E_MODE="${mode}"
args=(exec playwright test --config playwright.ui.config.ts)
if [ "${mode}" = ui ]; then
  args+=(--ui --ui-host="${UI_HOST}" --ui-port="${UI_PORT}")
  echo "Playwright UI: http://localhost:${UI_PORT}"
fi

echo "Running the ${scope} scope (${mode}) against ${UI_E2E_BASE_URL}"
(cd "${frontend_dir}" && pnpm "${args[@]}")
status=$?

if [ "${status}" -ne 0 ]; then
  if [ "${dev_stack}" = true ]; then
    echo "Dev stack logs:"
    "${compose[@]}" logs --no-color --tail 200 || true
  fi
  exit 1
fi
exit 0
