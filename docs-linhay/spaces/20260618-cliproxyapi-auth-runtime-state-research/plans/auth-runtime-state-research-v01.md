# Auth / runtime state research v01

## 上游候选

| upstream commit | 主题 | 判断 |
| --- | --- | --- |
| `8e52c403` | refresh token singleflight，覆盖 Codex/Kimi/XAI/Antigravity refresh | defer：GetTokens 已有账号 SQLite、manual disabled、route guard 与 Home refresh 边界；并发刷新需要按账号 store 与 Wails 状态设计。 |
| `f85768ee` | config API key exclusion management | defer：直接影响 API key persist policy 与管理 API；GetTokens 已有 openai-compatible / Codex API key 映射、模型排除、quota/billing 字段。 |
| `b5da0887` | home models credential forwarding | defer：fork 已有 `internal/runtime/executor/helps/home_refresh.go`，GetTokens 需要先定义 home credential 与本地账号池的所有权。 |
| `2a050dc9` | kv cache fault tolerance，涉及 codex reasoning replay / signature / home kv / executor helpers | independent-design：缓存容错可以参考，但必须确认不会绕过 GetTokens route guard、usage attribution 或 retry 语义。 |
| `7f026e1a` / `a4756ab7` | runtime config clone 与 management reload snapshot | defer：管理 reload 会影响 sidecar 运行态一致性，需先和 GetTokens dev App ready/apply-config 流程对齐。 |
| `b9d024af` | Codex usage-limit retry | defer：usage-limit retry 会影响 route guard、rate-limit、quota-empty 与 live sessions 归因，不能直接照搬 executor retry。 |
| `8fad0d03` | global Claude cloak mode 与 credential fallback | defer：属于跨 provider 策略和凭证 fallback 默认值，需要用户配置语义与验收场景。 |

## 当前 GetTokens 事实位置

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard.go` 已定义 `manual-disabled`、`rate-limit`、`quota-empty`、`auth-error`、`upstream-rate-limit` 等 route guard source。
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/rate_limit.go`、`quota_guard_test.go`、`usage_attribution.go`、`project_candidate_pool_policy.go`、`live_sessions.go` 已形成 GetTokens-owned runtime ownership。
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/home_refresh.go` 已接管 Home refresh 错误到 HTTP 状态的映射。
- 父仓 `app.go` / `app_types.go` / `internal/wailsapp/**` 暴露 channel routing、quota、rate-limit、route resilience、账号详情与 account-store diagnostics 给 Wails UI。

## 结论

本轮不实现 auth/runtime state 候选。它们不是“缺一个 helper”级别的兼容补丁，而是会改变 GetTokens sidecar 热路径状态所有权。后续如果用户要求推进，必须按单独需求重新进入：

1. 先建独立 space，明确具体用户问题或产品目标。
2. 写出 GetTokens-owned 状态机：账号 SQLite、route guard、quota/rate-limit、usage attribution、live sessions、Home refresh、management reload 的边界。
3. 先补 failing tests：至少覆盖 fake upstream、management API、route guard 结果、usage attribution 或 Wails DTO 中对应一条端到端链。
4. 若涉及 native/Wails binding，再按 GetTokens Wails dev loop 验收。

## 受限环境说明

本轮尝试从 upstream partial clone 读取部分完整 diff 时触发 promisor fetch；当前网络受限，`git show --stat` / `git diff --name-only` 对部分对象失败。已使用本地可用 commit metadata、前序 intake 记录、当前 fork/GetTokens 热路径文件定位完成 research 分类；由于本轮结论是不实现，不需要 fork 代码验证或 sidecar rebuild。
