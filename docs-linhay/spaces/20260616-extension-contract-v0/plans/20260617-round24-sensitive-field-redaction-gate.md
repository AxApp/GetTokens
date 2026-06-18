# Round 24 Sensitive Field Redaction Gate

日期：2026-06-17

## 目标

强化 Extension Contract read-only TOML planner 的敏感字段防回归门禁。planner 仍只消费调用方传入的 `configText` 测试/preview 文本，不读取或写入真实 `~/.codex/config.toml`，不执行 capability，不接 marketplace 或网络。

## 证据门禁

| 项 | 内容 |
|---|---|
| 问题来源 | Twenty-Fourth Dispatch 指定 `Extension TOML planner sensitive-field regression gate`，要求强化 `bearer_token/token/header/cookie` 等敏感字段 redaction 测试和前端展示门禁。 |
| 代码事实位置 | `internal/gettokensextensions/config_preview.go` 已有 Round23 read-only TOML planner；`frontend/src/features/gettokens-extension-registry/model.ts` 负责把 Wails dry-run DTO 映射成页面展示 view。 |
| 当前现象 | Round23 只测试 `bearer_token` literal；`token`、`api_token`、`headers`、`Authorization`、`cookie` 等敏感键如果出现在 preview `configText` 或未来 Wails DTO 中，缺少明确防回归测试。 |
| 预期验收 | Go planner 输出的 `beforeSnippet`、`afterSnippet`、section diff 不包含敏感 literal；前端 view model 渲染前二次 redacts snippet/diff/validation message；`bearer_token_env_var` 作为 env-var 引用保留可见。 |

## 实现边界

- 只在 read-only planner 和前端展示 view 层增加 redaction gate。
- 不新增真实 TOML writer，不保存、不 patch、不读取真实 Codex config。
- MCP 继续只以 `[mcp_servers.<id>]` 父 table 为 server；nested `tools` / `oauth` 仍属于父 server。
- `bearer_token` literal 以及 `token`、`api_token`、`header(s)`、`Authorization`、`cookie`、`secret` 类键的 RHS 必须变成 `"<redacted>"`。
- `bearer_token_env_var` 不视为 secret literal，保留 env var 名称以便确认未来保存边界。

## 验收

已新增/更新门禁：

- `TestPreviewCodexConfigDryRunRedactsSensitiveTomlFields`
  - 使用测试内联 `configText`，覆盖 `token`、`api_token`、`headers`、`cookie`、`Authorization`。
  - 断言 patch plan 与 section diff 不包含测试 secret literal。
  - 断言 validation 包含 `sensitive-fields-redacted`。
- `deriveGetTokensExtensionCodexConfigDryRunView redacts sensitive preview fields before display`
  - 构造带敏感 literal 的 preview DTO。
  - 断言前端 view 中 `diffPreview`、`preview`、`beforeSnippet`、`afterSnippet`、validation message 已 redacted。

## 已运行命令

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions -run 'TestPreviewCodexConfigDryRun(RedactsSensitiveTomlFields|PlansFromReadOnlyTomlInput|ReportsEnabledExtensionsWithoutWritingConfig)'
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun'
npm --prefix frontend run test:unit -- src/features/gettokens-extension-registry/model.test.mjs
```

## 剩余风险

- 当前 redaction 是 preview/snippet 行级防护，不是完整 TOML AST writer；真实保存链路仍需独立实现局部 patch、注释/排序/未知字段保留和 raw/structured editor 重读同步。
- 非赋值行中的任意自然语言 secret 只做保守 phrase redaction；后续如 dry-run DTO 增加结构化 secret-bearing 字段，需要为该字段补专门 mapper 测试。
