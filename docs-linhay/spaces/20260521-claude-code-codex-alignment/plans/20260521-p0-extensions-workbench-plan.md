# Claude Code P0 扩展资产工作台计划

日期：2026-05-21

## 背景

本计划承接本 space 的对齐矩阵。Claude Code 账号列表已经与 Codex 账号列表基本对齐；下一步最值得投入的是与 Codex `skills` / `mcp-servers` 高复用的扩展资产工作台。

实现前置条件：

1. `research-skills-commands.md` 与 `research-mcp-servers.md` 已完成第一版可行性调研。
2. 先执行 [`20260521-design-system-business-polish-plan.md`](./20260521-design-system-business-polish-plan.md)，把 Claude P0 资产工作台纳入设计系统业务组件与 Storybook 状态矩阵。
3. 进入代码实现前仍必须先补对应 BDD/TDD 红灯。

## P0 目标

1. Claude 工作区新增 `skills` 与 `mcp-servers` 二级菜单，分别直达 Skills / Commands 与 MCP 管理；旧 `extensions` hash 兼容迁移到 `skills`。
2. 复用 Codex Extensions 的主要 UI、筛选、预览、diff 和保存交互。
3. 后端抽出 target adapter，不把 Codex TOML parser 硬改成 Claude JSON parser。
4. 所有写入都提供 preview/diff，并保留未知字段。

## 用户场景

### 场景 1：查看 Claude Code Skills

Given 用户进入 `#frame=claude&workspace=skills`
When 本机存在 `~/.claude/skills/` 和项目 `.claude/skills/`
Then 页面展示 skill 名称、描述、来源、路径、启用状态和 `SKILL.md` 预览

### 场景 2：兼容查看旧 custom commands

Given 项目存在 `.claude/commands/*.md`
When 用户进入 Claude Code Skills 页面
Then 页面将 commands 作为兼容资产展示，并提示官方已将 custom commands 合并到 skills 语义

### 场景 3：管理 Claude Code MCP

Given 用户进入 `#frame=claude&workspace=mcp-servers`
When `~/.claude.json` 或项目 `.mcp.json` 存在 MCP server
Then 页面展示 server scope、transport、command/url、env、headers、tool 限制和原始 JSON 预览

### 场景 4：保存 MCP 修改

Given 用户编辑 Claude Code MCP server
When 点击保存
Then 后端只 patch 目标 server，保留文件中未知字段和其它项目条目，并返回变更预览

## 技术拆分

## 前置技术调研

- Skills / Commands：
  - 官方：确认 `SKILL.md`、`.claude/skills/`、`.claude/commands/` 的当前语义。
  - 本地：读取 `cherry-studio` 的 `.agents/skills` -> `.claude/skills` symlink mirror；读取 `cc-switch` 的 skill sync 测试。
  - GitHub：调研 `snowfort-ai/config` 或其它 Claude Code 配置管理项目。
  - 输出：[`research-skills-commands.md`](./research-skills-commands.md)。
  - 已验证边界：P0 只做扫描、预览、来源标记；不复用 Codex `[[skills.config]] enabled=false` 做启停。
- MCP Servers：
  - 官方：确认 `~/.claude.json`、`.mcp.json`、scope 和 transport 字段。
  - 本地：读取 `cc-switch/src-tauri/src/claude_mcp.rs` 与 `services/mcp.rs`，确认 import/sync/remove 策略。
  - GitHub：调研 `claude-mcp-switch`、`mcpick` 这类 MCP profile / switcher。
  - 输出：[`research-mcp-servers.md`](./research-mcp-servers.md)。
  - 已验证边界：P0 新增 Claude JSON adapter，支持 user/project/local scope 的单 server preservative patch。

### 1. 类型与路由

进入本节前必须先完成设计系统阶段的纯展示层和 mock stories，避免 runtime 业务代码先绑定 Wails 后无法稳定进入 Storybook。

- `frontend/src/types.ts`
  - `ClaudeWorkspace` 扩展为 `account-list | skills | mcp-servers | session-management | usage`
- `frontend/src/utils/pagePersistence.ts`
  - 扩展 `claudeWorkspaces`
  - 增加 hash roundtrip 测试
- `frontend/src/components/biz/Sidebar.tsx`
  - Claude submenu 增加扩展资产入口
- `frontend/src/pages/ClaudePage.tsx`
  - 按 workspace 路由到扩展工作台

### 1.1 第一刀实施记录

2026-05-21 已完成前端 preview 接入：

- `frontend/src/types.ts`：`ClaudeWorkspace` 增加 `extensions`。
- `frontend/src/utils/pagePersistence.ts`：支持 `#frame=claude&workspace=extensions` 解析、持久化和 hash 构建。
- `frontend/src/components/biz/Sidebar.tsx`：Claude submenu 增加 `扩展资产 / Extensions`。
- `frontend/src/pages/ClaudePage.tsx`：`extensions` 路由到 `ClaudeCodeAssetWorkbenchFeature`。
- `frontend/src/features/claude-code/assetPreviewData.ts`：抽出 Storybook 与真实 preview 共用的 Claude Code asset mock 数据。
- `frontend/src/features/claude-code/ClaudeCodeAssetWorkbenchFeature.tsx`：复用 `ClaudeCodeAssetWorkbench`，提供真实页面入口、tab 状态和搜索过滤。
- `frontend/src/components/ui/AssetWorkbenchShell.tsx`：从 Codex Extensions 的页头、面板、工具条、消息条、列表/侧栏布局中抽出共享 shell。
- `frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx` 与 `frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.tsx`：共同复用 `AssetWorkbenchShell`；Codex 继续保留现有业务行为，Claude 只替换字段语义、scope、diff 与风险状态。
- `frontend/src/features/design-system/storyCatalog.test.mjs`：新增门禁，要求 Codex Extensions 与 Claude Code 资产页都引用共享 shell。

本刀仍是 preview/mock 接入，不调用 Wails、sidecar 或真实本地文件扫描；后端 adapter 从下一刀开始。

### 1.4 Claude 二级菜单接入记录

2026-05-21 本轮目标调整为与 Codex 工作区形态进一步对齐：

- Claude submenu 不再只暴露合并的 `extensions`，而是直接暴露 `skills` 与 `mcp-servers` 两个二级菜单。
- `#frame=claude&workspace=skills` 默认打开 Skills / Commands 矩阵。
- `#frame=claude&workspace=mcp-servers` 默认打开 MCP Servers 矩阵。
- 旧链接 `#frame=claude&workspace=extensions` 与旧本地存储值迁移为 `skills`，避免用户旧入口回落到账号列表。
- 与 Codex `CodexExtensionsFeature` 保持一致，Claude feature 按 workspace 分派到 `ClaudeCodeSkillsWorkspace` 与 `ClaudeCodeMcpServersWorkspace` 两个页面组件。
- 页面内不再提供 Skills / MCP segmented tab；MCP 内保留的 segmented control 只用于 transport 字段编辑，不承担页面导航。

### 1.2 App 内只读扫描接入记录

2026-05-21 已完成 Wails app 内真实只读接入：

- 后端新增 `internal/wailsapp/claude_code_extensions.go` 与 `internal/wailsapp/claude_code_extensions_types.go`，提供 `GetClaudeCodeExtensionsSnapshot` 统一快照。
- root Wails binding 已接到 `app.go`、`app_types.go`、`app_mappers.go`，前端通过 `frontend/wailsjs/go/main/App` 调用真实方法。
- Skills 扫描范围：
  - `$CLAUDE_CONFIG_DIR/skills`，缺省为 `~/.claude/skills`
  - 当前项目 `.claude/skills`
  - 当前项目 `.claude/commands/*.md`，作为 `legacy-command` 兼容资产展示
- MCP 扫描范围：
  - `~/.claude.json.mcpServers` 作为 `user`
  - `~/.claude.json.projects[projectPath].mcpServers` 作为 `local`
  - 当前项目 `.mcp.json.mcpServers` 作为 `project`
- MCP precedence 当前按 `local > project > user` 标记，同名 server 的后续来源会显示为 `shadowed`，不删除也不覆盖原始配置。
- `streamable-http` / `streamable_http` 会标准化为 `http`；`env` / `headers` 中存在非空值或 token / secret / key / authorization 类字段时展示为 `redacted`。
- 前端 `ClaudeCodeAssetWorkbenchFeature` 在 Wails app 内调用真实快照；普通浏览器或 Storybook 无 Wails bridge 时仍使用 `assetPreviewData`，保证设计系统与本地预览可稳定打开。

本轮尚未实现 `SaveClaudeCodeMcpServer` 或 MCP JSON patch 写入；保存、diff 与未知字段保留仍按下一刀处理。

### 1.3 MCP 单 server 保存接入记录

2026-05-21 已完成 Claude Code MCP 单 server 保存第一刀：

- 后端新增 `SaveClaudeCodeMcpServer`，root Wails binding、`frontend/wailsjs` 与前端 feature 已接通。
- 保存 scope 与官方文档对齐：
  - `project` 写入当前项目根 `.mcp.json`
  - `user` 写入 `~/.claude.json.mcpServers`
  - `local` 写入 `~/.claude.json.projects[projectPath].mcpServers`
- 保存策略为 preservative JSON patch：只更新目标 server 的 `type` 与 endpoint 字段，不重建其它 server，不删除 top-level / project section / server 内未知字段。
- transport 约束：
  - `stdio` 写 `command` 并清理 stale `url`
  - `http` / `sse` 写 `url` 并清理 stale `command` / `args` / `cwd`
  - `streamable-http` 仍在读取阶段标准化为 `http`
- 前端 MCP 行新增最小编辑流：点击 `Edit` 后可编辑 transport 与 endpoint；桌面 app 调用真实 Wails 保存，browser preview 仅更新 mock 行并标记 `dirty`。
- 本刀仍不做完整 MCP 原始 JSON 编辑器、headers/env 编辑器、删除 server、批量迁移或 Skills 删除/启停。

### 2. 前端复用边界

- 现有 `frontend/src/features/codex-extensions/` 改名或抽出为通用 `cli-extensions` 前端层。
- 纯模型函数继续保持无 Wails 依赖，可直接复用：
  - git source 解析
  - MCP args/env/list/tools 序列化
  - change preview
  - skill preview/filter/remove 的列表状态操作
- Wails adapter 需要按 target 分流：
  - Codex：调用现有 `GetCodexSkillsSnapshot` / `GetCodexMcpServers`
  - Claude：调用新增 `GetClaudeCodeSkillsSnapshot` / `GetClaudeCodeMcpServers`

### 3. 后端 adapter

新增 Claude Code 后端能力时优先放在 `internal/wailsapp/claude_code_extensions.go`：

- `GetClaudeCodeExtensionsSnapshot`（本轮已实现）
  - 解析 `CLAUDE_CONFIG_DIR` 或默认 `~/.claude`
  - roots：`~/.claude/skills`、当前项目 `.claude/skills`、兼容 `.claude/commands`
  - 读取 `SKILL.md` 或 command markdown frontmatter
  - user/local 来源：`~/.claude.json`
  - project 来源：`.mcp.json`
  - 解析 JSON object 并映射到与前端兼容的 server record
- `SaveClaudeCodeMcpServer`（本轮已实现单 server endpoint / transport patch）
  - 按 scope 定位目标文件
  - preservative JSON patch，只替换目标 server object

### 4. 测试红灯

先补以下失败测试：

- `frontend/src/utils/pagePersistence.test.mjs`
  - `#frame=claude&workspace=skills`
  - `#frame=claude&workspace=mcp-servers`
  - `#frame=claude&workspace=extensions` legacy migrate to `skills`
- `frontend/src/features/cli-extensions/model.test.mjs`
  - target label / source label
  - command asset 展示
  - MCP JSON server change preview
- `internal/wailsapp/claude_code_extensions_test.go`
  - 从 `CLAUDE_CONFIG_DIR` 读取 user skills
  - 从项目 `.claude/commands` 读取兼容 command
  - 解析 `~/.claude.json` MCP servers
  - 识别 user / project / local scope、precedence 与 secret redaction
  - patch `.mcp.json` 单个 server 且保留未知字段
  - patch `~/.claude.json.projects[projectPath].mcpServers` local scope 且不影响 user scope
  - 非法 transport 拒绝保存

## 验证

- `go test ./internal/wailsapp ./internal/accounts`
- `go test ./internal/wailsapp -run 'ClaudeCode.*Extensions|ApplyClaudeCode'`
- `go test .`
- `go test ./...`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `./scripts/wails-cli.sh build -skipbindings`
- browser preview 打开：
  - `http://127.0.0.1:5173/#frame=claude&workspace=skills`
  - `http://127.0.0.1:5173/#frame=claude&workspace=mcp-servers`
- Wails app 内验证真实文件读取；写入 preview 留到 `SaveClaudeCodeMcpServer` 阶段。

## 风险

- Claude Code 官方配置结构会继续变化，写入层必须保留未知字段。
- `.claude/commands` 是兼容入口，不应成为新增主模型。
- MCP scope 分布比 Codex TOML 更复杂，P0 不做批量迁移，只做读写当前 scope。
- 删除本地 skill/command 是破坏性操作，P0 可先只读或仅允许删除用户明确选择的 Claude config dir 内资产。
