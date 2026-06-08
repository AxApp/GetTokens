# Automatic Session Distillation Workflow

## 适用场景

- 用户说“整理”“暂停”“剩下的作为下期需求实现”。
- 一轮重要修复、subagent 交付或长会话即将结束。
- 会话中出现新的稳定偏好、验收边界、失败模式、交付步骤或半成品回退流程。

## 自动审计步骤

1. 盘点本轮新增模式：流程、边界、失败模式、验收方式、文档落位、agent 分工。
2. 判断归属：
   - 临时现象：不沉淀。
   - 单领域复用：更新对应 `.agents/skills/<domain>/SKILL.md`。
   - 跨领域流程：写入 `docs-linhay/dev/` workflow，并在 `gettokens-ops-governance` 挂入口。
   - repo-wide 长期约束：同步更新 `AGENTS.md`。
   - 只有事实记录价值：写入 `docs-linhay/memory/YYYY-MM-DD.md`。
3. 若存在半成品实现被暂停，先撤回半成品代码和临时产物，再把证据、范围、验收方式转写为下期需求。
4. 更新对应 space README、plans、backlog 和 memory。
5. 纯文档/治理沉淀至少运行：

```bash
docs-linhay/scripts/check-docs.sh
git diff --check
```

## 输出要求

- 最终回复说明本次沉淀了什么、落在哪些文件。
- 如果没有沉淀，说明审计结论和不沉淀原因。
- 不把未完成原型描述成已交付功能。
