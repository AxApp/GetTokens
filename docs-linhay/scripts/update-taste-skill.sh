#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  update-taste-skill.sh [--check|--update]

Modes:
  --check   Compare the pinned commit with the remote ref. This is the default.
  --update  Replace installed Taste Skill directories and update the lock file.

Environment:
  LOCK_PATH  Override the Taste Skill lock file path.
EOF
}

MODE="check"
case "${1:-}" in
  ""|"--check")
    MODE="check"
    ;;
  "--update")
    MODE="update"
    ;;
  "-h"|"--help")
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCK_PATH="${LOCK_PATH:-$REPO_ROOT/.agents/skills/taste-skill.lock.json}"

if [[ ! -f "$LOCK_PATH" ]]; then
  echo "Missing lock file: $LOCK_PATH" >&2
  exit 1
fi

read_lock_field() {
  local expr="$1"
  python3 - "$LOCK_PATH" "$expr" <<'PY'
import json
import sys

path, expr = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

value = data
for part in expr.split("."):
    value = value[part]
print(value)
PY
}

SOURCE_URL="$(read_lock_field source.url)"
SOURCE_REF="$(read_lock_field source.ref)"
PINNED_COMMIT="$(read_lock_field source.commit)"

resolve_remote_commit() {
  local output commit
  output="$(git ls-remote "$SOURCE_URL" "refs/heads/$SOURCE_REF" "$SOURCE_REF" HEAD)"
  commit="$(printf '%s\n' "$output" | awk -v ref="refs/heads/$SOURCE_REF" '$2 == ref { print $1; exit }')"
  if [[ -z "$commit" ]]; then
    commit="$(printf '%s\n' "$output" | awk -v ref="$SOURCE_REF" '$2 == ref { print $1; exit }')"
  fi
  if [[ -z "$commit" ]]; then
    commit="$(printf '%s\n' "$output" | awk '$2 == "HEAD" { print $1; exit }')"
  fi
  if [[ -z "$commit" ]]; then
    echo "Unable to resolve remote ref '$SOURCE_REF' from $SOURCE_URL" >&2
    exit 1
  fi
  printf '%s\n' "$commit"
}

REMOTE_COMMIT="$(resolve_remote_commit)"

echo "Taste Skill source: $SOURCE_URL"
echo "Pinned commit:      $PINNED_COMMIT"
echo "Remote $SOURCE_REF: $REMOTE_COMMIT"

if [[ "$MODE" == "check" ]]; then
  if [[ "$PINNED_COMMIT" == "$REMOTE_COMMIT" ]]; then
    echo "Taste Skill is up to date."
    exit 0
  fi

  echo "Taste Skill update available. Run with --update to install it."
  exit 2
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

git clone --quiet "$SOURCE_URL" "$TMP_DIR/repo"
git -C "$TMP_DIR/repo" checkout --quiet "$REMOTE_COMMIT"

python3 - "$LOCK_PATH" "$TMP_DIR/repo" "$REPO_ROOT" "$REMOTE_COMMIT" <<'PY'
import json
import shutil
import sys
from datetime import date
from pathlib import Path

lock_path = Path(sys.argv[1])
checkout_root = Path(sys.argv[2])
repo_root = Path(sys.argv[3])
remote_commit = sys.argv[4]

data = json.loads(lock_path.read_text(encoding="utf-8"))

for item in data["installedPaths"]:
    source = checkout_root / item["sourcePath"]
    destination = repo_root / item["localPath"]
    if not source.is_dir():
        raise SystemExit(f"Missing source path in checkout: {source}")
    if destination.exists():
        shutil.rmtree(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination)

data["source"]["commit"] = remote_commit
data["installedAt"] = date.today().isoformat()
lock_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

echo "Updated Taste Skill to $REMOTE_COMMIT."
echo "Review the diff, then run docs-linhay/scripts/check-docs.sh."
