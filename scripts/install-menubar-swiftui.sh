#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="${1:-${ROOT_DIR}/build/bin/GetTokens.app}"
LIB_SOURCE="${ROOT_DIR}/build/menubar-swiftui/libGetTokensMenuBarSwiftUI.dylib"

if [[ "$(uname -s)" != "Darwin" ]]; then
  exit 0
fi

if [[ ! -d "${APP_PATH}" ]]; then
  echo "SwiftUI menu bar popover install skipped: app bundle not found at ${APP_PATH}" >&2
  exit 0
fi

if [[ ! -f "${LIB_SOURCE}" ]]; then
  "${ROOT_DIR}/scripts/build-menubar-swiftui.sh"
fi

FRAMEWORKS_DIR="${APP_PATH}/Contents/Frameworks"
mkdir -p "${FRAMEWORKS_DIR}"
cp "${LIB_SOURCE}" "${FRAMEWORKS_DIR}/libGetTokensMenuBarSwiftUI.dylib"
chmod 755 "${FRAMEWORKS_DIR}/libGetTokensMenuBarSwiftUI.dylib"

echo "Installed SwiftUI menu bar popover dylib into ${FRAMEWORKS_DIR}"
