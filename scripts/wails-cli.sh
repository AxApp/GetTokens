#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

WAILS_VERSION="v2.12.0"
DEFAULT_COMMAND="dev"

COMMAND="${1:-$DEFAULT_COMMAND}"
if [[ $# -gt 0 ]]; then
  shift
fi
COMMAND_ARGS=("$@")

case "$(uname -s)" in
  Darwin)
    GOOS="darwin"
    GOARCH="$(uname -m)"
    ;;
  Linux)
    GOOS="linux"
    GOARCH="$(uname -m)"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    GOOS="windows"
    GOARCH="amd64"
    ;;
  *)
    GOOS="darwin"
    GOARCH="$(uname -m)"
    ;;
esac

case "${GOARCH}" in
  arm64|aarch64)
    GOARCH="arm64"
    ;;
  x86_64|amd64)
    GOARCH="amd64"
    ;;
esac

if [[ -x "${ROOT_DIR}/scripts/ensure-sidecar.sh" ]]; then
  "${ROOT_DIR}/scripts/ensure-sidecar.sh" "${GOOS}" "${GOARCH}"
fi

if [[ "${COMMAND}" == "dev" ]]; then
  export GETTOKENS_APP_PROFILE=dev
fi

normalize_wailsjs() {
  if [[ -x "${ROOT_DIR}/scripts/normalize-wailsjs.sh" ]]; then
    "${ROOT_DIR}/scripts/normalize-wailsjs.sh"
  fi
}

run_wails() {
  local -a wails_cmd=("$@")
  if [[ "${COMMAND}" == "dev" ]]; then
    normalize_wailsjs
    (
      while true; do
        sleep 2
        normalize_wailsjs
      done
    ) &
    local normalizer_pid="$!"
    trap 'kill "$normalizer_pid" >/dev/null 2>&1 || true' EXIT INT TERM
    set +e +u
    "${wails_cmd[@]}" "$COMMAND" "${COMMAND_ARGS[@]}"
    local status="$?"
    set -euo pipefail
    kill "$normalizer_pid" >/dev/null 2>&1 || true
    normalize_wailsjs
    exit "$status"
  fi

  set +e +u
  "${wails_cmd[@]}" "$COMMAND" "${COMMAND_ARGS[@]}"
  local status="$?"
  set -euo pipefail
  normalize_wailsjs
  exit "$status"
}

if command -v wails >/dev/null 2>&1; then
  echo "→ Using global wails CLI from PATH"
  run_wails wails
fi

GOPATH_BIN="$(go env GOPATH 2>/dev/null)/bin/wails"

for candidate in \
  "$GOPATH_BIN" \
  "$HOME/go/bin/wails" \
  "/opt/homebrew/bin/wails" \
  "/usr/local/bin/wails"
do
  if [[ -x "$candidate" ]]; then
    echo "→ Using local wails CLI at $candidate"
    run_wails "$candidate"
  fi
done

echo "→ Global wails CLI not found, using go run github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}"
run_wails go run "github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}"
