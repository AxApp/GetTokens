# Round 26 Wails Generator Drift Smoke

日期：2026-06-18

## 目标

在 Round25 source-level binding surface gate 基础上，补一个安全的 Wails generated binding smoke / drift verifier，覆盖 Extension dry-run / route action 等 generated surface 的真实 generator 漂移风险。脚本必须优先证明 wrapper 能否运行 generator；若 generator 对 `frontend/wailsjs` 产生 diff，报告具体 drift 并恢复文件。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Round26 指定需要在 Round25 `check-wails-binding-surface.mjs` 基础上增加 generator smoke / drift verifier。 |
| 代码事实位置 | `scripts/wails-cli.sh` 支持 wrapper 调用；Round25 `check-wails-binding-surface.mjs` 只静态检查 root/internal/generated/frontend surface；generated files 位于 `frontend/wailsjs/**`。 |
| 当前现象 | 红灯：`node docs-linhay/scripts/check-wails-generated-drift.mjs` 失败于脚本不存在；当前没有安全运行 generator 并恢复 generated 文件的门禁。 |
| 预期验收 | `docs-linhay/scripts/check-wails-generated-drift.mjs` 快照 `frontend/wailsjs` 非 test 文件，运行 `bash scripts/wails-cli.sh generate bindings`，比较并恢复文件；generator 不可用或 drift 非空时结构化输出并非零退出。 |

## BDD Scenarios

1. Given Extension generated surface 已被 Round25 静态 gate 覆盖
   When Round26 verifier 运行
   Then 它会通过项目 wrapper 执行 binding generation smoke。

2. Given generator 输出与当前 `frontend/wailsjs` 不一致
   When verifier 收集 drift
   Then 报告 changed path、added/modified/deleted 状态和 diff，不静默覆盖当前工作区。

3. Given generator 不可用
   When wrapper 返回非零
   Then verifier 报告 command/status/stdout/stderr，并退出非零。

## 实现边界

- 不启动 dev App。
- 不触碰正式版 GetTokens。
- 不修改 Extension / Route action 业务实现。
- 不接受 generated diff，除非另有 focused test 证明必须最小同步；本轮默认只做报告与恢复。

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

- 该 verifier 只证明 generator 对 generated bindings 的可运行性与 drift；不替代 Wails runtime binding 可见性或 dev App 验收。
- 当前项目 wrapper / Wails CLI 不支持 `generate bindings` 独立入口；后续若要让 smoke 绿灯，需要确认等价 dry-run 或扩展 wrapper。
- `frontend/wailsjs/go/*` 在本轮开始前已处于并行脏树 `MM` 状态；本轮脚本只做快照/比较/恢复，不把 generated diff 接受进仓。
