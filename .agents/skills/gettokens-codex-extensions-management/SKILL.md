---
name: gettokens-codex-extensions-management
description: GetTokens Codex Skills / MCP 扩展管理：源码校准解析、全局 Skill roots、MCP section/tool 语义、Git source、UI 验收与整理拆分。
---

# GetTokens Codex Extensions Management

用于实现、审查或整理 Codex `Skills` / `MCP Servers` 工作区。触发词包括：Codex skills、MCP servers、`~/.codex/config.toml`、`[[skills.config]]`、`tk://github.com`、`tk://gitlab.com`、Skill 预览/移除/更新。

## 1. Source Truth
- 先读当前仓库实现，再核对 Codex 源码或已归档参考，不凭记忆补字段。
- Skills 只展示全局 roots，不展示 project / repo / git 追加 roots：
  - `$CODEX_HOME/skills`
  - `$HOME/.agents/skills`
  - `$CODEX_HOME/skills/.system`
  - `/etc/codex/skills`
- MCP 列表只把 `[mcp_servers.<id>]` 一级 table 作为 server。
- `[mcp_servers.<id>.tools.<tool>]` 是 parent server 的嵌套 tool approval，不是独立 server。

## 2. Skills Rules
- 只识别含 `SKILL.md` 的目录。
- `SKILL.md` 预览使用 `react-markdown` + `rehype-sanitize`，渲染前移除 YAML front matter。
- Snapshot 只返回文件路径、类型和可预览标记；文件内容必须点击单个文件后懒加载并前端缓存。
- Skill 启停使用 Codex 支持的 `[[skills.config]] enabled = false`。
- 启用 Skill 时移除匹配的禁用 override，不写 `enabled = true`。
- 移除 Skill 必须删除本地目录并校验目录不存在，否则 Codex 仍会扫描到。
- 移除需 alert dialog 二次确认，成功后关闭详情 modal 并显示短暂成功 HUD。
- Finder 打开必须校验路径属于已配置 skill roots。
- Git source 只支持显式 schema：
  - `tk://github.com/<owner>/<repo>?ref=<ref>&path=<skill-dir>`
  - `tk://gitlab.com/<namespace>/<repo>?ref=<ref>&path=<skill-dir>`
- 自建 GitLab 需要 allowlist；凭据不得写入 manifest。

### 2.1 External Project Skill Packages
- 将外部 Git skill 包安装进项目级 `.agents/skills/` 时，必须记录可复现来源：
  - source URL / repo / ref
  - resolved commit hash
  - source path -> local path -> skill name 清单
- 优先把来源记录写成机器可读 lock，例如 `.agents/skills/<package>.lock.json`，再补 `docs-linhay/dev/` 人工说明。
- 如果外部仓库包含多个 `skills/*/SKILL.md`，用户给的是仓库 URL 且未指定子 skill 时，按全量安装处理；后续如出现 skill discovery 预算告警，再收敛为高频子集。
- 更新脚本默认只能检查哈希；替换本地 skill 目录必须显式传 `--update` 或等价确认参数。
- 收尾必须更新 memory，并运行 `qmd update` 与 `qmd embed`，确保后续能按包名、commit、脚本名检索。

## 3. MCP Rules
- Transport 由字段推断：`command` => `stdio`，`url` => `streamable_http`。
- `command` 与 `url` 同时存在时不能保存。
- `bearer_token` 不是 Codex MCP 保存字段；只支持 `bearer_token_env_var`。
- 保存单个 server 时只 patch 目标 section，保留未知字段、其他 server 和非 MCP 配置。
- 编辑 modal 左侧表单只展示当前 server 有值的可选字段；必填字段保留。
- 右侧当前值只展示有用值；空可选项直接忽略。
- 原始 `config.toml` 编辑器保存后必须重读结构化 snapshot，避免结构化视图用旧数据。

## 4. UI Preferences
- 侧边栏内 Skills / MCP 拆成两个 tab/entry。
- 右侧主体按会话页面的信息层级组织：列表为主，详情/编辑用 modal 或 detail layer。
- 不使用多层卡片嵌套。
- 优先复用已有通用组件和全局样式：
  - `WorkspacePageHeader`
  - `SegmentedControl`
  - `ToggleSwitch`
  - `btn-swiss`
  - `input-swiss`
  - `select-swiss`
- Skill 列表点击整行打开详情，嵌套 toggle 必须阻止行点击冒泡。
- modal 要有视口约束高度和底部间距；长内容在内部明确滚动，不让文件切换导致整个页面跳动。

## 5. Split & Cleanup Pattern
- 前端大文件优先按稳定边界拆：
  - `CodexExtensionsFeature.tsx`：页面 controller、列表、加载保存调度。
  - `SkillsModals.tsx`：Skill 预览、Git 安装、删除确认、成功 HUD。
  - `McpModals.tsx`：MCP server editor、config TOML editor、MCP 字段组件。
  - `adapters.ts`：Wails DTO 与前端 model 互转、clone、来源格式化。
  - `model.ts`：纯解析/序列化/dirty diff 逻辑。
- 后端大文件第一刀优先移动 DTO / 内部结构体到 `*_types.go`，保持 Wails 方法签名和解析函数行为不变。
- 不在同一轮把 UI 拆分、解析算法重写、存储 schema 迁移混在一起。

## 6. Verification
- 前端结构调整后至少运行：
  - `npm run typecheck`
  - `npm run test:unit -- src/features/codex-extensions/model.test.mjs`
- 后端 Codex extensions 变更后至少运行：
  - `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`
- 视觉/交互变化需要浏览器或 Wails 实际截图，截图归档到对应 `space/screenshots/`。
- 收尾时更新 space README、`docs-linhay/dev/`、`docs-linhay/memory/YYYY-MM-DD.md`，再执行 `qmd update` 与 `qmd embed`。
