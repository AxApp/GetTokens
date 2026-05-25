# Account Routing Engine 实施记录 v01

日期：2026-05-25

## 批次 1：前端边界红灯测试与模型骨架

范围：

- 建立 `frontend/src/features/channel-routing/` 纯模型骨架。
- 锁定新 GetTokens 路由模式只接受 `sequential / balanced / project`。
- 将 `dedicated / prefer / ordered / weighted / canary` 识别为上游兼容模式，不进入新配置保存。
- 限制项目模式命中账号组后的组内 fallback 只能使用 `sequential / balanced`。
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
