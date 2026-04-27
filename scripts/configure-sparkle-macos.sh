#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-app>" >&2
  exit 1
fi

APP_PATH="$1"
PLIST_PATH="${APP_PATH}/Contents/Info.plist"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found: ${APP_PATH}" >&2
  exit 1
fi

if [[ ! -f "${PLIST_PATH}" ]]; then
  echo "Info.plist not found: ${PLIST_PATH}" >&2
  exit 1
fi

FEED_URL="${SPARKLE_FEED_URL:-}"
PUBLIC_KEY="${SPARKLE_PUBLIC_ED_KEY:-}"

if [[ -z "${FEED_URL}" || -z "${PUBLIC_KEY}" ]]; then
  echo "Skipping Sparkle plist configuration because SPARKLE_FEED_URL or SPARKLE_PUBLIC_ED_KEY is missing." >&2
  exit 0
fi

PLIST_BUDDY="/usr/libexec/PlistBuddy"

upsert_plist_string() {
  local key="$1"
  local value="$2"

  if "${PLIST_BUDDY}" -c "Print :${key}" "${PLIST_PATH}" >/dev/null 2>&1; then
    "${PLIST_BUDDY}" -c "Set :${key} ${value}" "${PLIST_PATH}"
  else
    "${PLIST_BUDDY}" -c "Add :${key} string ${value}" "${PLIST_PATH}"
  fi
}

upsert_plist_string "SUFeedURL" "${FEED_URL}"
upsert_plist_string "SUPublicEDKey" "${PUBLIC_KEY}"

echo "Configured Sparkle metadata in ${PLIST_PATH}"
