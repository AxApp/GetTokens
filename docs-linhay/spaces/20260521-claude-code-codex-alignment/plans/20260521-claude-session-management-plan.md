# Claude Code 会话管理第一刀计划

日期：2026-05-21

## 目标

在 Claude 工作区新增 `session-management`，复用现有 Codex `session-management` 页面结构，但数据源改为 Claude Code 本地 session jsonl。第一刀只做只读扫描、脱敏摘要与详情查看，不写入、不删除、不归并 provider。

## BDD 场景

### 场景 1：查看 Claude Code 会话列表

Given 本机存在 `~/.claude/projects/<project>/<session-id>.jsonl`
When 用户进入 `#frame=claude&workspace=session-management`
Then 页面按项目展示会话数、最近更新时间、消息数、角色分布、模型与摘要。

### 场景 2：跳过 subagent sidecar 会话

Given Claude Code 项目目录下存在 `subagents/agent-*.jsonl`
When 后端扫描 Claude Code sessions
Then 不把 subagent sidecar 当成主会话展示。

### 场景 3：查看脱敏详情

Given 会话中包含绝对路径、tool input、token 或系统上下文
When 用户打开会话详情
Then 详情只展示脱敏摘要，不泄露绝对路径、调用 ID、长系统提示或密钥形态文本。

### 场景 4：复制恢复命令

Given 会话有 `sessionId`
When 用户查看会话摘要或详情
Then 能看到可复制的 `claude --resume <sessionId>` 语义；第一刀仅展示/摘要，不启动终端。

## 技术边界

- 数据源：
  - `CLAUDE_CONFIG_DIR/projects`，缺省为 `~/.claude/projects`
  - 文件模式：递归扫描 `*.jsonl`
  - 跳过路径中包含 `/subagents/` 或文件名以 `agent-` 开头的 sidecar
- 输出模型：
  - 复用 `SessionManagementSnapshot` / `SessionManagementSessionDetail`
  - provider 固定为 `claude`
  - status 第一刀统一 `active`
  - `fileLabel` 使用项目目录 + 文件名，`summary` 增加 `claude --resume <sessionId>`
- 前端：
  - `SessionManagementFeature` 增加 `workspace='claude'`
  - API 层按 workspace 分流到 `GetClaudeCodeSessionManagementSnapshot` / `RefreshClaudeCodeSessionManagementSnapshot` / `GetClaudeCodeSessionDetail`
  - Claude workspace 侧新增“会话管理”入口
- 不做：
  - 不写 Claude 原生 session
  - 不删除、归档、压缩或重命名 session
  - 不做 Codex provider merge
  - 不展示完整 prompt/tool input 原文

## 验证

- `go test ./internal/wailsapp -run 'ClaudeCodeSession|CodexSessionManagement'`
- `go test .`
- `go test ./...`
- `npm --prefix frontend run typecheck`
- `node --test frontend/src/features/session-management/model.test.mjs`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- `./scripts/wails-cli.sh build -skipbindings`
- 无头浏览器打开 `http://127.0.0.1:5173/#frame=claude&workspace=session-management`，确认页面可渲染 Claude 会话入口。

## 完成记录

- 已完成后端只读扫描：新增 `GetClaudeCodeSessionManagementSnapshot`、`RefreshClaudeCodeSessionManagementSnapshot`、`GetClaudeCodeSessionDetail`，扫描 `~/.claude/projects/**/*.jsonl`，跳过 `subagents/` 与 `agent-*`。
- 已完成前端接入：Claude workspace 新增“会话管理”，复用 `SessionManagementFeature`；API / hooks 按 `codex` 与 `claude` 分流；localStorage snapshot cache 已按 workspace 隔离。
- 已明确禁用 Claude provider merge：Claude 会话管理不展示 provider mapping 编辑入口，不写入 Claude 原生 session。
- 已补开发态验证桥：Vite dev bridge 支持 `workspace=claude` 只读扫描，便于无头浏览器验证真实 Claude 会话数据。
- 已归档截图：`docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/20260521/claude-session-management/20260521-claude-session-management-web-after-v01.png`。
- 本机验证结果：Claude dev bridge 扫到 8 个项目、38 条主会话；无头浏览器页面显示 `CLAUDE` provider、项目/会话列表和 `claude --resume <sessionId>` 摘要语义，无 console error。
