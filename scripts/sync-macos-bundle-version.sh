#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  sync-macos-bundle-version.sh <path-to-app> <version>
EOF
  exit 1
}

if [[ $# -ne 2 ]]; then
  usage
fi

APP_PATH="$1"
RAW_VERSION="$2"
PLIST_PATH="${APP_PATH}/Contents/Info.plist"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found: ${APP_PATH}" >&2
  exit 1
fi

if [[ ! -f "${PLIST_PATH}" ]]; then
  echo "Info.plist not found: ${PLIST_PATH}" >&2
  exit 1
fi

BUNDLE_VERSION="$(
  python3 - "${RAW_VERSION}" <<'PY'
import re
import sys

raw_version = sys.argv[1].strip()
match = re.fullmatch(r"v?(\d+\.\d+\.\d+)(?:[-+][0-9A-Za-z.-]+)?", raw_version)
if match is None:
    raise SystemExit(f"unsupported app version for macOS bundle metadata: {raw_version}")

print(match.group(1))
PY
)"

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${BUNDLE_VERSION}" "${PLIST_PATH}"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${BUNDLE_VERSION}" "${PLIST_PATH}"

echo "Synced macOS bundle version to ${BUNDLE_VERSION} in ${PLIST_PATH}"
