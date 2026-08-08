#!/usr/bin/env bash
# Double-click this file to start Knoxel. Requires Node.js — https://nodejs.org
# (the LTS version is fine). See README.txt for the full first-run walkthrough.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run Knoxel but wasn't found on this Mac."
  echo "Install it from https://nodejs.org (the LTS version), then double-click this file again."
  read -r -p "Press Enter to close this window..." _
  exit 1
fi

node scripts/knoxel-server.js "$@"
read -r -p "Press Enter to close this window..." _
