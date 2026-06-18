# Protocol Bridge Round26: unrestricted smoke boundary

日期：2026-06-18

## 1. 本轮目标

在 Round25 no-network suite split 之后，新增一个 unrestricted smoke classifier：

- 尝试运行完整 `go test -count=1 ./internal/protocolbridge`。
- 将结果结构化归类为 `passed`、`localhost_listen_restriction_only` 或 `real_test_failure`。
- 当当前环境因 `httptest.NewServer` / localhost `[::1]:0` listen restriction 失败时，记录为环境限制。
- 若失败不属于已知 `httptest.NewServer` listen restriction，不吞掉真实测试失败，脚本以失败退出并输出 stdout / stderr。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不删除、不跳过、不改写既有 `httptest.NewServer` 测试。
- 不把 unrestricted smoke 作为 no-network gate 的替代品。
- 不修改 `internal/protocolbridge` 业务代码。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮处理 |
| --- | --- | --- |
| Round25 no-network suite split | `docs-linhay/scripts/check-protocolbridge-no-network.mjs` 已显式把 64 个 no-network 测试与 4 个 unrestricted / `httptest.NewServer` 测试分类。 | 保持 no-network gate 原行为，只新增到 unrestricted smoke classifier 的交叉引用。 |
| 主控环境记录 | Round25 聚合曾完整通过，说明非受限环境下完整 package test 预期可通过。 | 新脚本优先把完整通过归类为 `passed`，并打印 Go 测试输出。 |
| 当前受限沙箱 | 既往记录显示完整 package test 可因 `httptest.NewServer` 监听 `[::1]:0` 被拒。 | 新脚本检查 stderr 与合并输出中的 listen restriction，同时解析失败测试名；只有已知 4 个 listener 测试触发该签名时才归类为 `localhost_listen_restriction_only`。 |
| 用户边界 | 只改 protocol verifier 脚本/docs，不启动真实 sidecar endpoint。 | 本轮写入面限定为 `docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs`、no-network 脚本交叉引用、本计划和 protocol space README。 |

红灯记录：

```bash
node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs
```

结果：脚本不存在，Node 返回 `MODULE_NOT_FOUND`。

## 3. BDD 场景

### 场景 A：完整 package test 通过

- Given 环境允许 `httptest.NewServer` 绑定 localhost。
- When 运行 `node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs`。
- Then 脚本执行 `go test -count=1 ./internal/protocolbridge`。
- And 输出 JSON summary，`classification=passed`，退出码为 0。

### 场景 B：仅 localhost listen restriction

- Given Go package test 失败。
- And 失败测试只包含 Round25 归类出的 4 个 unrestricted listener 测试。
- And stderr 或合并输出包含 `httptest.NewServer` / `httptest: failed to listen on a port` / `listen [::1]:0 ... operation not permitted` 这类签名。
- When 运行 smoke classifier。
- Then 输出 `classification=localhost_listen_restriction_only`。
- And 退出码为 0，供受限沙箱记录环境限制。

### 场景 C：真实测试失败不被吞掉

- Given Go package test 失败。
- And 失败测试不只限于已知 4 个 listener 测试，或输出没有 localhost listen restriction 签名。
- When 运行 smoke classifier。
- Then 输出 `classification=real_test_failure`。
- And 打印 stdout / stderr，退出码为 1。

## 4. 实现边界

- `docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs` 使用 `spawnSync('go', ['test', '-count=1', './internal/protocolbridge'])`，默认 `GOCACHE=/private/tmp/gettokens-go-cache`。
- 分类器解析 `--- FAIL: Test...`，只允许 Round25 已知 4 个 `httptest.NewServer` 测试进入环境限制分支。
- listen restriction 同时检查 stderr 与合并输出，因为 Go test failure 细节可能出现在 stdout。
- `real_test_failure` 分支必须非 0 退出，避免 CI 或主控误判。

## 5. 验证结果

```bash
node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs
```

结果：通过；脚本执行完整 `go test -count=1 ./internal/protocolbridge`，Go 退出码为 1，但结构化归类为 `localhost_listen_restriction_only`。失败测试只包含 `TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface`，stderr 未出现 listen restriction，合并输出出现 `httptest: failed to listen on a port: listen tcp6 [::1]:0: bind: operation not permitted`。

```bash
node docs-linhay/scripts/check-protocolbridge-no-network.mjs
```

结果：通过；仍输出 64 个 no-network gate 测试与 4 个 unrestricted / `httptest.NewServer` 测试，并只运行 no-network allowlist。

```bash
GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge
```

结果：失败，分类为当前沙箱 localhost listen restriction；首个失败测试为 `TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface`，panic 来自 `httptest.NewServer` 监听 `[::1]:0` 被 `operation not permitted` 拒绝。未观察到其它测试失败证据。

```bash
bash docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs docs-linhay/scripts/check-protocolbridge-no-network.mjs docs-linhay/spaces/20260616-protocol-bridge-surfaces/README.md docs-linhay/spaces/20260616-protocol-bridge-surfaces/plans/20260618-round26-unrestricted-smoke-boundary.md
```

结果：通过。

## 6. 剩余风险

- 在当前受限沙箱里，`localhost_listen_restriction_only` 只证明失败来自本地监听权限，不证明 unrestricted 环境已通过完整 package test。
- 若后续新增 `httptest.NewServer` 测试，必须先更新 Round25 no-network suite split 与本 smoke classifier 的 listener test allowlist。
- 该脚本不启动真实 sidecar endpoint，因此不覆盖 sidecar runtime endpoint 是否存在。
