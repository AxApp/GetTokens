# Responses WebSocket passthrough / XAI defer audit v01

## 背景

本审计承接 v7.2.16 Codex Responses WebSocket hardening。前序已完成或关闭：

- `response.done` / inline `type=error` terminal payload：已实现，fork commit `66558927`。
- `previous_response_id` / pending tool call incremental state：已实现，fork commit `19fbddc4`。
- input item ID dedupe：当前 fork 已满足，不做 port。
- handler-level incremental injection、pending output missing、`generate` fallback cleanup：当前 fork 已满足，不做 port。

复核 upstream test diff 后，剩余未进入 fork 的 WebSocket 类测试集中在 upstream passthrough 与 XAI executor 策略，不属于本期 response protocol hardening 的窄修范围。

## Upstream 参考测试

来自 v7.2.16 upstream `sdk/api/handlers/openai/openai_responses_websocket_test.go`：

- `TestResponsesWebsocketCodexWebsocketPassthroughPassesCompactedRequestWithoutTranscriptMerge`
- `TestResponsesWebsocketXAIWebsocketPassthroughCarriesPreviousResponseID`
- `TestWebsocketUpstreamSupportsIncrementalInputForXAI`
- `TestResponsesWebsocketUsesUpstreamWebsocketPassthroughForXAI`

对应 upstream code path：

- `responsesWebsocketUsesUpstreamWebsocketPassthrough`
- `normalizeResponsesWebsocketPassthroughRequest`
- provider allowlist 包含 `codex` / `xai`
- passthrough 分支绕过普通 transcript merge / replacement 路径，直接把 compacted 或 incremental request 交给 upstream websocket executor。

## 当前 fork 事实

- GetTokens fork 已有 sidecar-owned Codex WebSocket transport、route guard、live sessions、usage attribution、account selection、failure / guard failover 相关测试。
- `19fbddc4` 已在现有 GetTokens WebSocket handler 内实现上一轮 response id 与 pending tool call state，不需要引入 upstream passthrough 分支才能满足 OpenAI Responses incremental 场景。
- 当前 fork 已存在 XAI image/video handler 能力，但这不等同于允许 Responses WebSocket 走 XAI passthrough executor；XAI Responses WebSocket 需要独立产品与路由策略证据。

## 决策

结论：`defer-product-strategy-no-port`。

本期不 reference-port upstream passthrough / XAI WebSocket executor 能力，原因：

1. passthrough 分支会改变 GetTokens sidecar 对 Codex WebSocket 热路径的所有权边界；它可能绕过或削弱现有 transcript normalization、route guard、live sessions、usage attribution、account failover 证据链。
2. XAI Responses WebSocket 属于 provider / executor 新能力，不是 response protocol bug fix；需要先定义 GetTokens model catalog、账号能力、路由选择、fake upstream 验证和用户可见开关语义。
3. 本期目标是 Codex Responses protocol hardening：terminal/error payload、incremental state、dedupe 与 handler integration；前述目标已通过实现或 already-satisfied 审计关闭。

## 非目标

- 不引入 `responsesWebsocketUsesUpstreamWebsocketPassthrough`。
- 不引入 XAI Responses WebSocket passthrough executor。
- 不调整 GetTokens model catalog / provider routing / account capability。
- 不改变 Codex WebSocket route guard、live sessions、usage attribution 或 failure budget 语义。
- 不为了通过 upstream passthrough tests 而复制 upstream handler 分支。

## 后续入口

若后续要评估该能力，应从 intake 的 Phase 5 拆独立 space：

- `model-catalog-compat`
- `xai-antigravity-executor-compat`

进入实现前必须先补齐 evidence gate：

- 用户可见场景或明确产品需求。
- 当前 GetTokens model catalog / account capability 的缺口证明。
- fake upstream XAI WebSocket executor tests。
- route selection / route guard / live sessions / usage attribution 不被绕过的回归测试。
- clean sidecar rebuild 与 dev App 或 API-level 验收证据。

## 验收记录

- 本审计为策略性 deferral，无 fork 代码变更。
- 不新增 fork commit，不重建 sidecar。
- 既有最新 sidecar 仍为 `19fbddc44e54258f7ebc8e83ae92c69394eae853:clean:17808a42f6643e93d0485bc67e32d66b2853372cb3223690bc24d3485f59aefb:darwin:arm64`。
- 本期 response hardening space 的 WebSocket upstream diff 关闭状态：
  - terminal/error payload：implemented。
  - incremental state：implemented。
  - input ID dedupe：already-satisfied。
  - handler integration / generate fallback：already-satisfied。
  - passthrough / XAI executor：deferred to product strategy。
