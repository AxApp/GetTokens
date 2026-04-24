#!/usr/bin/env bash
# scripts/gen-checksums.sh
# Generates SHA256 checksums.txt from all release assets in ./dist/release/
set -euo pipefail

RELEASE_DIR="${1:-./dist/release}"
OUT="${RELEASE_DIR}/checksums.txt"

echo "→ Generating checksums for ${RELEASE_DIR}"
cd "$RELEASE_DIR"
shasum -a 256 GetTokens_* > checksums.txt
echo "✓ Written to ${OUT}"
cat checksums.txt
