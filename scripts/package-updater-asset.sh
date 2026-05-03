#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <goos> <goarch>" >&2
  exit 1
fi

GOOS="$1"
GOARCH="$2"
RELEASE_DIR="dist/release"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

mkdir -p "$RELEASE_DIR"

case "${GOOS}:${GOARCH}" in
  darwin:arm64)
    cp "build/bin/GetTokens.app/Contents/MacOS/GetTokens" "${STAGE_DIR}/GetTokens"
    tar -czf "${RELEASE_DIR}/GetTokens_macOS_AppleSilicon.tar.gz" -C "$STAGE_DIR" GetTokens
    ;;
  darwin:amd64)
    cp "build/bin/GetTokens.app/Contents/MacOS/GetTokens" "${STAGE_DIR}/GetTokens"
    tar -czf "${RELEASE_DIR}/GetTokens_macOS_Intel.tar.gz" -C "$STAGE_DIR" GetTokens
    ;;
  windows:amd64)
    cp "build/bin/GetTokens.exe" "${STAGE_DIR}/GetTokens.exe"
    tar -czf "${RELEASE_DIR}/GetTokens_windows_amd64.tar.gz" -C "$STAGE_DIR" GetTokens.exe
    ;;
  linux:amd64)
    cp "build/bin/GetTokens" "${STAGE_DIR}/GetTokens"
    tar -czf "${RELEASE_DIR}/GetTokens_linux_amd64.tar.gz" -C "$STAGE_DIR" GetTokens
    ;;
  *)
    echo "Unsupported updater asset target: ${GOOS}:${GOARCH}" >&2
    exit 1
    ;;
esac
