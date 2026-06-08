---
name: gettokens-session-skill-distill
description: GetTokens 会话沉淀入口：处理“整理”及可复用模式蒸馏。
---

# GetTokens Session Skill Distillation

## 1. 触发条件
- 用户明确说“整理”
- 用户要求暂停、收口、把剩余问题放到下期，且当前会话已经产生方案、原型、证据矩阵或未完成实现
- 一轮会话里反复出现同类排障、交付、验收或文档动作
- 长会话结束前，agent 发现本轮存在新的稳定偏好、验收边界、失败模式、交付步骤或可复用修复流程
- 需要判断某个模式应沉淀为 skill、写入 docs，还是升级到 AGENTS

## 2. 蒸馏顺序
1. 先抽取可复用模式
2. 再区分稳定性边界：
   - 只在本次会话出现的，丢弃
   - 后续还会重复的，先沉淀到项目级 skill
   - repo-wide 且长期稳定的，再考虑更新 AGENTS
3. 同步写入对应 docs 与 memory

## 2.1 自动沉淀审计
每次重要修复轮、subagent 交付轮、会话整理或中断收口结束前，agent 必须自动做一次沉淀审计，不需要等待用户追问：

1. 列出本轮新出现的复用候选：流程、边界、失败模式、验收方式、文档落位、agent 分工。
2. 对每个候选判断归属：
   - 临时现象：不沉淀，只在最终回复说明不纳入。
   - 单领域复用：更新对应 domain skill。
   - 跨领域流程：写入 `docs-linhay/dev/` workflow，并在 `gettokens-ops-governance` 中挂入口。
   - repo-wide 长期约束：同步更新 `AGENTS.md`。
3. 若本轮存在半成品实现被用户暂停或改为下期需求，必须先撤回半成品代码，只保留证据、范围、验收和下期计划。
4. 将沉淀结果或“不沉淀原因”写入 `docs-linhay/memory/YYYY-MM-DD.md`。
5. 纯治理/文档沉淀至少运行 `docs-linhay/scripts/check-docs.sh` 与 `git diff --check`。

## 3. 输出标准
- 清楚写出“这次沉淀了什么模式”
- 明确“不纳入”的临时内容
- 给出后续可复用的执行入口
- 若发现现有 skill 缺口，优先补 skill，再谈 AGENTS

## 4. 本仓库常见沉淀对象
- Wails 开发态与 sidecar 启动闭环
- 账号池 / 轮动 / quota 的稳定边界
- 文档写回、记忆写回
- Wails 绑定生成与前端导出缺口排障
- 中断修复轮的半成品回退、证据保留、下期需求转写
- 前端 model / selector 与 UI/i18n 文案边界

## 5. 结束检查
- 是否已经更新相关 skill
- 是否已写入 docs-linhay/dev 或 docs-linhay/memory
- 是否需要进一步升级到 AGENTS
