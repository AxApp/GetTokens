#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  create-space.sh <space-key> [title]

Environment:
  DOCS_ROOT   Override docs-linhay root for testing.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

SPACE_KEY="$1"
TITLE="${2:-$SPACE_KEY}"

if [[ ! "$SPACE_KEY" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Invalid space-key: $SPACE_KEY" >&2
  echo "Use lowercase letters, digits, and hyphens only." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_ROOT="${DOCS_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SPACES_DIR="$DOCS_ROOT/spaces"
SPACE_DIR="$SPACES_DIR/$SPACE_KEY"
README_PATH="$SPACE_DIR/README.md"

mkdir -p "$SPACE_DIR/plans" "$SPACE_DIR/screenshots" "$SPACE_DIR/debate"

if [[ ! -f "$README_PATH" ]]; then
  cat >"$README_PATH" <<EOF
# $TITLE

## 背景

## 目标

## 范围

## 非目标

## 验收标准

## 相关链接

## 当前状态
- 状态：draft
- 最近更新：$(date +%F)
EOF
  echo "Created README: $README_PATH"
else
  echo "README already exists: $README_PATH"
fi

echo "Space ready: $SPACE_DIR"
echo "Created or verified:"
echo "  - $SPACE_DIR/plans"
echo "  - $SPACE_DIR/screenshots"
echo "  - $SPACE_DIR/debate"
