# Sidecar Route Guard Rate Limit Optimization

## 背景

当前账号卡的手动禁用已经在 sidecar 内闭环：Wails 只负责把 `account_key` 发给 management API，sidecar 写 `account_cards.disabled`、同步运行态 `AuthManager`、写入 `manual-disabled` route guard，并在 Codex WebSocket 下一请求边界释放 pinned auth。

时间窗口限流和 token / request 限流也在 sidecar 内实现，但当前形态仍有两个需要优化的点：

1. rate-limit 规则 CRUD 会立即 `EvaluateNow()`，但普通 usage 增量主要依赖 evaluator 周期刷新，默认存在最多约 30 秒延迟。
2. request-window 以完成后的 usage 事件计数，无法严格阻止高并发请求在同一窗口内同时越过阈值。

本期基于新约束：GetTokens sidecar 可以破坏性修改，不再为了 CLIProxyAPI 上游旧合约保留兼容路径。优化目标是把 route guard、时间限流、request/token usage、WebSocket request-boundary 热切和 explain 观测都收敛到 sidecar 自治层。

## 目标

1. 将 rate-limit 从“周期评估为主”升级为“事件驱动评估 + 选路前快速校验 + 周期兜底”。
2. 将 `manual-disabled`、`rate-limit`、`auth-error`、`upstream-rate-limit`、`upstream-error` 等 guard source 统一到一个 sidecar-owned guard controller。
3. 对 request-window 增加预占/释放机制，避免并发请求明显超过窗口阈值。
4. 对 token-window 保持完成后精确入账，并在 usage 写入后立即刷新该账号 guard 状态。
5. Codex WebSocket pinned auth 继续只在 request boundary 切换，不承诺 mid-response 迁移。
6. management API 可以破坏性调整，优先保证 sidecar 内部一致性、可测试性和 explain 可解释。
7. 提供 route/rate-limit trace，能解释某账号被哪个 source、哪条规则、哪个窗口阻断，以及预计恢复时间。

## 范围

- sidecar / CLIProxyAPI fork：
  - 新增或重构 sidecar-owned `GuardController` / `RateLimitController`。
  - 统一维护 guard source 快照、lookup index、block TTL、source 独立清理和 explain 输出。
  - rate-limit 规则存储继续按 `account_key` 绑定账号卡，但 schema 可破坏性演进。
  - 新增 request-window admission reservation，用于请求开始前预占计数。
  - usage attribution 写入完成后立即触发对应账号的 rate-limit 增量评估。
  - 周期 evaluator 降级为 reconcile / orphan cleanup / restart recovery 兜底。
  - 将 guard hook 失败从静默忽略改为可观测错误，关键管理操作不能假装运行态已同步。
  - route engine / selector 在选账号前读取统一 guard snapshot；retry 时能继续尝试其他账号。
  - WebSocket pinned auth 在 request boundary 读取同一 guard snapshot，命中后 release pin、关闭旧 upstream、强制 transcript replay。
- Wails / frontend：
  - 只保留账号卡和详情页作为配置入口。
  - UI 不伪造 sidecar 已阻断状态；展示 sidecar 返回的 guard state / stale state / trace。
  - 本期不优先重做视觉，仅在 API DTO 变化时做必要适配。
- 文档 / 测试：
  - 以 BDD/TDD 补齐 sidecar 单测、management API 测试、WebSocket request-boundary 测试和 Wails bridge 测试。
  - 若产生可复用模式，再沉淀到项目 skill；本 space 本身不立即改 AGENTS。

## 非目标

1. 不做 streaming mid-response 无感换账号。
2. 不把限流阻断做成 Gin middleware；必须保留 selector fallback / retry 能力。
3. 不在前端或 Wails 中补偿 sidecar 未处理的 guard 状态。
4. 不引入移动端适配或移动截图验收。
5. 不为了兼容 CLIProxyAPI 上游旧 route/rate-limit 合约保留双路径。

## 验收标准

1. Given 账号 A 配置 `request-window 1h limit=1 block`，When 第一个请求被 A 接收并创建 admission reservation，Then 同窗口内第二个并发请求不能再选 A，必须 fallback 到其他可用账号或返回可解释失败。
2. Given 账号 A 的 request-window reservation 超时或请求失败未完成，When cleanup/reconcile 运行，Then orphan reservation 被释放或标记，不能永久阻断账号。
3. Given 账号 A 的 token-window 在一次请求完成后达到阈值，When usage attribution 写入成功，Then A 的 `rate-limit` guard source 立即刷新，下一次选路不再选择 A。
4. Given 用户新增、修改、删除 rate-limit 规则，When management API 返回成功，Then sidecar 已完成对应账号即时评估，route guard snapshot 与 API 返回状态一致。
5. Given 某账号同时被 `manual-disabled` 和 `rate-limit` 阻断，When rate-limit 窗口恢复，Then 只清除 `rate-limit` source，不清除 `manual-disabled`。
6. Given 用户重新启用手动禁用账号，When `manual-disabled` source 清除，Then 如果该账号仍被 rate-limit block，后续选路仍不能选择该账号。
7. Given sidecar 重启，When rate-limit store 和 usage attribution store 加载完成，Then 当前窗口内已超限账号会重新进入 `rate-limit` guard source。
8. Given Codex WebSocket 已 pinned 到账号 A，When A 被 request-window 或 token-window guard 阻断，Then 当前 response 不做 mid-response 迁移；下一条 downstream request 到达时释放 pin、关闭旧 upstream、完整 replay 并重新选账号。
9. Given management status hook 或 guard controller 同步失败，When API 写入会造成运行态不一致，Then 返回可见错误或 degraded/stale 状态，不能静默成功。
10. Given 用户查看账号详情 rate-limit 状态，When sidecar 返回状态，Then UI 能看到 blocked source、命中规则、窗口、usage/limit、next reset、last evaluated time 和 stale 标记。
11. Given route explain 被调用，When 某账号被过滤，Then trace 中明确过滤 source：`manual-disabled`、`rate-limit`、`auth-error`、`upstream-rate-limit` 或 `upstream-error`。
12. Given 多个账号可用，When 其中一个账号被 rate-limit guard 阻断，Then selector / retry 继续尝试其他账号，而不是在 HTTP handler 中直接失败。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260531-sidecar-route-guard-rate-limit`
- worktree：`../GetTokens-worktrees/20260531-sidecar-route-guard-rate-limit/`

## 相关链接

- [Account Routing Engine](../20260524-account-routing-engine/README.md)
- [Account Routing Engine 技术边界](../../dev/20260524-account-routing-engine.md)
- [Sidecar Route Policy](../../dev/20260513-sidecar-route-policy.md)
- [账号卡身份模型](../../dev/account-card-identity-model.md)
- [账号凭证 SQLite 统一存储设计](../../dev/account-credential-sqlite-store-design.md)
- [Sidecar Route Guard / Rate Limit 技术方案](../../dev/20260531-sidecar-route-guard-rate-limit.md)
- [实施方案 v01](./plans/implementation-plan-v01.md)

## 当前状态
- 状态：implemented-verified-pending-desktop-user-validation
- 最近更新：2026-05-31

## 最终验证记录

2026-05-31 已完成自动化闭环验证：

- CLIProxyAPI fork：`go test ./... -count=1`
- GetTokens root：`go test ./... -count=1`
- Frontend：`npm --prefix frontend run typecheck`
- Frontend：`npm --prefix frontend run test:unit`
- Frontend：`npm --prefix frontend run build`
- Wails：`./scripts/wails-cli.sh build`
- Sidecar：`scripts/ensure-sidecar.sh darwin arm64`
- Docs：`docs-linhay/scripts/check-docs.sh`
- Diff hygiene：root 与 CLIProxyAPI fork 均通过 `git diff --check`
- QMD：`qmd update` 与 `qmd embed`

2026-05-31 追加 dev mock 上下游验收：

- 新增 `TestCodexResponsesDevSmokeRequestWindowAdmissionFallsBackWithMockUpstream`：使用真实 OpenAI Responses handler 作为 mock downstream、两个 `httptest` upstream、真实 rate-limit management 规则写入与 `AuthManager` admission，验证账号 A 被 request-window 预占后，第二个并发 downstream 请求会 fallback 到账号 B。
- 已复跑 mock HTTP / WebSocket 上下游与 route-guard request-boundary focused 集合：
  - `go test ./sdk/api/handlers/openai -run 'TestCodex(ModelRoutingResponsesHTTPDownstreamUpstreamSmoke|ModelRoutingResponsesWebSocketDownstreamUpstreamSmoke|ResponsesDevSmokeRequestWindowAdmissionFallsBackWithMockUpstream)|TestResponsesWebsocket(ReleasesPinnedAuthAfterRouteGuardBlock|RequestBoundaryReleaseUsesRouteGuard)' -count=1 -v`
- 已复跑 handler 包与跨包链路：
  - `go test ./sdk/api/handlers/openai -count=1`
  - `go test ./internal/gettokenshooks ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1`

## 实施记录

### 2026-05-31 Phase 1/2 第一段

- 已完成 usage attribution 写入成功后的账号级增量评估：`usageAttributionPlugin.HandleUsage` 持久化成功后立即调用 rate-limit evaluator 刷新对应 `account_key`。
- 已完成 rate-limit 规则 CRUD 成功路径的即时评估：management API 只有在 evaluator 同步完成后才返回成功。
- 已补强失败语义：若规则写入/删除后的即时评估失败，management API 返回 500，并回滚本次 DB 规则变更，避免“API 失败但规则已偷偷生效/删除”。
- 已收紧新写入身份：rate-limit rule 新写入只接受 `acct_*` 账号卡 key，旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 不再作为新规则 key。
- 已补 evaluator 并发保护：`EvaluateNow` 与 `EvaluateAccountNow` 串行执行，避免周期评估和 usage 即时评估交错后把旧 guard 写回。
- 已避免状态锁内 SQLite event 持久化：阻断事件在内存状态和 route guard 刷新后再持久化，降低 route/status 读取被 DB I/O 卡住的风险。
- 已重建本地 sidecar：`build/bin/cli-proxy-api`。

验证：
- `go test ./internal/gettokenshooks -run 'TestRateLimitEvaluatorSerializesConcurrentEvaluations|TestRateLimitManagementRoutesReturnEvaluationError|TestRateLimitManagementRoutesRollbackFailedDelete|TestRateLimitEvaluatorEvaluateAccountNowPreservesOtherAccountBlocks|TestRateLimitRuleRejectsLegacyAccountKeys|TestUsageAttributionPluginRefreshesRateLimitGuardAfterPersist' -count=1`
- `go test ./internal/gettokenshooks -count=1`
- `go test ./internal/gettokenshooks ./internal/api/handlers/management ./sdk/cliproxy ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1`
- `go test ./... -count=1`
- `scripts/ensure-sidecar.sh darwin arm64`

未完成：
- WebSocket request-boundary explain 合并与 UI DTO 扩展尚未进入本段实现。

### 2026-05-31 Phase 3

- 已完成 request-window admission reservation：新增 sidecar 内 admission registry，在 `AuthManager` 选中账号后、执行请求前尝试预占；若当前账号预占失败，只把该账号加入本次 `tried` 并继续 fallback，不让 handler 直接返回 429。
- 已新增 `rate_limit_reservations` ledger，记录 `pending / committed / released / expired` 生命周期；request-window usage 同时计算已完成 usage events 与未释放 reservation，避免并发请求在完成前越过阈值。
- 已实现释放与清理：请求失败或取消时 release；请求成功时 commit 并等待 usage attribution 按 `request_id + account_key` 释放；周期/即时评估会过期 orphan reservation，避免永久占用额度。
- 已把 reservation 纳入即时评估和 route guard：预占、commit、release、usage 写入和 reconcile 后都会刷新对应账号的 rate-limit 状态。
- 已重建本地 sidecar：`build/bin/cli-proxy-api`。

验证：
- `go test ./internal/gettokenshooks -run 'TestRateLimitAdmissionReservationDeniesConcurrentRequestWindow|TestRateLimitAdmissionReservationCleanupExpiresOrphan' -count=1`
- `go test ./sdk/cliproxy/auth -run 'TestManagerExecute_OpenAICompatAliasPoolBlockedAuthDoesNotConsumeRetryBudget|TestManagerAdmissionDenyFallsBackToNextAuth' -count=1`
- `go test ./internal/gettokenshooks -count=1`
- `go test ./internal/gettokenshooks ./internal/api/handlers/management ./sdk/cliproxy ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1`
- `go test ./... -count=1`
- `scripts/ensure-sidecar.sh darwin arm64`

后续：
- WebSocket request-boundary explain 合并与 UI DTO 扩展已在 Phase 4/5 完成。

### 2026-05-31 Phase 4/5

- 已完成 route guard 活跃 block 详情查询：WebSocket request-boundary 不再只知道“被 guard 阻断”，还能拿到 source/reason/expires_at。
- 已完成 route policy explain source：`account-route-guard` hard-filter trace reason 会包含活跃 source/reason，例如 `manual-disabled=...`、`rate-limit=...`。
- 已完成 Codex WebSocket pinned auth release explain：命中 `rate-limit` 或其他 guard source 时，release 结果携带 source/reason，并写入 websocket timeline 的 `route_guard_pinned_auth_released` 事件。
- 已完成 rate-limit status DTO 扩展：sidecar status API 返回 active sources、rule/window、usage/limit、window start/end、next reset、last evaluated、stale/degraded 字段。
- 已同步 Wails / frontend DTO：`internal/cliproxyapi`、`internal/wailsapp`、root `app_types/app_mappers`、`frontend/wailsjs` 和 `frontend/src/features/accounts/model/rateLimit.ts` 已更新。
- 已更新账号详情 Route Guard 展示：summary 使用 `lastEvaluatedAt`，并展示 sidecar 返回的 source/reason/next reset；前端不本地推断 blocked。
- 已重建本地 sidecar：`build/bin/cli-proxy-api`。

验证：
- `go test ./internal/gettokenshooks ./sdk/api/handlers/openai -run 'TestAccountRouteGuardActiveBlocksForAuthReturnsSourceDetails|TestResponsesWebsocketRequestBoundaryReleaseUsesRouteGuard|TestRateLimitManagementRoutesExposeStrategiesCRUDStatusAndEvents' -count=1`
- `go test ./internal/gettokenshooks -run 'TestAccountRouteGuardManualDisabledDeniesCandidate|TestAccountRouteGuardPolicyReasonIncludesActiveSources|TestRateLimitEvaluatorRoutePolicyUsesGuardStore' -count=1`
- `go test ./internal/gettokenshooks ./internal/api/handlers/management ./sdk/cliproxy ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1`
- `go test ./... -count=1`（CLIProxyAPI fork）
- `go test ./...`（GetTokens root）
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- `scripts/ensure-sidecar.sh darwin arm64`
- `./scripts/wails-cli.sh build`

待用户验证：
- 真实 Wails 桌面中保存账号卡 rate-limit 规则后，账号详情可看到 source/reason/next reset。
- Codex WebSocket pinned auth 被 rate-limit 或手动禁用命中后，下一条 downstream request 在 request boundary 切号且 transcript replay 不带旧 `previous_response_id`。
