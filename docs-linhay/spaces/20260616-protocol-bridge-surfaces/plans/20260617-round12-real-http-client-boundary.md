# Protocol Bridge Real HTTP Client Boundary v01

日期：2026-06-17

## 1. 本轮目标

在 `internal/protocolbridge` 内为 `SidecarHTTPExecutor` 增加真实 HTTP transport/client 构造边界，固定：

- 明确 `baseURL` 注入入口
- loopback / scheme / endpoint 校验
- timeout / context 透传
- 可选 bearer token 注入，但不进入 bridge audit / canonical error surface
- 继续复用第十一轮 sidecar HTTP failure taxonomy

本轮只做：

- package 内真实 HTTP transport 构造器
- 真实 HTTP client option contract
- `httptest` / fake server 测试
- non-loopback / invalid endpoint 拒绝测试
- timeout / HTTP non-2xx / malformed JSON taxonomy 回归

本轮不做：

- MCP stdio server
- audit persistence
- route / quota / model truth 存储
- CLIProxyAPI reference 对齐
- Wails / frontend / root app 绑定

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮切片的约束 |
| --- | --- | --- |
| `README.md` 当前状态 | `SidecarHTTPExecutor` 仍只接 fake `SidecarTransport`，真实 transport 待补。 | 本轮要补 transport/client boundary，但不能越界到 runner truth 或 sidecar authority 持久层。 |
| `plans/20260617-sidecar-execution-binding-slice-v01.md` | canonical operation -> sidecar path/body/header 与 failure taxonomy 已固化。 | 真实 HTTP transport 只能复用既有 request mapping 和 taxonomy，不能发明新 envelope。 |
| `internal/protocolbridge/sidecar_http_executor_test.go` | 现有测试已证明 fake transport 下的 path/body/header、idempotency hash 和错误脱敏。 | 新增真实 client 测试必须证明 contract 不变，只是把 fake transport 替换成真实 HTTP client boundary。 |
| 用户本轮限制 | 写入面只限 `internal/protocolbridge/**` 与本 space 文档。 | 不改 sidecar / Wails / CLIProxyAPI reference，也不把 bearer token 写进其他层。 |

## 3. BDD 场景

### 场景 A：loopback base URL 可构造真实 transport

- Given 显式 `http://127.0.0.1:<port>`、`http://localhost:<port>` 或 `https://[::1]:<port>` base URL。
- When 构造 real sidecar HTTP transport。
- Then transport 创建成功。
- And executor 通过该 transport 发出的 request path/body/header 与 fake transport contract 一致。

### 场景 B：非 loopback 或非法 endpoint 在构造边界被拒绝

- Given 非 loopback host、非 `http(s)` scheme、缺 host、带 query / fragment / userinfo 的 base URL。
- When 构造 real sidecar HTTP transport。
- Then 直接返回错误。
- And 不产生任何网络请求。

### 场景 C：timeout 与 context 透传

- Given transport 配置显式 timeout，且 sidecar server 故意超时。
- When executor 通过 real transport 调用 sidecar。
- Then 请求受 `http.Client` timeout 或 `context` deadline 约束。
- And canonical error 继续是 `sidecar_unavailable`，sidecar error code 保持 `transport_timeout`。

### 场景 D：bearer token 只在真实 HTTP boundary 使用

- Given transport 配置 bearer token。
- When executor 发起请求。
- Then sidecar server 能收到 `Authorization: Bearer <token>`。
- And canonical request body、bridge headers、error / audit surface 都不包含 raw token。

### 场景 E：HTTP / malformed / rejected taxonomy 不回归

- Given real transport 指向 `httptest` sidecar server。
- When server 返回 HTTP non-2xx、malformed JSON 或 canonical rejected envelope。
- Then executor / adapter 仍返回第十一轮既有 canonical taxonomy。
- And message / sidecar error code / response payload 继续脱敏，不泄露 `Authorization`、`Cookie` 或 raw idempotency key。

## 4. 最小实现

1. 新增 `NewSidecarHTTPTransport(baseURL, options...)` 一类 package 内构造器。
2. 在构造边界校验 scheme 只允许 `http` / `https`，host 必须是显式 loopback literal 或 `localhost`，禁止 query / fragment / userinfo。
3. 提供最小 options：timeout、bearer token、可替换 `http.Client`。
4. transport 负责把 canonical `SidecarHTTPRequest` 转成真实 `http.Request`，并把 `baseURL` 与 operation path 拼接成最终 endpoint。
5. bearer token 只加到真实 `http.Request` header，不回写到 `SidecarHTTPRequest`、body、canonical response 或 audit projection。
6. 继续复用现有 `classifyTransportError`、`decodeSidecarHTTPResponse` 与 redaction 规则，保证 taxonomy 不变。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 6. 风险与后续

- 本轮只验证 real HTTP client boundary，不验证真实 sidecar runtime 是否已提供这些 endpoint。
- 当前 transport 只做单 endpoint + timeout + auth 注入，不涉及 retry、connection pool policy、proxy 或 mTLS。
- 若后续 runner 需要按 profile / authority 动态切换 endpoint，本轮构造器可能还要外提成更窄的 factory。

## 7. 沉淀审计

- 候选模式：loopback-only real sidecar HTTP transport 构造边界。
- 当前结论：先不升级到项目级 skill 或 `AGENTS.md`。
- 原因：约束仍局限于 `internal/protocolbridge` 切片，还未形成跨领域重复工作流。
