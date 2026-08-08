#!/usr/bin/env bash
#
# Fetches the official PocketBase binary release for the current platform
# and drops it in server/pocketbase (or server/pocketbase.exe on Windows).
# Not built from source — see design.md section 17.
#
# Usage:
#   scripts/download-pocketbase.sh                # auto-detect platform/arch
#   scripts/download-pocketbase.sh --version 0.40.0
#   scripts/download-pocketbase.sh --platform windows --arch amd64
#   scripts/download-pocketbase.sh --platform windows --arch amd64 --out-dir /tmp/stage
#
set -euo pipefail

DEFAULT_VERSION="0.39.10"
VERSION="${POCKETBASE_VERSION:-$DEFAULT_VERSION}"
PLATFORM=""
ARCH=""
OUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --arch) ARCH="$2"; shift 2 ;;
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PLATFORM" ]]; then
  case "$(uname -s)" in
    Darwin) PLATFORM="darwin" ;;
    Linux) PLATFORM="linux" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
    *) echo "Unrecognized platform: $(uname -s). Pass --platform explicitly." >&2; exit 1 ;;
  esac
fi

if [[ -z "$ARCH" ]]; then
  case "$(uname -m)" in
    arm64|aarch64) ARCH="arm64" ;;
    x86_64|amd64) ARCH="amd64" ;;
    armv7l) ARCH="armv7" ;;
    ppc64le) ARCH="ppc64le" ;;
    s390x) ARCH="s390x" ;;
    *) echo "Unrecognized architecture: $(uname -m). Pass --arch explicitly." >&2; exit 1 ;;
  esac
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${OUT_DIR:-$REPO_DIR/server}"
mkdir -p "$SERVER_DIR"

ASSET="pocketbase_${VERSION}_${PLATFORM}_${ARCH}.zip"
BASE_URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Downloading PocketBase v${VERSION} (${PLATFORM}/${ARCH})..."
curl -fL --progress-bar -o "$WORK_DIR/$ASSET" "$BASE_URL/$ASSET"
curl -fL -o "$WORK_DIR/checksums.txt" "$BASE_URL/checksums.txt"

echo "Verifying checksum..."
EXPECTED_LINE="$(grep " $ASSET\$" "$WORK_DIR/checksums.txt" || true)"
if [[ -z "$EXPECTED_LINE" ]]; then
  echo "No checksum entry found for $ASSET in checksums.txt — aborting." >&2
  exit 1
fi
EXPECTED_SHA="$(awk '{print $1}' <<<"$EXPECTED_LINE")"
ACTUAL_SHA="$(shasum -a 256 "$WORK_DIR/$ASSET" | awk '{print $1}')"
if [[ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]]; then
  echo "Checksum mismatch for $ASSET — expected $EXPECTED_SHA, got $ACTUAL_SHA. Aborting." >&2
  exit 1
fi

echo "Extracting..."
unzip -o -q "$WORK_DIR/$ASSET" -d "$WORK_DIR"

if [[ "$PLATFORM" == "windows" ]]; then
  mv -f "$WORK_DIR/pocketbase.exe" "$SERVER_DIR/pocketbase.exe"
else
  mv -f "$WORK_DIR/pocketbase" "$SERVER_DIR/pocketbase"
  chmod +x "$SERVER_DIR/pocketbase"
fi

echo "PocketBase v${VERSION} installed to $SERVER_DIR."
