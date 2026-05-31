# Sidecar Route Guard / Rate Limit 优化方案 v01

日期：2026-05-31

## 推荐方向

采用 sidecar-owned guard controller：把手动禁用、限流、上游错误冷却、auth error、WebSocket pinned auth request-boundary 判断都收敛到一个运行态快照和一组可解释 API。rate-limit 从“周期扫描 usage 后写 guard”升级为“请求开始预占 + usage 写入即时评估 + 周期兜底 reconcile”。

这个方案假设 sidecar 可以破坏性调整 management API、SQLite schema 和内部包边界。如果后续又要求兼容上游 CLIProxyAPI 旧合约，本方案会被迫增加兼容层，实时性和测试边界都会变差。

## 不做什么

- 不做 mid-response 账号迁移。
- 不让前端/Wails 自己维护 guard 真状态。
- 不把限流写成 HTTP middleware。
- 不保留旧 `matchKey` / attribution fallback / legacy route policy 双路径。
- 不把 token-window 做成不可验证的 token 预测拦截；第一期只基于完成后的真实 usage 精确阻断下一次请求。

## 目标架构

```text
Management API / Runtime Result / Usage Attribution
        |
        v
GuardController
  - source registry
  - account_key lookup
  - TTL / next reset
  - stale / degraded state
        |
        +--> RateLimitController
        |      - rules
        |      - request reservations
        |      - usage-triggered evaluation
        |      - periodic reconcile
        |
        v
AccountRoutingEngine hard-filter
        |
        v
Selector / Retry / WS request-boundary
```

## 关键决策

1. `account_key` 是唯一绑定键  
   rate-limit rules、reservations、events、guard blocks 和 explain 都使用账号卡 `account_key`。不再接受旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 作为新写入键。

2. request-window 改为 admission 语义  
   请求开始前按 `account_key + rule_id + window` 预占一次。预占成功才允许该账号执行请求；预占失败则该账号进入本次候选 deny，selector/retry 尝试下一个账号。

3. token-window 保持 completion 语义  
   token 使用量只有响应完成后可信。完成写入 usage attribution 后立即评估该账号，不再等待 30 秒周期。

4. 周期 evaluator 只做兜底  
   周期任务负责重启恢复、窗口滑动恢复、孤儿 reservation 清理、对账和 stale 状态修复，不承担主实时路径。

5. guard hook 失败必须显性化  
   账号禁用、规则保存、usage 写入后刷新 guard 如果失败，需要返回错误或标记 degraded/stale。不能再 `_ = hook()` 静默吞掉。

## 分阶段实施

### Phase 1：GuardController 收口

可独立合并。

- 新增 sidecar 内部 controller，包装现有 `AccountRouteGuardStore` 能力。
- 保留 source 独立：`manual-disabled`、`rate-limit`、`auth-error`、`upstream-rate-limit`、`upstream-error`。
- 增加 snapshot DTO：`account_key`、source、reason、rule_id、window、expires_at、updated_at、stale。
- 把 management status hook 的错误从静默忽略改为可观测返回或 degraded 状态。

验收：
- source 独立清理不互相影响。
- 手动禁用仍实时 deny 新请求。
- status hook 失败不再静默成功。

### Phase 2：rate-limit 规则即时评估

可独立合并。

- 规则 CRUD 成功后必须同步刷新 GuardController 的 `rate-limit` source。
- `GET rate-limit-status` 返回同一个 guard snapshot 派生状态，避免 API 状态和 route guard 不一致。
- usage attribution insert 成功后，按 `account_key` 调用增量评估。
- 30 秒 evaluator 改名为 reconcile loop，职责写清楚。
- 管理 API 不能在即时评估失败时留下不可见副作用；若本次规则写入/删除后评估失败，必须回滚本次 DB 变更并返回错误。
- evaluator 必须串行化规则评估，避免周期评估和账号级即时评估交错后把旧 `rate-limit` guard 写回。

验收：
- 新增/修改/删除规则后，下一次选路立即看到新 guard。
- usage 完成后，下一次选路立即排除 token-window 超限账号。
- 周期 reconcile 可恢复重启后的超限状态。
- 失败评估不会造成“API 500 但规则已经新增/删除”的分裂状态。
- 账号级即时评估只刷新目标账号，不清除其他账号的 `rate-limit` block。

当前进展（2026-05-31）：
- 已落地 usage 写入成功后按账号即时刷新、规则 CRUD 成功后即时评估、失败评估回滚、`acct_*` 新写入校验、评估串行化和事件持久化移出状态锁。
- 已覆盖聚焦单测和 sidecar 全量 `go test ./...`；已重建 darwin/arm64 sidecar。

### Phase 3：request-window admission reservation

可独立合并。

- 新增 reservation 表或内存+SQLite ledger：
  - `reservation_id`
  - `account_key`
  - `rule_id`
  - `window_start`
  - `status=pending|committed|released|expired`
  - `created_at`
  - `expires_at`
- route 选中账号前执行 admission check。
- admission 失败时只 deny 当前账号，让 selector/retry 继续尝试其他账号。
- 请求完成后 commit；请求未完成或连接中断后 release/expire。

验收：
- 并发请求不会明显超过 request-window 阈值。
- orphan reservation 会被清理。
- retry 不会因为第一个账号 admission 失败而直接失败。

当前进展（2026-05-31）：
- 已落地通用 admission registry，并在 `AuthManager` 选中账号后、执行请求前调用；admission deny 只标记当前 auth 为本次 `tried` 并继续 fallback。
- 已新增 SQLite `rate_limit_reservations` ledger，状态为 `pending / committed / released / expired`。
- request-window usage 已合并完成后的 usage events 与未释放 reservation；usage attribution 按 `request_id + account_key` 释放已 commit reservation，reconcile 负责 orphan cleanup。
- 已覆盖 admission 并发预占、orphan cleanup、Manager fallback 和别名池空 execution model 不重复选择的回归测试；sidecar 全量 `go test ./...` 通过并已重建 darwin/arm64 sidecar。

### Phase 4：WS request-boundary 与 explain 合并

可独立合并。

- Codex WS pinned auth request-boundary 读取 GuardController snapshot。
- guard 命中时释放 pin、关闭旧 upstream、强制 transcript replay。
- route explain 返回 pinned/sticky 失效原因。
- 不改变 mid-response 边界。

验收：
- pinned auth 被 rate-limit 阻断后，下一条 downstream request 切到其他账号。
- trace 明确标注 `pinned_released: rate-limit`。
- 已写出 payload 后不做无感迁移。

当前进展（2026-05-31）：
- 已为 `AccountRouteGuardStore` 增加活跃 block 详情查询，WebSocket request-boundary 能读取 source/reason/expires_at。
- 已让 `account-route-guard` hard-filter trace reason 包含活跃 source/reason，route explain 能区分 `manual-disabled`、`rate-limit` 等过滤来源。
- 已把 `responsesWebsocketReleasePinnedAuthAtRequestBoundary` 改为结构化结果，release 时携带 source/reason，并写入 websocket timeline `route_guard_pinned_auth_released` 事件。
- 已覆盖 route policy source reason、request-boundary release source/reason 与 timeline 断言；保留“不做 mid-response 迁移”的边界。

### Phase 5：API / UI 适配与清理

可独立合并。

- Wails DTO 透出 guard snapshot / rate-limit status。
- 前端账号详情展示 sidecar 返回的 blocked source、规则、窗口、usage/limit、next reset、last evaluated。
- 删除旧 legacy key 写入和旧兼容 fallback。
- 更新 dev 文档、skill、memory，并跑 qmd 索引。

验收：
- 浏览器 preview 有 mock guard state。
- Wails 真实数据与 sidecar snapshot 一致。
- 旧 `matchKey` / legacy account id 新写入路径被测试拒绝。

当前进展（2026-05-31）：
- 已扩展 sidecar rate-limit status DTO：`sources`、`rule_id`、`usage/limit`、`window_start/window_end`、`next_reset`、`last_evaluated_at`、`stale`、`degraded_reason`。
- 已同步 Wails management client、root DTO/mappers、生成绑定和前端模型。
- 前端账号详情 Route Guard summary 已展示 sidecar source/reason/next reset，不本地推断 blocked。
- 已完成 root Go、前端 typecheck/unit/build、CLIProxyAPI sidecar 全量测试、sidecar 重建和 Wails production build。

## API / Schema 变化

建议允许破坏性调整：

- rate-limit rule 写入只接受 `acct_*` account key。
- status API 返回结构增加：
  - `blocked`
  - `sources`
  - `rules`
  - `usage`
  - `limit`
  - `window_start`
  - `window_end`
  - `next_reset`
  - `last_evaluated_at`
  - `stale`
- 新增 admission reservation ledger，用于 request-window。
- route explain 增加 guard trace 节点。

## 测试矩阵

- `internal/gettokenshooks`
  - manual-disabled 与 rate-limit source 独立。
  - rule CRUD 立即刷新 guard。
  - usage insert 后 token-window 立即阻断下一请求。
  - request-window admission 并发预占。
  - orphan reservation cleanup。
  - window slide 后自动恢复。
- `sdk/cliproxy`
  - selector 遇到 admission/guard deny 后 fallback。
  - retry 带 tried 集合不重复选择已失败账号。
- `sdk/api/handlers/openai`
  - WS pinned auth 被 rate-limit guard 阻断后下一 request-boundary release。
  - no mid-response migration。
- `internal/wailsapp`
  - 规则 CRUD 只传 `acct_* account_key`。
  - guard snapshot DTO 映射。
- frontend focused tests
  - 账号详情只展示 sidecar 状态，不本地推断 blocked。
  - legacy key 写入被拒绝或不可创建。

## 回滚策略

- Phase 1/2 可通过关闭新的 controller hook 回退到现有 `AccountRouteGuardStore + periodic evaluator`。
- Phase 3 涉及 reservation ledger，回滚时需要停用 admission check，并保留 ledger 表只读不参与决策。
- 不删除旧 rate-limit events 数据；schema 迁移需要只增不破坏历史 usage attribution。

## 主要风险

1. admission reservation 会影响并发吞吐，需要准确释放失败/取消请求。
2. token-window 无法在请求开始前知道真实 tokens，第一期只能保证完成后立即阻断下一请求。
3. guard hook 错误显性化后，前端可能需要处理更多 degraded 状态。
4. 如果 route engine 仍有绕过 GuardController 的旧路径，实时性会出现裂缝；实施时必须先用 rg 和 tests 锁住所有入口。

## 建议执行顺序

先做 Phase 1 + Phase 2。它们风险低，能立刻解决“配置变更和 usage 完成后不等 30 秒”的主要问题。Phase 3 再处理并发 request-window 精准限流，因为它需要新增 reservation 生命周期，风险更高。
