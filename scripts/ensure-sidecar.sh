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
BUILD_SCRIPT="${CLI_PROXY_BUILD_SCRIPT:-${SCRIPT_DIR}/build-sidecar.sh}"
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

hash_stdin() {
  shasum -a 256 | awk '{print $1}'
}

emit_file_state() {
  local rel_path="$1"
  local abs_path="${SOURCE_DIR}/${rel_path}"

  if [[ -L "${abs_path}" ]]; then
    printf 'symlink\t%s\t%s\n' "${rel_path}" "$(readlink "${abs_path}")"
    return
  fi

  if [[ -f "${abs_path}" ]]; then
    printf 'file\t%s\t%s\n' "${rel_path}" "$(shasum -a 256 "${abs_path}" | awk '{print $1}')"
    return
  fi

  printf 'missing\t%s\n' "${rel_path}"
}

resolve_git_source_state_hash() {
  {
    while IFS= read -r rel_path; do
      [[ -n "${rel_path}" ]] || continue
      emit_file_state "${rel_path}"
    done < <(git -C "${SOURCE_DIR}" ls-files)

    while IFS= read -r rel_path; do
      [[ -n "${rel_path}" ]] || continue
      emit_file_state "${rel_path}"
    done < <(git -C "${SOURCE_DIR}" ls-files --others --exclude-standard)
  } | LC_ALL=C sort | hash_stdin
}

resolve_plain_source_state_hash() {
  if [[ ! -d "${SOURCE_DIR}" ]]; then
    printf 'missing-source-dir' | hash_stdin
    return
  fi

  (
    cd "${SOURCE_DIR}"
    find . -type f ! -path './.git/*' -print
  ) | LC_ALL=C sort | while IFS= read -r rel_path; do
    [[ -n "${rel_path}" ]] || continue
    emit_file_state "${rel_path#./}"
  done | LC_ALL=C sort | hash_stdin
}

resolve_source_state_hash() {
  if git -C "${SOURCE_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    resolve_git_source_state_hash
    return
  fi
  resolve_plain_source_state_hash
}

current_commit="$(resolve_commit)"
current_dirty="$(resolve_dirty)"
current_source_state_hash="$(resolve_source_state_hash)"
current_fingerprint="${current_commit}:${current_dirty}:${current_source_state_hash}:${GOOS}:${GOARCH}"

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
{"fingerprint":"${current_fingerprint}","commit":"${current_commit}","dirty":"${current_dirty}","sourceStateHash":"${current_source_state_hash}","goos":"${GOOS}","goarch":"${GOARCH}"}
EOF
}

if needs_rebuild; then
  echo "→ CLIProxyAPI binary out of date, rebuilding (${current_fingerprint})" >&2
  rm -f "${OUTPUT_DIR}/${BINARY_NAME}"
  "${BUILD_SCRIPT}" "${GOOS}" "${GOARCH}" "${OUTPUT_DIR}"
  write_meta
else
  echo "→ CLIProxyAPI binary is up to date (${current_fingerprint})" >&2
fi
