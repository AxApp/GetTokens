#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <goos> <goarch>" >&2
  exit 1
fi

GOOS="$1"
GOARCH="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${CLI_PROXY_SOURCE_DIR:-${ROOT_DIR}/docs-linhay/references/CLIProxyAPI}"
OUTPUT_DIR="${CLI_PROXY_OUTPUT_DIR:-${ROOT_DIR}/build/bin}"
META_FILE="${OUTPUT_DIR}/cli-proxy-api.meta.json"
BINARY_NAME="cli-proxy-api"

if [[ "$GOOS" == "windows" ]]; then
  BINARY_NAME="${BINARY_NAME}.exe"
fi

resolve_commit() {
  git -C "${SOURCE_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

resolve_dirty() {
  if [[ -n "$(git -C "${SOURCE_DIR}" status --porcelain 2>/dev/null || true)" ]]; then
    echo "dirty"
  else
    echo "clean"
  fi
}

current_commit="$(resolve_commit)"
current_dirty="$(resolve_dirty)"
current_fingerprint="${current_commit}:${current_dirty}:${GOOS}:${GOARCH}"

needs_rebuild() {
  if [[ ! -x "${OUTPUT_DIR}/${BINARY_NAME}" ]]; then
    return 0
  fi
  if [[ ! -f "${META_FILE}" ]]; then
    return 0
  fi

  local recorded
  recorded="$(sed -n 's/.*"fingerprint"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${META_FILE}" | head -n 1)"
  [[ "${recorded}" != "${current_fingerprint}" ]]
}

write_meta() {
  mkdir -p "${OUTPUT_DIR}"
  cat > "${META_FILE}" <<EOF
{"fingerprint":"${current_fingerprint}","commit":"${current_commit}","dirty":"${current_dirty}","goos":"${GOOS}","goarch":"${GOARCH}"}
EOF
}

if needs_rebuild; then
  echo "→ CLIProxyAPI binary out of date, rebuilding (${current_fingerprint})" >&2
  rm -f "${OUTPUT_DIR}/${BINARY_NAME}"
  "${SCRIPT_DIR}/build-sidecar.sh" "${GOOS}" "${GOARCH}" "${OUTPUT_DIR}"
  write_meta
else
  echo "→ CLIProxyAPI binary is up to date (${current_fingerprint})" >&2
fi
