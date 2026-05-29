#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  build-local-macos-package.sh [options]

Options:
  --arch <arm64|amd64>       Target macOS architecture. Defaults to the current machine.
  --version <vX.Y.Z|X.Y.Z>   Build version. Defaults to frontend/package.json version.
  --output-dir <dir>         Output directory. Defaults to dist/local-release.
  --skip-tests               Skip go/typecheck/docs preflight.
  --notarize                 Sign and notarize the app and DMG using release env vars.
  -h, --help                 Show this help.

Env:
  LOCAL_MACOS_PACKAGE_PRINT_PLAN=1 prints the resolved plan and exits.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WAILS_VERSION="v2.12.0"

ARCH=""
VERSION=""
OUTPUT_DIR="${ROOT_DIR}/dist/local-release"
SKIP_TESTS=0
NOTARIZE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)
      ARCH="${2:-}"
      shift 2
      ;;
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=1
      shift
      ;;
    --notarize)
      NOTARIZE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script only builds macOS installable packages." >&2
  exit 1
fi

if [[ -z "${ARCH}" ]]; then
  ARCH="$(uname -m)"
fi

case "${ARCH}" in
  arm64|aarch64)
    ARCH="arm64"
    ASSET_NAME="GetTokens_local_macOS_AppleSilicon.dmg"
    ;;
  amd64|x86_64)
    ARCH="amd64"
    ASSET_NAME="GetTokens_local_macOS_Intel.dmg"
    ;;
  *)
    echo "Unsupported macOS architecture: ${ARCH}" >&2
    exit 1
    ;;
esac

if [[ -z "${VERSION}" ]]; then
  VERSION="$(
    python3 - "${ROOT_DIR}/frontend/package.json" <<'PY'
import json
import sys
from pathlib import Path

print(json.loads(Path(sys.argv[1]).read_text())["version"])
PY
  )"
fi

if [[ "${VERSION}" != v* ]]; then
  VERSION="v${VERSION}"
fi

python3 - "${VERSION}" <<'PY'
import re
import sys

if re.fullmatch(r"v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", sys.argv[1]) is None:
    raise SystemExit(f"unsupported local package version: {sys.argv[1]}")
PY

if [[ "${OUTPUT_DIR}" != /* ]]; then
  OUTPUT_DIR="${ROOT_DIR}/${OUTPUT_DIR}"
fi

PLATFORM="darwin/${ARCH}"
APP_PATH="${ROOT_DIR}/build/bin/GetTokens.app"
DMG_PATH="${OUTPUT_DIR}/${ASSET_NAME}"
RELEASE_LABEL="${LOCAL_RELEASE_LABEL:-$(TZ=Asia/Shanghai date +'%Y.%m.%d.%H')}"
GIT_HASH="$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo local)"

if [[ "${LOCAL_MACOS_PACKAGE_PRINT_PLAN:-0}" == "1" ]]; then
  cat <<EOF
root=${ROOT_DIR}
arch=${ARCH}
platform=${PLATFORM}
version=${VERSION}
release_label=${RELEASE_LABEL}
git_hash=${GIT_HASH}
output_dir=${OUTPUT_DIR}
asset=${ASSET_NAME}
app=${APP_PATH}
dmg=${DMG_PATH}
skip_tests=${SKIP_TESTS}
notarize=${NOTARIZE}
EOF
  exit 0
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

resolve_wails_cmd() {
  if command -v wails >/dev/null 2>&1; then
    WAILS_CMD=(wails)
    return
  fi

  local gopath_bin
  gopath_bin="$(go env GOPATH 2>/dev/null)/bin/wails"
  for candidate in \
    "${gopath_bin}" \
    "${HOME}/go/bin/wails" \
    "/opt/homebrew/bin/wails" \
    "/usr/local/bin/wails"
  do
    if [[ -x "${candidate}" ]]; then
      WAILS_CMD=("${candidate}")
      return
    fi
  done

  WAILS_CMD=(go run "github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}")
}

package_dmg() {
  local dmg_path="$1"
  local app_path="$2"

  rm -f "${dmg_path}"
  if command -v create-dmg >/dev/null 2>&1; then
    bash "${SCRIPT_DIR}/package-macos-dmg.sh" "${dmg_path}" "${app_path}"
    return
  fi

  local stage_dir
  stage_dir="$(mktemp -d)"
  (
    trap 'rm -rf "${stage_dir}"' EXIT
    cp -R "${app_path}" "${stage_dir}/GetTokens.app"
    ln -s /Applications "${stage_dir}/Applications"
    hdiutil create -volname "GetTokens" -srcfolder "${stage_dir}" -ov -format UDZO "${dmg_path}"
  )
}

verify_dmg() {
  local dmg_path="$1"
  local mount_dir
  mount_dir="$(mktemp -d)"

  (
    trap 'hdiutil detach "${mount_dir}" >/dev/null 2>&1 || true; rm -rf "${mount_dir}"' EXIT
    hdiutil verify "${dmg_path}" >/dev/null
    hdiutil attach -nobrowse -readonly -mountpoint "${mount_dir}" "${dmg_path}" >/dev/null

    test -d "${mount_dir}/GetTokens.app"
    test -x "${mount_dir}/GetTokens.app/Contents/MacOS/GetTokens"
    test -x "${mount_dir}/GetTokens.app/Contents/MacOS/cli-proxy-api"
    file "${mount_dir}/GetTokens.app/Contents/MacOS/GetTokens"
    /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${mount_dir}/GetTokens.app/Contents/Info.plist"
    codesign --verify --deep --strict --verbose=2 "${mount_dir}/GetTokens.app"
  )
}

cd "${ROOT_DIR}"
require_command go
require_command npm
require_command python3
require_command hdiutil
require_command codesign

if [[ "${SKIP_TESTS}" == "0" ]]; then
  go test ./...
  npm --prefix frontend run typecheck
  docs-linhay/scripts/check-docs.sh
fi

mkdir -p "${OUTPUT_DIR}"

bash "${SCRIPT_DIR}/ensure-sidecar.sh" darwin "${ARCH}"

resolve_wails_cmd
export VITE_VERSION="${VERSION}"
export VITE_GIT_HASH="${GIT_HASH}"
export GETTOKENS_APP_PROFILE=prod

"${WAILS_CMD[@]}" build \
  -platform "${PLATFORM}" \
  -ldflags "-X main.Version=${VERSION} -X main.ReleaseLabel=${RELEASE_LABEL}"

bash "${SCRIPT_DIR}/sync-macos-bundle-version.sh" "${APP_PATH}" "${VERSION}"

cp "${ROOT_DIR}/build/bin/cli-proxy-api" "${APP_PATH}/Contents/MacOS/cli-proxy-api"
if [[ -f "${ROOT_DIR}/build/bin/cli-proxy-api.meta.json" ]]; then
  cp "${ROOT_DIR}/build/bin/cli-proxy-api.meta.json" "${APP_PATH}/Contents/MacOS/cli-proxy-api.meta.json"
fi
chmod +x "${APP_PATH}/Contents/MacOS/cli-proxy-api"

if [[ "${NOTARIZE}" == "1" ]]; then
  bash "${SCRIPT_DIR}/sign-notarize-macos-release.sh" app "${APP_PATH}"
else
  codesign --deep --force --options runtime --sign - "${APP_PATH}"
  codesign --verify --deep --strict --verbose=2 "${APP_PATH}"
fi

package_dmg "${DMG_PATH}" "${APP_PATH}"

if [[ "${NOTARIZE}" == "1" ]]; then
  bash "${SCRIPT_DIR}/sign-notarize-macos-release.sh" dmg "${DMG_PATH}"
fi

verify_dmg "${DMG_PATH}"
shasum -a 256 "${DMG_PATH}" > "${DMG_PATH}.sha256"

cat <<EOF
Built local macOS package:
  ${DMG_PATH}
  ${DMG_PATH}.sha256
EOF
