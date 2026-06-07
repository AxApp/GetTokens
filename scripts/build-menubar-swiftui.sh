#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${ROOT_DIR}/internal/menubar/swiftui/GetTokensMenuBarPopover.swift"
OUTPUT_DIR="${ROOT_DIR}/build/menubar-swiftui"
OUTPUT="${OUTPUT_DIR}/libGetTokensMenuBarSwiftUI.dylib"
MODULE_CACHE_DIR="${CLANG_MODULE_CACHE_PATH:-${OUTPUT_DIR}/module-cache}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  exit 0
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is required to build the SwiftUI menu bar popover" >&2
  exit 1
fi

SWIFTC="$(xcrun --find swiftc)"
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
ARCH="${MENUBAR_SWIFTUI_ARCH:-${1:-$(uname -m)}}"
case "${ARCH}" in
  arm64|aarch64)
    SWIFT_ARCH="arm64"
    ;;
  amd64|x86_64)
    SWIFT_ARCH="x86_64"
    ;;
  *)
    echo "Unsupported SwiftUI menu bar popover architecture: ${ARCH}" >&2
    exit 1
    ;;
esac
DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-15.0}"
mkdir -p "${OUTPUT_DIR}" "${MODULE_CACHE_DIR}"

CLANG_MODULE_CACHE_PATH="${MODULE_CACHE_DIR}" "${SWIFTC}" \
  -target "${SWIFT_ARCH}-apple-macosx${DEPLOYMENT_TARGET}" \
  -sdk "${SDK_PATH}" \
  -emit-library \
  -module-name GetTokensMenuBarSwiftUI \
  -parse-as-library \
  -O \
  -framework AppKit \
  -framework SwiftUI \
  -Xlinker -install_name \
  -Xlinker "@executable_path/../Frameworks/libGetTokensMenuBarSwiftUI.dylib" \
  -Xlinker -undefined \
  -Xlinker dynamic_lookup \
  -o "${OUTPUT}" \
  "${SOURCE}"

echo "Built ${OUTPUT} (${SWIFT_ARCH})"
