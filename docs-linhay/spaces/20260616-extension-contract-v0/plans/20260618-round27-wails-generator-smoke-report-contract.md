# Round 27 Wails Generator Smoke Report Contract

日期：2026-06-18

## 目标

把 Round26 的 check-wails-generated-drift.mjs 升级成结构化 report contract：stdout 只输出精简 JSON，支持安全 report artifact 落盘，并把 generator unavailable / wrapper side effect 分类变成可机读证据。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Round27 指定：Round26 脚本输出可能含大量 diff，generator unavailable / wrapper side effect 证据不够 machine-readable。 |
| 代码事实位置 | docs-linhay/scripts/check-wails-generated-drift.mjs 当前负责调用 bash scripts/wails-cli.sh generate bindings；frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs 只覆盖 wrapper 常量和 target 范围。 |
| 当前现象 | 变更前脚本会把 report pretty-print 到 stdout，并在 generator unavailable 时继续把 stderr/stdout 全量回显；一旦未来出现 drift，CLI 会继续打印大段 diff，CI/主控难以稳定消费。 |
| 反证条件 | 若脚本已经能稳定输出单个 JSON 对象、包含 unavailable / drift / side effect 分类、并支持独立 artifact path，则本轮不应改业务 Wails DTO。 |
| 预期验收 | CLI 默认或 --report <path> 下都只输出单个 JSON report；report 至少包含 bindingGenerationAvailable、unavailableReason、wrapperCommand、restored、changedFiles、driftKind、sideEffectFiles、acceptedGeneratedDiff:false、exitClassification；generator unavailable 仍非零退出但不打印巨大 diff。 |

## BDD Scenarios

1. Given 当前 Wails CLI v2.12.0 不支持 generate bindings
   When 运行 drift smoke
   Then stdout 只输出结构化 JSON，exitClassification 为 binding-generation-unavailable，并写出 report artifact。

2. Given generator 改写了 frontend/wailsjs
   When smoke 收集前后快照
   Then report 用 changedFiles / driftKind / sideEffectFiles 暴露差异，并在退出前恢复 generated 文件。

3. Given 调用方需要把 smoke 结果交给 CI / 主控聚合
   When 传入 --report /private/tmp/...json 或 docs-linhay/...json
   Then 脚本只在安全路径写入 artifact，不把报告写进 git tracked generated files。

## 实现边界

- 不启动 dev App。
- 不接受或覆盖 generated diff。
- 不修改 Extension 业务 DTO / binding surface。
- report artifact 只允许写到 /private/tmp 或 docs-linhay/** 安全位置。

## 验收命令

- node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-generated-drift-smoke-round27.json
- node docs-linhay/scripts/check-wails-binding-surface.mjs
- node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs
- bash docs-linhay/scripts/check-docs.sh
- git diff --check -- docs-linhay/scripts/check-wails-generated-drift.mjs frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-round27-wails-generator-smoke-report-contract.md docs-linhay/spaces/20260616-doctor-workbench/plans/20260618-round27-wails-generator-smoke-report-contract.md

## 验收结果

- node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-generated-drift-smoke-round27.json：按预期非零退出；stdout 为单个 JSON report，bindingGenerationAvailable:false、driftKind:"none"、sideEffectFiles:[]、acceptedGeneratedDiff:false、exitClassification:"binding-generation-unavailable"。
- frontend/wailsjs 未留下生成器副作用；报告写入 /private/tmp/gettokens-wails-generated-drift-smoke-round27.json。
- node docs-linhay/scripts/check-wails-binding-surface.mjs：通过。
- node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs：通过，新增 CLI/report contract focused test。

## 剩余风险

- 当前 Wails CLI / wrapper 仍不支持 generate bindings 独立入口；本轮只把失败信号结构化，不把 unavailable 伪装成通过。
- 若未来 generator 真产生 drift，当前 report 只输出 changed file metadata，不内联巨大 diff；需要时应结合 artifact 或单独 diff 调查。
