#!/usr/bin/env bash
#
# Runs PocketBase and the Vite dev server together for local development.
# The client proxies /api and /_ to PocketBase — see client/vite.config.ts.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_DIR/server"
CLIENT_DIR="$REPO_DIR/client"

if [[ ! -x "$SERVER_DIR/pocketbase" ]]; then
  echo "PocketBase binary not found — downloading it first..."
  "$REPO_DIR/scripts/download-pocketbase.sh"
fi

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

(cd "$SERVER_DIR" && ./pocketbase serve) &
PIDS+=($!)

(cd "$CLIENT_DIR" && npm run dev) &
PIDS+=($!)

wait
