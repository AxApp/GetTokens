# Round26: Sidecar Smoke Reproducibility Manifest

日期：2026-06-18

## 目标

强化 Round25 sidecar smoke manifest 的可复现/可追踪边界：把 deterministic source metadata 与 volatile build metadata 拆开，新增 manifest checker/schema gate，明确当前 smoke 只证明测试证据可复核，不追求 release deterministic binary。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round26 subagent 指定：Round25 manifest 已记录 provenance，但 binary sha 会因为 build timestamp 变化，字段边界仍不够清晰。 |
| 当前代码事实位置 | `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 生成 Round25 manifest，字段仍混合在 `source` / `artifact` / `commands` / `environment` 中。 |
| 当前现象 / 缺失证明 | 旧 manifest 没有 machine-readable 字段分类；后续阅读者容易把 `artifact.sha256` 误解成可复现 binary 证明，而不是本次 `/private/tmp` 临时 binary 指纹。 |
| 预期验收方式 | smoke 脚本生成 v2 manifest；`check-sidecar-smoke-manifest.mjs` 校验 deterministic source fields、volatile build fields、`testOnly: true`、`notReleaseArtifact: true`、`releasePipelineEligible: false`。 |
| 反证条件 | checker 不能拒绝缺字段 manifest；manifest 未拆分 deterministic/volatile；未声明 binary non-deterministic；或脚本触碰 app bundle、正式版、dev App、release pipeline。 |

## 范围

- 更新 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`。
- 新增 `docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs`。
- 更新 `docs-linhay/references/CLIProxyAPI/SIDECAR_BUILD_SMOKE.md`。
- 更新 Doctor Workbench README 当前状态。

## 非目标

- 不发布、不签名、不 notarize。
- 不替换 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`。
- 不触碰 `/Applications/GetTokens.app` 正式版。
- 不启动 dev App、正式 App 或真实 sidecar HTTP 服务。
- 不追求 release deterministic binary。
- 不清理、reset、checkout 或 revert 并行脏工作区。

## BDD 场景

1. 给定同一 source checkout state，当执行 smoke 时，manifest 必须在 `deterministicSourceMetadata` 记录 commit、branch、dirty status、Go module 与 `sourceStateHash`。
2. 给定 smoke 每次使用当前 UTC timestamp 注入 `main.BuildDate`，当执行 smoke 时，manifest 必须在 `volatileBuildMetadata` 记录 `timestampUTC` / `buildDateUTC` / binary sha / output paths / commands / environment。
3. 给定 binary sha 会随 volatile build metadata 变化，当执行 checker 时，必须看到 `reproducibilityBoundary.binaryDeterministic: false` 和包含 timestamp / BuildDate 原因的 `binaryVolatilityCauses`。
4. 给定 smoke 只用于测试证据，当执行 checker 时，必须断言 `testOnly: true`、`notReleaseArtifact: true`、`releasePipelineEligible: false`，且 release boundary 禁止复制到 app bundle、正式版或发布资产。

## Deterministic Source Fields

这些字段用于复核产生 smoke 的 source checkout state。它们不声明 binary 可复现，只声明源码输入可追踪。

- `deterministicSourceMetadata.sourcePath`
- `deterministicSourceMetadata.branch`
- `deterministicSourceMetadata.commitShort`
- `deterministicSourceMetadata.commitFull`
- `deterministicSourceMetadata.dirty`
- `deterministicSourceMetadata.dirtyStatus`
- `deterministicSourceMetadata.goModule`
- `deterministicSourceMetadata.sourceStateHash`

## Volatile Build Fields

这些字段预期随每次 smoke 或本机环境变化，不能作为 release deterministic binary 证明。

- `volatileBuildMetadata.timestampUTC`
- `volatileBuildMetadata.buildDateUTC`
- `volatileBuildMetadata.outputDir`
- `volatileBuildMetadata.binaryPath`
- `volatileBuildMetadata.binarySha256`
- `volatileBuildMetadata.sha256File`
- `volatileBuildMetadata.helpLogPath`
- `volatileBuildMetadata.version`
- `volatileBuildMetadata.ldflagsCommit`
- `volatileBuildMetadata.commands.*`
- `volatileBuildMetadata.environment.*`

## 验收命令

```bash
docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh
node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-manifest.json
bash docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/spaces/20260616-doctor-workbench/README.md docs-linhay/spaces/20260616-doctor-workbench/plans/20260618-round26-sidecar-smoke-reproducibility-manifest.md
git -C docs-linhay/references/CLIProxyAPI diff --check -- SIDECAR_BUILD_SMOKE.md scripts/gettokens-sidecar-build-smoke.sh scripts/check-sidecar-smoke-manifest.mjs
```

## 验收记录

- 主控重跑 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 通过，输出测试侧 binary 到 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke`。
- 主控重跑 `node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-manifest.json` 通过。
- 本次 smoke manifest v2 记录 `volatileBuildMetadata.binarySha256=43fcbea176cd349ea112035b64957b0c7b16cbd4a1ddd5ba9396db39505ab792`。
- 本次 smoke manifest v2 记录 `deterministicSourceMetadata.sourceStateHash=391453c57dfa6a4f7763beb05590ce9f26217c866fe378bacc879b3642cf849c`、`dirty=true`、`dirtyStatusEntries=8`。
- boundary 字段保持 `testOnly=true`、`notReleaseArtifact=true`、`releasePipelineEligible=false`、`binaryDeterministic=false`、`mayCopyIntoAppBundle=false`、`mayTouchApplicationsGetTokens=false`、`mayPublish=false`。
- 该记录只证明 CLIProxyAPI reference 的测试侧 rebuild smoke 和 manifest 可校验，不代表 release binary 可复现或可分发。

## 剩余风险

- `volatileBuildMetadata.binarySha256` 只标识本次 `/private/tmp` smoke binary；由于 `main.BuildDate` 每次变化，sha 预期可变。
- 当前 reference worktree dirty 时，manifest 会如实记录 dirty 状态；这仍然只代表测试侧 rebuild smoke 成功，不代表 release artifact 可用。
- 该 smoke 不替代完整 `go test ./...`、Wails build、dev App ready 验收或正式 release packaging。
