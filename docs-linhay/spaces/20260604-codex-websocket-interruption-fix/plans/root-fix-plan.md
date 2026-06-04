# Codex WebSocket Interrupted 根治方案

## 结论

最佳方案不是只把 `supports_websockets` 默认值改成 `false`。那只能保护新写入的本地 Codex 配置，不能保护已经写入 `supports_websockets=true` 的存量配置，也不能防止用户手动开启 WebSocket 后再次把唯一 auth 打进 route guard。

推荐采用三层修复：

1. **默认降级**：GetTokens relay provider 默认走 HTTP Responses，WebSocket 变成高级 opt-in。
2. **运行态熔断**：sidecar 将 WS 传输型 408 / session_closed / abnormal close / timeout 识别为 WebSocket transport failure，不把 auth 作为全局不可用账号处理；后续请求触发 HTTP fallback 或 WS circuit breaker。
3. **存量修复与可观测**：检测本地 Codex provider 指向 GetTokens relay 且 `supports_websockets=true` 的风险配置，提供显式修复动作和清晰状态说明。

## 问题链路

```text
Codex TUI
  -> local provider supports_websockets=true
  -> GetTokens /v1/responses websocket
  -> sidecar selects codex auth and pins websocket session
  -> upstream ws://cpa.host.dxy/v1/responses closes before response.completed
  -> sidecar emits 408 stream closed before response.completed
  -> route guard marks the only auth as upstream transient unavailable
  -> next same-model request sees no available auth
  -> sidecar emits 503 auth_unavailable
  -> Codex TUI shows Conversation interrupted
```

核心错配：Codex WebSocket 是长连接/pinned session，GetTokens sidecar 是账号池、route guard、failover 的运行态路由器。WebSocket 的单条上游传输故障被提升成 auth 级不可用后，会放大为同模型连续 503。

历史差异：路由改造前 WebSocket relay 可以工作，是因为当时还没有把执行结果统一收敛到 account route guard。`c9a91feb feat: converge gettokens account route guard pipeline` 之后，`408` 这类 HTTP-like status 开始进入 `AccountRouteGuardResultHook`，才产生“WS 单次断流 -> auth/model 全局 guard -> 后续 503”的回归。因此修复必须保留显式 WS 能力，同时阻止 WS transport failure 污染路由状态。

## 方案边界

### Building

- 修改 GetTokens 写入本地 Codex 配置的默认 WebSocket 策略。
- 修改 sidecar 对 Codex WebSocket transport failure 的分类和后续 fallback 行为。
- 增加存量本地配置风险检测和修复入口。
- 增加 mock 上下游回归测试和 dev Codex CLI 冒烟。

### Not Building

- 不删除 WebSocket relay 能力。
- 不替上游 WebSocket 服务端修 bug。
- 不改变真实 quota/auth/rate-limit 错误的 route guard。
- 不静默修改正式版用户配置或正式版二进制。

## 设计决策

### 决策 1：GetTokens relay 默认 `supports_websockets=false`

HTTP Responses 是 GetTokens relay 的主路径。它和每 turn 账号选择、retry、route guard、usage attribution 的边界一致；WebSocket 的 pinned session 会绕过或放大这些边界。

注意：默认关闭 WebSocket 不等于删除 WebSocket 能力。Codex 源码 `codex-rs/codex-api/src/provider.rs` 的 `websocket_url_for_path()` 语义是：`http://` 转 `ws://`、`https://` 转 `wss://`，`ws://` / `wss://` 原样保留。GetTokens sidecar 必须对齐这一行为。

落点：

- `frontend/src/features/status/StatusFeature.tsx`：默认 `supportsWebsockets=false`。
- `frontend/src/features/accounts/model/accountLocalCliMapping.ts`：Codex draft 默认 `supportsWebsockets=false`。
- `frontend/src/features/accounts/AccountsFeature.tsx`：任何硬编码 `supportsWebsockets:true` 改为默认 false 或高级开关值。
- `internal/wailsapp/relay_local_apply.go`：V2 apply 显式 false 时必须写入 `supports_websockets = false`；旧 bool API 不再作为新 UI 主路径。

### 决策 2：WS 传输型 408 不进入 auth 全局不可用

`stream closed before response.completed` 说明 WebSocket transport 没有完整结束，不等价于 API key、账号额度或模型不可用。它可以影响 WebSocket 能力，但不能让同一 auth 的 HTTP Responses 也不可用。

落点：

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`

实现原则：

- 保留 401/402/403/429 以及非 WS 的真实 5xx route guard。
- 对 WS transport failure 记录独立的 websocket capability/circuit-breaker 状态。
- circuit breaker 命中时，不再选择上游 WS；下游 WebSocket 请求应收到明确的 fallback close/error，让 Codex 走 HTTP Responses。

### 决策 3：存量配置不静默改，提供显式修复

用户现有 `CODEX_HOME/config.toml` 可能是手工配置或有意开启 WS。GetTokens 可以检测风险，但不应在用户未点击应用时静默改。

落点：

- `frontend/src/features/status/model/relayLocalState.ts`
- `frontend/src/features/status/StatusFeature.tsx`
- `internal/wailsapp/codex_feature_config.go`
- `internal/wailsapp/relay_local_apply.go`

行为：

- 当 provider base URL 指向 GetTokens relay，且 `supports_websockets=true`，Status 页显示“高风险：GetTokens relay WebSocket 已开启，可能导致 Codex interrupted”。
- 提供“一键切换到 HTTP Responses”操作，写入 `supports_websockets = false`。
- 如果用户显式保留 WS，状态页显示 opt-in 风险说明，不反复覆盖。

## 阶段计划

### Phase 1：默认降级与存量检测

可独立合并。合并后新配置不再默认触发问题，存量配置能被用户发现并修复。

改动：

- 前端默认 `supportsWebsockets=false`。
- 账号卡 Codex 本地应用 draft 默认 false。
- Status 本地配置 diff 默认写 `supports_websockets = false`。
- 增加存量风险检测 copy 和修复入口。

测试：

```bash
npm --prefix frontend run test:unit -- src/features/accounts/tests/accountLocalCliMapping.test.mjs src/features/status/tests/relayLocalState.test.mjs
go test ./internal/wailsapp -run 'TestApplyRelayServiceConfigToLocalV2.*SupportsWebsockets|TestApplyRelayServiceConfigToLocalWritesCustomProviderFacingFiles' -count=1
```

验收：

- 新生成 Codex provider 默认 `supports_websockets = false`。
- 已存在 true 的 GetTokens provider 被标记为风险，不被静默覆盖。

### Phase 2：sidecar WS transport circuit breaker

可独立合并。合并后即使用户手动开启 WS，WS 传输故障也不会放大成 auth 全局不可用。

改动：

- 将 `stream closed before response.completed`、WS `session_closed`、1006 abnormal close、i/o timeout 归类为 websocket transport failure。
- 新增或复用独立状态，标记 auth/model 的 WebSocket 能力短暂熔断。
- route guard 不再因这类 WS transport failure 产生 `auth_unavailable`。
- 下游 WS 请求在熔断期触发 HTTP fallback，而不是继续打同一坏 WS。

测试：

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocket(MockUpstream408ThenRouteGuardUnavailable|ClosesOnCodexUpstreamDisconnect|ReleasesPinnedAuthAfterRouteGuardBlock|RequestBoundaryReleaseUsesRouteGuard)' -count=1
go test ./internal/gettokenshooks ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1
```

验收：

- 现有复现测试从“408 后 503 auth_unavailable”调整为“408 后 HTTP fallback / no auth_unavailable”。
- 401/429 route guard 回归仍通过。

### Phase 3：真实 dev 冒烟与发布准备

可独立合并。合并后证明桌面 dev 构建和 Codex CLI 真实进程可用。

改动：

- 重建 dev sidecar。
- 使用隔离 `CODEX_HOME` 写入 GetTokens relay provider，默认 `supports_websockets=false`。
- 执行真实 `codex exec` 冒烟。
- 更新 memory 和必要 dev docs。

命令：

```bash
./scripts/ensure-sidecar.sh darwin arm64
codex -a never exec --skip-git-repo-check --ephemeral --sandbox read-only --model gpt-5.5 --output-last-message /tmp/gettokens-codex-ws-fix.out "Reply with ok"
```

验收：

- Codex CLI exit code 为 0。
- sidecar 日志出现 `/v1/responses` HTTP 请求，不出现 WebSocket `/v1/responses`。
- 不出现连续 `Conversation interrupted`。

## 回滚

- Phase 1 可回滚为默认 true，但不建议；更安全的回滚是保留 UI 高级开关，让用户手动开启。
- Phase 2 可通过移除 WS circuit breaker 回到当前行为；不会涉及数据迁移。
- Phase 3 只涉及 dev 构建和验证，不修改正式版。

## 风险

1. Codex 对 downstream WebSocket close 是否稳定 fallback 到 HTTP，必须用真实 Codex CLI 冒烟确认；如果不稳定，默认 false 仍是主保护。
2. 不能把所有 408 都跳过 route guard；只有 WS transport close 类 408 能跳过，否则会误放行真实请求失败。
3. 存量配置如果用户不点击修复，仍可能复现；因此状态页必须显著提示风险。

## 最小可交付

最小可交付是 Phase 1：默认 `supports_websockets=false` 加存量风险检测。它能立刻阻断新配置复现，并让用户修复当前本地配置。

完整根治是 Phase 1 + Phase 2：既避免默认踩坑，也保证手动开启 WS 后不会把账号池状态打坏。

## 实施结果（2026-06-04）

已在 dev/source 范围完成 Phase 1 + Phase 2：

1. GetTokens 写入本地 Codex provider 的 UI 默认值改为 `supports_websockets=false`；账号卡生成 Codex local apply draft 时同样默认 false。
2. `GetLocalCodexModelProviderStateView` 增加当前 provider 的 `base_url` 与 `supports_websockets` 解析；Status 页在当前本地 provider 指向当前 GetTokens relay endpoint 且显式 `supports_websockets=true` 时显示风险提示。用户保持开关关闭并点击应用时会写入 `supports_websockets=false`，不会静默改配置。
3. CLIProxyAPI fork 新增 WebSocket transport failure 标记与 auth 内存级 WebSocket circuit breaker。`408 stream closed before response.completed`、`session_closed`、abnormal close、timeout 等 WS 传输失败只熔断该 auth 的 WebSocket 能力，不再创建 auth/model 全局 route guard。
4. executor 的 WS handshake `408/5xx`、dial 失败、send/retry-send 失败也会包装为 `TransportFailureKindWebsocket`；auth manager 直接 `ExecuteStream` 返回错误和 stream chunk 错误两条路径都识别该标记，避免绕过 circuit 分支。
5. downstream Codex WebSocket 在 Codex auth 被显式禁用 WS 或 circuit 命中时关闭连接并提示 retry over HTTP；openai-compatible 仍走 HTTP fallback；非 WS 传输错误的 route guard 语义不变。
6. WS/WSS 支持继续保留并对齐 Codex：`https://...` 转 `wss://...`，用户直接配置 `ws://...` 或 `wss://...` 时原样保留。
7. mock upstream 复现测试已从旧行为“408 后 route guard 503 auth_unavailable”更新为新行为“408 后不创建 route guard、打开 WS circuit、后续不返回 auth_unavailable”。

已验证命令：

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1
go test ./internal/runtime/executor -run 'TestBuildCodexResponsesWebsocketURLRequiresHTTPURL|TestCodexWebsockets|TestParseCodexWebsocketError' -count=1
```

```bash
go test ./internal/wailsapp -run 'TestParseLocalCodexModelProviderStateReadsCurrentProvider|TestGetLocalCodexModelProviderStateReadsConfigTomlFromCodexHome|TestApplyRelayServiceConfigToLocalV2.*SupportsWebsockets|TestApplyRelayServiceConfigToLocalWritesCustomProviderFacingFiles' -count=1
npm --prefix frontend run test:unit -- src/features/accounts/tests/accountLocalCliMapping.test.mjs src/features/status/tests/relayLocalState.test.mjs
npm --prefix frontend run typecheck
bash docs-linhay/scripts/check-docs.sh
```

真实冒烟（2026-06-04）：

- 已执行 `./scripts/ensure-sidecar.sh darwin arm64`，按当前 dirty CLIProxyAPI source 重建 `build/bin/cli-proxy-api`。
- 从 `~/.config/gettokens-dev` 复制临时配置到 `/tmp/gettokens-codex-smoke.*`，将 sidecar 端口改为 `28317`，`auth-dir` 和 `account-store-db` 均指向临时副本。
- 启动临时 sidecar 后，`GET /v1/models?client_version=0.136.0` 返回 `200`，包含 `gpt-5.5`。
- 隔离 `CODEX_HOME` 写入 provider `base_url = "http://127.0.0.1:28317/v1"`、`wire_api = "responses"`、`supports_websockets = false`，`auth.json` 只写本地 relay key。
- 执行 `codex -a never exec --skip-git-repo-check --ephemeral --sandbox read-only --model gpt-5.5 --output-last-message ... 'Reply with ok'`，exit code `0`，最后消息 `ok`。
- 临时 sidecar 日志显示 `POST "/v1/responses"`，未出现 WebSocket upgrade 或 `codex websockets: upstream connected`。
- 验证后停止临时 sidecar，删除临时目录。

未执行项：

- 未重建并替换正式版 sidecar。
- 未触碰 `/Applications/GetTokens.app`、正式版 sidecar 或正式配置。
