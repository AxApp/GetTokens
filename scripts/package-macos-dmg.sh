#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  package-macos-dmg.sh <path-to-dmg> <path-to-app>
EOF
  exit 1
}

if [[ $# -ne 2 ]]; then
  usage
fi

DMG_PATH="$1"
APP_PATH="$2"
CREATE_DMG_BIN="${CREATE_DMG_BIN:-create-dmg}"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found: ${APP_PATH}" >&2
  exit 1
fi

cmd=(
  "${CREATE_DMG_BIN}"
  --volname "GetTokens"
  --window-size 660 400
  --icon-size 100
  --icon "GetTokens.app" 180 170
  --hide-extension "GetTokens.app"
  --app-drop-link 480 170
  "${DMG_PATH}"
  "${APP_PATH}"
)

if [[ "${PRINT_CREATE_DMG_COMMAND:-0}" == "1" ]]; then
  printf '%q ' "${cmd[@]}"
  printf '\n'
  exit 0
fi

"${cmd[@]}"
