#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_ROOT="${DOCS_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SPACES_DIR="$DOCS_ROOT/spaces"

errors=0

report_error() {
  echo "ERROR: $1" >&2
  errors=$((errors + 1))
}

check_space_structure() {
  local space_dir="$1"
  local name
  name="$(basename "$space_dir")"

  [[ -f "$space_dir/README.md" ]] || report_error "$name is missing README.md"
  [[ -d "$space_dir/plans" ]] || report_error "$name is missing plans/"
  [[ -d "$space_dir/screenshots" ]] || report_error "$name is missing screenshots/"
  [[ -d "$space_dir/debate" ]] || report_error "$name is missing debate/"
}

check_screenshot_files() {
  local space_dir="$1"
  while IFS= read -r -d '' file; do
    local rel base
    rel="${file#"$space_dir/screenshots/"}"
    base="$(basename "$file")"
    [[ "$rel" =~ ^[0-9]{8}/[a-z0-9-]+/[^/]+$ ]] || report_error "Invalid screenshot path: $file"
    [[ "$base" =~ ^[0-9]{8}-[a-z0-9-]+-[a-z0-9-]+-(before|after|baseline|failed)-v[0-9]{2}\.png$ ]] || report_error "Invalid screenshot filename: $file"
  done < <(find "$space_dir/screenshots" -type f -print0)
}

check_debate_files() {
  local space_dir="$1"
  while IFS= read -r -d '' file; do
    local rel base
    rel="${file#"$space_dir/debate/"}"
    base="$(basename "$file")"
    [[ "$rel" =~ ^[0-9]{8}/[a-z0-9-]+/[^/]+$ ]] || report_error "Invalid debate path: $file"
    [[ "$base" =~ ^[0-9]{8}-[a-z0-9-]+-v[0-9]{2}\.md$ ]] || report_error "Invalid debate filename: $file"
  done < <(find "$space_dir/debate" -type f -print0)
}

if [[ ! -d "$SPACES_DIR" ]]; then
  report_error "Missing spaces directory: $SPACES_DIR"
fi

space_found=0
if [[ -d "$SPACES_DIR" ]]; then
  while IFS= read -r -d '' space_dir; do
    space_found=1
    check_space_structure "$space_dir"
    check_screenshot_files "$space_dir"
    check_debate_files "$space_dir"
  done < <(find "$SPACES_DIR" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)
fi

if [[ $space_found -eq 0 ]]; then
  echo "No spaces found under $SPACES_DIR"
fi

if [[ $errors -gt 0 ]]; then
  echo "Documentation check failed with $errors error(s)." >&2
  exit 1
fi

echo "Documentation check passed."
