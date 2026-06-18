# Round 27 Wails Generator Smoke Report Contract

日期：2026-06-18

## 目标

补齐 Doctor workbench 对 Wails generated binding smoke 的 Round27 证据门禁：脚本必须输出结构化 report contract，而不是把 generator unavailable / side effect 只留在人看日志里。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Round27 指定主控需要 machine-readable 的 generator smoke 结果，方便聚合 Doctor / Extension 两条 generated binding 风险链。 |
| 代码事实位置 | docs-linhay/scripts/check-wails-generated-drift.mjs、frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs、frontend/wailsjs/go/main/App.js、frontend/wailsjs/go/main/App.d.ts、frontend/wailsjs/go/models.ts。 |
| 当前现象 | Round26 脚本虽然能证明当前 CLI 不支持 generate bindings，但 stdout/stderr 仍混有人类日志，不适合作为稳定 smoke contract。 |
| 反证条件 | 若 CLI 能只输出单个 JSON report，并把 unavailable / side effect / generated drift 分类显式化，则 Doctor 侧不需要再额外增加 DTO 或 runtime 补偿。 |
| 预期验收 | report 包含 bindingGenerationAvailable、unavailableReason、wrapperCommand、restored、changedFiles、driftKind、sideEffectFiles、acceptedGeneratedDiff:false、exitClassification；focused test 覆盖 CLI stdout 与 report artifact 一致性。 |

## BDD Scenarios

1. Given Doctor workbench 依赖 root Wails binding 暴露
   When 运行 generated drift smoke
   Then 主控能从单个 JSON report 判断是 generator unavailable 还是 generated drift。

2. Given wrapper 在 generator unavailable 的情况下仍可能产生 side effect
   When smoke 结束
   Then report 明确列出 sideEffectFiles，并声明 restored:true。

3. Given 当前 repo 存在并行脏树
   When smoke 运行
   Then report artifact 只写到 /private/tmp 或 docs-linhay/**，不污染 frontend/wailsjs/**。

## 实现边界

- 不做真实桌面 app 验收；本轮只交付 script/test/doc contract。
- 不接受 generated diff。
- 不扩展 Doctor DTO。

## 验收命令

- node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-generated-drift-smoke-round27.json
- node docs-linhay/scripts/check-wails-binding-surface.mjs
- node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs
- bash docs-linhay/scripts/check-docs.sh
- git diff --check -- docs-linhay/scripts/check-wails-generated-drift.mjs frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs docs-linhay/spaces/20260616-doctor-workbench/plans/20260618-round27-wails-generator-smoke-report-contract.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-round27-wails-generator-smoke-report-contract.md

## 验收结果

- node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-generated-drift-smoke-round27.json：按预期非零退出，stdout 为单行 JSON；当前分类为 binding-generation-unavailable，未打印巨大 diff。
- node docs-linhay/scripts/check-wails-binding-surface.mjs：通过。
- node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs：通过，验证 stdout 可直接 JSON.parse，artifact 内容与 stdout 一致。

## 剩余风险

- 该 smoke contract 只解决“如何稳定报告”问题，不改变 Wails CLI 当前不支持 generate bindings 的事实。
- 若未来 wrapper 产生额外非 generated 文件副作用，本轮脚本仍只监控 frontend/wailsjs 范围；其他副作用需另设门禁。
