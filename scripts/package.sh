#!/usr/bin/env bash
#
# Builds distributable zips: PocketBase binary + migrations/hooks + the
# built client + the CLI wrapper + a double-click start script. Faculty
# unzip, double-click, and go — see scripts/dist-template/README.txt for
# what they see. See design.md section 17 ("Distribution zips").
#
# NEEDS JAIME (see design/changes.md): this still requires faculty to have
# Node.js installed, which design.md section 2's goals list says shouldn't
# be necessary. Flagging rather than silently deciding — bundling a Node
# runtime (e.g. via `pkg`) would remove that requirement but is a bigger
# change than this script attempts.
#
# Usage:
#   scripts/package.sh                                  # mac-arm64 + windows-x64
#   scripts/package.sh mac-arm64 mac-x64 windows-x64 linux-x64
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
TEMPLATE_DIR="$REPO_DIR/scripts/dist-template"

TARGETS=("$@")
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=(mac-arm64 windows-x64)
fi

echo "Building client + server/pb_public once, shared across all targets..."
"$REPO_DIR/scripts/build.sh"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

package_target() {
  local target="$1"
  local platform arch pb_name start_script
  case "$target" in
    mac-arm64)   platform=darwin  arch=arm64 pb_name=pocketbase      start_script=start.command ;;
    mac-x64)     platform=darwin  arch=amd64 pb_name=pocketbase      start_script=start.command ;;
    windows-x64) platform=windows arch=amd64 pb_name=pocketbase.exe  start_script=start.bat ;;
    linux-x64)   platform=linux   arch=amd64 pb_name=pocketbase      start_script=start.sh ;;
    *)
      echo "Unknown target: $target (expected mac-arm64, mac-x64, windows-x64, linux-x64)" >&2
      exit 1
      ;;
  esac

  echo ""
  echo "── Packaging $target ──"

  local work_dir stage_dir
  work_dir="$(mktemp -d)"
  stage_dir="$work_dir/knoxel"
  mkdir -p "$stage_dir/server" "$stage_dir/scripts"

  # Downloads straight into the staging dir — never touches the developer's
  # own server/pocketbase, so packaging other platforms doesn't clobber
  # whatever's needed for local dev.
  "$REPO_DIR/scripts/download-pocketbase.sh" --platform "$platform" --arch "$arch" --out-dir "$stage_dir/server"

  cp -R "$REPO_DIR/server/pb_migrations" "$stage_dir/server/pb_migrations"
  cp -R "$REPO_DIR/server/pb_hooks" "$stage_dir/server/pb_hooks"
  cp -R "$REPO_DIR/server/pb_public" "$stage_dir/server/pb_public"
  cp "$REPO_DIR/scripts/knoxel-server.js" "$stage_dir/scripts/knoxel-server.js"
  cp "$TEMPLATE_DIR/$start_script" "$stage_dir/$start_script"
  cp "$TEMPLATE_DIR/README.txt" "$stage_dir/README.txt"
  chmod +x "$stage_dir/$start_script" 2>/dev/null || true
  chmod +x "$stage_dir/server/$pb_name" 2>/dev/null || true

  (cd "$work_dir" && zip -rq "$DIST_DIR/knoxel-$target.zip" knoxel)
  rm -rf "$work_dir"
  echo "  → dist/knoxel-$target.zip"
}

for target in "${TARGETS[@]}"; do
  package_target "$target"
done

echo ""
echo "Done. Zips are in $DIST_DIR/"
