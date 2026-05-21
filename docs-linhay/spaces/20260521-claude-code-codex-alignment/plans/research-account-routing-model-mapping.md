# Claude Code 账号路由与模型映射技术调研

日期：2026-05-21
状态：已验证可继续迭代

## 结论

Claude Code 账号路由当前可继续沿用 GetTokens relay 的 Anthropic Messages 请求链路，不把 Claude Code 本地 `settings.json` 当多账号池。后续只需要把 UI 字段命名从 Codex-only 的模型 alias 逐步收敛成通用 `requestModel` / `aliasModel` 语义。

## 已验证依据

- 官方配置面：Claude Code settings 明确以 `~/.claude/settings.json`、项目 `.claude/settings.json`、`.claude/settings.local.json` 管理配置；它不是多账号队列存储。
- 本地实现：`internal/wailsapp/claude_code_routing_probe.go` 已通过 `/v1/messages` 发送 Anthropic Messages 测试请求，并用 route headers 限定候选账号。
- 本地测试：`internal/wailsapp/claude_code_routing_probe_test.go` 已覆盖 Anthropic 请求体、route headers、过滤非 Anthropic 账号、model 必填。
- 外部参考：`musistudio/claude-code-router` 用 `Providers`、`Router`、transformer 和 env activation 解决 Claude Code 请求路由，说明路由层应在代理/relay 层完成，而不是塞进 Claude Code 原生配置。

## 数据边界

- 读取：GetTokens `AccountRecord`、relay usage、账号 `supportedFormats`。
- 写入：不写 Claude Code 多账号文件；只在用户明确“应用到本机 Claude Code”时 patch `~/.claude/settings.json` 的受控 `env` 字段。
- 候选过滤：P0 仍只纳入 `supportedFormats` 包含 `anthropic` 的账号。
- 不能做：不把 OpenAI-compatible 账号直接伪装成 Claude Code 原生账号；如需转换，必须走 sidecar translator 并单独验证协议兼容。

## 后续实现边界

- 保留当前 `ProbeClaudeCodeAccountRouting`，补充 UI 上的“Anthropic 格式候选”解释。
- 模型映射字段前端展示可统一为“请求模型 / 别名模型”，后端保持兼容旧 DTO。
- Claude Code Router 只作为外部参考，不引入它的配置格式作为 GetTokens 存储格式。

## TDD 红灯

- `internal/wailsapp/claude_code_routing_probe_test.go`：
  - 非 Anthropic 格式账号不会进入候选。
  - route order / allow / deny headers 与 Codex probe 语义一致。
  - model 为空时不发请求。
- 前端测试：
  - 账号详情映射字段不再只显示 Codex 文案。
  - DeepSeek 等非 Anthropic 模板仅展示已验证支持的本机应用入口。

## 风险

- 若后续引入 sidecar translator，需要另起调研验证 OpenAI-compatible 到 Anthropic Messages 的 tool、stream、cache_control、thinking 字段转换。
- `ANTHROPIC_AUTH_TOKEN` 与 API key 同时存在时，Claude Code 可能优先使用 token；本地 apply 已保留并提示冲突，不能静默覆盖。

