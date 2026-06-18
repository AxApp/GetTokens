# Protocol Bridge MCP Stdio Transport Preflight v01

日期：2026-06-17

## 1. 本轮目标

在 `internal/protocolbridge` 内新增一个更靠近 MCP stdio transport 的 contract / preflight 层，固定：

- stdio 只接收 `mcp-adapter-mapping-v01.json` 允许的 tool / resource。
- tool 请求仍然先走 `Runtime.Authorize`，再决定是否进入 executor。
- credential-bearing input 在进入 executor 前被拒绝。
- response / audit 不泄露 raw token、header、cookie 或其他 credential material。

本轮只做：

- package 内小型 stdio preflight helper
- adapter 挂接与聚焦契约测试
- Protocol Bridge space README / plan / artifact gate 更新

本轮不做：

- 真实 MCP stdio server / process lifecycle
- sidecar endpoint selector / registry
- audit persistence 落盘
- 真实 sidecar endpoint 探活或运行时验收

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮切片的约束 |
| --- | --- | --- |
| `README.md` 当前状态 | 第十三轮已落 authority-aware executor factory，但“真实 MCP stdio transport”仍明确待后续切片。 | 本轮只能补 preflight contract，不能把 helper 扩成 server/runtime 真源。 |
| `internal/protocolbridge/mcp_adapter.go` | tool 请求当前已先 `Runtime.Authorize` 再调用 `OperationExecutor`；resource 只允许 manifest / schema / scope list。 | 新 preflight 必须保留 authorize -> executor 顺序，只新增 executor 前的输入守门。 |
| `schemas/mcp-adapter-mapping-v01.json` | tool / resource allowlist 已由 fixture 固化。 | preflight 只能接受 fixture 声明的名字，不新增 transport 私有工具或资源。 |
| 用户本轮限制 | 不实现完整 MCP stdio server，也不接真实 sidecar endpoint。 | helper 只负责 contract / preflight，不负责 session、socket、child process 或 endpoint runtime。 |

## 3. BDD 场景

### 场景 A：stdio preflight 只接受 mapping fixture 允许的 tool / resource

- Given MCP adapter mapping fixture 已固化工具和资源清单。
- When stdio preflight 收到 fixture 内的 tool / resource。
- Then 请求可继续进入 adapter / resource handler。
- When stdio preflight 收到 unknown tool / resource。
- Then 直接按 canonical `invalid_request` 契约拒绝。

### 场景 B：credential-bearing input 在 executor 前被拒绝

- Given tool query 包含 `Authorization` / `Cookie` / `access_token` / `api_key` 或等价 credential-bearing material。
- When adapter 在授权成功后进入 stdio preflight。
- Then 返回 canonical rejected envelope。
- And `error.code=invalid_request`。
- And `sidecar_invoked=false`。
- And executor / sidecar transport 均不被调用。

### 场景 C：authorize 顺序不回归

- Given tool 名称在 mapping fixture 中且 scope grant 合法。
- When adapter 处理 stdio tool 请求。
- Then 仍先执行 `Runtime.Authorize`。
- And 只有 authorize 成功且 preflight 通过，才调用 executor。

### 场景 D：response / audit 不泄露 header / cookie / token

- Given credential-bearing input 被拒绝，或 resource URI 自带 credential-bearing query。
- When preflight 产出 canonical response / audit。
- Then payload 不包含 raw token、Authorization header、Cookie、access token、refresh token、id token 或 API key。

## 4. 最小实现

1. 新增 `MCPStdioPreflight` 小 helper，基于 mapping fixture 维护 tool/resource allowlist。
2. helper 递归扫描 tool query 与 resource URI，拒绝 header/token/cookie 类 credential-bearing input。
3. `MCPAdapter.HandleTool(...)` 在 authorize 成功后、executor 之前调用 preflight。
4. `MCPAdapter.HandleResource(...)` 在返回资源前调用 preflight。
5. preflight rejection 继续复用 canonical envelope，并保持 audit redaction。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 6. 风险与后续

- 这层 helper 只证明 stdio preflight contract，不证明真实 stdio server 的 stdin/stdout framing、process lifecycle 或 client binding。
- credential-bearing input 目前按保守规则拒绝 header/token/cookie 相关键名和值；若后续 query schema 新增近似字段，需要同步收窄或白名单化。
- resource 仍然只暴露 manifest / schema / scope list；后续如果扩充 resource catalog，必须先更新 mapping fixture 与 preflight 测试。

## 7. 沉淀审计

- 候选模式：MCP stdio transport preflight 作为 adapter 前的静态 contract gate。
- 当前结论：沉淀到本 space 文档和包内 helper/tests，不升级到项目级 skill、memory 或 `AGENTS.md`。
- 原因：模式仍局限于 Protocol Bridge 的 MCP stdio 切片，尚未形成跨领域治理规则。
