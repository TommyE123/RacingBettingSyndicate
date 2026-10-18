#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

bash .devcontainer/prepare-volumes.sh

# Switch to `mise install --locked` once a lockfile has been generated with
# `mise lock --platform linux-x64,linux-arm64` (see mise.toml).
mise install
# Only mise's tool installs grow without bound (each version bump leaves the old
# install behind); prune is a no-op when nothing is superseded.
mise prune --yes || echo "Warning: mise prune failed; superseded tool versions were kept"

python -m pip install -r requirements-dev.txt
# The frontend does not exist until it is added; skip its install until then.
if [ -f frontend/package-lock.json ]; then
  npm ci --prefer-offline --no-audit --prefix frontend
fi
npm ci --prefer-offline --ignore-scripts --no-audit --prefix .devcontainer
