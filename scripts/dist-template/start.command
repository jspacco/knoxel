#!/usr/bin/env bash
# Double-click this file to start Knoxel. See README.txt for the full
# first-run walkthrough.
cd "$(dirname "$0")"

./knoxel-server "$@"
read -r -p "Press Enter to close this window..." _
