# Codex WebSocket Interrupted Root Fix

## 背景
用户在 Codex 会话 `019e90ad-2afe-7b50-9c27-35d44246338d` 中使用：

- Model：`gpt-5.5`
- Provider：`GetTokens - http://cpa.host.dxy/v1`
- Directory：`~/Desktop/linhay-open-sources/GetTokens`
- Credentials：`API key configured`

运行期间大量出现：

```text
Conversation interrupted - tell the model what to do differently. Something went wrong?
Hit `/feedback` to report the issue.
```

正式 sidecar 日志 `/Users/linhey/.config/gettokens/sidecar.log` 已证明链路为：

1. Codex 通过 GetTokens relay 使用 WebSocket `/v1/responses`。
2. sidecar 选择 `codex:apikey:3df2001c2d1b`，`websockets=true`，上游连接 `ws://cpa.host.dxy/v1/responses`。
3. 上游在没有 `response.completed` 的情况下断开，sidecar 写出 `408 stream closed before response.completed`。
4. `AccountRouteGuardResultHook` 将 408 记录为 upstream transient guard。
5. 后续同模型请求只剩一个被 guard 的 auth，返回 `503 auth_unavailable: no auth available (providers=codex, model=gpt-5.5)`。
6. Codex TUI 把 turn abort 渲染为固定 `Conversation interrupted` 文案。

补充复核：用户指出“路由改造前这个功能是好的”。代码历史支持该判断：早期 WebSocket hot switch 只负责 pinned auth 释放和重连；`c9a91feb feat: converge gettokens account route guard pipeline` 之后，`AccountRouteGuardResultHook` 才把执行结果中的 `408` 纳入统一 route guard，并具备把一次 WS transport close 放大成 auth/model 全局不可用的条件。因此根治点不是删除 WebSocket，而是把 WS 传输失败从路由 guard / session failure budget 中隔离出来；默认 `supports_websockets=false` 只是新配置止血策略。

已构造可执行复现测试：

- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`
- `TestResponsesWebsocketMockUpstream408ThenRouteGuardUnavailable`

## 目标
1. 根本消除 GetTokens relay 默认使用 Codex WebSocket 导致的连续 interrupted。
2. 即使用户手动打开 WebSocket，WS 上游异常也不能把可用 auth 打成全局不可用，导致同模型连续 503。
3. 保留用户显式 opt-in WebSocket 的能力，且显式开启时必须同时支持 `ws://` 与 `wss://` 上游；但必须有可观测、可恢复、可回退的运行态保护。
4. 对存量已写入 `supports_websockets = true` 的本地 Codex 配置给出明确检测和显式修复路径。
5. 修复必须有 mock 上下游回归测试；真实 Codex CLI dev 冒烟作为发布前补验。

## 范围
本 space 覆盖：

- GetTokens 写入本地 Codex provider 的 `supports_websockets` 默认值与 diff 预览。
- 账号卡生成 Codex 本地应用草稿时的 WebSocket 默认策略。
- sidecar Codex WebSocket relay 在上游 408 / session_closed / abnormal close / timeout 时的 route guard 处理。
- 存量本地 Codex 配置风险检测和修复入口。
- 回归测试；dev sidecar 重建和隔离 `CODEX_HOME` 真实 Codex CLI 冒烟留作发布前补验。

## 非目标
1. 不修改 `/Applications/GetTokens.app` 正式版二进制。
2. 不擅自改用户正式 `~/.codex/config.toml`；存量修复通过 dev 验证和用户显式应用完成。
3. 不移除 Codex WebSocket 支持；仅将其从默认路径降级为高级 opt-in。HTTPS upstream base URL 仍必须转换为 `wss://`。
4. 不为上游 `cpa.host.dxy` 的 WebSocket 稳定性做服务端兜底承诺；GetTokens 只保证自身 relay 和 route guard 不放大故障。
5. 不改变 401/402/403/429 等真实账号不可用、额度耗尽、鉴权失败的 route guard 语义。

## 验收标准
### BDD 场景

1. 新用户从 Status 页应用 GetTokens relay 到本地 Codex 时，预览和写入结果默认包含 `supports_websockets = false`，Codex 后续走 HTTP Responses。
2. 从账号卡生成 Codex 本地应用草稿时，默认 `supportsWebsockets=false`，除非用户显式开启高级 WebSocket。
3. 存量本地 Codex provider 指向 GetTokens relay 且 `supports_websockets=true` 时，UI 能检测为风险状态，并提供将其改为 `false` 的修复动作。
4. fake upstream WebSocket 返回 `408 stream closed before response.completed` 后，sidecar 不再把该 auth 作为全局不可用候选处理；后续 HTTP Responses 请求仍可使用同一 auth。
5. fake downstream Codex WebSocket 重连同模型时，不再出现连续 `503 auth_unavailable`；应触发 HTTP fallback 或明确的 WS circuit-breaker 行为。
5.1. 用户显式开启 WebSocket 且 upstream base URL 为 `https://...` 时，sidecar 必须使用 `wss://...` 连接上游，而不是降级或错误改成 `ws://`。
6. 401/429 等非 WS 传输型错误仍进入正确 route guard，不被本次修复误放行。
7. 发布前使用隔离 `CODEX_HOME` 和 dev sidecar 完成一次真实 `codex exec`，不出现连续 interrupted。

### 回归命令

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocket(MockUpstream408ThenRouteGuardUnavailable|ClosesOnCodexUpstreamDisconnect|ReleasesPinnedAuthAfterRouteGuardBlock|RequestBoundaryReleaseUsesRouteGuard)' -count=1
go test ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1
```

```bash
npm --prefix frontend run test:unit -- src/features/accounts/tests/accountLocalCliMapping.test.mjs src/features/status/tests/relayLocalState.test.mjs
go test ./internal/wailsapp -run 'TestApplyRelayServiceConfigToLocalV2.*SupportsWebsockets|TestApplyRelayServiceConfigToLocalWritesCustomProviderFacingFiles' -count=1
npm --prefix frontend run typecheck
```

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260604-codex-websocket-interruption-fix`
- worktree：`../GetTokens-worktrees/20260604-codex-websocket-interruption-fix/`

## 相关链接
- 复现测试：`docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`
- Codex interrupted 文案：`docs-linhay/references/codex/codex-rs/tui/src/chatwidget/turn_runtime.rs`
- Codex provider WebSocket URL 构造：`docs-linhay/references/codex/codex-rs/codex-api/src/provider.rs`
- Codex WS stream close：`docs-linhay/references/codex/codex-rs/codex-api/src/endpoint/responses_websocket.rs`
- CLIProxyAPI WS relay：`docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
- CLIProxyAPI Codex WS executor：`docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
- 方案：`plans/root-fix-plan.md`

## 当前状态
- 状态：implemented in dev source
- 已完成：默认 `supports_websockets=false`、账号卡 Codex draft 默认 false、存量本地 provider WS 风险提示、sidecar `ws/wss` URL 支持对齐 Codex、sidecar WS transport failure circuit breaker、WS handshake/dial/send 失败 transport 标记、mock 上下游回归测试。
- 已验证：sidecar `sdk/cliproxy/auth` + `sdk/api/handlers/openai`、sidecar executor `ws/wss` URL 测试、Wails local apply 局部测试、前端全量 unit、前端 typecheck、文档结构校验、相关 diff 空白检查、真实 Codex CLI + 隔离 `CODEX_HOME` + 临时 dev sidecar 冒烟。
- 真实冒烟结果：2026-06-04 使用临时复制的 `gettokens-dev` 配置启动 sidecar `:28317`，隔离 `CODEX_HOME` provider 写入 `supports_websockets=false`，`codex -a never exec --skip-git-repo-check --ephemeral --sandbox read-only --model gpt-5.5 --output-last-message ... 'Reply with ok'` exit code `0`，最后消息 `ok`；sidecar 日志为 `POST "/v1/responses"`，没有 WebSocket upgrade / upstream connected 日志。
- 未触碰：`/Applications/GetTokens.app` 正式版、正式 sidecar、正式配置。
- 最近更新：2026-06-04
