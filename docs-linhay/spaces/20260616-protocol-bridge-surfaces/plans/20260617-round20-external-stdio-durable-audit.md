# Protocol Bridge Round20: external stdio wrapper and durable audit sink

日期：2026-06-17

## 1. 本轮目标

在 protocol bridge 内补两块可验证但仍受控的基础能力：

- 受控 fake external stdio process wrapper，用测试内 helper process 验证 start、JSON-RPC request、context shutdown、stderr / exit error 边界。
- durable audit sink skeleton，以 JSONL file store 证明 audit event 可以落到文件，同时不持久化 raw token、header、cookie、query 或 URI。

本轮不做：

- 不启动真实 sidecar。
- 不连接真实 endpoint 或用户机器外部服务。
- 不实现完整 MCP initialize / capabilities negotiation。
- 不修改 Extension / Route / Doctor / Quota。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮约束 |
| --- | --- | --- |
| Round18 / Round19 | 已有 in-process JSON-RPC handler 与 lifecycle wrapper。 | external stdio wrapper 只证明进程 IO / lifecycle 边界，不替换 handler 语义。 |
| `AuditPersister` | adapter 已支持可注入 audit persistence，resource rejection 也能生成内部 audit event。 | 本轮只补 JSONL sink skeleton，不引入真实 ledger schema / queue / retry。 |
| 用户边界 | 要求 fake command / helper process，不依赖真实 sidecar endpoint。 | 测试只能使用 `go test` helper process，不执行外部服务。 |

## 3. BDD 场景

### 场景 A：external stdio process start + JSON-RPC request

- Given `MCPExternalStdioProcess` 使用测试内 helper process。
- When `Start(ctx)` 后调用 `CallJSONRPC(ctx, request, &response)`。
- Then request 通过 stdin 写入，response 从 stdout 解码。
- And 不启动真实 sidecar / endpoint。

### 场景 B：context shutdown 终止外部 stdio process

- Given helper process 进入 hang 状态。
- When 调用 `Shutdown(ctx)`。
- Then wrapper cancel context 并等待进程退出。
- And `Running()` 变为 false。

### 场景 C：stderr / exit error 边界不泄密

- Given helper process 向 stderr 写入 `Authorization` / `Cookie` / `api_key` 类文本后非零退出。
- When `CallJSONRPC` 观察到进程退出。
- Then 返回 `ErrExternalStdioProcessExited` sentinel。
- And error string 与 `Stderr()` 均不包含 raw token、header、cookie 或 bearer 内容。

### 场景 D：durable audit JSONL 不落敏感输入

- Given `NewJSONLAuditSink(path)` 写临时 JSONL 文件。
- When event 中恶意塞入 raw URI、query、Authorization、Cookie、api_key。
- Then JSONL 仍可按行解码为 `AuditEvent`。
- And target refs / source notes 被 redacted，不包含 raw token、header、cookie、query 或 URI。

## 4. 最小实现

1. 新增 `MCPExternalStdioProcess`：
   - 使用 `MCPExternalStdioCommand{Path, Args, Env}` 描述受控命令。
   - `Start(ctx)` 通过 `exec.CommandContext` 启动，并绑定 stdin/stdout/stderr。
   - `CallJSONRPC(ctx, request, response)` 用 JSON encoder/decoder 进行单请求往返。
   - `Shutdown(ctx)` 关闭 stdin、cancel context 并等待进程退出。
   - stderr 通过有限缓冲采集，输出前统一脱敏。
2. 新增 `JSONLAuditSink`：
   - 构造时创建父目录，写入时用 `0600` append。
   - 写入前复制并脱敏 `AuditEvent` 中的 `TargetRefs` 与 `Authority.SourceNotes`。
   - 对疑似 raw URI / query / credential-bearing text 使用 `redacted-target-ref` 或 `redacted` 替代。

## 5. 验证命令

```bash
go test -count=1 ./internal/protocolbridge
docs-linhay/scripts/check-docs.sh
git diff --check -- internal/protocolbridge docs-linhay/spaces/20260616-protocol-bridge-surfaces
```

## 6. 剩余风险

- external stdio wrapper 仍是受控 wrapper skeleton，不是完整 MCP process manager。
- 当前只支持同步单请求 JSON-RPC 往返；并发 request、initialize negotiation、progress/cancel、stderr streaming policy 仍待后续切片。
- JSONL audit sink 没有 rotation、fsync、batch flush、retry、schema migration 或 ledger query API。
- JSONL sink 采用保守脱敏，可能会把未来某些安全但包含 `query=` / URI-like 的 target ref 降级为 redacted；后续如需可检索性，应引入结构化 target type 与 hash projection。
