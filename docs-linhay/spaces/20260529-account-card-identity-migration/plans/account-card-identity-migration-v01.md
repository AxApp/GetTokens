# 账号卡身份模型迁移执行计划 v01

## 核心决策

1. 本地产品实体只有账号卡，没有用户实体。
2. `account_key` / `account_id` 是账号卡的唯一业务身份。
3. `auth-id` / `auth-index` / `source_hash` / `provider` / OAuth subject / email / API key hash 只作为 runtime evidence。
4. rate-limit 是账号卡资产级策略，只能以 `account_key` 为匹配键。
5. 本次不兼容旧版本：迁移后移除 rate-limit `match_key` schema、DTO、API 和前端字段。

## 数据模型

### Sidecar Config

`config.CodexKey` 增加：

```go
LocalID string `yaml:"local-id,omitempty" json:"local-id,omitempty"`
```

规则：

- 账号登录 / 新增 key：创建新账号卡，生成新 `local-id`。
- 重新登录 / 编辑当前卡凭证：保留原 `local-id`。
- standalone sidecar 发现缺失 `local-id` 的 codex key：启动或保存时生成并持久化。

### Runtime Auth

`sdk/cliproxy/auth.Auth` 增加：

```go
AccountKey string `json:"account_key,omitempty"`
```

runtime candidate 生成规则：

- Codex API key：`config.CodexKey.LocalID`
- auth-file：`auth-file:<file-name>`
- OpenAI-compatible：`openai-compatible:<provider-name>`

### SQLite

`usage_attribution_events` 保留：

- `account_key`：业务归属，必须优先写入。
- `attribution_key`：运行态证据，仅用于诊断和迁移回填。

`rate_limit_rules` 删除：

- `match_key`
- `idx_rate_limit_rules_match`

`rate_limit_events` 删除：

- `match_key`

## 执行阶段

### 阶段 1：红灯测试（已完成）

Sidecar tests:

1. `CodexKey` 缺失 `local-id` 时，synthesizer/runtime auth 必须失败当前新测试。
2. `Auth` 缺失 `AccountKey` 时，runtime identity 测试失败。
3. rate-limit schema 仍含 `match_key` 的结构测试失败。
4. evaluator 仍使用 `attribution_key` fallback 的源码结构测试失败。

GetTokens tests:

1. 前端 rate-limit 源码不允许出现 `matchKey` 的测试先失败。
2. Wails / cliproxyapi DTO 不允许出现 `MatchKey` 的测试先失败。

### 阶段 2：sidecar identity foundation（已完成）

修改：

- `internal/config/config.go`
- `internal/api/handlers/management/config_lists.go`
- `internal/watcher/synthesizer/config.go`
- `sdk/cliproxy/auth/types.go`
- 必要时补充 auth-file / OpenAI-compatible synthesizer 的 `AccountKey`

验收：

- `go test ./internal/config ./internal/api/handlers/management ./internal/watcher/synthesizer ./sdk/cliproxy/auth`

### 阶段 3：usage attribution account_key 写入（已完成）

修改：

- `internal/gettokenshooks/usage_attribution.go`
- `internal/gettokenshooks/usage_attribution_test.go`

验收：

- GetTokens 管理账号的新 usage event 必须有 `account_key`。
- unresolved event 保留 `attribution_key`，但不参与账号卡策略。

### 阶段 4：rate-limit 破坏性清理（已完成）

修改：

- `internal/gettokenshooks/rate_limit.go`
- `internal/gettokenshooks/rate_limit_test.go`

验收：

- `PRAGMA table_info(rate_limit_rules)` 不含 `match_key`。
- `PRAGMA table_info(rate_limit_events)` 不含 `match_key`。
- usage 查询只按 `account_key = ?`。
- 两个相同凭证不同账号卡的用量和规则互不影响。

### 阶段 5：GetTokens bridge/frontend 清理（已完成）

修改：

- `internal/cliproxyapi/types.go`
- `internal/cliproxyapi/client_test.go`
- `internal/wailsapp/rate_limit_test.go`
- `app_types.go`
- `app_mappers.go`
- `frontend/src/features/accounts/model/rateLimit.ts`
- `frontend/src/features/accounts/components/RateLimitRulesSection.tsx`
- `frontend/src/features/accounts/tests/rateLimit.test.mjs`

验收：

- 前端和 Wails rate-limit 类型不再出现 `matchKey` / `MatchKey`。
- UI 保持单行摘要 + 编辑配置态，不再横向滚动。
- 账号详情弹窗不直接 import Wails rate-limit CRUD；由 Accounts/Codex page shell 根据 desktop/preview 注入 `RateLimitRulesAPI`。

### 阶段 6：文档、memory、索引（已完成）

修改：

- 本 space README / plan
- `docs-linhay/dev/account-card-identity-model.md`
- `docs-linhay/memory/2026-05-29.md`

命令：

```bash
docs-linhay/scripts/check-docs.sh
qmd update
qmd embed
```

## 验证命令

Sidecar:

```bash
go test ./internal/gettokenshooks
go test ./internal/config ./internal/api/handlers/management ./internal/watcher/synthesizer ./sdk/cliproxy/auth
```

GetTokens:

```bash
go test ./internal/cliproxyapi ./internal/wailsapp
cd frontend && node --test src/features/accounts/tests/rateLimit.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
qmd update && qmd embed
```

## 风险

1. WebSocket pinned auth 可能存在独立路径，必须确认同样携带 `AccountKey`。
2. 破坏性迁移会丢弃无法归属账号卡的旧 rate-limit 规则；这是本次明确接受的行为。

## 执行记录

- 2026-05-29：sidecar runtime auth 已覆盖 Codex API key、auth-file、OpenAI-compatible provider 的 `AccountKey`。
- 2026-05-29：sidecar standalone Codex API key 缺失 `local-id` 时会生成 `codex-api-key:legacy-*` 并写回配置。
- 2026-05-29：sidecar rate-limit schema/API/evaluator 删除 `match_key`，只按 `account_key` 查询 usage。
- 2026-05-29：GetTokens Wails / frontend rate-limit DTO 删除 `matchKey`，规则区改为单行摘要 + 配置态。
- 2026-05-29：修复 browser preview 根因，`UnifiedAccountDetailModal` / `CodexAccountDetailModal` 不再直连真实 Wails rate-limit CRUD。
- 2026-05-29：已运行 Sidecar 聚焦 Go 测试、GetTokens Go 测试、frontend `typecheck`、`build` 和 `test:unit`。
- 2026-05-29：已用 `playwright-cli` 验收账号详情限流区 summary / config 态，并归档截图。
