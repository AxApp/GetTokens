# Protocol Bridge Round25: no-network suite split

日期：2026-06-18

## 1. 本轮目标

把 Round24 的单点 `protocolbridge_no_network` verifier 扩展成稳定的 suite split：

- 明确 `internal/protocolbridge` 哪些测试属于当前沙箱可运行的 no-network gate。
- 明确哪些测试需要 unrestricted network / `httptest.NewServer` 监听能力。
- 通过脚本输出可读清单，并只运行 no-network allowlist。
- 不删除、不跳过、不弱化既有需要真实 HTTP listener 的测试。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不新增网络监听。
- 不把 `httptest.NewServer` 场景改造成 fake transport。
- 不宣称 no-network gate 替代 unrestricted 环境下的完整 package test。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮处理 |
| --- | --- | --- |
| Round25 retry dispatch | 上一批 agent 因上游 stream disconnected 失败，不是代码失败；要求从当前工作区继续，只改 protocolbridge verifier/tests/docs。 | 保留并行工作区改动，不 reset / revert / checkout；本轮只改 no-network script、focused verifier 和 protocol bridge space 文档。 |
| 完整 package test | `GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge` 在当前沙箱失败：`httptest.NewServer` 监听 `[::1]:0` 返回 `bind: operation not permitted`。首个失败测试为 `TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface`。 | 记录为环境限制，不作为 Round25 代码失败；脚本把该类测试列入 unrestricted / httptest suite。 |
| Round24 verifier | `docs-linhay/scripts/check-protocolbridge-no-network.mjs` 只发现并运行 `TestProtocolBridgeNoNetworkVerifier`，没有输出哪些既有测试属于 no-network gate。 | 改为显式 suite split 清单：发现全部测试、校验所有测试已分类、输出 no-network 与 unrestricted 列表，再运行 no-network allowlist。 |
| 关键 no-network 路径 | MCP initialize/list/resources/read、audit cursor / JSONL reader、stdio preflight、runtime authorize、fake transport mapping 都不需要监听端口。 | 纳入 no-network allowlist；build-tag verifier 额外覆盖 initialize、resource read、credential-bearing stdio preflight 不触达 executor。 |

红灯记录：

```bash
node docs-linhay/scripts/check-protocolbridge-no-network.mjs | rg 'No-network gate tests|Requires unrestricted network'
```

Round24 旧脚本没有可读 suite split 清单，命令退出 `1`。

## 3. Suite Split

### No-network gate

脚本当前把 64 个测试纳入 no-network gate：

- JSONL audit sink / reader：只使用 `t.TempDir()` 文件。
- MCP adapter / runtime authorization：只使用 in-process runtime 与 stub executor。
- MCP stdio preflight：只验证 fixture / schema / credential-bearing input。
- MCP in-process JSON-RPC stdio：只使用 `bytes.Buffer` reader / writer，覆盖 `initialize`、`tools/list`、`resources/list`、`resources/read`、credential/schema 拒绝。
- MCP stdio lifecycle / external process wrapper：只使用本地 pipe 与 Go helper process，不监听 TCP。
- Sidecar HTTP boundary without listeners：invalid endpoint、authority mismatch、fake `SidecarTransport` mapping / taxonomy。
- Build-tag package verifier：`TestProtocolBridgeNoNetworkVerifier`。

### Requires unrestricted network / httptest

以下 4 个测试保留在完整 package suite 中，但不进入 no-network gate：

- `TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface`
- `TestSidecarHTTPExecutorWithRealTransportPreservesRequestContract`
- `TestSidecarHTTPExecutorWithRealTransportClassifiesHTTPFailureTaxonomy`
- `TestSidecarHTTPExecutorWithRealTransportHonorsContextDeadline`

原因：它们使用 `httptest.NewServer`，在当前沙箱需要 localhost 端口监听能力。

## 4. BDD 场景

### 场景 A：脚本输出可读 no-network / unrestricted 清单

- Given `internal/protocolbridge` 包内测试通过 `go test -tags protocolbridge_no_network -list '^Test'` 可发现。
- When 运行 `node docs-linhay/scripts/check-protocolbridge-no-network.mjs`。
- Then 输出 `No-network gate tests` 与 `Requires unrestricted network / httptest tests` 两个清单。
- And 所有发现到的测试必须显式归类；若新增测试未分类，脚本失败。

### 场景 B：no-network gate 运行关键本地路径

- Given 脚本构造 no-network allowlist `-run` pattern。
- When 执行 no-network gate。
- Then 覆盖 MCP initialize/list/resources/read、audit cursor / JSONL reader、stdio preflight、runtime authorize、fake sidecar transport mapping。
- And 不运行任何 `httptest.NewServer` 测试。

### 场景 C：build-tag verifier 保持单命令 smoke

- Given `protocolbridge_no_network` build tag。
- When 执行 `go test -count=1 -tags protocolbridge_no_network ./internal/protocolbridge -run '^TestProtocolBridgeNoNetworkVerifier$'`。
- Then verifier 覆盖 cross-cutting local smoke：initialize、resources/read、stdio preflight、list cursor、audit cursor。
- And executor call count 保持 0。

## 5. 验证结果

```bash
GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge
```

结果：失败于 `httptest.NewServer` 监听 `[::1]:0`，记录为当前沙箱限制。

```bash
node docs-linhay/scripts/check-protocolbridge-no-network.mjs
```

结果：通过。脚本输出 64 个 no-network gate 测试与 4 个 unrestricted / httptest 测试，并运行 no-network allowlist。

```bash
GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 -tags protocolbridge_no_network ./internal/protocolbridge -run '^TestProtocolBridgeNoNetworkVerifier$'
```

结果：通过。

## 6. 剩余风险

- no-network gate 不替代 unrestricted 环境下的完整 `go test ./internal/protocolbridge`。
- 4 个 `httptest.NewServer` 场景仍需要能绑定 localhost 端口的环境验证。
- suite split 是显式清单；后续新增 protocolbridge 测试必须先分类，否则脚本会失败。
