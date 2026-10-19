#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

bash .devcontainer/prepare-volumes.sh

# Switch to `mise install --locked` once a lockfile has been generated with
# `mise lock --platform linux-x64` (see mise.toml).
mise install
# Only mise's tool installs grow without bound (each version bump leaves the old
# install behind); prune is a no-op when nothing is superseded.
mise prune --yes || echo "Warning: mise prune failed; superseded tool versions were kept"

python -m pip install -r requirements-dev.txt
# The frontend is the Devias Kit (pnpm lockfile); the pnpm version matches frontend/Dockerfile.
# Install it under ~/.local, which is on the Dev Container PATH, so the VS Code tasks can run
# `pnpm` without root.
if [ -f frontend/pnpm-lock.yaml ]; then
  npm install --global --prefix "${HOME}/.local" --no-audit pnpm@12.14.0
  export PATH="${HOME}/.local/bin:${PATH}"
  # Keep pnpm's store in the cache volume. Left alone, pnpm creates .pnpm-store inside the
  # project because the workspace is on a different mount from the home directory. This is
  # pnpm's own config file; an npm_config_store_dir environment variable makes npm warn.
  pnpm config set --global store-dir "${HOME}/.cache/pnpm"
  pnpm install --frozen-lockfile --dir frontend
elif [ -f frontend/package-lock.json ]; then
  npm ci --prefer-offline --no-audit --prefix frontend
fi
npm ci --prefer-offline --ignore-scripts --no-audit --prefix .devcontainer
