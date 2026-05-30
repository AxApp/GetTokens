#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

normalize_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return 0
  fi

  local tmp
  tmp="$(mktemp)"
  perl -0pe 's/[ \t]+$//mg; s/\n+\z/\n/' "$file" > "$tmp"
  if cmp -s "$file" "$tmp"; then
    rm -f "$tmp"
    return 0
  fi
  perl -0pi -e 's/[ \t]+$//mg; s/\n+\z/\n/' "$file"
  rm -f "$tmp"
}

normalize_file "${ROOT_DIR}/frontend/wailsjs/go/models.ts"
normalize_file "${ROOT_DIR}/frontend/wailsjs/go/main/App.d.ts"
normalize_file "${ROOT_DIR}/frontend/wailsjs/go/main/App.js"
