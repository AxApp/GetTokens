#!/usr/bin/env bash
# scripts/fetch-sidecar.sh
# Downloads the CLIProxyAPI binary for the target platform from upstream GitHub Releases.
# Usage: ./scripts/fetch-sidecar.sh <goos> <goarch> <version> <dest_dir>
#   goos:     darwin | windows | linux
#   goarch:   amd64 | arm64
#   version:  e.g. v1.2.3 or "latest"
#   dest_dir: where to place the extracted binary (defaults to ./build/bin)

set -euo pipefail

GOOS="${1:-darwin}"
GOARCH="${2:-arm64}"
VERSION="${3:-latest}"
DEST_DIR="${4:-./build/bin}"

REPO="router-for-me/CLIProxyAPI"
BINARY_NAME="cli-proxy-api"
[[ "$GOOS" == "windows" ]] && BINARY_NAME="${BINARY_NAME}.exe"

# Resolve latest tag if needed
if [[ "$VERSION" == "latest" ]]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": "\(.*\)".*/\1/')
fi

echo "→ Fetching CLIProxyAPI ${VERSION} for ${GOOS}/${GOARCH}"

EXT="tar.gz"
[[ "$GOOS" == "windows" ]] && EXT="zip"

# Upstream naming: CLIProxyAPI_{version}_{os}_{arch}.{ext}  (e.g. CLIProxyAPI_6.9.36_darwin_arm64.tar.gz)
TAG_NUM="${VERSION#v}"
ASSET="CLIProxyAPI_${TAG_NUM}_${GOOS}_${GOARCH}.${EXT}"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl --retry 5 --retry-delay 2 --retry-all-errors -fsSL "$URL" -o "${TMP}/${ASSET}"

mkdir -p "$DEST_DIR"

if [[ "$EXT" == "zip" ]]; then
  unzip -qo "${TMP}/${ASSET}" "$BINARY_NAME" -d "$DEST_DIR"
else
  tar -xzf "${TMP}/${ASSET}" -C "$DEST_DIR" "$BINARY_NAME"
fi

chmod +x "${DEST_DIR}/${BINARY_NAME}"
echo "✓ Binary written to ${DEST_DIR}/${BINARY_NAME}"
