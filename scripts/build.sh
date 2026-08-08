#!/usr/bin/env bash
#
# Builds the client for the PocketBase-served tiers (2/3) and copies it into
# server/pb_public, so `pocketbase serve` alone serves both the API and the
# built React app from one origin and one port. See design.md sections 4
# and 17.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$REPO_DIR/client"
PB_PUBLIC_DIR="$REPO_DIR/server/pb_public"

echo "Building client..."
(
  cd "$CLIENT_DIR"
  # Same-origin deployment: PocketBase serves the client from its own root,
  # so the relative "/" API URL already used in dev (scripts/dev.sh) works
  # here too. No VITE_BASE override — this isn't a GitHub Pages subpath.
  export VITE_POCKETBASE_URL=/
  npm run build
)

echo "Copying build to $PB_PUBLIC_DIR..."
rm -rf "$PB_PUBLIC_DIR"
mkdir -p "$PB_PUBLIC_DIR"
cp -R "$CLIENT_DIR/dist/." "$PB_PUBLIC_DIR/"

echo "Done. 'cd server && ./pocketbase serve' (or scripts/knoxel-server.js) now serves everything from one URL."
