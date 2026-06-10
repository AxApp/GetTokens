#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_ROOT="$(mktemp -d)"
SOURCE_DIR="${TEST_ROOT}/CLIProxyAPI"
OUTPUT_DIR="${TEST_ROOT}/build"
COUNT_FILE="${TEST_ROOT}/build-count"
FAKE_BUILD_SCRIPT="${TEST_ROOT}/fake-build-sidecar.sh"

cleanup() {
  rm -rf "${TEST_ROOT}"
}
trap cleanup EXIT

assert_eq() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "ASSERT FAILED: ${message}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    exit 1
  fi
}

read_fingerprint() {
  sed -n 's/.*"fingerprint"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${OUTPUT_DIR}/cli-proxy-api.meta.json" | head -n 1
}

read_commit() {
  sed -n 's/.*"commit"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${OUTPUT_DIR}/cli-proxy-api.meta.json" | head -n 1
}

mkdir -p "${SOURCE_DIR}"
cd "${SOURCE_DIR}"
git init -q
git config user.email "codex@example.com"
git config user.name "Codex"

cat > go.mod <<'EOF'
module example.com/cliproxyapi

go 1.24
EOF

cat > main.go <<'EOF'
package main

func main() {}
EOF

git add go.mod main.go
git commit -qm "init"

cat > "${FAKE_BUILD_SCRIPT}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

GOOS="$1"
GOARCH="$2"
OUTPUT_DIR="$3"
COUNT_FILE="${FAKE_BUILD_COUNT_FILE:?}"

mkdir -p "${OUTPUT_DIR}"
count=0
if [[ -f "${COUNT_FILE}" ]]; then
  count="$(cat "${COUNT_FILE}")"
fi
count=$((count + 1))
printf '%s' "${count}" > "${COUNT_FILE}"
printf '#!/usr/bin/env bash\n# fake sidecar for %s/%s\n' "${GOOS}" "${GOARCH}" > "${OUTPUT_DIR}/cli-proxy-api"
chmod +x "${OUTPUT_DIR}/cli-proxy-api"
EOF
chmod +x "${FAKE_BUILD_SCRIPT}"

run_ensure() {
  CLI_PROXY_SOURCE_DIR="${CLI_PROXY_TEST_SOURCE_DIR:-${SOURCE_DIR}}" \
  CLI_PROXY_SOURCE_REPO="${CLI_PROXY_TEST_SOURCE_REPO:-https://github.com/AxApp/CLIProxyAPI.git}" \
  CLI_PROXY_SOURCE_REF="${CLI_PROXY_TEST_SOURCE_REF:-gettokens/sidecar}" \
  CLI_PROXY_OUTPUT_DIR="${OUTPUT_DIR}" \
  CLI_PROXY_BUILD_SCRIPT="${FAKE_BUILD_SCRIPT}" \
  CLI_PROXY_COMMIT="${CLI_PROXY_COMMIT:-}" \
  FAKE_BUILD_COUNT_FILE="${COUNT_FILE}" \
  "${ROOT_DIR}/scripts/ensure-sidecar.sh" darwin arm64 >/dev/null
}

run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "1" "首次运行必须构建 sidecar"
fingerprint_v1="$(read_fingerprint)"
assert_eq "$(read_commit)" "$(git -C "${SOURCE_DIR}" rev-parse --short HEAD)" "meta.json 必须记录 source commit"

run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "1" "源码未变化时不应重复构建"
assert_eq "$(read_fingerprint)" "${fingerprint_v1}" "源码未变化时 fingerprint 应保持不变"

cat > main.go <<'EOF'
package main

func main() {
	println("v2")
}
EOF

run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "2" "tracked dirty 内容变化后必须重新构建"
fingerprint_v2="$(read_fingerprint)"
if [[ "${fingerprint_v2}" == "${fingerprint_v1}" ]]; then
  echo "ASSERT FAILED: dirty 内容变化后 fingerprint 不应保持不变" >&2
  exit 1
fi

run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "2" "相同 dirty 内容不应重复构建"

cat > main.go <<'EOF'
package main

func main() {
	println("v3")
}
EOF

run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "3" "dirty 内容再次变化后必须再次构建"

CLI_PROXY_COMMIT="release-explicit-hash" run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "4" "显式发布 commit 变化后必须重新生成 sidecar metadata"
assert_eq "$(read_commit)" "release-explicit-hash" "meta.json 必须优先记录显式 CLI_PROXY_COMMIT"

REMOTE_SOURCE_DIR="${TEST_ROOT}/remote-source"
REMOTE_BARE_DIR="${TEST_ROOT}/remote-source.git"
MISSING_SOURCE_DIR="${TEST_ROOT}/missing-source-dir"
mkdir -p "${REMOTE_SOURCE_DIR}"
cd "${REMOTE_SOURCE_DIR}"
git init -q
git config user.email "codex@example.com"
git config user.name "Codex"
cat > go.mod <<'EOF'
module example.com/remote-cliproxyapi

go 1.24
EOF
cat > main.go <<'EOF'
package main

func main() {}
EOF
git add go.mod main.go
git commit -qm "remote init"
REMOTE_COMMIT="$(git rev-parse HEAD)"
git clone --bare -q "${REMOTE_SOURCE_DIR}" "${REMOTE_BARE_DIR}"

CLI_PROXY_TEST_SOURCE_DIR="${MISSING_SOURCE_DIR}" \
CLI_PROXY_TEST_SOURCE_REPO="${REMOTE_BARE_DIR}" \
CLI_PROXY_TEST_SOURCE_REF="${REMOTE_COMMIT}" \
CLI_PROXY_COMMIT="${REMOTE_COMMIT}" \
run_ensure
assert_eq "$(cat "${COUNT_FILE}")" "5" "source 目录缺失时必须按指定 commit 拉取并构建"
assert_eq "$(read_commit)" "${REMOTE_COMMIT}" "缺失 source 场景 meta.json 必须记录发布指定的 sidecar commit"

echo "ensure-sidecar test passed"
