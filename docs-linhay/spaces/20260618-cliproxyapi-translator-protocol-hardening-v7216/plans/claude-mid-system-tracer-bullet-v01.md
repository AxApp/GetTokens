# Claude request 中途 system 消息归并 Tracer Bullet

## 背景

v7.2.16 upstream 强化了 Claude request -> OpenAI Chat Completions 的 system 消息处理：Claude 侧可能在 `messages` 中穿插 `role=system`，但 OpenAI Chat Completions 目标侧应只保留首部 system message。转换器需要把顶层 `system` 和中途 system 内容按顺序归并进首个 system message，并跳过原来的中途 system message。

## 范围

- fork 代码：`docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request.go`
- fork 测试：`docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request_test.go`
- upstream 参考：v7.2.16 `TestConvertClaudeRequestToOpenAI_MidConversationSystemMessagesMoveToInitialSystem`

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 mid-conversation system 归并测试 |
| 当前代码事实 | fork 只从 `root.system` 构造首个 system message，没有预扫 `messages[].role=system` |
| 预期红灯 | mixed user/system/assistant/system/user 输入转换后，messages 应为 system/user/assistant/user；system content 应包含顶层和两个中途 system 文本 |
| 红灯命令 | `go test ./internal/translator/openai/claude -run TestConvertClaudeRequestToOpenAI_MidConversationSystemMessagesMoveToInitialSystem -count=1` |
| 绿灯验收 | focused test、affected package test、full `go test ./... -count=1`、fork `git diff --check`、fork commit、clean sidecar rebuild |

## 实现记录

- 红灯结果：`Expected 4 messages, got 6`，当前 fork 将中途 `role=system` 作为普通 messages 保留。
- 实现：在 `ConvertClaudeRequestToOpenAI` 中抽取 `appendSystemContent`，先处理顶层 `system`，再预扫 `messages[].role=system` 并按顺序归并内容；正式遍历 messages 时跳过 `role=system`。
- fork commit：`578afbfe fix(translator): consolidate claude system messages`。
- sidecar rebuild fingerprint：`578afbfea1b2a91f6442a290322c98aa684325c2:clean:38aee3501a9adf785d7fa4757110aa493c984103c6a2ed3dec664e5f3d17d8e6:darwin:arm64`。
- dev App：本切片只改纯 request translator，不改 Wails binding、native runtime、sidecar process lifecycle 或 management API；按 AGENTS 第 26 条，本轮不启动真实 dev App。

## 验收命令

- `go test ./internal/translator/openai/claude -run TestConvertClaudeRequestToOpenAI_MidConversationSystemMessagesMoveToInitialSystem -count=1`
- `go test ./internal/translator/openai/claude -count=1`
- `git diff --check`
- `go test ./... -count=1`
- `./scripts/ensure-sidecar.sh darwin arm64`

## BDD 场景

1. 给定顶层 `system` 和对话中两个 `role=system` 消息，当转换为 OpenAI Chat Completions 时，输出第一个 message 必须为 `role=system`。
2. 输出的 system content 必须按顺序包含顶层规则、字符串中途规则、数组中途规则。
3. 普通 messages 序列中不得继续保留中途 `role=system`；非 system 对话顺序保持为 user -> assistant -> user。

## 非目标

- 不重写 thinking/signature 兼容逻辑。
- 不改变 tool_use/tool_result 邻接规则。
- 不改账号选择、route guard、rate-limit、live sessions、usage attribution、system proxy 或 management API。
- 不触碰正式版 `/Applications/GetTokens.app`。
