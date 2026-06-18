# Final Completion Wave: Sidecar Clean Source Comparison Smoke

日期：2026-06-18

## 目标

完成 Final Completion Wave 的 sidecar smoke closure：在不清理、不 reset 当前 dirty `CLIProxyAPI` reference 的前提下，让 smoke manifest 明确区分 clean source、dirty source、volatile binary，并在可创建 clean checkout/worktree 时记录 clean comparison result。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Final Completion Wave 任务：当前 latest smoke 来自 dirty CLIProxyAPI reference，需要 clean-state 或 dirty-state comparison smoke，证明 dirty 只是 source-state evidence，不是 release artifact。 |
| 当前代码事实位置 | `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 已生成 manifest v2，但只记录 `deterministicSourceMetadata.dirty` / `dirtyStatus`；`scripts/check-sidecar-smoke-manifest.mjs` 尚未强制 clean/dirty comparison 字段。 |
| 当前现象 / 缺失证明 | Round27 checker 能证明 fixture/latest 是 test-only 与 volatile binary，但无法 machine-readably 说明“primary latest 是 dirty source smoke”以及“同 commit clean checkout 是否已单独验证”。 |
| 红灯方式 | 新增 `docs-linhay/scripts/check-sidecar-smoke-clean-comparison.test.mjs`，先断言 fixture/checker 必须要求 `sourceState.classification`、`sourceStateComparison.cleanComparisonAvailable`、`cleanManifestPath` 或 clean/unavailable reason；当前 checker/fixture 缺字段应失败。 |
| 预期验收方式 | smoke script 在 dirty reference 下保留 primary latest manifest，同时尝试创建 `/private/tmp` clean worktree 对同 commit 跑 clean comparison；checker 支持 fixture/latest/explicit path，并强制 dirty source 只能作为 evidence、clean result 只能在 clean checkout 可用时记录。 |
| 反证条件 | checker 接受无 comparison 字段的 manifest；dirty source 被描述成 release artifact；docs-check 触发 sidecar rebuild；clean worktree 创建失败时没有 machine-readable reason；或脚本触碰正式版 app bundle / `/Applications/GetTokens.app` / 真实 `~/.codex/config.toml`。 |

## 范围

- 更新 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`。
- 更新 `docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs`。
- 更新 fixture：`docs-linhay/references/CLIProxyAPI/fixtures/sidecar-smoke/cli-proxy-api-round26-smoke-manifest.fixture.json`。
- 新增 focused policy test：`docs-linhay/scripts/check-sidecar-smoke-clean-comparison.test.mjs`。
- 更新 `docs-linhay/references/CLIProxyAPI/SIDECAR_BUILD_SMOKE.md`、Doctor Workbench README、Final Completion Wave 验收记录与 memory。

## 非目标

- 不要求当前 dirty reference 变 clean。
- 不 reset / checkout / revert 当前 reference 脏树。
- 不替换 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`。
- 不触碰 `/Applications/GetTokens.app`。
- 不读取或写入真实 `~/.codex/config.toml`。
- 不让 `docs-linhay/scripts/check-docs.sh` 每次 rebuild sidecar。

## BDD 场景

1. 给定 primary smoke 在 dirty `CLIProxyAPI` reference 上运行，当 manifest 生成时，必须记录 `sourceState.classification=dirty-source`、`sourceState.clean=false`、`sourceState.dirtyStatusEvidenceOnly=true`，且继续保持 `testOnly=true`、`notReleaseArtifact=true`、`releasePipelineEligible=false`。
2. 给定当前 dirty source 的 HEAD commit 可创建临时 clean worktree，当 smoke 完成时，primary latest manifest 必须记录 `sourceStateComparison.cleanComparisonAvailable=true`、同 commit clean manifest 路径、clean source state hash、clean binary sha256，并标记 clean result 仍是 test-only smoke evidence。
3. 给定 clean comparison worktree 无法创建或无法运行，当 smoke 完成时，manifest 必须记录 `cleanComparisonAvailable=false` 和 reason，不得把 primary dirty smoke 提升为 release artifact。
4. 给定 docs-check 运行 fixture gate，当执行 `bash docs-linhay/scripts/check-docs.sh` 时，只校验 fixture/checker，不创建 worktree、不 build sidecar。

## 验收命令

```bash
node docs-linhay/scripts/check-sidecar-smoke-clean-comparison.test.mjs
docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh
node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs latest
bash docs-linhay/scripts/check-docs.sh
git -C docs-linhay/references/CLIProxyAPI diff --check
```

## 验收记录

- 红灯：新增 `docs-linhay/scripts/check-sidecar-smoke-clean-comparison.test.mjs` 后，当前 checker 缺少 `sourceStateComparison` 校验，命令失败于 `checker must require machine-readable clean/dirty comparison metadata`。
- 绿灯：`node docs-linhay/scripts/check-sidecar-smoke-clean-comparison.test.mjs` 通过，fixture 与 checker 均要求 `sourceState.classification=dirty-source`、`sourceState.artifactClass=volatile-test-binary`、`sourceStateComparison.cleanComparisonAvailable=true`。
- `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 通过；primary dirty smoke 输出 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke`，sha256=`5b6b7a71e2a9758a2b26943f789ba13dc634f41e712e98129f05b5ffdf757ec1`。
- 同一命令成功创建 `/private/tmp` detached clean worktree 并生成 clean comparison manifest：`/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-clean-comparison-manifest.json`。
- `node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs latest` 通过；latest manifest 记录 `sourceStateHash=3bb47bb46f49681be8af9661476c207db0fe97cb58c257c7d79f6eac7bcaa148`、`dirty=true`、`dirtyStatusEntries=9`、`sourceStateClassification=dirty-source`、`artifactClass=volatile-test-binary`、`cleanComparisonAvailable=true`、`sourceStateComparisonMode=dirty-with-clean-comparison`。
- clean comparison result 记录 `cleanSourceStateHash=a200c1822c5034f8f40b3b238b542aedc61791a0a44db01d83dd59ba092fcf85`、`cleanBinarySha256=d50166bf688a4c9f3d62571d4aa8e4c8cebfcdf0aef233b5ed1ce87589f30291`、`sameCommit=true`、`result=clean-source-recorded`。
- 修复 `docs-linhay/scripts/check-sidecar-smoke-manifest-gate-integration.test.mjs`：latest mode 验证会备份并恢复 `/private/tmp` latest manifest，不再用 fixture 覆盖真实 smoke evidence。
- `node docs-linhay/scripts/check-sidecar-smoke-manifest-gate-integration.test.mjs` 通过；其后再次执行 latest checker，真实 smoke manifest 未被覆盖。

## 剩余风险

- primary latest 仍来自 dirty reference；它只作为 source-state evidence，不是 release artifact。
- clean comparison 证明同一 commit 的 clean checkout 可完成 smoke build，但仍使用 smoke 脚本、`BuildDate` timestamp 和 `/private/tmp` binary，不等同于 release-approved rebuild / signing / notarization。
- fixture 只锁 schema、字段分类和 release boundary；latest mode 仍需在显式跑过 smoke 后单独校验。
- 本轮没有启动 dev App，也没有替换 app bundle sidecar；按任务边界只做 sidecar smoke completion。
