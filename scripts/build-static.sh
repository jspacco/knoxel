#!/usr/bin/env bash
#
# Builds the Tier 1 static bundle for GitHub Pages — no PocketBase URL (so
# the client stays in solo mode), with the Cloudflare Worker URL baked in so
# a `?id=<id>` link can be resolved. See design.md section 3 (Tier 1).
#
# Output: client/dist/ — publish this directory's contents to the
# jspacco.github.io/knoxel Pages branch/root.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$REPO_DIR/client"

# Project page, not a user/org page — base path must match the repo name.
VITE_BASE="${VITE_BASE:-/knoxel/}"
# knoxel-worker.jspacco.workers.dev is the one deployed instance (see
# CLAUDE.md "Key facts"); override for a different Worker deployment.
VITE_WORKER_URL="${VITE_WORKER_URL:-https://knoxel-worker.jspacco.workers.dev}"

echo "Building static client — base=$VITE_BASE worker=$VITE_WORKER_URL"

(
  cd "$CLIENT_DIR"
  # VITE_POCKETBASE_URL intentionally left unset: Tier 1 is solo-only.
  export VITE_BASE
  export VITE_WORKER_URL
  npm run build
)

echo "Built to $CLIENT_DIR/dist/ — publish this directory to GitHub Pages."
