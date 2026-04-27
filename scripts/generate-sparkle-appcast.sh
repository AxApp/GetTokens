#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <release-dir> <output-dir>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_DIR="$1"
OUTPUT_DIR="$2"
APPCAST_NAME="${SPARKLE_APPCAST_NAME:-appcast.xml}"
ARCHIVE_PATTERN="${SPARKLE_ARCHIVE_PATTERN:-GetTokens_macOS_*.dmg}"
RELEASE_BASE_URL="${SPARKLE_RELEASE_BASE_URL:-}"
FULL_RELEASE_NOTES_URL="${SPARKLE_FULL_RELEASE_NOTES_URL:-}"
PRODUCT_URL="${SPARKLE_PRODUCT_URL:-}"
PRIVATE_ED_KEY="${SPARKLE_PRIVATE_ED_KEY:-}"
TOOL_BIN_DIR="${SPARKLE_TOOL_BIN_DIR:-}"
MAX_VERSIONS="${SPARKLE_MAX_VERSIONS:-3}"

if [[ -z "${RELEASE_BASE_URL}" ]]; then
  echo "SPARKLE_RELEASE_BASE_URL is required." >&2
  exit 1
fi

if [[ -z "${PRIVATE_ED_KEY}" ]]; then
  echo "SPARKLE_PRIVATE_ED_KEY is required." >&2
  exit 1
fi

if [[ ! -d "${RELEASE_DIR}" ]]; then
  echo "Release directory not found: ${RELEASE_DIR}" >&2
  exit 1
fi

if [[ -z "${TOOL_BIN_DIR}" ]]; then
  SPARKLE_XCFRAMEWORK_DIR="$(bash "${SCRIPT_DIR}/prepare-sparkle-framework.sh")"
  TOOL_BIN_DIR="$(cd "${SPARKLE_XCFRAMEWORK_DIR}/.." && pwd)/bin"
fi

GENERATE_APPCAST="${TOOL_BIN_DIR}/generate_appcast"
if [[ ! -x "${GENERATE_APPCAST}" ]]; then
  echo "generate_appcast not found or not executable: ${GENERATE_APPCAST}" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
STAGE_DIR="$(mktemp -d "${ROOT_DIR}/.tmp-sparkle-appcast.XXXXXX")"
trap 'rm -rf "${STAGE_DIR}"' EXIT

if [[ -f "${OUTPUT_DIR}/${APPCAST_NAME}" ]]; then
  cp "${OUTPUT_DIR}/${APPCAST_NAME}" "${STAGE_DIR}/${APPCAST_NAME}"
fi

copied_any=0
while IFS= read -r archive_path; do
  cp "${archive_path}" "${STAGE_DIR}/$(basename "${archive_path}")"
  copied_any=1
done < <(find "${RELEASE_DIR}" -maxdepth 1 -type f -name "${ARCHIVE_PATTERN}" | sort)

if [[ "${copied_any}" -ne 1 ]]; then
  echo "No Sparkle archives matched ${ARCHIVE_PATTERN} in ${RELEASE_DIR}" >&2
  exit 1
fi

cmd=(
  "${GENERATE_APPCAST}"
  --ed-key-file -
  --download-url-prefix "${RELEASE_BASE_URL%/}/"
  --maximum-deltas 0
  --maximum-versions "${MAX_VERSIONS}"
  -o "${STAGE_DIR}/${APPCAST_NAME}"
)

if [[ -n "${FULL_RELEASE_NOTES_URL}" ]]; then
  cmd+=(--full-release-notes-url "${FULL_RELEASE_NOTES_URL}")
fi

if [[ -n "${PRODUCT_URL}" ]]; then
  cmd+=(--link "${PRODUCT_URL}")
fi

cmd+=("${STAGE_DIR}")

printf '%s' "${PRIVATE_ED_KEY}" | "${cmd[@]}"

if [[ ! -f "${STAGE_DIR}/${APPCAST_NAME}" ]]; then
  echo "generate_appcast did not produce ${STAGE_DIR}/${APPCAST_NAME}" >&2
  exit 1
fi

cp "${STAGE_DIR}/${APPCAST_NAME}" "${OUTPUT_DIR}/${APPCAST_NAME}"
echo "Generated Sparkle appcast at ${OUTPUT_DIR}/${APPCAST_NAME}"
