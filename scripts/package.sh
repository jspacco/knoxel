#!/usr/bin/env bash
#
# Builds distributable zips: a self-contained knoxel-server binary (compiled
# with pkg — no Node.js install required) + the PocketBase binary +
# migrations/hooks + the built client + a double-click start script. Faculty
# unzip, double-click, and go — see scripts/dist-template/README.txt for what
# they see. See design.md section 17 ("Distribution zips").
#
# Usage:
#   scripts/package.sh                                  # mac-arm64 + windows-x64
#   scripts/package.sh mac-arm64 windows-x64 linux-x64
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

echo ""
echo "Compiling knoxel-server binaries with pkg..."
(cd "$REPO_DIR" && npx pkg --target node24-macos-arm64 --output "$DIST_DIR/knoxel-server-macos-arm64" .)
(cd "$REPO_DIR" && npx pkg --target node24-win-x64     --output "$DIST_DIR/knoxel-server-win-x64.exe" .)
(cd "$REPO_DIR" && npx pkg --target node24-linux-x64   --output "$DIST_DIR/knoxel-server-linux-x64" .)
chmod +x "$DIST_DIR/knoxel-server-macos-arm64" "$DIST_DIR/knoxel-server-linux-x64"

package_target() {
  local target="$1"
  local platform arch pb_name start_script server_binary_src server_binary_name
  case "$target" in
    mac-arm64)   platform=darwin  arch=arm64 pb_name=pocketbase      start_script=start.command server_binary_src="$DIST_DIR/knoxel-server-macos-arm64" server_binary_name=knoxel-server ;;
    windows-x64) platform=windows arch=amd64 pb_name=pocketbase.exe  start_script=start.bat     server_binary_src="$DIST_DIR/knoxel-server-win-x64.exe" server_binary_name=knoxel-server.exe ;;
    linux-x64)   platform=linux   arch=amd64 pb_name=pocketbase      start_script=start.sh      server_binary_src="$DIST_DIR/knoxel-server-linux-x64"  server_binary_name=knoxel-server ;;
    *)
      echo "Unknown target: $target (expected mac-arm64, windows-x64, linux-x64 — mac-x64 has no compiled knoxel-server binary; add node24-macos-x64 to package.json's pkg.targets and rebuild if needed)" >&2
      exit 1
      ;;
  esac

  echo ""
  echo "── Packaging $target ──"

  local work_dir stage_dir
  work_dir="$(mktemp -d)"
  stage_dir="$work_dir/knoxel"
  mkdir -p "$stage_dir/server"

  # Downloads straight into the staging dir — never touches the developer's
  # own server/pocketbase, so packaging other platforms doesn't clobber
  # whatever's needed for local dev.
  "$REPO_DIR/scripts/download-pocketbase.sh" --platform "$platform" --arch "$arch" --out-dir "$stage_dir/server"

  cp -R "$REPO_DIR/server/pb_migrations" "$stage_dir/server/pb_migrations"
  cp -R "$REPO_DIR/server/pb_hooks" "$stage_dir/server/pb_hooks"
  cp -R "$REPO_DIR/server/pb_public" "$stage_dir/server/pb_public"
  cp "$server_binary_src" "$stage_dir/$server_binary_name"
  cp "$TEMPLATE_DIR/$start_script" "$stage_dir/$start_script"
  cp "$TEMPLATE_DIR/README.txt" "$stage_dir/README.txt"
  chmod +x "$stage_dir/$start_script" 2>/dev/null || true
  chmod +x "$stage_dir/$server_binary_name" 2>/dev/null || true
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
