# Round 26 Wails Generator Drift Smoke

日期：2026-06-18

## 目标

在 Round25 source-level binding surface gate 基础上，补一个会实际调用项目 Wails wrapper 的 generated binding smoke / drift verifier。该 verifier 必须证明 generator 是否可运行；若 generator 会改 `frontend/wailsjs`，必须报告具体 drift，并在退出前恢复 generated 文件，避免把临时输出留在并行脏树。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Round26 指定 Wails generator smoke / drift verifier；Round25 只覆盖 source-level generated surface gate。 |
| 代码事实位置 | `docs-linhay/scripts/check-wails-binding-surface.mjs`、`frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs`、`scripts/wails-cli.sh`、`frontend/wailsjs/**`。 |
| 当前现象 | 红灯：`node docs-linhay/scripts/check-wails-generated-drift.mjs` 失败于 `MODULE_NOT_FOUND`，说明没有 generator smoke 入口。 |
| 预期验收 | 新脚本通过 `bash scripts/wails-cli.sh generate bindings` 运行 Wails generator；快照并恢复 `frontend/wailsjs` generated files；无 drift 时退出 0，有 drift 或 generator 不可用时输出结构化报告并退出非零。 |

## BDD Scenarios

1. Given Round25 已有 source-level binding surface gate
   When Round26 运行 generator drift smoke
   Then verifier 通过项目 wrapper 触发 binding generation，而不是只读源码。

2. Given generator 改写 `frontend/wailsjs`
   When verifier 比较生成前后快照
   Then 报告每个 changed generated file 的状态和 diff，并恢复原文件内容。

3. Given 本地缺少 Wails generator 或 wrapper 无法完成 generation
   When verifier 运行失败
   Then 输出结构化 command/status/stdout/stderr，并以非零退出，不伪装通过。

## 实现边界

- 不启动 dev App。
- 不触碰正式版 GetTokens。
- 不接受 generator 产生的 generated diff 进仓。
- 不修改 Doctor 业务 DTO；本轮只补 smoke / drift verifier 与入口断言。

## 验收命令

```bash
node docs-linhay/scripts/check-wails-generated-drift.mjs
node docs-linhay/scripts/check-wails-binding-surface.mjs
node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs
npm --prefix frontend run typecheck
bash docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-wails-generated-drift.mjs frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs docs-linhay/spaces/20260616-doctor-workbench/plans/20260618-round26-wails-generator-drift-smoke.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-round26-wails-generator-drift-smoke.md docs-linhay/memory/2026-06-18.md
```

## 验收结果

- `node docs-linhay/scripts/check-wails-generated-drift.mjs`：按约定非零退出。脚本成功调用 `bash scripts/wails-cli.sh generate bindings`，但当前 Wails CLI v2.12.0 只输出 `generate` help，available commands 为 `module` / `template`，未确认 binding generation；脚本结构化报告 `bindingGenerationAvailable: false`、`drift: []`、`restored: true`。
- 未发现 generated drift；未接受任何 generated diff。
- `node docs-linhay/scripts/check-wails-binding-surface.mjs`：通过。
- `node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`：通过，6 个 binding tests 全绿。
- `npm --prefix frontend run typecheck`：通过。
- `bash docs-linhay/scripts/check-docs.sh`：通过。
- scoped `git diff --check -- docs-linhay/scripts/check-wails-generated-drift.mjs frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs ...round26 docs... docs-linhay/memory/2026-06-18.md`：通过。

## 剩余风险

- 该 verifier 能证明 generator smoke 与 generated drift，不替代真实 Wails 桌面运行态验收。
- 当前项目 wrapper / Wails CLI 不支持 `generate bindings` 独立入口；后续若要让 smoke 绿灯，需要确认等价 dry-run 或扩展 wrapper。
- `frontend/wailsjs/go/*` 在本轮开始前已处于并行脏树 `MM` 状态；本轮脚本只做快照/比较/恢复，不把 generated diff 接受进仓。
