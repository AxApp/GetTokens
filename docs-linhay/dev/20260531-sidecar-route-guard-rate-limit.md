# Sidecar Route Guard / Rate Limit 技术方案

日期：2026-05-31

## 结论

GetTokens sidecar 可以破坏性调整后，route guard 和时间/用量限流应进一步收敛为 sidecar 自治能力：前端和 Wails 只负责配置、展示和桥接；真实阻断、选路、retry、WebSocket request-boundary 热切和 explain 都由 sidecar 负责。

推荐方向是新增或重构 sidecar-owned `GuardController` 与 `RateLimitController`：

1. `GuardController` 统一管理 `manual-disabled`、`rate-limit`、`auth-error`、`upstream-rate-limit`、`upstream-error` 等 source。
2. `RateLimitController` 负责规则、时间窗口计算、request-window admission reservation、token-window completion evaluation 和周期 reconcile。
3. `AccountRoutingEngine` 在 hard-filter 阶段读取统一 guard snapshot，而不是从多个包、多个状态源临时拼装阻断结果。

## 当前问题

现有手动禁用路径已经实时：`PATCH /accounts/{account_key}/status` 写 `account_cards.disabled` 后，status hook 会更新 runtime auth、写 `manual-disabled` guard，并关闭受影响 Codex WebSocket upstream session。

现有限流路径仍有两个缺口：

1. 规则 CRUD 会即时 `EvaluateNow()`，但普通 usage 增量主要依赖默认 30 秒 evaluator 周期刷新。
2. request-window 按完成后的 usage 事件计数，高并发情况下可能有多个请求同时越过窗口阈值。

## 目标设计

```text
Usage Attribution / Management API / Runtime Result
        |
        v
GuardController
  source registry
  account_key lookup
  TTL / next reset
  stale / degraded state
        |
        +--> RateLimitController
        |      rules
        |      request reservations
        |      usage-triggered evaluation
        |      periodic reconcile
        |
        v
AccountRoutingEngine hard-filter
        |
        v
Selector / Retry / WebSocket request-boundary
```

## 关键语义

### 账号绑定

所有新写入路径只接受统一账号卡 `account_key`，即 `acct_*`。旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 只可作为历史读取或迁移输入，不再作为新规则和 guard 状态的写入键。

### request-window

request-window 改为 admission 语义：

1. 选中候选账号后、执行请求前尝试 reservation。
2. reservation 成功后才允许该账号执行请求。
3. reservation 失败只 deny 当前账号，selector / retry 继续尝试其他账号。
4. 请求完成后 commit；请求失败、取消或超时后 release / expire。

这样可以避免高并发请求明显超过请求次数窗口。

2026-05-31 Phase 3 实现选择在 `AuthManager` 执行循环内接入通用 admission registry，而不是把 reservation 放进 hard-filter route policy。原因是 hard-filter 会看到候选列表，若在该阶段预占容易误占多个账号；实际 admission 必须绑定最终被选中的单个 auth。若 admission deny 当前账号，`AuthManager` 将该账号加入本次 `tried` 后重新选择，保留 fallback / retry 能力。

request-window usage 由两部分组成：已完成的 `usage_attribution_events` 数量，以及 `rate_limit_reservations` 中尚未被 usage 释放的 `pending / committed` reservation。请求失败或取消会 release；请求成功先 commit，后续 usage attribution 按 `request_id + account_key` 释放对应 reservation；周期/即时评估会把超过 TTL 的 orphan reservation 标记为 `expired`。

### token-window

token-window 保持 completion 语义：

1. 请求完成后 usage attribution 写入真实 `total_tokens`。
2. 写入成功后立即评估对应 `account_key`。
3. 若达到阈值，立即刷新 `rate-limit` guard source，阻断下一次选路。

第一期不做 token 预测式 admission，因为请求开始前无法可靠知道真实 token 用量。

### 周期任务

默认 evaluator 周期不再承担主实时路径，只负责：

- sidecar 重启后的状态重建。
- window slide 后恢复。
- orphan reservation cleanup。
- usage / guard 对账。
- stale / degraded 状态修复。

### WebSocket

Codex WebSocket 仍不做 mid-response 迁移。被 guard 命中的 pinned auth 在下一条 downstream request 到达时释放 pin、关闭旧 upstream、强制 transcript replay，再重新进入 route engine 选路。

## API 与可观测性

建议 status / explain DTO 统一透出：

- `account_key`
- `blocked`
- `sources`
- `rule_id`
- `strategy`
- `window`
- `usage`
- `limit`
- `window_start`
- `window_end`
- `next_reset`
- `last_evaluated_at`
- `stale`
- `degraded_reason`

management 写入路径如果已经持久化但运行态 guard 同步失败，不应静默成功。可以选择直接返回错误，或返回 `degraded/stale` 并要求 UI 明确展示。

2026-05-31 第一段实现选择“失败即回滚”：rate-limit 规则新增、修改、删除后如果即时评估失败，management API 返回 500，并回滚本次规则 DB 变更，避免 API 失败但规则已经部分写入或删除。规则新写入只接受 `acct_*` 账号卡 key；旧 key 仅作为历史读取或迁移输入。

rate-limit evaluator 的周期全量评估与 usage 后账号级评估必须串行化，避免旧评估在规则变化后延迟落状态并重新写回 stale guard。事件持久化不应发生在 evaluator 状态锁内；内存状态与 route guard 先刷新，阻断事件随后持久化。

2026-05-31 Phase 3 已新增通用 admission policy 注册点和 request-window reservation ledger。admission 成功、commit、release、usage 释放和 orphan cleanup 都会触发账号级 rate-limit 评估，使 route guard 与 request-window 预占状态保持一致。admission 失败不直接映射为 HTTP 429，而是 deny 当前 auth 并让选择器尝试其他账号；只有所有候选都不可用时才回到现有无可用账号错误。

2026-05-31 Phase 4/5 已把 WebSocket request-boundary 和 DTO explain 链路补齐：

- `AccountRouteGuardStore` 新增按 auth 查询活跃 block 详情的能力，返回 source、reason、account_key、expires_at 等信息。
- Codex WebSocket pinned auth 在 request boundary 命中 guard 时，release 结果会携带 source/reason，并写入 websocket timeline 的 `route_guard_pinned_auth_released` 事件。当前仍只在 request boundary 切换，不做 mid-response 迁移。
- rate-limit status DTO 增加 `sources`、`rule_id`、`strategy/window`、`usage/limit`、`window_start/window_end`、`next_reset`、`last_evaluated_at`、`stale`、`degraded_reason` 等解释字段。
- Wails root DTO、management client、生成的 `frontend/wailsjs` 和前端账号详情模型已同步。前端展示 sidecar 返回的 source/reason/next reset，不在本地重新推断 blocked。

## 分期

1. GuardController 收口：统一 source、snapshot、hook 错误显性化。
2. rate-limit 即时评估：规则 CRUD 和 usage insert 后立即刷新对应账号 guard。
3. request-window admission reservation：补齐并发请求次数限制。
4. WebSocket request-boundary 与 explain 合并：route trace 能解释 pinned release。
5. Wails / frontend DTO 适配和旧路径清理。

完整执行计划见 `docs-linhay/spaces/20260531-sidecar-route-guard-rate-limit/plans/implementation-plan-v01.md`。

## 验证重点

- source 独立：`rate-limit` 恢复不能清 `manual-disabled`。
- 规则 CRUD 即时生效：API 返回成功后 route guard snapshot 已同步。
- usage 完成即时阻断：token-window 达阈值后下一请求不再选该账号。
- request-window 并发预占：并发请求不会明显越过请求数阈值。
- reservation cleanup：失败/取消/超时不会永久占用额度。
- WebSocket 边界：guarded pinned auth 下一 downstream request 切号，mid-response 不迁移。
- explain 一致：UI/status/route trace 读同一 sidecar snapshot。
