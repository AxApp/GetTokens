# CLIProxyAPI AMP And Model Registry

## 背景
CLIProxyAPI 上游 `v7.1.29..v7.1.36` 中有两类低耦合增强：AMP response tool casing 按请求恢复，以及模型注册表新增 `claude-opus-4-8` / grok image-video preview。它们不应影响 GetTokens sidecar 热路径，但可以提高兼容性。

## 目标
移植 AMP tool casing 恢复与低风险模型注册增强，保持现有 model listing 和 video handler 行为兼容。

## 范围
- `docs-linhay/references/CLIProxyAPI/internal/api/modules/amp/*`
- `docs-linhay/references/CLIProxyAPI/internal/registry/models/models.json`
- `docs-linhay/references/CLIProxyAPI/internal/registry/model_definitions.go`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_videos_handlers.go`
- 对应 AMP / registry / video handler 测试

## 非目标
- 不新增 HomeAppLogForwarder。
- 不改 GetTokens 前端模型展示策略，除非后端测试需要同步模型类型。
- 不调整账号池、route guard、quota 或 usage attribution。

## 验收标准
- 先补失败测试：请求声明 `Glob` 时，AMP streaming / non-streaming tool_use 响应中的 `glob` 恢复为 `Glob`。
- 冲突大小写工具名不强制改写。
- `claude-opus-4-8` 出现在 registry 模型定义。
- `grok-imagine-video-1.5-preview` 被 XAI video handler 接受，非 XAI prefix 仍拒绝。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260601-cliproxyapi-amp-model-registry`
- worktree：`../GetTokens-worktrees/20260601-cliproxyapi-amp-model-registry/`

## 相关链接
- 实现文件：
  - `docs-linhay/references/CLIProxyAPI/internal/api/modules/amp/fallback_handlers.go`
  - `docs-linhay/references/CLIProxyAPI/internal/api/modules/amp/response_rewriter.go`
  - `docs-linhay/references/CLIProxyAPI/internal/registry/models/models.json`
  - `docs-linhay/references/CLIProxyAPI/internal/registry/model_definitions.go`
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_videos_handlers.go`
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/codex_client_models.go`

## 验证记录
- `go test -count=1 ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/translator/gemini/openai/responses ./internal/api/handlers/management ./internal/api/modules/amp ./internal/registry`
- `go test ./...`

## 当前状态
- 状态：done
- 最近更新：2026-06-01
