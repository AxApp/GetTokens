#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <goos> <goarch> <output-dir>" >&2
  exit 1
fi

GOOS="$1"
GOARCH="$2"
OUTPUT_DIR="$3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${CLI_PROXY_SOURCE_DIR:-${ROOT_DIR}/docs-linhay/references/CLIProxyAPI}"
BINARY_NAME="cli-proxy-api"

if [[ "$GOOS" == "windows" ]]; then
  BINARY_NAME="${BINARY_NAME}.exe"
fi

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "CLIProxyAPI source dir not found: ${SOURCE_DIR}" >&2
  exit 1
fi

if [[ ! -f "${SOURCE_DIR}/go.mod" ]]; then
  echo "CLIProxyAPI source dir is missing go.mod: ${SOURCE_DIR}" >&2
  exit 1
fi

resolve_git_value() {
  local cmd="$1"
  if git -C "${SOURCE_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "${SOURCE_DIR}" ${cmd} 2>/dev/null || true
  fi
}

VERSION="${CLI_PROXY_VERSION:-$(resolve_git_value "describe --tags --always --dirty")}"
COMMIT="${CLI_PROXY_COMMIT:-$(resolve_git_value "rev-parse --short HEAD")}"
BUILD_DATE="${CLI_PROXY_BUILD_DATE:-$(date -u +'%Y-%m-%dT%H:%M:%SZ')}"

VERSION="${VERSION:-fork-source}"
COMMIT="${COMMIT:-unknown}"

LDFLAGS="-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.BuildDate=${BUILD_DATE}"

mkdir -p "${OUTPUT_DIR}"

build_single() {
  local target_goarch="$1"
  local output_path="$2"

  (
    cd "${SOURCE_DIR}"
    CGO_ENABLED=0 GOOS="${GOOS}" GOARCH="${target_goarch}" \
      go build -trimpath -ldflags "${LDFLAGS}" -o "${output_path}" ./cmd/server
  )
}

case "${GOOS}:${GOARCH}" in
  darwin:universal)
    if ! command -v lipo >/dev/null 2>&1; then
      echo "lipo is required for darwin/universal sidecar builds" >&2
      exit 1
    fi

    STAGE_DIR="$(mktemp -d)"
    trap 'rm -rf "${STAGE_DIR}"' EXIT

    ARM64_PATH="${STAGE_DIR}/cli-proxy-api-arm64"
    AMD64_PATH="${STAGE_DIR}/cli-proxy-api-amd64"
    UNIVERSAL_PATH="${OUTPUT_DIR}/cli-proxy-api"

    build_single arm64 "${ARM64_PATH}"
    build_single amd64 "${AMD64_PATH}"
    lipo -create -output "${UNIVERSAL_PATH}" "${ARM64_PATH}" "${AMD64_PATH}"
    chmod +x "${UNIVERSAL_PATH}"
    ;;
  darwin:arm64 | darwin:amd64 | linux:amd64 | linux:arm64 | windows:amd64 | windows:arm64)
    build_single "${GOARCH}" "${OUTPUT_DIR}/${BINARY_NAME}"
    chmod +x "${OUTPUT_DIR}/${BINARY_NAME}"
    ;;
  *)
    echo "Unsupported sidecar target: ${GOOS}:${GOARCH}" >&2
    exit 1
    ;;
esac

echo "✓ Built CLIProxyAPI from source: ${OUTPUT_DIR}/${BINARY_NAME}"
