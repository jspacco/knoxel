#!/usr/bin/env bash
# Run this file to start Knoxel. Requires Node.js — https://nodejs.org
# (the LTS version is fine). See README.txt for the full first-run walkthrough.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run Knoxel but wasn't found."
  echo "Install it from https://nodejs.org (the LTS version), then run this script again."
  exit 1
fi

node scripts/knoxel-server.js "$@"
