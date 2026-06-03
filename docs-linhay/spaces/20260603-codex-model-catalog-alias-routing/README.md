# Codex Model Catalog Alias Routing 修复

## 背景

近期完成 `sync_model_catalog` 需求后，GetTokens 会把 relay 可用模型同步到本地 Codex `model_catalog_json`，让 `/model` 可以展示 GetTokens relay 模型。

当前用户在 `/model` 中看到如下条目：

```text
Select Model and Effort
Access legacy models by running codex -m <model_name> or in your config.toml

› 1. deepseek-v4-flash  GetTokens relay model
  2. deepseek-v4-pro    GetTokens relay model
  3. GPT-5.5            GetTokens relay alias for gpt-5.5
  4. gpt-5.4            GetTokens relay model
  5. GPT-5.4-Mini       GetTokens relay alias for gpt-5.4-mini
  6. gpt-5.3-codex      GetTokens relay model
  7. gpt-5.2            GetTokens relay model
  8. mimo-v2-pro        GetTokens relay model
```

选择 `GPT-5.5` 后，Codex 本地状态显示已切换：

```text
• Model changed to GPT-5.5 high
```

但实际请求失败：

```text
⚠ Falling back from WebSockets to HTTPS transport. unexpected status 502 Bad Gateway: unknown provider for model GPT-5.5
```

初步判断：`/model` catalog 把 display alias（例如 `GPT-5.5` / `GPT-5.4-Mini`）投影成了 Codex 请求 slug；sidecar 路由只识别真实 client-facing route model（例如 `gpt-5.5` / `gpt-5.4-mini`），因此出现 “unknown provider for model GPT-5.5”。

## 目标

1. `/model` 仍可显示友好的 display name（例如 `GPT-5.5`）。
2. Codex 选择该条目后实际写入/发送的模型 slug 必须是 sidecar 可路由的模型 ID（例如 `gpt-5.5`）。
3. 对真正的 provider route alias（例如用户配置的 `deepseek` -> `deepseek-chat`、`codex-kimi` -> `moonshotai/kimi-k2`）保持现有能力：alias 仍可作为 Codex 请求 slug。
4. 修复需要覆盖测试，避免 display alias 再次污染 route slug。

## 范围

- 检查并修复 GetTokens 生成 Codex model catalog 的 slug/display_name 判定逻辑。
- 覆盖 `GPT-5.5`、`GPT-5.4-Mini` 这类大小写展示别名。
- 复核 sync_model_catalog 开关与 local Codex catalog 写入路径，不扩大到 UI 视觉重构。

## 非目标

- 不改 Codex CLI 上游 `/model` 交互本身。
- 不新增移动端适配。
- 不重做账号池、route guard、quota 调度策略。
- 不把 sidecar 不可路由的模型强行暴露到 `/model`。

## BDD 场景

### 场景 1：display alias 不得成为请求 slug

- Given sidecar/model definitions 返回模型 `name=gpt-5.5`，展示名 `alias=GPT-5.5`
- When GetTokens 生成本地 Codex model catalog
- Then catalog entry 的 `slug` 必须是 `gpt-5.5`
- And `display_name` 可以是 `GPT-5.5`
- And catalog 中不得出现 `slug=GPT-5.5`

### 场景 2：真正 route alias 继续可用

- Given provider 模型配置 `name=deepseek-chat, alias=deepseek`
- When GetTokens 生成本地 Codex model catalog
- Then catalog entry 的 `slug` 仍为 `deepseek`
- And 请求 `deepseek` 可继续走 alias route

### 场景 3：用户从 `/model` 选择 GPT-5.5 后请求可路由

- Given Codex `config.toml` 指向 GetTokens relay provider，且启用 GetTokens model catalog projection
- When 用户在 `/model` 选择显示名 `GPT-5.5`
- Then Codex 实际请求 model 为 `gpt-5.5`
- And sidecar 不再返回 `unknown provider for model GPT-5.5`

## 验收标准

1. 新增/更新 Go 测试证明 `GPT-5.5`、`GPT-5.4-Mini` 这类大小写 display alias 使用小写模型 ID 作为 catalog slug。
2. 现有 route alias 测试保持通过，`deepseek` 等别名不退化。
3. 至少运行相关 Go 测试：
   - `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog'`
4. 如改动 sidecar 路由边界，额外运行 CLIProxyAPI 相关测试；若只修 Wails catalog 投影，说明未跑真实 Codex CLI 冒烟的原因和风险。
5. 更新本 space 与 memory。

## 设计稿入口

- 本期设计稿：`（不涉及 UI 设计稿）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260603-codex-model-catalog-alias-routing`
- worktree：`../GetTokens-worktrees/20260603-codex-model-catalog-alias-routing/`
- 当前执行：本次为小范围修复，先在当前工作区基于既有 sync_model_catalog 改动补测试和最小修复；若后续扩大为多日/并行任务，再迁移到上述 worktree。

## 相关链接

- 相关代码：`internal/wailsapp/codex_model_catalog_projection.go`
- 相关测试：`internal/wailsapp/codex_model_catalog_projection_test.go`
- 相关需求：`sync_model_catalog`（近期完成）

## 实施记录

### 2026-06-03

- 已补 BDD/TDD：先新增 `GPT-5.5`、`GPT-5.4-Mini` 大小写 display alias 不得成为 catalog slug 的失败断言，复现 `slug=GPT-5.5` 导致 sidecar `unknown provider for model GPT-5.5` 的问题。
- 已修复 `resolveCodexModelCatalogSlug`：当 alias 与 name 仅大小写不同（`strings.EqualFold`）时，将其判定为 display alias，catalog `slug` 使用真实 model id；真正不同名的 route alias（如 `deepseek`）仍保留为请求 slug。
- 已运行验证：
  - `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog'`
  - `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2WritesGetTokensModelCatalogPointer|TestModelCatalogProjectionPublicMethodsPersistSyncPreference|TestApplyRelayServiceConfigToLocalV2OffPersistsAndRemovesOwnedCatalogPointer|TestApplyRelayServiceConfigToLocalV2WithoutProjectionModePreservesCatalogPreference|TestShutdownRemovesOwnedModelCatalogPointerWithoutChangingSyncPreference|TestShutdownPreservesExternalModelCatalogPointer'`
  - `docs-linhay/scripts/check-docs.sh`
- 待补充：真实 Codex CLI + sidecar 冒烟（需要本地 relay 运行态与真实可用账号；本次先完成单元回归和文档闭环）。

## 当前状态

- 状态：fixed-awaiting-real-smoke
- 最近更新：2026-06-03
