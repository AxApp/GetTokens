# Round27: Sidecar Manifest Docs Gate

日期：2026-06-18

## 目标

把 CLIProxyAPI sidecar smoke manifest checker 接入可复用的 docs gate，但保持 gate 轻量：常规 `check-docs.sh` 只验证稳定 fixture，不触发 sidecar rebuild；latest smoke manifest 继续由显式命令单独校验。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round27 subagent 指定：Round26 已有 manifest v2 与 checker，但 docs gate 还没有稳定 fixture / latest 分流，常规 docs-check 不能安全复用。 |
| 当前代码事实位置 | `docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs` 当前只校验显式路径或默认 latest；`docs-linhay/scripts/check-docs.sh` 还未接入 sidecar manifest gate。 |
| 当前现象 / 缺失证明 | 若把 checker 直接接进 docs-check 且仍依赖 `/private/tmp` latest，gate 会受本机是否先跑 smoke 影响；若让 docs-check 每次重跑 smoke，又会无谓 rebuild sidecar。 |
| 红灯方式 | 新增 `docs-linhay/scripts/check-sidecar-smoke-manifest-gate-integration.test.mjs`，先断言 `check-docs.sh` 必须以 fixture mode 调 checker，并且 checker 需要 machine-readable 的 `binarySha256Volatile` / `dirtyStatusEvidenceOnly` 边界字段。 |
| 预期验收方式 | docs-check 运行 fixture gate；smoke script 仍输出 `/private/tmp` latest manifest；checker 支持 `fixture`、`latest`、显式路径三种入口；文档明确 `binarySha256` volatile、dirty status 仅是 source-state evidence。 |
| 反证条件 | docs-check 触发 build；checker 无法校验 fixture 或 latest；manifest 未明确 `binarySha256Volatile=true` / `dirtyStatusEvidenceOnly=true`；或文档仍把 dirty smoke binary 描述成 release artifact。 |

## 范围

- 更新 `docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs`。
- 更新 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`。
- 新增稳定 fixture：`docs-linhay/references/CLIProxyAPI/fixtures/sidecar-smoke/cli-proxy-api-round26-smoke-manifest.fixture.json`。
- 接入 `docs-linhay/scripts/check-docs.sh`。
- 更新 `docs-linhay/references/CLIProxyAPI/SIDECAR_BUILD_SMOKE.md` 与 Doctor Workbench README。

## 非目标

- 不重建 app bundle sidecar。
- 不触碰 `/Applications/GetTokens.app`。
- 不要求 docs-check 先跑 smoke。
- 不把 latest manifest 固化进仓库替代 fixture。
- 不清理并行脏工作区。

## BDD 场景

1. 给定常规 docs-check 没有 sidecar binary，当执行 `bash docs-linhay/scripts/check-docs.sh` 时，脚本必须只校验仓库内 stable fixture，而不是重跑 smoke build。
2. 给定主控刚执行过 smoke script，当执行 `node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs latest` 时，checker 必须能校验 `/private/tmp` latest manifest。
3. 给定 manifest v2 把 binary sha 视为 volatile evidence，当执行 checker 时，必须要求 `reproducibilityBoundary.binarySha256Volatile: true`。
4. 给定 dirty reference smoke 只说明 source checkout state，当执行 checker 时，必须要求 `releaseBoundary.dirtyStatusEvidenceOnly: true`，并继续保持 `testOnly=true`、`notReleaseArtifact=true`、`releasePipelineEligible=false`。

## 设计说明

- fixture mode：面向 docs gate，读取仓库内稳定 JSON fixture，只检查 schema / boundary / 字段分类。
- latest mode：面向 smoke 后快速复核，读取 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-manifest.json`。
- explicit path mode：面向手工比对或归档路径。
- docs-check 只调用 fixture mode，保证无 build、无网络、无临时目录前置依赖。

## 验收命令

```bash
node docs-linhay/scripts/check-sidecar-smoke-manifest-gate-integration.test.mjs
bash docs-linhay/scripts/check-docs.sh
docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh
node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs latest
git -C docs-linhay/references/CLIProxyAPI diff --check
```

## 验收记录

- 红灯：新增 `check-sidecar-smoke-manifest-gate-integration.test.mjs` 后，因 `check-docs.sh` 尚未调用 fixture mode checker 而失败。
- 绿灯预期：实现后，fixture gate、docs-check、latest manifest checker 全通过，且 docs-check 不会重建 sidecar。

## 剩余风险

- fixture 只锁 schema/boundary，不保证最新 smoke 输出内容与某一次实际构建完全一致；latest mode 仍需在跑过 smoke 后单独执行。
- `volatileBuildMetadata.binarySha256` 仍是 run-local 指纹，不能与 release hash 等同。
- `deterministicSourceMetadata.dirty` / `dirtyStatus` 仅说明 source checkout state，被记录不代表任何 binary 可以进入发布链路。
