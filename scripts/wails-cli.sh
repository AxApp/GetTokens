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

if command -v wails >/dev/null 2>&1; then
  echo "→ Using global wails CLI from PATH"
  exec wails "$COMMAND" "$@"
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
    exec "$candidate" "$COMMAND" "$@"
  fi
done

echo "→ Global wails CLI not found, using go run github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}"
exec go run "github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}" "$COMMAND" "$@"
