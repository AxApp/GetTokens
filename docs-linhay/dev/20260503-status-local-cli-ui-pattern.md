# 2026-05-03 Status Local CLI UI Pattern

## 背景

本轮状态页本地 CLI 配置从单一 Codex 表单扩展为 `Codex / Claude Code` 双 tab。用户多次指出重复 JSX、按钮位置不一致、字段宽度不对齐和说明区过密的问题，最终形成一条可复用 UI 模式。

## 稳定规则

1. `Codex / Claude Code` tab 中表达同一概念的字段必须复用同一组件，不因目标 CLI 不同而复制一份相似 JSX。
2. `select + 右侧动作按钮` 使用 `frontend/src/components/ui/ActionSelect.tsx`。
3. `ActionSelect` 的 `+` 和可选删除按钮位于 select 框内，select 本身占满父列，避免按钮数量不同导致字段边界不齐。
4. 本地 CLI 配置区只保留可操作控件和右侧 diff；固定值、受控字段列表、说明性提示优先移除，除非它直接阻止用户误操作。
5. 右侧 diff 继续由 `StatusSnippetPanel` 承载，增删行用红绿标识。
6. Codex 写入语义是 `CODEX_HOME/auth.json` 字段 merge 与 `CODEX_HOME/config.toml` 受控 key patch；Claude Code 写入语义是 `settings.json` 的受控 `env` 字段 patch。两者都不能覆盖 MCP、profiles、agents、permissions、hooks、statusLine 或未知字段。

## 当前落点

- 通用控件：`frontend/src/components/ui/ActionSelect.tsx`
- 页面控制器：`frontend/src/features/status/StatusFeature.tsx`
- 状态页组件：`frontend/src/features/status/components/StatusPanels.tsx`
- 本地 patch 模型：`frontend/src/features/status/model/relayLocalState.ts`
- Claude Code 后端写入：`internal/wailsapp/claude_local_apply.go`
- Codex feature 配置后端：`internal/wailsapp/codex_feature_config.go`

## 不纳入本次沉淀

- `docs-linhay/references/codex/` 是本地外部参考仓库副本，不作为项目文档资产提交。
- `.playwright-mcp/` 是本地浏览器自动化临时目录。
- `docs-linhay/spaces/.DS_Store` 是系统文件。
