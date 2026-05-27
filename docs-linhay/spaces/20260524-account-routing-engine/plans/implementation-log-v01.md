# Account Routing Engine 实施记录 v01

日期：2026-05-25

## 批次 1：前端边界红灯测试与模型骨架

2026-05-27 校准：当前主路径已下线 `project` route mode；前端 `ChannelRouteMode` 只接受 `sequential / balanced`。历史项目绑定仍可作为项目名范围约束或兼容数据保留，但不能作为新的路由模式入口。

范围：

- 建立 `frontend/src/features/channel-routing/` 纯模型骨架。
- 锁定当前 GetTokens 路由模式只接受 `sequential / balanced`。
- 将 `dedicated / prefer / ordered / weighted / canary` 识别为上游兼容模式，不进入新配置保存。
- 限制项目绑定命中账号组后的组内选择只能使用 `sequential / balanced`。
- 移除 `AccountsFeature` 中的 `AccountRotationModal` 主入口。
- 移除 `useAccountsPageState` 中的账号轮动 modal UI state。

代码入口：

- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- `frontend/src/features/accounts/tests/accountInventoryBoundary.test.mjs`
- `frontend/src/features/accounts/AccountsFeature.tsx`
- `frontend/src/features/accounts/hooks/useAccountsPageState.ts`

验证：

- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs src/features/accounts/tests/accountInventoryBoundary.test.mjs`
  - 结果：通过，实际执行完整 unit script，`450` tests passed。
- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run build`
  - 结果：通过。
- 浏览器冒烟：
  - URL：`http://127.0.0.1:5173/#frame=accounts&workspace=all`
  - 断言：页面 `bodyText` 不包含 `轮动` 或 `rotation`。
  - 控制台：仅有 `favicon.ico` 404；无业务错误。
  - 截图：`docs-linhay/spaces/20260524-account-routing-engine/screenshots/20260525/accounts/20260525-accounts-inventory-no-rotation-after-v01.png`

未完成范围：

- 尚未实现 sidecar `AccountRoutingEngine` seam。
- 尚未迁移旧 `RoutePolicy` / rate-limit / session affinity / WebSocket pinned auth。
- 尚未新增 Wails channel routing API。
- 尚未重做 Codex / Claude channel routing 页面。

下一批建议：

1. 补 sidecar route engine 空策略兼容测试。
2. 补 hook 安装点测试。
3. 补 hard guard 优先级测试。
4. 再进入 `internal/gettokensrouting` 骨架实现。

## 批次 2：sidecar RoutePolicy 顺序与 hard guard 回归

范围：

- 修复 `sdk/cliproxy/auth/route_policy.go` 中 `routePolicySnapshot()` 从 map 无序迭代返回 policy 的问题，改为按注册 ID 升序返回。
- 新增 route policy 注册顺序测试，锁定后续 policy pipeline 的稳定执行顺序。
- 新增“前序 deny 不能被后续 allow/order 放回”的 scheduler 测试，作为 hard guard 优先级的兼容基线。

代码入口：

- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_policy.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_policy_test.go`

验证：

- `go test ./sdk/cliproxy/auth -run 'TestRoutePolicySnapshotPreservesRegistrationOrder|TestSchedulerRoutePolicyDenyCannotBeBypassedByLaterAllow|TestSchedulerRoutePolicyOrdersReadyCandidates|TestSchedulerRoutePolicyCannotBypassCooldown|TestSchedulerRoutePolicyStrictAllow'`
  - 结果：通过。
- `go test ./internal/gettokenshooks -run 'TestAccountRouteGuard|TestRoute|TestRateLimitPolicy|TestRateLimitEvaluator'`
  - 结果：通过。
- `go test ./sdk/cliproxy/auth ./internal/gettokenshooks`
  - 结果：通过。

未完成范围：

- 尚未实现 `internal/gettokensrouting` engine 包。
- 尚未把旧 `RoutePolicy` 映射为 engine `RequestPolicy`。
- 尚未收敛 rate-limit 双路径。
- 尚未迁移 session affinity wrapper。

下一批建议：

1. 新增 `internal/gettokensrouting` 纯 engine DTO 与空策略测试。
2. 将旧 `RoutePolicyDecision` 适配为 engine request policy。
3. 将 `accountRouteGuardPolicy` 适配为 engine hard filter policy。

## 批次 3：sidecar 路由引擎骨架与最小闭环

范围：

- 新增 `internal/gettokensrouting` 纯 engine 骨架，包含 `RouteContext`、`Policy`、`PolicyDecision`、`DecisionStep` 和 `RouteResult`。
- 以 stage 排序固定 policy 执行顺序，确保 hard-filter 先于 request/sticky。
- 将 policy decision 规范化为 allow / deny / order / fallback trace，保留候选快照与安全 trace。
- 锁定空策略不改变候选顺序，且 hard guard 不能被后续 request policy 放回。

代码入口：

- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/engine.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/engine_test.go`

验证：

- `go test ./internal/gettokensrouting`
  - 结果：通过。
- `go test ./internal/gettokensrouting ./sdk/cliproxy/auth`
  - 结果：通过。

未完成范围：

- 尚未把 engine seam 接到 scheduler / selector 热路径。
- 尚未把旧 `RoutePolicy` / guard / session affinity / WebSocket pinned auth 全部迁入统一 pipeline。
- 尚未新增 Wails channel routing API。
- 尚未重做 Codex / Claude channel routing 页面。

下一批建议：

1. 把 `RouteContext` / `PolicyPipeline` 接入 sidecar 选路 seam。
2. 补齐 hook 安装点测试和兼容层映射。
3. 继续推进 `RoutePolicy`、rate-limit 和 session affinity 的收敛。

## 批次 4：生产启动 hook 安装点

范围：

- 在 `internal/cmd/run.go` 接入 `buildGetTokensStartupHooks(configPath)`，让服务启动时统一安装 GetTokens route policy、usage attribution 和 rate-limit hook。
- `InstallRoutePolicyHook()` 在启动时始终执行；`UsageStatisticsEnabled` 打开时再安装 usage attribution / rate-limit ledger。
- 新增 `internal/cmd/run_test.go`，用真实 `Manager + Executor + RouteMetadata` 验证 route policy 已进入启动链路，并验证启用 usage 时会创建 attribution ledger。

代码入口：

- `docs-linhay/references/CLIProxyAPI/internal/cmd/run.go`
- `docs-linhay/references/CLIProxyAPI/internal/cmd/run_test.go`

验证：

- `go test ./internal/cmd ./internal/gettokensrouting ./sdk/cliproxy/auth`
  - 结果：通过。
- `go build ./...`
  - 结果：通过。

未完成范围：

- 尚未把 `AccountRoutingEngine` seam 接到 `pickNext` / `pickNextMixed` 热路径。
- 尚未把 session affinity / WebSocket pinned auth / route policy 统一迁移到 engine pipeline。
- 尚未新增 Wails channel routing API。
- 尚未重做 Codex / Claude channel routing 页面。

下一批建议：

1. 接入 `AccountRoutingEngine` 的 `RouteContext` 和 `PolicyPipeline`。
2. 把现有 `RoutePolicy` / guard / sticky 迁移到统一路由入口。
3. 再做一次带真实请求流的冒烟验证。

## 批次 5：shadow/event ledger 与桌面预览验收

范围：

- 在 `internal/wailsapp/channel_routing.go` 增加 `shadowEnabled` / `shadowRouteMode`，Explain 可同时返回 production decision 与 shadow diff。
- 新增安全 route event ledger，持久化 explain 摘要、snapshot version、policy version、shadow diff 和计数，不记录 payload / token / cookie / bearer 等敏感内容。
- 增加 `ListChannelRouteEvents` 供后续调试面板/审计使用。
- 前端 `ChannelRoutingWorkbench` 增加 shadow 开关、shadow 路由模式和 snapshot/policy 摘要展示。
- Codex / Claude 账号列表浏览器预览补齐 shadow explain 截图。

代码入口：

- `internal/wailsapp/channel_routing.go`
- `internal/wailsapp/channel_routing_test.go`
- `app.go`
- `app_types.go`
- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx`
- `frontend/src/features/codex/CodexAccountListFeature.tsx`
- `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx`
- `frontend/wailsjs/go/main/App.js`
- `frontend/wailsjs/go/main/App.d.ts`
- `frontend/wailsjs/go/models.ts`

验证：

- `go test . ./internal/wailsapp -run 'Test.*ChannelRouting|TestChannelRouteEvent'`
  - 结果：通过。
- `go test ./...`
  - 结果：通过。
- `go test ./...`（CLIProxyAPI fork）
  - 结果：通过。
- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs`
  - 结果：通过，unit 总计 `453` tests passed。
- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run build`
  - 结果：通过。
- 浏览器预览：
  - Codex 侧 `shadow: balanced -> codex-api-key:gray-canary / diff: yes`
  - Claude 侧 `shadow: balanced -> codex-api-key:mimo-shared / diff: yes`
  - 截图：
    - `docs-linhay/spaces/20260524-account-routing-engine/screenshots/20260525/codex/20260525-codex-account-routing-shadow-after-v01.png`
    - `docs-linhay/spaces/20260524-account-routing-engine/screenshots/20260525/claude/20260525-claude-account-routing-shadow-after-v01.png`

未完成范围：

- 真实 upstream 请求冒烟还没有在可用凭据环境中完成。
- `AccountRoutingEngine` 仍未完全接管所有 selector 热路径。
- 还需要把 route event ledger 接入更完整的调试/审计入口。

下一批建议：

1. 补真实请求冒烟与 ledger 查询入口。
2. 回头收敛 remaining legacy route paths。
3. 做最后一次 DoD 审计并收尾 memory / qmd。

## 批次 6：最终验收审计

范围：

- 复核当前 space 的核心交付是否保持绿色。
- 确认 shadow/event ledger、Wails 绑定、前端工作台、启动 hook、engine seam 和回归测试都已收口。

验证：

- `go test . ./internal/wailsapp -run 'Test.*ChannelRouting|TestChannelRouteEvent'`
  - 结果：通过。
- CLIProxyAPI fork 的 `go test ./internal/gettokensrouting ./sdk/cliproxy/auth ./internal/cmd ./internal/gettokenshooks`
  - 结果：通过。
- CLIProxyAPI fork 的 `go test ./...`
  - 结果：通过。
- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs src/features/accounts/tests/accountInventoryBoundary.test.mjs`
  - 结果：通过。
- `npm --prefix frontend run build`
  - 结果：通过。
- `docs-linhay/scripts/check-docs.sh`
  - 结果：通过。

结论：

- 本轮目标已收口到 shadow / event ledger 这一阶段，当前实现与 space 文档一致。
- 更深的 legacy cleanup 与外部真实 upstream smoke 保留为后续兼容项，不阻塞本次收尾。

## 批次 7：冒烟测试

范围：

- 复用现有 Wails dev / Vite 进程做 Account Routing Engine 冒烟。
- 覆盖自动化门禁、Codex / Claude 浏览器 EXPLAIN、dev sidecar 健康检查和客户端模型列表探针。

验证：

- `go test . ./internal/wailsapp -run 'Test.*ChannelRouting|TestChannelRouteEvent'`
  - 结果：通过。
- CLIProxyAPI fork 的 `go test ./internal/gettokensrouting ./sdk/cliproxy/auth ./internal/cmd ./internal/gettokenshooks`
  - 结果：通过。
- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs src/features/accounts/tests/accountInventoryBoundary.test.mjs`
  - 结果：通过，`453` tests passed。
- `npm --prefix frontend run build`
  - 结果：通过。
- `docs-linhay/scripts/check-docs.sh`
  - 结果：通过。
- Codex browser smoke：`http://127.0.0.1:5173/#frame=codex&workspace=account-list`
  - EXPLAIN 后：`5 candidates / 2 filtered`，`selected: openai-compatible:deepseek`，`snapshot: preview / policy: channel-routing-v1`。
  - 截图：`../screenshots/20260525/codex/20260525-codex-account-routing-smoke-after-v01.png`。
- Claude browser smoke：`http://127.0.0.1:5173/#frame=claude&workspace=account-list`
  - EXPLAIN 后：`3 candidates / 1 filtered`，`selected: codex-api-key:deepseek-claude`，`snapshot: preview / policy: channel-routing-v1`。
  - 截图：`../screenshots/20260525/claude/20260525-claude-account-routing-smoke-after-v01.png`。
- dev sidecar：
  - `GET /healthz` on `127.0.0.1:18317` 返回 `200`。
  - `GET /v1/models` 通过本地客户端 API key 返回 `status=200 models=8`。

未执行：

- 未发送真实生成请求，避免消耗外部 upstream 额度。
- management endpoint 未用配置文件中的 bcrypt hash 反推明文 key；未绕过鉴权。

## 批次 8：Codex 隔离 HOME 冒烟

范围：

- 按用户要求使用独立 `CODEX_HOME` 测试 Codex CLI 与 GetTokens local apply 相关逻辑。
- 验证不会污染真实 `~/.codex/auth.json` 与 `~/.codex/config.toml`。

验证：

- 隔离目录：`/tmp/gettokens-codex-home-smoke.zaXxDu`。
- `CODEX_HOME=/tmp/gettokens-codex-home-smoke.zaXxDu codex --version`
  - 结果：通过，`codex-cli 0.130.0`。
- `CODEX_HOME=/tmp/gettokens-codex-home-smoke.zaXxDu codex --help`
  - 结果：通过，只读帮助输出。
- `CODEX_HOME=/tmp/gettokens-codex-home-smoke.zaXxDu codex features list`
  - 结果：通过，CLI 在隔离 home 下生成运行态目录 `tmp/arg0` 与 `memories/`。
- `CODEX_HOME=/tmp/gettokens-codex-home-smoke.zaXxDu codex features enable apply_patch_streaming_events`
  - 结果：通过，写入隔离目录 `config.toml`，内容为 `[features] apply_patch_streaming_events = true`。
- `go test ./internal/wailsapp -run 'TestResolveCodexHomePathUsesCODEXHOMEOverride|TestApplyRelayServiceConfigToLocal|TestGetLocalCodexAuthState'`
  - 结果：通过，覆盖 `CODEX_HOME` override、本地 Codex apply 写 `auth.json/config.toml`、保留式 patch、OAuth/API key 模式与本地 auth state 判定。
- 真实 `/Users/linhey/.codex`、`auth.json`、`config.toml` 在测试前后 `mtime/size` 一致。

结论：

- Codex CLI 自身支持用 `CODEX_HOME` 指向隔离 home 做读写测试。
- GetTokens 后端 `resolveCodexHomePath()` 与 local apply 逻辑也按 `CODEX_HOME` 写入隔离目录。
- 本轮未发送真实生成请求，也未读取或输出真实 token。

## 批次 9：启停语义与失败冷却持久化

范围：

- 在 Wails channel routing 决策层补齐 `stickyAccountID` 输入，用于模拟已有会话 sticky / pinned auth。
- 账号禁用、有效组禁用和运行态 block 高于 sticky、失败降级与 selector；sticky 账号被过滤时记录 `sticky:invalidated:<reason>` 并立即 fallback。
- 账号激活只重新进入候选池，不抢占已有 sticky，会话仍继续命中当前账号直到下一轮 route / retry。
- 新增 `MarkChannelRouteAccountResult`，把 401 / 429 / 5xx / timeout / model-unavailable 等结果写入 channel routing store 的 `runtimeStates`，后续 explain 使用同一状态过滤账号。
- 同步 root `main.App` DTO / facade 与 `frontend/wailsjs` 绑定，桌面前端可调用失败结果记录接口。
- CLIProxyAPI fork 未重复改热路径；当前 fork 已有 WebSocket guard failover 测试覆盖 pinned auth 被 guard block 后释放并切换账号。

验证：

- `go test ./internal/wailsapp -run 'TestExplainChannelRoutingDisabledStickyInvalidatesAndFallsBack|TestExplainChannelRoutingActivationDoesNotPreemptExistingSticky|TestChannelRouteAccountResultPersistsCooldownAndExplainFiltersRuntimeState'`
  - 结果：通过。
- `go test . ./internal/wailsapp -run 'Test.*ChannelRouting|TestChannelRouteEvent|TestChannelRouteAccountResult'`
  - 结果：通过。
- `go test ./internal/wailsapp`
  - 结果：通过。
- `./scripts/wails-cli.sh generate module`
  - 结果：通过，`frontend/wailsjs/go/main/App.*` 新增 `MarkChannelRouteAccountResult`，`models.ts` 新增 runtime DTO 与 `stickyAccountID`。
- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs`
  - 结果：通过，实际执行完整前端 unit 列表，`454` tests passed。
- CLIProxyAPI fork：`go test ./internal/gettokensrouting ./internal/gettokenshooks ./sdk/api/handlers/openai -run 'Test.*Channel|TestAccountRouteGuard|TestResponsesWebSocket.*Guard|TestResponsesWebSocket.*Failover|Test.*previous_response_id'`
  - 结果：通过。

结论：

- 禁用立即生效已经在 routing explain / runtime state 层可验证；禁用账号不会被 sticky 或 retry 继续选中。
- 激活语义保持非抢占，只影响下一轮候选池。
- 失败冷却已持久化到 channel routing store，后续 route explain 可读同一运行态。
- 当前仍未发送真实 upstream 生成请求；真实流式断开行为以 CLIProxyAPI fork 既有 WebSocket guard failover 测试作为热路径覆盖。

## 批次 10：结果回流、真实生成冒烟与 legacy UI 收敛

范围：

- CLIProxyAPI fork 新增 `AccountRouteGuardResultHook`，默认 service builder 通过 `coreauth.NewManager(..., AccountRouteGuardResultHook{})` 接入真实执行器 `MarkResult`。
- `AccountRouteGuardStore.MarkResult` 将真实执行器结果转为 route guard transient sources：
  - `401` -> `auth-error`
  - `429` -> `upstream-rate-limit`
  - `408 / 5xx / timeout` -> `upstream-error`
- 成功结果只清理 `auth-error`、`upstream-rate-limit`、`upstream-error`，不清理 `manual-disabled` 或既有 `rate-limit` source。
- Codex / Claude 账号列表移除旧 allow / deny / fallback 的主 UI 操作入口；路由探测只按当前渠道排序传入 `orderAccountIDs`，底层 probe API 的兼容字段保留为空。
- 真实 dev sidecar 使用本地 relay client key 做安全冒烟，不输出任何 key / token / payload 明文。

代码入口：

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard_test.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/builder.go`
- `frontend/src/features/codex/CodexAccountListFeature.tsx`
- `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx`
- `frontend/src/features/codex/components/CodexAccountOrderRow.tsx`
- `frontend/src/features/codex/components/CodexRouteProbeCard.tsx`

验证：

- dev sidecar `GET /healthz` on `127.0.0.1:18317`
  - 结果：通过，返回 `{"status":"ok"}`。
- dev sidecar `GET /v1/models` 使用本地 relay client key
  - 结果：通过，`status=200 models=8`。
- dev sidecar `POST /v1/responses` 使用本地 relay client key，`model=gpt-5.4`、`max_output_tokens=1`
  - 结果：通过，`status=200 object=response id_present=true`。
- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs src/features/codex/codexAccountList.test.mjs src/features/claude-code/claudeCodeAccountList.test.mjs`
  - 结果：通过，实际执行完整前端 unit 列表，`454` tests passed。
- `go test . ./internal/wailsapp -run 'Test.*ChannelRouting|TestChannelRouteEvent|TestChannelRouteAccountResult'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokensrouting ./internal/gettokenshooks ./sdk/cliproxy ./sdk/cliproxy/auth ./internal/cmd ./sdk/api/handlers/openai -run 'Test.*Channel|TestAccountRouteGuard|TestInstallGetTokensHooksInstallsRoutePolicy|TestService|TestBuilder|Test.*RouteGuard|TestResponsesWebSocket.*Guard|TestResponsesWebSocket.*Failover|Test.*previous_response_id|TestManager.*MarkResult|TestManager.*Cooldown|Test.*RoutePolicy|Test.*Scheduler'`
  - 结果：通过。

结论：

- 真实执行器结果已经能回流到 route guard store，失败冷却覆盖从 Wails explain/record 进一步延伸到 sidecar 真实请求路径。
- 真实 upstream 生成冒烟已跑通；本轮只记录状态码、模型数量和 response id 是否存在，不记录敏感内容。
- 新路由主 UI 已不再暴露旧 allow / deny / fallback 编排，旧字段保留为 sidecar request policy 兼容层，便于后续合并上游。

剩余后续项：

- route event ledger 的更完整审计入口。
- 更彻底的 selector 热路径接管与删除清单。

## 批次 11：Route Ledger 工作台入口与 selector shim 状态清单

范围：

- `ChannelRoutingWorkbench` 增加 `Route Ledger` 区块，展示最近 5 条安全 route event 摘要。
- Codex / Claude 账号列表在桌面模式通过 `ListChannelRouteEvents(channel, limit=5)` 读取各自渠道事件，浏览器预览模式在 Explain 后合成 preview-only redacted event。
- 新增 `buildChannelRouteAuditEventSummary` 和 `buildPreviewChannelRouteAuditEvent` 纯模型函数，避免审计展示逻辑散落在 JSX。
- 更新 `legacy-routing-cleanup-v01.md`，标记当前已完成项、兼容保留项和删除条件。

代码入口：

- `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx`
- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- `frontend/src/features/codex/CodexAccountListFeature.tsx`
- `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx`
- `docs-linhay/spaces/20260524-account-routing-engine/plans/legacy-routing-cleanup-v01.md`

验证：

- `npm --prefix frontend run typecheck`
  - 结果：通过。
- `npm --prefix frontend run test:unit -- src/features/channel-routing/tests/channelRouting.test.mjs`
  - 结果：通过，实际执行完整前端 unit 列表，`456` tests passed。
- 浏览器预览 Codex：`http://127.0.0.1:5173/#frame=codex&workspace=account-list`
  - EXPLAIN 后：`Route Ledger` 可见，出现 `preview -> openai-compatible:deepseek`，`5 candidates / 2 filtered`。
- 浏览器预览 Claude：`http://127.0.0.1:5173/#frame=claude&workspace=account-list`
  - EXPLAIN 后：`Route Ledger` 可见，出现 `preview -> codex-api-key:deepseek-claude`，`3 candidates / 1 filtered`。
- 浏览器控制台：
  - 仅有既有 `favicon.ico` 404，无业务错误。

结论：

- route event ledger 已从后端读 API 补到 Codex / Claude 工作台入口，审计信息以 redacted 摘要展示，不包含 payload、token、cookie 或 bearer。
- 当时 selector 热路径剩余项收敛为明确清单：`rateLimitPolicy` 兼容注册、普通 session affinity wrapper、`RoutePolicy` 公共兼容 API 和 WebSocket request-boundary 特例；其中 `rateLimitPolicy` 已在批次 12 删除。

## 批次 12：Rate-limit 双路径收敛

范围：

- CLIProxyAPI fork 删除 `rateLimitPolicy` 兼容 RoutePolicy 注册，`InstallRateLimitHook()` 不再调用 `coreauth.RegisterRoutePolicy(rateLimitPolicy{...})`。
- 删除 `defaultRateLimitCleanup` 和独立 `rateLimitPolicy` 类型，rate-limit 不再拥有第二个热路径 deny 出口。
- 保留 `RateLimitEvaluator` 的评估、事件写入和 `AccountRouteGuardSourceRateLimit` 刷新职责。
- 调整回归测试，证明 blocked rate-limit state 在没有 `rateLimitPolicy` 时仍由 `accountRouteGuardPolicy` 统一输出 deny。

代码入口：

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/rate_limit.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/rate_limit_test.go`
- `docs-linhay/spaces/20260524-account-routing-engine/plans/legacy-routing-cleanup-v01.md`

验证：

- CLIProxyAPI fork：`go test ./internal/gettokenshooks -run 'TestRateLimit|TestAccountRouteGuard'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth -run 'TestRateLimit|TestAccountRouteGuard|TestInstallGetTokensHooksInstallsRoutePolicy|Test.*RoutePolicy|Test.*Scheduler'`
  - 结果：通过。

结论：

- rate-limit 热路径已经收敛为 guard source -> `accountRouteGuardPolicy`，不再存在 `rateLimitPolicy` 与 guard policy 并行 deny 的双路径。
- selector shim 剩余项从 `rateLimitPolicy` 兼容注册、普通 session affinity wrapper、公共 `RoutePolicy` 兼容 API 和 WebSocket request-boundary 特例，缩减为普通 session affinity wrapper、公共 `RoutePolicy` 兼容 API 和 WebSocket request-boundary 特例。

## 批次 13：Session affinity legacy path 接入 route policy seam

范围：

- CLIProxyAPI fork 的 `Manager.pickNextLegacy()` 和 `Manager.pickNextMixedLegacy()` 在调用 selector 前复用 `RoutePolicy` / `gettokensrouting.Engine` rewrite。
- 新增 `rewriteAuthCandidates()`，让 legacy `[]*Auth` 候选复用 scheduler 已有的 staged route policy pipeline。
- session affinity 仍保留 selector wrapper 与 cache 语义，但 sticky selector 只能在 route policy 过滤后的候选池内命中或重选。
- 新增单 provider 与 mixed provider 回归测试，证明 hard guard deny 不能被 session affinity cache / fallback 绕过。

代码入口：

- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_policy.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_policy_test.go`
- `docs-linhay/spaces/20260524-account-routing-engine/plans/legacy-routing-cleanup-v01.md`

验证：

- CLIProxyAPI fork：`go test ./sdk/cliproxy/auth -run 'TestLegacy.*SessionAffinityRoutePolicy|TestSchedulerRoutePolicy|TestSessionAffinitySelector'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth -run 'TestRateLimit|TestAccountRouteGuard|TestInstallGetTokensHooksInstallsRoutePolicy|Test.*RoutePolicy|Test.*Scheduler|TestSessionAffinitySelector|TestLegacy.*SessionAffinityRoutePolicy'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth`
  - 结果：通过。

结论：

- session affinity wrapper 还没有完全改写为 engine-native `StickyPolicy`，但它已经不再绕过 route policy / hard guard 主路径。
- selector shim 剩余项进一步缩减为公共 `RoutePolicy` 兼容 API、WebSocket request-boundary 特例，以及后续可选的 engine-native sticky stage 重构。

## 批次 14：Session affinity 进入 scheduler sticky stage

范围：

- `SessionAffinitySelector` 继续保留 cache / TTL / fallback selector 语义，但不再让 manager 因 selector wrapper 退出 scheduler fast path。
- `authScheduler` 识别 `SessionAffinitySelector`，提取其 fallback strategy，并把 selector 自身作为 manager-local sticky policy 附加到 route engine。
- `SessionAffinitySelector` 实现 `RoutePolicyStage() == sticky` 和 `RewriteCandidates()`：cache hit / fallback cache hit 时只在当前候选池内把绑定账号排序到最前。
- scheduler 在 cache miss 时由 built-in selector 完成选择，并通过 `BindRouteResult()` 把最终选中账号写回 session cache。
- 新增测试覆盖 scheduler fast path 识别 session affinity、sticky policy 绑定结果、hard guard deny 不被 session affinity 绕过。

代码入口：

- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/scheduler.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_policy.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_policy_test.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/scheduler_test.go`
- `docs-linhay/spaces/20260524-account-routing-engine/plans/legacy-routing-cleanup-v01.md`

验证：

- CLIProxyAPI fork：`go test ./sdk/cliproxy/auth -run 'TestSchedulerSessionAffinity|TestLegacy.*SessionAffinityRoutePolicy|TestSchedulerRoutePolicy|TestSessionAffinitySelector|TestManager_InitializesSchedulerForBuiltInSelector'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth -run 'TestRateLimit|TestAccountRouteGuard|TestInstallGetTokensHooksInstallsRoutePolicy|Test.*RoutePolicy|Test.*Scheduler|TestSessionAffinitySelector|TestLegacy.*SessionAffinityRoutePolicy|TestManager_InitializesSchedulerForBuiltInSelector'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth`
  - 结果：通过。

结论：

- sticky wrapper 已经完成 engine-native 主线收敛：sticky hit/miss 不再绕过 scheduler fast path，cache hit 作为 `PolicyStageSticky` 参与统一候选重写，cache miss 由 selector 选中后绑定。
- selector shim 剩余项缩减为公共 `RoutePolicy` 兼容 API 与 WebSocket request-boundary 特例。

## 批次 15：WebSocket request-boundary 特例收口

范围：

- 将 WebSocket handler 中的 pinned auth guarded 检查抽成 `responsesWebsocketReleasePinnedAuthAtRequestBoundary()`。
- helper 统一使用 `AccountRouteGuardStore` 判断 pinned auth 是否被 hard guard block。
- 命中 guarded auth 时释放 pin、关闭旧 execution session、强制下一条请求 transcript replay；未命中时保持 pinned auth 不变。
- 新增单测覆盖 unguarded 不释放、guarded 释放并要求 replay。

代码入口：

- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`
- `docs-linhay/spaces/20260524-account-routing-engine/plans/legacy-routing-cleanup-v01.md`

验证：

- CLIProxyAPI fork：`go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocketRequestBoundaryReleaseUsesRouteGuard|TestResponsesWebsocketReleasesPinnedAuthAfterRouteGuardBlock|TestResponsesWebSocket.*Guard|TestResponsesWebSocket.*Failover|Test.*previous_response_id'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth ./sdk/api/handlers/openai -run 'TestRateLimit|TestAccountRouteGuard|TestInstallGetTokensHooksInstallsRoutePolicy|Test.*RoutePolicy|Test.*Scheduler|TestSessionAffinitySelector|TestLegacy.*SessionAffinityRoutePolicy|TestManager_InitializesSchedulerForBuiltInSelector|TestResponsesWebsocketRequestBoundaryReleaseUsesRouteGuard|TestResponsesWebsocketReleasesPinnedAuthAfterRouteGuardBlock|TestResponsesWebSocket.*Guard|TestResponsesWebSocket.*Failover|Test.*previous_response_id'`
  - 结果：通过。
- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy/auth ./sdk/api/handlers/openai`
  - 结果：通过。

结论：

- WebSocket request-boundary 特例已经收口为连接生命周期 helper，不再散落在 handler 内部。
- 该特例仍应保留，因为它处理的是已建立 upstream WebSocket 的 pin 释放、旧连接关闭和 transcript replay，不是普通候选排序规则。
- 剩余兼容边界缩减为公共 `RoutePolicy` API；它作为上游合并和旧 request policy 的兼容入口保留。
