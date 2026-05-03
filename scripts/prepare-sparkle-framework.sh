#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SPARKLE_VERSION="${SPARKLE_VERSION:-2.9.1}"
SPARKLE_CACHE_DIR="${SPARKLE_CACHE_DIR:-${ROOT_DIR}/.local/sparkle}"
SPARKLE_WORK_DIR="${SPARKLE_CACHE_DIR}/${SPARKLE_VERSION}"
SPARKLE_ZIP_PATH="${SPARKLE_WORK_DIR}/Sparkle-for-Swift-Package-Manager.zip"
SPARKLE_DOWNLOAD_URL="${SPARKLE_DOWNLOAD_URL:-https://github.com/sparkle-project/Sparkle/releases/download/${SPARKLE_VERSION}/Sparkle-for-Swift-Package-Manager.zip}"
SPARKLE_XCFRAMEWORK_DIR="${SPARKLE_WORK_DIR}/Sparkle.xcframework"

mkdir -p "${SPARKLE_WORK_DIR}"

download_sparkle_zip() {
  local attempt
  local max_attempts=5

  for attempt in $(seq 1 "${max_attempts}"); do
    rm -f "${SPARKLE_ZIP_PATH}"
    echo "Downloading Sparkle ${SPARKLE_VERSION} from ${SPARKLE_DOWNLOAD_URL} (attempt ${attempt}/${max_attempts})" >&2
    curl --fail --location --retry 3 --retry-all-errors --retry-delay 2 -o "${SPARKLE_ZIP_PATH}" "${SPARKLE_DOWNLOAD_URL}"

    if unzip -tq "${SPARKLE_ZIP_PATH}" >/dev/null 2>&1; then
      return 0
    fi

    echo "Downloaded Sparkle archive is not a valid zip, retrying..." >&2
  done

  echo "Failed to download a valid Sparkle archive after ${max_attempts} attempts." >&2
  exit 1
}

if [[ ! -f "${SPARKLE_ZIP_PATH}" ]] || ! unzip -tq "${SPARKLE_ZIP_PATH}" >/dev/null 2>&1; then
  download_sparkle_zip
fi

if [[ ! -d "${SPARKLE_XCFRAMEWORK_DIR}" ]]; then
  unzip -oq "${SPARKLE_ZIP_PATH}" -d "${SPARKLE_WORK_DIR}"
fi

if [[ ! -d "${SPARKLE_XCFRAMEWORK_DIR}" ]]; then
  echo "Sparkle.xcframework not found after extraction: ${SPARKLE_XCFRAMEWORK_DIR}" >&2
  exit 1
fi

echo "${SPARKLE_XCFRAMEWORK_DIR}"
