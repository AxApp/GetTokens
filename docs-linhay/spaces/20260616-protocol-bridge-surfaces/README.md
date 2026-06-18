# Protocol Bridge Surfaces

## 背景

本 space 承接 OmniRoute 借鉴能力评估中的中期方向：`protocol bridge`。

如果 GetTokens 后续需要把账号摘要、模型目录、路由诊断、quota summary 或安全操作暴露给外部 agent，需要一个桥接层。该桥接层只能暴露 GetTokens 自身已有能力，不能变成第二套运行时或第二套路由真源。

## 目标

1. 定义第一批 bridge capability surface。
2. 明确 scope、auth、audit 边界。
3. 评估 MCP / A2A / OpenAI-compatible admin surface 的适配顺序。

## 范围

- 只读能力：accounts summary、supported models、route diagnostics、quota summary。
- 显式安全写操作：受控 trigger，例如 routeability recheck。
- 协议适配设计与安全约束。

## 非目标

- 不在 bridge 层维护 candidate pool。
- 不在 bridge 层保存独立 route state。
- 不让外部协议直接绕过 sidecar authority。

## 验收标准

- 每个 bridge capability 都能追溯到 sidecar / Wails authority。
- scope 和 audit model 明确。
- 给出推荐 transport 顺序和不做项。
- 文档能直接作为后续实现 space 的输入。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-protocol-bridge-surfaces`
- worktree：`../GetTokens-worktrees/20260616-protocol-bridge-surfaces/`

## 相关链接

- 总架构：[docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)
- 技术方案：[docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md:1)
- Bridge surface schema：[schemas/bridge-surface-v1.schema.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/schemas/bridge-surface-v1.schema.json:1)
- Canonical operations：[schemas/canonical-operations-v01.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/schemas/canonical-operations-v01.json:1)
- MCP adapter mapping：[schemas/mcp-adapter-mapping-v01.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/schemas/mcp-adapter-mapping-v01.json:1)
- Examples：[examples/read-surface-success-response.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/examples/read-surface-success-response.json:1)、[examples/safe-action-accepted-response.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/examples/safe-action-accepted-response.json:1)、[examples/rejected-missing-scope-response.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/examples/rejected-missing-scope-response.json:1)

## 当前状态
- 状态：protocol-bridge-final-completion-wave-unrestricted-real-pass
- 最近更新：2026-06-18
- 当前输出：`schemas/bridge-surface-v1.schema.json`、`schemas/canonical-operations-v01.json`、`schemas/mcp-adapter-mapping-v01.json`、`examples/*.json`、`plans/20260616-scoped-auth-audit-runtime-plan-v01.md`、`plans/20260617-sidecar-execution-binding-slice-v01.md`、`plans/20260617-round12-real-http-client-boundary.md`、`plans/20260617-round13-transport-factory-boundary.md`、`plans/20260617-round14-stdio-transport-preflight.md`、`plans/20260617-round15-stdio-query-schema-allowlist-preflight.md`、`plans/20260617-round16-stdio-query-type-required-preflight.md`、`plans/20260617-round17-stdio-query-enum-preflight.md`、`plans/20260617-round18-inprocess-mcp-stdio-jsonrpc-handler.md`、`plans/20260617-round19-stdio-lifecycle-audit-persistence.md`、`plans/20260617-round20-external-stdio-durable-audit.md`、`plans/20260617-round21-mcp-initialize-audit-query.md`、`plans/20260617-round22-tools-resources-list-audit-pagination.md`、`plans/20260617-round23-list-pagination-stable-audit-cursor.md`、`plans/20260617-round24-no-network-verifier.md`、`plans/20260617-round25-no-network-suite-split.md`、`plans/20260618-round26-unrestricted-smoke-boundary.md`、`plans/20260618-round27-listener-tests-quarantine.md`、`plans/20260618-final-completion-wave-protocol-unrestricted.md`、`internal/protocolbridge`、`internal/protocolbridge/sidecar_http_unrestricted_listener_test.go`、`docs-linhay/scripts/check-protocolbridge-no-network.mjs`、`docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs`
- 已落地：最小 Go runtime core 包 `internal/protocolbridge`，覆盖 bridge client、scope grant、token hash 校验、transport allowlist、loopback-only caller / peer context 校验、disabled / expired 拒绝、精确 scope 匹配、active actor scope 投影、safe action idempotency key 要求、sidecar authority 引用和 redacted audit projection。
- Reviewer 修复：request schema 不再接受外部 `actor`，`actor` 只作为 bridge auth 生成的 response / audit 字段；loopback-only client 缺 caller 或非 loopback caller 会以 `loopback_required` audit code 在 bridge boundary 拒绝且不触达 sidecar。
- MCP adapter 前置 fixture：`schemas/mcp-adapter-mapping-v01.json` 已固化 MCP tool/resource 到 canonical operation 的映射；Go validator 和 OmniRoute artifact validator 会校验 tool 一一映射、required scope 对齐、safe action idempotency、canonical query / response envelope 复用，以及 resources 只暴露 manifest / schema / scope list。
- MCP adapter handler contract：`internal/protocolbridge.MCPAdapter` 已能按 mapping fixture 将 MCP tool 请求映射到 canonical operation，先走 `Runtime.Authorize`，授权成功后才调用 `OperationExecutor` fakeable interface 并返回 canonical envelope；read 返回 executor data，safe action 只返回 accepted operation ref / sidecar operation id，不声称 action 已完成。
- Sidecar execution binding slice：`OperationExecutor` 成功结果已收敛为 sidecar read envelope / accepted action ref 两类；`StubOperationExecutor` 可用于后续 sidecar runner 替换前的契约测试；adapter 成功执行路径统一标记 `sidecar_invoked=true`，但仍只表示进入 sidecar execution binding contract，不代表真实 transport 已实现；audit persistence 目前只提供 interface + no-op/stub 接口，不落真实持久层。
- Sidecar runner contract slice：新增 `SidecarHTTPExecutor` 与 fake `SidecarTransport` 契约测试，已固化 canonical operation -> sidecar request path/body/header 映射；请求只透传授权后的 actor / authority / canonical query，safe action 仅通过 `X-GetTokens-Bridge-Idempotency-Key-SHA256` 传递幂等哈希，不传 raw token、Authorization、Cookie 或明文 idempotency key；read response 继续返回 sidecar-authority data envelope，safe action 继续只返回 accepted operation ref。
- Sidecar HTTP failure taxonomy：HTTP non-2xx、transport/timeout error、malformed JSON 统一收敛为 canonical `sidecar_unavailable` rejected envelope；sidecar 返回 `status=rejected` 时收敛为 canonical `operation_rejected` rejected envelope；response 可带安全的 `sidecar_error_code`，但 `error.message`、`sidecar_error_code`、audit projection 和测试 fixture 均不得泄露 Authorization、Cookie 或明文 idempotency key。
- Real HTTP client boundary：`internal/protocolbridge` 已新增真实 `NewSidecarHTTPTransport(baseURL, options...)` 构造边界，base URL 只允许显式 loopback / `localhost` 的 `http(s)` endpoint，拒绝 userinfo、query、fragment 与非 loopback host；transport 支持注入 `http.Client`、timeout 和可选 bearer token，且 bearer token 只进入真实 outbound HTTP header，不回写到 canonical request body、bridge header、error 或 audit surface。
- Real HTTP transport verification：`httptest` 场景已证明真实 transport 下的 request path/body/header 与第十一轮 fake transport contract 一致；`Authorization: Bearer <token>` 只在 real HTTP boundary 注入；non-loopback / invalid endpoint 在构造阶段被拒绝；timeout、HTTP non-2xx、malformed JSON 与 rejected envelope 继续复用既有 canonical taxonomy。
- Transport factory boundary：`internal/protocolbridge` 已新增 `SidecarHTTPEndpoint` 与 `NewSidecarHTTPExecutorFromEndpoint(...)` 小型 factory contract，按 `profile_id + baseURL + timeout/http.Client + optional bearer token provider` 构造 `OperationExecutor`；factory 继续复用第十二轮 loopback/baseURL/timeout/header 防线，并在 executor 入口额外要求 `AuthorityOwnerSidecar` 且 `Authority.Endpoint` 必须与 canonical operation endpoint 匹配，authority 不匹配时以 canonical `invalid_request` 在触 sidecar 前拒绝。
- Factory verification：测试已证明 invalid endpoint 在 factory 构造阶段被拒绝且不会调用 token provider；factory 返回的 executor 被 `MCPAdapter` 调用时仍然先 `Runtime.Authorize` 再解析 token provider / 调 sidecar；provider 返回的 bearer token 只进入真实 outbound `Authorization` header，不进入 canonical request body、audit、error 或 MCP response。
- Resource handler contract：首期只允许 mapping fixture 中的 manifest、schema、scope list 三类 resource；unknown resource 在 adapter boundary 以 canonical rejected envelope 返回，resource response 不暴露 token hash、audit secret、Authorization header、cookie 或 credential material。
- MCP stdio transport preflight：`internal/protocolbridge.MCPStdioPreflight` 已把 mapping fixture allowlist、tool query schema allowlist 与 credential-bearing input 检测收敛为一层小型 contract helper；`MCPAdapter.HandleTool(...)` 保持先 `Runtime.Authorize`，授权成功后再做 stdio preflight 并决定是否进入 executor；`HandleResource(...)` 也会在返回 manifest/schema/scope list 前做同层 preflight。tool query 只允许各自 `query_schema_ref` 声明的 canonical 字段，schema 外 key（含 header / token / cookie 类）会以 canonical `invalid_request` 拒绝，`sidecar_invoked=false`，response / audit 不泄露 raw token、header 或 cookie。
- MCP stdio canonical query validation：在 round15 allowlist 基础上，`MCPStdioPreflight` 现已对当前 canonical query schema 增加最小 `required` / `type` 校验；仅覆盖现有 schema 需要的 `boolean`、`string`、`array[string]`，并对 `routesDiagnosticsInput` 强制 `protocol` + `model`。缺 required、类型错误、schema 外 key 都会在 executor 前以 canonical `invalid_request` 拒绝，`authorize -> stdio preflight -> executor` 顺序保持不变，safe action 缺 `idempotency_key` 仍由既有 authorize gate 处理。
- MCP stdio canonical query enum validation：在 round16 type/required 基础上，`MCPStdioPreflight` 已为当前 query schema 声明的 enum 增加最小 gate：`protocol` 仅允许 `codex` / `openai_responses` / `openai_chat` / `anthropic`，`detail_level`、`probe_mode` 与 `kinds[]` 按当前 schema enum 拒绝非法值。非法 enum 会在 executor 前以 canonical `invalid_request` 拒绝，`sidecar_invoked=false`；未授权请求仍先返回授权错误，不因 enum preflight 抢先暴露 schema 细节。
- In-process MCP stdio JSON-RPC handler：`MCPStdioJSONRPCServer` 已能从 in-memory reader 读取 JSON-RPC request，并把 `tools/call` / `resources/read` 分发到既有 `MCPAdapter`。`tools/call` 已由测试证明会经过 `Runtime.Authorize -> MCPStdioPreflight -> OperationExecutor`；`resources/read` 只允许 mapping fixture URI；credential-bearing input 与 schema 外 query 仍在 executor 前拒绝；executor/canonical error response 不回显 token、Authorization header、Cookie 或 secret-like sidecar error code。本轮仍不启动外部 stdio 进程，不接真实 sidecar endpoint，不落 audit persistence。
- Stdio lifecycle wrapper：`MCPStdioLifecycleWrapper` 已能包裹现有 in-process JSON-RPC handler，提供 `Serve` / `Shutdown`，并通过 context cancel 或 shutdown 关闭可关闭 reader/writer 解除阻塞；malformed JSON-RPC payload 只返回通用 parse error，不回显 token、Authorization header、Cookie 或 bearer 内容。本轮仍不启动外部 stdio 进程，不做真实 MCP capabilities negotiation。
- Audit persistence skeleton：`AuditPersister` 注入链路已覆盖 successful tool call、stdio preflight rejection 与 resource rejection；resource audit event 仅作为内部字段用于 persister，`json:"-"` 不暴露给 JSON-RPC response，且 resource rejection 不持久化 raw URI、token、header、cookie。当前仍不是真实 ledger/DB 持久层，不含 flush/retry/队列。
- External stdio wrapper：`MCPExternalStdioProcess` 已提供受控外部 stdio process skeleton，使用 `exec.CommandContext` 绑定 stdin/stdout/stderr，测试通过 Go helper process 验证 start、JSON-RPC request、context shutdown、stderr / exit error 脱敏边界；本轮不启动真实 sidecar，不接真实 endpoint。
- Durable audit JSONL sink：`JSONLAuditSink` 已能将 `AuditEvent` 以 JSONL 追加写入文件，创建父目录并使用 `0600` 文件权限；写入前会脱敏 `TargetRefs` 与 `Authority.SourceNotes`，不落 raw token、Authorization header、Cookie、query 或 URI。当前仍不包含 rotation、fsync、batch flush、retry、schema migration 或 ledger query API。
- MCP initialize and audit query：`MCPStdioJSONRPCServer` 已支持 minimal `initialize` 响应，返回固定 protocol version、`gettokens-protocol-bridge` server info，以及 `tools` / `resources` capabilities，且不调用 executor / sidecar；`JSONLAuditReader` 已支持本地 JSONL 只读 query，按 `status`、`kind=read|safe_action` 与 `limit` 过滤，读取时继续脱敏 event 并统计 malformed line skip。
- MCP tools/resources list and stable audit pagination：`MCPStdioJSONRPCServer` 已支持 minimal `tools/list` 与 `resources/list`，只从本地 MCP mapping fixture 投影 tool/resource manifest，且不调用 executor / sidecar；list 请求支持可选 `limit` 与稳定 cursor token `pb-list-v1:<tools|resources>:<offset>`，malformed cursor / negative limit 会以 JSON-RPC invalid params 拒绝；`JSONLAuditReader` 已支持 `offset` 与 stable cursor pagination，返回 `next_cursor=pb-audit-v1:<offset>` / `has_more`，保持 latest-first 过滤语义，且 `Cursor` 不再接受裸数字 offset。
- Protocol no-network verifier：新增 `protocolbridge_no_network` build tag 下的 `TestProtocolBridgeNoNetworkVerifier` 与 `docs-linhay/scripts/check-protocolbridge-no-network.mjs`，在沙箱中通过 in-process MCP stdio handler、stub executor 与 `t.TempDir()` JSONL 覆盖 `tools/list` / `resources/list` cursor、wrong-kind cursor 拒绝、audit cursor/offset 等价和裸数字 audit cursor 拒绝；该 verifier 不导入 `httptest`、不监听端口、不启动真实 sidecar endpoint。
- Protocol listener tests quarantine：4 个依赖 localhost listener / `httptest.NewServer` 的 top-level tests 已迁入 `internal/protocolbridge/sidecar_http_unrestricted_listener_test.go`，并使用 build tag `protocolbridge_unrestricted_listener` 显式运行；默认 `go test -count=1 ./internal/protocolbridge` 现在只包含 63 个 no-listener top-level tests，不再把受限沙箱 bind 限制误报为实现失败。
- Protocol no-network suite split：`docs-linhay/scripts/check-protocolbridge-no-network.mjs` 现按三段边界发现和验证测试面：63 个 default package gate tests、1 个 `protocolbridge_no_network` tag-only verifier、4 个 `protocolbridge_unrestricted_listener` tests。脚本只运行 default package gate + tag-only verifier，并把 tagged listener suite 留给独立 smoke。
- Protocol unrestricted smoke boundary：`docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs` 现只运行 `protocolbridge_unrestricted_listener` tagged listener suite，并继续输出结构化分类：`passed`、`localhost_listen_restriction_only` 或 `real_test_failure`；当 suite 全部通过时额外输出 `environment_conclusion="real_unrestricted_pass"` 与 `real_unrestricted_pass=true`。
- Final Completion Wave unrestricted pass：2026-06-18 当前 full-access 环境下，`go test -count=1 -tags protocolbridge_unrestricted_listener ./internal/protocolbridge` 与 unrestricted smoke 均通过，4 个 listener tests 已证明 real HTTP transport / factory / taxonomy / deadline 的 localhost listener contract 可在非受限环境真实运行；默认 `go test -count=1 ./internal/protocolbridge` 与 no-network partition 同时保持通过。
- 下一步：完整 MCP capabilities negotiation、`notifications/initialized`、dynamic `listChanged`、stdio framing 兼容、跨会话 endpoint selector / runner factory、operation runner、完整 audit ledger 与 resource session 授权仍待后续切片；当前 external wrapper / JSONL sink 只证明受控进程 IO 和 durable audit skeleton，不在 bridge 层保存 route / quota / model truth，也不证明 sidecar 真实 runtime 已提供这些 endpoint。当前仍不是完整 JSON Schema 校验器，pattern、length、range、uniqueItems 不在 round21 范围内；audit stable cursor 仍映射 filtered latest-first offset，不具备 JSONL rotation / compaction 后跨文件稳定 ledger cursor 语义。

## Contract Artifact Validator

进入 scoped auth / audit runtime 或 MCP adapter 实现前先运行轻量契约 artifact 门禁：

```bash
node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs
```

该脚本会校验 canonical operations、bridge schema、MCP adapter mapping fixture、missing-scope example 与 scoped auth / audit 计划是否保持一致，并联动检查 Extension Contract v0 的 schema / examples。
