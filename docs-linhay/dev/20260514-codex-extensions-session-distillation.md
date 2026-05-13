# Codex Skills / MCP 会话整理与结构收敛

日期：2026-05-14

## 背景

本期 `20260511-cc-switch-codex-skills-mcp` space 的主要需求施工已经结束，进入收尾整理阶段。目标不是新增业务能力，而是降低大文件维护成本，沉淀可复用工作方式，并把长期规则分层写回到 skill / AGENTS / space / memory。

## 本轮代码整理

前端大文件 `frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx` 从 1554 行收敛到 668 行。

拆分边界：

- `CodexExtensionsFeature.tsx`：页面 controller，负责列表、筛选、加载、保存调度和 preview fallback。
- `SkillsModals.tsx`：Skill preview、Git 安装 modal、删除 alert dialog、成功 HUD。
- `McpModals.tsx`：MCP server editor、config TOML editor、MCP status badge 与字段组件。
- `adapters.ts`：Wails DTO 与前端 model 互转、MCP clone、Skill source 展示格式。
- `model.ts`：保留纯解析、序列化、dirty diff 和 skill config patch 逻辑。

后端大文件 `internal/wailsapp/codex_extensions.go` 先做低风险第一刀：把 Wails DTO 与内部数据结构移动到 `internal/wailsapp/codex_extensions_types.go`，保留现有方法签名、解析函数和写回逻辑不变。

## 沉淀的稳定模式

新增项目级 skill：

- `.agents/skills/gettokens-codex-extensions-management/SKILL.md`

该 skill 负责 Codex Skills / MCP 的源码校准规则、UI 偏好、Git source schema、MCP section/tool 语义、文件拆分边界和验证闭环。

已更新：

- `.agents/skills/gettokens-domain-engineering/SKILL.md`：在 Codex workspace 章节中将 Skills / MCP 需求路由到专用 skill。
- `AGENTS.md`：只补充 repo-wide 的整理期规则和 Codex Extensions skill 路由，不写入本期页面细节。

## 用户偏好

- 不要多层卡片嵌套；复杂页面先简化信息架构，再加组件。
- 优先使用已有通用组件和全局样式，包括 `WorkspacePageHeader`、`SegmentedControl`、`ToggleSwitch`、`btn-swiss`、`input-swiss`、`select-swiss`。
- 列表页保持列表为主；详情和编辑进入独立 modal/detail layer。
- 空值字段不要展示，尤其是 MCP 编辑器中未配置的可选项。
- modal 需要视口约束高度和底部间距，长内容滚动区域要明确，切换内容不应导致整个页面跳动。

## 未升级到 AGENTS 的内容

以下内容属于 Codex Extensions 功能域，不写入全仓规则：

- Codex Skills 的具体 root 列表。
- `[[skills.config]]` 的 path/name selector 语义。
- MCP `bearer_token_env_var`、nested tools、transport 字段推断。
- Skill Git source manifest / update / rollback 细节。

这些规则统一由 `gettokens-codex-extensions-management` 承载。

## 验证

已完成：

- `npm run typecheck`
- `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`
- `npm run test:unit -- src/features/codex-extensions/model.test.mjs`
- `docs-linhay/scripts/check-docs.sh`
- `qmd update`
- `qmd embed`
