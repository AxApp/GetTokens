# Claude Code Session / Usage 技术调研

日期：2026-05-21
状态：P2 仅建议只读摘要，写入不可行

## 结论

Claude Code session / usage 不应在下一期直接做写入能力。已验证的可行边界是只读扫描、摘要和 relay usage 归因；原生 session 文件格式和隐私字段要作为只读数据源处理。

## 已验证依据

- 本地参考 `docs-linhay/references/cc-switch/src-tauri/src/session_manager/providers/claude.rs` 已实现 Claude session 只读 provider：扫描 Claude config `projects` 目录，解析 jsonl、跳过 sidecar subagents、推断 session id、生成 `claude --resume <session_id>`。
- 本地 GetTokens 已有 `frontend/src/features/session-management/` 与 `internal/wailsapp/session_management.go`，可复用 session 列表 UI 和脱敏原则。
- 账号路由探测已能通过 relay usage 前后差值识别命中账号，Claude Code usage 的 P0/P1 价值应优先落在 relay 归因，而不是原生 session 改写。

## 数据边界

- 读取：
  - `~/.claude/projects/**` 下 session jsonl，具体路径需以当前 Claude Code 版本实测确认。
  - GetTokens relay usage。
- 写入：
  - 不写 Claude 原生 session。
  - 不删除/压缩/重命名 session 文件。
- 脱敏：
  - prompt、tool input、路径、token、API key、邮箱等敏感字段必须按现有 session sanitizer 规则处理。

## 后端设计

- P2 新增 `GetClaudeCodeSessionsSnapshot`，只返回摘要字段：
  - session id、project path、title、mtime、message count、tool count、resume command。
- 先不返回完整 message body，点击详情再懒加载并脱敏。

## TDD 红灯

- 解析 jsonl 中 user / assistant / tool_use。
- 跳过或标记 subagent sidecar 文件。
- resume command 基于 session id 生成。
- 脱敏系统 prompt、绝对路径、token。

## 验收方式

- Go 单测基于 fixture jsonl。
- 不做 browser preview 以外的写入验收。
- Wails 桌面只读验证真实路径存在时不会修改文件。

## 风险

- Claude Code session 格式可能变化；只读 parser 应容错并保留 parse error。
- usage 金额/额度如果从第三方工具推断，必须标注来源，不与 relay usage 混算。

