# CLIProxyAPI Gemini Developer Role

## 背景
CLIProxyAPI 上游 `v7.1.31` 修复 Gemini OpenAI Responses 翻译器对 `developer` role 的处理。OpenAI Responses 已把系统类指令表达为 `developer`，转 Gemini 时应并入 `systemInstruction`。

## 目标
Gemini OpenAI Responses 请求转换时，`system` 与 `developer` role 都进入 Gemini `systemInstruction`，不落入普通 conversation contents。

## 范围
- `docs-linhay/references/CLIProxyAPI/internal/translator/gemini/openai/responses/gemini_openai-responses_request.go`
- 对应 translator 单元测试

## 非目标
- 不调整 Codex 自身 system -> developer 的转换规则。
- 不改 Gemini chat-completions 翻译器，除非现有代码路径共享同一函数。
- 不扩展前端模型或账号 UI。

## 验收标准
- 先补失败测试：OpenAI Responses input 中 `developer` role 文本转换为 Gemini `systemInstruction.parts`。
- `system` role 原有行为保持。
- 普通 user / assistant / tool output item 不受影响。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260601-cliproxyapi-gemini-developer-role`
- worktree：`../GetTokens-worktrees/20260601-cliproxyapi-gemini-developer-role/`

## 相关链接
- 实现文件：
  - `docs-linhay/references/CLIProxyAPI/internal/translator/gemini/openai/responses/gemini_openai-responses_request.go`
  - `docs-linhay/references/CLIProxyAPI/internal/translator/gemini/openai/responses/gemini_openai-responses_request_test.go`

## 验证记录
- `go test -count=1 ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/translator/gemini/openai/responses ./internal/api/handlers/management ./internal/api/modules/amp ./internal/registry`
- `go test ./...`

## 当前状态
- 状态：done
- 最近更新：2026-06-01
