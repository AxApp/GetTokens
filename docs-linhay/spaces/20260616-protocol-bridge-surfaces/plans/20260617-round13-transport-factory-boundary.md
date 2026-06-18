# Protocol Bridge Transport Factory Boundary v01

日期：2026-06-17

## 1. 本轮目标

在 `internal/protocolbridge` 内新增一个小的 executor factory / constructor boundary，把：

- sidecar endpoint `baseURL`
- profile id
- timeout / `http.Client`
- 可选 bearer token provider

收敛为一个安全的 `OperationExecutor` 构造入口，供后续 MCP adapter 按 sidecar endpoint 创建 executor。

本轮只做：

- package 内 endpoint -> executor 的 factory contract
- endpoint / profile 输入校验
- sidecar authority 预校验，避免 authority 不匹配时触 sidecar
- factory 返回 executor 的 MCP adapter 调用链测试
- token provider 注入测试，证明 token 不进入 canonical body / audit / error

本轮不做：

- MCP stdio server
- audit persistence
- route / quota / model truth 存储
- CLIProxyAPI reference 对齐
- sidecar endpoint 存活性证明

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮切片的约束 |
| --- | --- | --- |
| `README.md` 当前状态 | 第十二轮只有 `NewSidecarHTTPTransport(baseURL, options...)`，还没有 profile / authority aware executor factory。 | 本轮只能补 factory contract，不能把 bridge 扩成 endpoint registry 或运行时真源。 |
| `internal/protocolbridge/sidecar_http_transport.go` | loopback baseURL、scheme、userinfo、query / fragment、forbidden header、timeout / bearer token 注入边界已固化。 | factory 必须复用这层防线，不能重新发明另一套 transport 校验。 |
| `internal/protocolbridge/mcp_adapter.go` | adapter 已固定先 `Runtime.Authorize`，再调用 `OperationExecutor`。 | 新 factory 返回的 executor 必须仍然走这条链，不能提前触 sidecar 或绕过授权。 |
| 用户本轮限制 | 写入面只限 `internal/protocolbridge/**` 与本 space 文档。 | 不改 Wails / sidecar runtime / CLIProxyAPI reference，不证明 endpoint 已存在。 |

## 3. BDD 场景

### 场景 A：合法 endpoint 可构造 executor

- Given 一个带 `profile_id` 的 loopback sidecar endpoint。
- When 调用 `NewSidecarHTTPExecutorFromEndpoint(...)`。
- Then 返回可执行的 `OperationExecutor`。
- And 后续通过 MCP adapter 调用时，仍先 authorize，再请求 sidecar。

### 场景 B：非法 endpoint 在 factory 边界被拒绝

- Given 缺失 profile id、非 loopback host、非法 scheme 或带 query / userinfo 的 endpoint。
- When 构造 executor。
- Then 直接返回错误。
- And 不解析 token provider，也不产生网络请求。

### 场景 C：token provider 只影响真实 HTTP Authorization

- Given factory 配置 token provider。
- When executor 被 MCP adapter 在授权成功后调用。
- Then sidecar server 只在真实 outbound HTTP header 收到 `Authorization: Bearer <token>`。
- And canonical request body、response audit、error surface 都不包含 raw token。

### 场景 D：authority 不匹配时在 factory executor 边界拒绝

- Given authorize 后的 operation request 带非 sidecar owner，或 authority endpoint 与 canonical operation endpoint 不匹配。
- When factory 返回的 executor 执行请求。
- Then 返回 canonical invalid request。
- And 不解析 token provider，也不触 sidecar。

## 4. 最小实现

1. 新增 endpoint DTO，例如 `SidecarHTTPEndpoint`，至少包含 `ProfileID` 和 `BaseURL`。
2. 新增 `NewSidecarHTTPExecutorFromEndpoint(...)` 小构造层，返回 `OperationExecutor`。
3. 新增可选 token provider option，并在执行时解析 token，再复用 `NewSidecarHTTPTransport(...)`。
4. 在 factory 返回的 executor 内补 `AuthorityOwnerSidecar` 与 `Authority.Endpoint == operation spec endpoint` 的预校验。
5. token provider / authority mismatch 失败必须走 canonical error，不泄露 raw token。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 6. 风险与后续

- 本轮 factory 只把单 endpoint 收敛为 executor，不维护 endpoint registry、profile lifecycle 或 endpoint 探活。
- token provider 只定义 contract，不负责缓存、刷新、轮换策略。
- 若后续 MCP stdio / 其他 transport 需要按会话动态切换 endpoint，可能还要在 factory 之上再补更高一层 selector。

## 7. 沉淀审计

- 候选模式：sidecar endpoint -> executor 的 authority-aware factory boundary。
- 当前结论：先沉淀到本 space 文档，不升级到项目级 skill 或 `AGENTS.md`。
- 原因：约束仍局限于 protocol bridge transport slice，还未形成跨领域复用流程。
