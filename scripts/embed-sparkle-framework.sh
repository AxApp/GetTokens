#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-app>" >&2
  exit 1
fi

APP_PATH="$1"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "App bundle not found: ${APP_PATH}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SPARKLE_XCFRAMEWORK_DIR="${SPARKLE_XCFRAMEWORK_DIR:-}"
if [[ -z "${SPARKLE_XCFRAMEWORK_DIR}" ]]; then
  SPARKLE_XCFRAMEWORK_DIR="$(bash "${SCRIPT_DIR}/prepare-sparkle-framework.sh")"
fi

FRAMEWORK_SOURCE="${SPARKLE_XCFRAMEWORK_DIR}/macos-arm64_x86_64/Sparkle.framework"
FRAMEWORKS_DIR="${APP_PATH}/Contents/Frameworks"
FRAMEWORK_DEST="${FRAMEWORKS_DIR}/Sparkle.framework"

if [[ ! -d "${FRAMEWORK_SOURCE}" ]]; then
  echo "Sparkle.framework source not found: ${FRAMEWORK_SOURCE}" >&2
  exit 1
fi

mkdir -p "${FRAMEWORKS_DIR}"
rm -rf "${FRAMEWORK_DEST}"
cp -R "${FRAMEWORK_SOURCE}" "${FRAMEWORK_DEST}"

echo "Embedded Sparkle.framework into ${FRAMEWORK_DEST}"
