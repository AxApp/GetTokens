# Codex Subagent Model Routing

## 背景

Codex 主 agent 在执行复杂任务时会使用 subagent 承担调研、实现、审查或验证等子任务。当前需要讨论一种配置能力：允许在 Codex 侧为 subagent 指定特殊模型，并在 GetTokens sidecar 侧把这类请求路由到支持对应模型、能力或配额策略的账号。

该需求关系到 Codex 请求识别、模型映射、账号池能力声明、sidecar 热路径路由和使用量归因。讨论阶段先明确契约边界，避免前端或本地配置只展示“已配置”，但 sidecar 实际没有按 subagent 模型能力完成账号选择。

## 目标

1. 明确 Codex 下 subagent 特殊模型配置的用户侧表达方式。
2. 明确 sidecar 如何识别“subagent 请求”和“普通 Codex 请求”的路由差异。
3. 明确账号池需要暴露哪些能力字段，才能判断某个账号是否支持目标 subagent 模型。
4. 明确模型别名、fallback、rate-limit、usage attribution 的边界。
5. 产出可进入实现阶段的验收场景、接口契约和风险清单。

## 范围

1. Codex subagent 模型配置的需求语义和配置来源。
2. sidecar 的账号选择规则、模型支持判断、fallback 策略和错误表达。
3. Codex 请求链路中的 `x-openai-subagent` header 与 body `model` 识别边界。
4. 账号能力与模型映射在 GetTokens 本地数据结构中的落点。
5. 测试策略：单元测试覆盖路由决策，集成测试覆盖 sidecar 请求到账号选择闭环。

## 非目标

1. 本 space 不直接实现 UI 设计稿或具体代码。
2. 不重新设计整个账号池、quota 或 provider 体系。
3. 不把 subagent 模型路由伪装成前端状态；sidecar 必须能独立闭环。
4. 不讨论与 Codex 无关的 Claude Code、OpenAI-compatible 通用路由扩展，除非它们是必要的抽象边界。
5. 不处理具体 `agent_role` / `agent_type` 路由，也不设计新的 Codex header / metadata 扩展。

## 验收标准

### 场景 1：subagent 指定特殊模型并命中支持账号

Given Codex 为 subagent 请求指定了模型 `subagent-model-a`
And 账号池中至少有一个 Codex 账号声明支持该模型
When sidecar 收到该 subagent 请求
Then sidecar 选择支持 `subagent-model-a` 的账号
And usage attribution 能标记该请求来自 subagent 路由。

### 场景 2：普通 Codex 请求不被 subagent 配置污染

Given 用户只为 subagent 配置了特殊模型
When 普通 Codex 主 agent 请求进入 sidecar
Then sidecar 仍按普通 Codex 路由策略选账号
And 不因为 subagent 模型配置改变默认模型或默认账号顺序。

### 场景 3：目标模型无可用账号时有明确失败或 fallback

Given Codex subagent 请求指定了特殊模型
And 当前账号池没有可用账号支持该模型
When sidecar 执行账号选择
Then sidecar 返回可诊断的错误或按已确认的 fallback 规则降级
And 失败原因能区分“模型不支持”“账号 rate-limit”“账号不可用”。

### 场景 4：模型别名与 provider 能力声明一致

Given provider 侧模型名称与 Codex 配置名称可能存在别名
When sidecar 判断账号是否支持目标 subagent 模型
Then 使用统一模型映射表完成规范化
And 测试覆盖别名命中、未知别名、显式禁用三类边界。

## 待讨论问题

1. sidecar 不再消费 `x-openai-subagent` 做路由判断；该 header 只按 Codex client context allowlist 透传给上游。
2. `ThreadSpawn` 当前 header 只有 `collab_spawn`，本期不作为 sidecar 账号选择输入。
3. sidecar 如何把 `Session_id`、`X-Client-Request-Id`、`X-Codex-Turn-Metadata.session_id/thread_id/thread_source/turn_id/turn_started_at_unix_ms` 作为观测上下文保存，但不混入账号选择条件。
4. fallback 策略是强失败、降级到默认 Codex 模型，还是只在用户显式允许时降级。
5. 账号能力字段是否需要区分“可路由模型”“默认模型”“高成本模型”“仅 subagent 可用模型”。
6. usage / live sessions / route guard 是否需要新增 subagent source 维度。

## 初始技术假设

1. sidecar 是账号选择和 runtime 状态的唯一可信闭环，前端只展示和配置，不承担热路径补偿。
2. 请求路由应先完成模型规范化，再做账号过滤、rate-limit 判断和请求归因。
3. 账号选择只以请求 body `model` 进入现有模型能力过滤和 routing policy；不根据 `x-openai-subagent` 区分主 agent / subagent。
4. 本期不读取、不推断、不扩展具体 role；`x-openai-subagent` 只做上游透传。
5. 实现阶段应优先补 CLIProxyAPI fork / sidecar 路由单元测试，再接 GetTokens UI 或配置入口。

## 源码校准

- Codex 源码位置：`/Users/linhey/.nolon/references/github.com/openai@codex`
- 源码版本：`e6773f8 Feat: Preserve network access on read-only sandbox policies (#13409)`
- 关键结论：`codex-rs/core/src/client.rs` 会为 `SessionSource::SubAgent` 写入 `x-openai-subagent`；`codex-rs/protocol/src/protocol.rs` 保留 `ThreadSpawn.agent_role`，但当前 header 对 thread spawn 只输出 `collab_spawn`。
- 2026-05-30 追加：按 OpenAI Codex 最新源码 `/tmp/openai-codex-src` commit `3e7baa00e43419967d90d6ad9cef40f58d5ac89f` 复查后，GetTokens 本期不再使用 `x-openai-subagent` 做 sidecar 内部判断；sidecar 上游请求仍需同步 Codex latest Responses client context，包括 installation id、turn state/metadata、parent thread、window id、subagent、memgen、attestation、`session-id`、`thread-id` 等 header。

## 真实请求校准

用户提供的 Codex TUI `0.133.0` 真实 `/v1/responses` 请求显示：

1. `Session_id` 是独立 HTTP header。
2. `X-Client-Request-Id` 是独立 HTTP header。
3. `X-Codex-Turn-Metadata` 是 JSON header，已包含 `session_id`、`thread_id`、`thread_source`、`turn_id`、`workspaces`、`sandbox`、`turn_started_at_unix_ms`。
4. 样例为主线程请求，未出现 `X-OpenAI-Subagent`；GetTokens sidecar 账号选择不再依赖该 header。
5. 真实请求中的 Authorization / token 不进入文档与日志。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## 执行交接

- CLIProxyAPI 请求链路与 `CodexRequestContext` 执行交接：`plans/cliproxyapi-request-flow-and-context-handoff.md`

## Worktree 映射

- branch：`feat/20260529-codex-subagent-model-routing`
- worktree：`../GetTokens-worktrees/20260529-codex-subagent-model-routing/`

## 相关链接

- 相关治理规则：`AGENTS.md` 中 sidecar 自治层、Codex 账号列表和 space/worktree 规则。
- 可行性判断：`plans/feasibility-assessment-v01.md`
- 技术调研方案：`plans/technical-research-v02.md`
- 历史调研快照：`plans/technical-research-v01.md`

## 当前状态

- 状态：P0 implemented in sidecar checkout
- 最近更新：2026-05-30
- 同步校准：已从本地 `master` 同步到 `232f573`；最新 sidecar 修改范围按 gitlink `c6f35c108cfd8b0060d27e8c63797609e3035c0f` 校准，旧 `RoutePolicy` / `X-GetTokens-Route-*` 不再作为实现入口。
- 执行结果：已在 sidecar checkout `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI` 落地 P0。
  - 新增 `internal/gettokenscodex.RequestContext`，从 decoded body 和 allowlist headers 解析 `requestKind/requestedModel/sessionID/clientRequestID/threadID/threadSource/turnID/turnStartedAtUnixMs`；不再保存或判断 `subagentSource`。
  - `sdk/api/handlers` 在 Codex Responses handler 上解析一次并写入 `executor.Options.Metadata`；非 Codex handler 不注入。
  - `internal/gettokensrouting.RouteContext` 增加 typed `CodexRequest`，`sdk/cliproxy/auth` 从 metadata 贯通给 routing policy。
  - HTTP `applyCodexHeaders()` 与 WebSocket `applyCodexWebsocketHeaders()` 复用统一 Codex Responses client context allowlist，补齐 installation、turn state/metadata、parent thread、window、subagent 透传、memgen、attestation、`session-id`、`thread-id`。
- 验证：sidecar `go test ./...` 通过；`go build -o test-output ./cmd/server` 通过，临时二进制已删除。
- 冒烟补充：已新增 sidecar 上下游模拟收发测试 `sdk/api/handlers/openai/openai_responses_model_routing_smoke_test.go`。
  - HTTP：downstream `POST /v1/responses` -> handler -> auth manager -> Codex executor -> mock upstream `/responses`，断言 upstream 收到 client context headers、body model/input，mock SSE response 回流到 downstream。
  - WebSocket：downstream `GET /v1/responses/ws` -> handler -> auth manager -> Codex WebSocket executor -> mock upstream WS `/responses`，断言 upstream handshake headers、upstream `response.create` body、mock `response.completed` 回流到 downstream。
  - 两条 smoke 均断言 routing policy 可读取 typed `CodexRequest.requestedModel`，且 inbound `Authorization` / `Cookie` 不会透传到 upstream。
- 冒烟验证：`go test ./sdk/api/handlers/openai -run 'TestCodexModelRoutingResponses.*Smoke' -count=1 -v` 通过；随后 `go test ./sdk/api/handlers/openai ./internal/runtime/executor ./sdk/api/handlers ./sdk/cliproxy/auth ./internal/gettokenscodex ./internal/gettokensrouting -count=1` 与 sidecar `go test ./...` 均通过。
- 剩余范围：P1 仍可接 live sessions / usage attribution / route explain 的模型、session、thread、turn 观测字段；P2 如需候选 scope，也必须以模型和显式 sidecar 配置为准，不以 `X-OpenAI-Subagent` 做账号选择。

## 2026-06-02 DeepSeek account-store runtime 修正

- 背景：Codex `/model` 已能展示 `deepseek-v4-flash`，但真实请求失败为 `auth_unavailable: no auth available (providers=codex, model=deepseek-v4-flash)`。
- 根因：SQLite account-store 作为运行态真源后，openai-compatible 账号合成出的 runtime auth 没有携带非敏感 `openai_compat_models`；模型注册阶段不应再把旧 `config.OpenAICompatibility` 当运行时 fallback。缺少自描述模型声明时，account-store DeepSeek auth 没有注册到 model registry，最终 registry 只剩 Codex 静态 DeepSeek catalog，provider set 被收窄成 `codex`。
- 修复：account-store openai-compatible auth 合成时写入 `openai_compat_models` attribute；DeepSeek 默认模型只在 account-store 合成阶段 materialize；`sdk/cliproxy` 注册阶段只消费 auth attributes，不反查旧 config provider。
- 验证：`go test ./internal/watcher/synthesizer ./sdk/cliproxy ./sdk/api/handlers/openai ./sdk/api/handlers ./sdk/cliproxy/auth ./internal/registry -count=1`、`go build -o test-output ./cmd/server` 与 `./scripts/ensure-sidecar.sh darwin arm64` 通过。
