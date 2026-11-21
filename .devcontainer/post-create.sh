#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

bash .devcontainer/prepare-volumes.sh

# Tools float to the latest release with no lockfile. `install` fetches anything missing;
# `upgrade` moves tools already installed on the persisted volume to the newest release.
mise install
mise upgrade --yes
# Only mise's tool installs grow without bound (each version bump leaves the old
# install behind); prune is a no-op when nothing is superseded.
mise prune --yes || echo "Warning: mise prune failed; superseded tool versions were kept"

python -m pip install -r requirements-dev.txt
# The frontend is the Devias Kit (pnpm lockfile); the pnpm version matches frontend/Dockerfile.
# Install it under ~/.local, which is on the Dev Container PATH, so the VS Code tasks can run
# `pnpm` without root.
if [ -f frontend/pnpm-lock.yaml ]; then
  npm install --global --prefix "${HOME}/.local" --no-audit --allow-scripts=pnpm pnpm@12.14.0
  export PATH="${HOME}/.local/bin:${PATH}"
  # Keep pnpm's store in the cache volume. Left alone, pnpm creates .pnpm-store inside the
  # project because the workspace is on a different mount from the home directory. This is
  # pnpm's own config file; an npm_config_store_dir environment variable makes npm warn.
  pnpm config set --global store-dir "${HOME}/.cache/pnpm"
  pnpm install --frozen-lockfile --dir frontend
  # Chromium for the UI E2E suite (frontend/e2e-ui/run.sh). The browser is kept in ~/.cache,
  # a persisted volume, so a rebuilt container does not download it again.
  pnpm --dir frontend exec playwright install --with-deps chromium
elif [ -f frontend/package-lock.json ]; then
  npm ci --prefer-offline --no-audit --prefix frontend
fi
# The Dev Container linters float with no lockfile (see .devcontainer/package.json).
npm install --no-package-lock --ignore-scripts --no-audit --prefix .devcontainer
# `install` leaves packages already in the workspace's node_modules alone, so update them too.
npm update --no-package-lock --ignore-scripts --no-audit --prefix .devcontainer
