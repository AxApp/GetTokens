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
  echo "→ Using global wails CLI"
  exec wails "$COMMAND" "$@"
fi

echo "→ Global wails CLI not found, using go run github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}"
exec go run "github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}" "$COMMAND" "$@"
