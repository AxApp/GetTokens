# Subagent Project Experience Review

## 背景
用户希望用项目级 subagent 对 GetTokens 做一次 dev 环境体验巡检：

- 3 个体验 subagent 并行体验项目，并各自给出至少 10 个中度修改建议。
- 体验建议必须覆盖业务功能体验和现有代码逻辑审核，不只看界面和流程。
- 1 个评估和修复 subagent 汇总体验结果，筛选可立即落地的低风险修复并执行。
- 所有过程材料、建议、评估、修复说明、验收记录都落到本 space 内。
- 体验环境限定为 dev；需要真实数据时，只允许从正式数据目录拷贝到 dev 数据目录。
- 本轮按轮次推进；除非用户停止，或评估后已经没有无需产品决策且可安全修改的候选，否则继续下一轮。

## 目标
- 从不同角色视角体验 GetTokens 当前项目，形成可追踪、可复盘的改进建议。
- 每个体验 subagent 至少输出 10 条“中度建议”：建议应具备明确问题、影响范围、修改方向和验收方式，但不要求立即全部实现。
- 每轮报告都必须标注轮次，例如“第 1 轮：体验 + 代码逻辑审核”“第 1 轮：评估 + 修复”。
- 由评估修复 subagent 对建议进行归并、优先级判断，并修复一批不破坏业务边界的低风险问题。
- 主控 agent 负责调度、集成、验证、文档和 memory 写回，并根据剩余可修复候选决定是否进入下一轮。

## 范围
- dev 环境体验、文档梳理、功能/交互/架构/验证链路建议。
- 现有代码逻辑审核：状态流、数据契约、错误处理、测试缺口、维护性、sidecar 边界和 Wails/frontend 绑定闭环。
- dev 数据准备：可将 `/Users/linhey/.config/gettokens/` 的必要数据复制到 `/Users/linhey/.config/gettokens-dev/`，复制前必须备份 dev 原目录。
- subagent 产物路径：
  - `plans/experience-product-operator.md`
  - `plans/experience-runtime-routing.md`
  - `plans/experience-extension-workbench.md`
  - `plans/evaluation-and-fixes.md`
  - `plans/final-acceptance.md`

## 非目标
- 不触碰正式版 GetTokens 应用二进制或正式版运行进程。
- 不修改 `/Applications/GetTokens.app`。
- 不为了体验强行 kill 或重启正式版进程。
- 不把所有中度建议一次性全部实现；本轮只修复评估后确认低风险且能快速验收的问题。

## 验收标准
- 已完成 dev 数据准备记录，明确是否从正式环境搬运数据以及备份路径。
- 3 个体验 subagent 均完成报告，每份至少 10 条中度建议。
- 每份体验报告均标注轮次，并同时覆盖业务功能体验与代码逻辑审核。
- 评估修复 subagent 完成建议归并、优先级判断和至少 1 项可落地修复。
- 评估修复报告明确是否仍有可继续修改的下一轮候选；若有，继续下一轮，除非用户停止。
- 主控 agent 审核并集成产物，运行必要的文档/测试验证。
- 本 space 的 README、计划/报告、最终验收记录与 memory 均已更新。
- 若未运行某类验证，必须说明原因与风险。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260608-subagent-project-experience`
- worktree：`../GetTokens-worktrees/20260608-subagent-project-experience/`

## 相关链接
- 数据准备记录：`plans/dev-data-prep.md`
- 最终验收：`plans/final-acceptance.md`
- 第 8 轮第一修复包方案：`plans/round-8-first-fix-plan.md`
- 第 8 轮第一修复包验收：`plans/round-8-first-fix-acceptance.md`
- 第 9 轮入口诊断方案：`plans/round-9-entry-diagnostics-plan.md`
- 第 9 轮入口诊断验收：`plans/round-9-entry-diagnostics-acceptance.md`

## 当前状态
- 状态：round-9-real-dev-app-accepted
- 最近更新：2026-06-08
