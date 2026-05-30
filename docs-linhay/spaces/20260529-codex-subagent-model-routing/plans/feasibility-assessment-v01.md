# Codex Subagent Model Routing 可行性判断 v01

## 结论

源码确认后，方案从“中等可行”上调为“高可行”。本期范围明确收敛为只处理 `x-openai-subagent` 场景。

可落地路径是“请求级能力路由”：Codex 请求已经会在 subagent 会话下发送 `x-openai-subagent` header，且请求 payload 本身携带目标 `model`。sidecar 只消费 `x-openai-subagent + model` 这两个热路径输入，复用现有 channel routing、模型映射、账号能力和 route guard 完成账号选择。

不进入当前范围：具体 `agent_role` / `agent_type` 路由。`ThreadSpawn` 源数据虽然保留 `agent_role`，但 HTTP header 只输出统一值 `collab_spawn`。既然当前决策只处理 `x-openai-subagent`，sidecar 不做 role 推断，也不设计额外 header / metadata 扩展。

## Codex 源码证据

参考源码：`/Users/linhey/.nolon/references/github.com/openai@codex`，HEAD `e6773f8 Feat: Preserve network access on read-only sandbox policies (#13409)`。

1. `codex-rs/core/src/client.rs` 的 `build_subagent_headers()` 在 `SessionSource::SubAgent` 时写入 `x-openai-subagent`。
2. header 映射为：`Review -> review`、`Compact -> compact`、`MemoryConsolidation -> memory_consolidation`、`ThreadSpawn { .. } -> collab_spawn`、`Other(label) -> label`。
3. `codex-rs/core/tests/responses_headers.rs` 已有 Responses streaming 测试，断言 review / other subagent 请求会带 `x-openai-subagent`。
4. `codex-rs/protocol/src/protocol.rs` 的 `SubAgentSource::ThreadSpawn` 保留 `agent_role`，但当前 `client.rs` 的 header 构造没有把该字段写出；因此本期不把 role 作为 sidecar 路由输入。

## 真实请求字段校准

用户提供的 Codex TUI `0.133.0` 真实 `/v1/responses` 请求显示，运行态 headers 比本地源码快照中的静态 `TurnMetadataBag` 更丰富。字段结构按真实抓包校准如下，凭证值不记录：

```http
POST /v1/responses HTTP/1.1
Host: <redacted>
User-Agent: codex-tui/0.133.0 (...)
Accept: text/event-stream
Authorization: Bearer <redacted>
Content-Type: application/json
Originator: codex-tui
Session_id: <session-id>
X-Client-Request-Id: <client-request-id>
X-Codex-Beta-Features: terminal_resize_reflow
X-Codex-Turn-Metadata: {
  "session_id": "<session-id>",
  "thread_id": "<thread-id>",
  "thread_source": "user",
  "turn_id": "<turn-id>",
  "workspaces": {
    "<repo-path>": {
      "associated_remote_urls": {
        "origin": "<git-remote>"
      },
      "latest_git_commit_hash": "<commit>",
      "has_changes": false
    }
  },
  "sandbox": "none",
  "turn_started_at_unix_ms": <unix-ms>
}
```

1. 独立 HTTP headers：
   - `Session_id`: 当前 Codex session / thread id。
   - `X-Client-Request-Id`: 客户端请求 id；样例中与 `Session_id` 相同。
   - `X-Codex-Beta-Features`: beta feature 列表，例如 `terminal_resize_reflow`。
   - `X-Codex-Turn-Metadata`: JSON 字符串。
   - `X-OpenAI-Subagent`: 仅 subagent 请求才关注；样例主线程请求未出现该 header。
2. `X-Codex-Turn-Metadata` 展开字段：
   - `session_id`: 与独立 `Session_id` 对应。
   - `thread_id`: 当前 thread id；样例中与 `session_id` 相同。
   - `thread_source`: 当前 thread 来源；样例为 `user`。
   - `turn_id`: 当前 turn id。
   - `workspaces`: workspace git 元数据，key 为 repo path，值包含 `associated_remote_urls`、`latest_git_commit_hash`、`has_changes`。
   - `sandbox`: sandbox 标签，样例为 `none`。
   - `turn_started_at_unix_ms`: turn 开始时间戳。

sidecar P0 需要把这些字段当作同一请求上下文的观测信息，但路由触发条件仍然只以 `X-OpenAI-Subagent` 是否存在及其值为准；不把 `thread_source` 当作 subagent 判定的替代信号。

## 当前可复用基础

1. `AccountRecord` 已有 `models[]`、`supportedFormats`、`formatBaseUrls`，能表达账号可支持的模型与 OpenAI Responses 兼容入口。
2. `CodexModel` / `OpenAICompatibleModel` 已有 `name + alias` 模型映射结构，可承载“Codex 请求模型 -> 真实上游模型”的规范化。
3. `channel-routing/config.json` 已是 Codex runtime routing 的主路径，支持 `sequential / balanced`、候选过滤、explain 和 runtime state。
4. sidecar route policy 已支持 allow / deny / order / fallback，且 disabled、cooldown、model availability 在候选选择前就会参与过滤。
5. Codex feature config 中已有 `multi_agent` 稳定开关和 `multi_agent_v2` under development 入口，说明上游能力处于演进中，但不等于已有稳定 per-subagent model schema。

## 最大风险

已解除的风险：请求级 subagent 身份不是空白。Codex HTTP 请求可通过 `x-openai-subagent` 区分普通主 agent 与 subagent。

边界风险：当前 header 不能区分具体 `agent_type` / role。对所有 `spawn_agent` 创建的 thread subagent，sidecar 只能看到 `collab_spawn`。本期接受这个边界，只把 `review` / `compact` / `memory_consolidation` / `collab_spawn` / `Other(label)` 等 `x-openai-subagent` 值作为 subagent source。

该风险影响：

1. usage attribution 只能精确到 subagent source，不能精确到 `explorer` / `worker`。
2. live sessions 只能展示 subagent source，不能展示具体 role。
3. fallback 只能按 subagent source / model 生效，不能只对某个 role 生效。
4. route explain 不能解释“因为 agent_type=xxx 命中账号”。

## 推荐方向

1. P0 不需要等待大规模请求观测才能立项；源码已经证明存在 `x-openai-subagent`。但实现前仍应做一次脱敏端到端验证，确认 GetTokens sidecar 实际收到的 header 没被代理链路剥离。
2. 新增 `requestKind=subagent` / `subagentSource` / `targetModel` 规范化层，再接 channel routing。
3. 对 `ThreadSpawn`，只使用 `subagentSource=collab_spawn` 加 `model` 路由；不承诺 role 级路由。
4. 模型判断必须先规范化：OAuth/auth-file 继续默认同名透传，openai-compatible 使用 `models[].name -> models[].alias || name`。
5. fallback 默认 fail-closed，除非用户显式允许降级；降级时 usage/log 必须保留原始目标模型和实际命中模型。
6. observability 读取 `Session_id`、`X-Client-Request-Id` 和 `X-Codex-Turn-Metadata`，用于关联 session / thread / turn / workspace；不要把这些字段混入账号选择条件，除非后续另立需求。

## 不建议方向

1. 不建议只在 GetTokens UI 增加“subagent model”配置项；即使 Codex 已有请求级信号，也必须由 sidecar relay / route policy 在热路径中消费并可解释。
2. 不建议新增第三种 route mode；现有 Codex route mode 应继续保持 `sequential / balanced`。
3. 不建议把 subagent 特例写进普通账号优先级；这会污染主 agent 请求顺序。
4. 不建议依赖旧 `X-GetTokens-Route-*` 作为正式配置入口；它适合 probe/debug，不适合 runtime 主路径。

## 最小可落地切片

### P0：请求信号验证与模型能力路由

1. 打开 Codex multi-agent 能力，构造主 agent 与 thread subagent 请求。
2. 在 sidecar relay 层读取 allowlist header：`x-openai-subagent`。
3. 读取请求 body 中的 `model`，完成 target model 规范化。
4. 新增纯函数：输入 `subagentSource`、请求模型、账号模型映射、账号状态，输出候选账号与过滤原因。
5. 接入 channel routing explain，新增过滤原因 `model-unsupported` / `model-alias-miss`。
6. 验收：主 agent 请求无 `x-openai-subagent`，subagent 请求有 `x-openai-subagent=collab_spawn` 或其他已知值；sidecar 按目标模型选择支持账号。

### P1：脱敏观测与归因闭环

1. 形成测试 fixture：主 agent、review/compact、thread spawn、Other label 四类请求。
2. usage attribution / live sessions 增加 `subagentSource` 字段。
3. 覆盖 OAuth 同名透传、openai-compatible alias、未知模型、excluded model。
4. 验收：普通主 agent 请求不受 subagent 模型配置影响；usage/log 能区分主 agent 与 subagent source。

### 暂不进入：role 级路由

当前明确只处理 `x-openai-subagent` 场景，因此 role 级路由不作为本 space 的实现目标。后续如果重新打开该需求，应另开 space 或新版本方案，重新评估 Codex 是否需要扩展 header / metadata。

## 可行性评级

1. 按模型能力路由：高可行，已有账号模型、alias、channel routing 基础。
2. 按 subagent 身份路由：高可行，Codex 已有 `x-openai-subagent`。
3. 按具体 role 路由：本期不处理，不进入可行性评级。
4. 完整 UI + sidecar + usage/live sessions 闭环：可行，但建议先完成 P0/P1，不宜一次做完。
