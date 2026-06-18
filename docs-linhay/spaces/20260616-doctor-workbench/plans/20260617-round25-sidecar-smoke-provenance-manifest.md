# Round25: Sidecar Smoke Provenance Manifest

日期：2026-06-17

## 目标

在 Round24 `gettokens-sidecar-build-smoke.sh` 的基础上补强 provenance evidence：每次 smoke 都必须在 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/` 生成合法 JSON manifest，明确记录 source commit、dirty 状态、source path、binary path、sha256、build/test commands、timestamp，以及 `testOnly` / `notReleaseArtifact` release 边界。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round25 retry 指定：上一批 agents 因上游 stream disconnected 中断；Round24 smoke binary 来自 dirty reference，只能作为测试证据，缺少 machine-readable provenance manifest。 |
| 当前代码事实位置 | `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 已能跑 focused tests、build `./cmd/server`、执行 `-h` 并输出 sha256。 |
| 当前现象 / 缺失证明 | Round24 文档只记录人工可读 sha256 与 `+dirty`，没有 manifest 固化 dirty status、命令、artifact path 和 release 禁用标记。 |
| 预期验收方式 | 运行 smoke 脚本后，用 JSON 解析器校验 manifest 合法，检查必需字段存在且 `testOnly: true`、`notReleaseArtifact: true`、`releasePipelineEligible: false`。 |
| 反证条件 | manifest 缺字段、不是合法 JSON、未记录 dirty 状态、未明确 test-only / not-release-artifact，或脚本触碰 app bundle / 正式版 / dev App。 |

## 范围

- 更新 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`。
- 更新 `docs-linhay/references/CLIProxyAPI/SIDECAR_BUILD_SMOKE.md`。
- 新增本 Round25 plan，并按需更新 Doctor Workbench README。

## 非目标

- 不发布、不签名、不 notarize。
- 不替换 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`。
- 不触碰 `/Applications/GetTokens.app` 正式版。
- 不启动 dev App、正式 App 或真实 sidecar HTTP 服务。
- 不清理、reset、checkout 或 revert 并行脏工作区。

## BDD 场景

1. 给定 CLIProxyAPI reference worktree 可能 dirty，当执行 smoke 脚本时，manifest 必须记录 `source.dirty` 与 `source.dirtyStatus`。
2. 给定 smoke 生成测试 binary，当脚本完成时，manifest 必须记录 binary path、help log path、sha256 file 和 sha256 值。
3. 给定 smoke 只用于测试证据，当脚本完成时，manifest 必须声明 `testOnly: true`、`notReleaseArtifact: true`、`releasePipelineEligible: false`。
4. 给定后续 release pipeline 需要 sidecar artifact，当 source dirty 或 artifact 来自 `/private/tmp` smoke 时，文档必须明确不能进入 release pipeline。

## Manifest 字段

必需字段：

- `manifestVersion`
- `timestampUTC`
- `source.path`
- `source.branch`
- `source.commitShort`
- `source.commitFull`
- `source.dirty`
- `source.dirtyStatus`
- `artifact.binaryPath`
- `artifact.sha256`
- `artifact.sha256File`
- `artifact.helpLogPath`
- `commands.test`
- `commands.build`
- `commands.help`
- `commands.sha256`
- `testOnly`
- `notReleaseArtifact`
- `releasePipelineEligible`
- `releaseBoundary`

## Release 边界

Manifest 只解决 test evidence 的可追溯性，不提升 artifact 信任等级。只有 clean maintained `gettokens/sidecar` commit 经过正式 release rebuild、metadata、packaging、签名/公证与分发验收后，才允许进入 release pipeline。dirty reference smoke binary 即使有 manifest，也不得复制进 app bundle 或发布资产。

## 验收命令

```bash
docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh
python3 -m json.tool /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-provenance.json >/tmp/gettokens-sidecar-smoke-manifest.pretty.json
python3 - <<'PY'
import json
from pathlib import Path

manifest = Path("/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-provenance.json")
data = json.loads(manifest.read_text())
required = [
    "manifestVersion",
    "timestampUTC",
    "source",
    "artifact",
    "commands",
    "testOnly",
    "notReleaseArtifact",
    "releasePipelineEligible",
]
missing = [key for key in required if key not in data]
assert not missing, missing
assert data["testOnly"] is True
assert data["notReleaseArtifact"] is True
assert data["releasePipelineEligible"] is False
for section, keys in {
    "source": ["path", "branch", "commitShort", "commitFull", "dirty", "dirtyStatus"],
    "artifact": ["binaryPath", "sha256", "sha256File", "helpLogPath"],
    "commands": ["test", "build", "help", "sha256"],
}.items():
    section_data = data[section]
    missing = [key for key in keys if key not in section_data]
    assert not missing, (section, missing)
assert data["artifact"]["sha256"]
print(data["artifact"]["sha256"])
PY
docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/spaces/20260616-doctor-workbench/README.md docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round25-sidecar-smoke-provenance-manifest.md
git -C docs-linhay/references/CLIProxyAPI diff --check -- SIDECAR_BUILD_SMOKE.md scripts/gettokens-sidecar-build-smoke.sh
```

## 验收记录

执行结果：通过。

```text
== gettokens management route focused tests ==
GOCACHE=/private/tmp/gettokens-cliproxyapi-sidecar-smoke/gocache
GOPROXY=off
ok  	github.com/router-for-me/CLIProxyAPI/v7/internal/gettokenshooks	0.457s
== bounded sidecar reference build ==
go: writing stat cache: open /Users/linhey/go/pkg/mod/cache/download/github.com/router-for-me/!c!l!i!proxy!a!p!i/v7/@v/v7.1.29-0.20260617113128-91dd8d8e4e4c.info113005471.tmp: operation not permitted
a040e3baff871369a70e099e06e4083fe626fc13dd6481309224be9c4ed53d85  /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke
smoke ok
source: /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI
commit: 91dd8d8e+dirty
binary: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke
help: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-help.txt
sha256: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke.sha256
manifest: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-provenance.json
testOnly: true
notReleaseArtifact: true
```

Manifest 校验：

```text
manifest ok
path=/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-provenance.json
sha256=a040e3baff871369a70e099e06e4083fe626fc13dd6481309224be9c4ed53d85
dirty=true
dirtyStatusEntries=7
```

环境备注：Go 仍尝试向默认 module stat cache 写入 `~/go/pkg/mod/cache/download/...` 并在 sandbox 下打印 `operation not permitted` warning；命令最终退出码为 0，focused tests、build、binary `-h`、sha256、manifest 生成与 manifest JSON 字段校验均完成。该 warning 表示当前 sandbox 对默认 Go module cache 只读，不表示 sidecar build 失败。

收尾门禁：

```text
docs-linhay/scripts/check-docs.sh
Documentation check passed.

git diff --check -- docs-linhay/spaces/20260616-doctor-workbench/README.md
passed

git -C docs-linhay/references/CLIProxyAPI diff --check
passed

git diff --check --no-index -- /dev/null docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round25-sidecar-smoke-provenance-manifest.md
passed; no whitespace errors

git -C docs-linhay/references/CLIProxyAPI diff --check --no-index -- /dev/null SIDECAR_BUILD_SMOKE.md
passed; no whitespace errors

git -C docs-linhay/references/CLIProxyAPI diff --check --no-index -- /dev/null scripts/gettokens-sidecar-build-smoke.sh
passed; no whitespace errors
```

## 剩余风险

- 当前 reference worktree dirty 时，manifest 会如实记录 dirty 状态；这仍然只代表测试侧 rebuild smoke 成功，不代表 release artifact 可用。
- 该 smoke 不替代完整 `go test ./...`、Wails build、dev App ready 验收或正式 release packaging。
- `/private/tmp` 下 binary/help/sha/manifest 是临时证据，不应纳入 app bundle 或发布资产。
