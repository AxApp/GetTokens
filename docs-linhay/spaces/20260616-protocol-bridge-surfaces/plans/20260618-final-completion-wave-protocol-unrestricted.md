# Protocol Bridge Final Completion Wave: unrestricted listener pass

日期：2026-06-18

## 1. 本轮目标

完成 Protocol unrestricted completion：

- 显式运行 `protocolbridge_unrestricted_listener` tagged listener tests。
- 如果 4 个 listener tests 全部通过，更新 unrestricted smoke 输出与 protocol docs，记录当前 full-access 环境下的 real unrestricted pass。
- 保持默认 `go test ./internal/protocolbridge` 通过，保持 no-network partition。
- 若 listener tests 失败，不能只归类为沙箱限制，必须区分代码问题、IPv6 localhost、`httptest` 绑定策略或环境问题后再最小修复。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮处理 |
| --- | --- | --- |
| 用户 Final Completion Wave 指令 | 当前环境已切到 full-access，要求不要再分多轮，直接跑 tagged listener tests 并闭环文档。 | 直接运行 tagged Go suite 与 smoke script，不再沿用 Round27 的受限沙箱结论。 |
| `internal/protocolbridge/sidecar_http_unrestricted_listener_test.go` | 4 个测试覆盖 `httptest.NewServer` / localhost listener 下的 real HTTP transport、factory authorize-before-sidecar、request contract、failure taxonomy、deadline。 | 在 `protocolbridge_unrestricted_listener` build tag 下显式运行。 |
| `docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs` | 旧输出已有 `passed` / `localhost_listen_restriction_only` / `real_test_failure` 三态，但 `passed` 没有显式 machine-readable real-pass 字段。 | 保留三态分类，新增 `environment_conclusion` 与 `real_unrestricted_pass`，让通过日志明确表示 real unrestricted pass。 |
| `docs-linhay/scripts/check-protocolbridge-no-network.mjs` | no-network partition 发现 63 个 default tests、1 个 tag-only verifier、4 个 unrestricted listener tests，并只执行 default + no-network verifier。 | 本轮保持该 partition，通过脚本复跑确认未被 listener pass 改动破坏。 |

## 3. BDD 场景

### 场景 A：full-access 环境真实通过 listener suite

- Given 当前环境允许 localhost listener / `httptest.NewServer` 绑定。
- When 运行 `go test -count=1 -tags protocolbridge_unrestricted_listener ./internal/protocolbridge`。
- Then 4 个 tagged listener tests 全部通过。
- And 不需要把失败归类为沙箱限制、IPv6 localhost 或绑定策略问题。

### 场景 B：unrestricted smoke 输出 machine-readable real pass

- Given tagged listener suite 全部通过。
- When 运行 `node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs`。
- Then JSON 输出包含 `classification: "passed"`、`environment_conclusion: "real_unrestricted_pass"`、`real_unrestricted_pass: true`。
- And `stderr_has_localhost_listen_restriction=false`、`output_has_localhost_listen_restriction=false`。

### 场景 C：默认 package gate 和 no-network partition 保持不变

- Given listener tests 仍只属于 `protocolbridge_unrestricted_listener` tag。
- When 运行默认 package gate 与 no-network script。
- Then `go test -count=1 ./internal/protocolbridge` 通过。
- And no-network script 继续只运行 63 个 default package gate tests + 1 个 `protocolbridge_no_network` verifier，不把 listener suite 混入 no-network gate。

## 4. 实现边界

- 只增强 `check-protocolbridge-unrestricted-smoke.mjs` 的结构化输出字段；不改 4 个 listener test 的语义。
- 不启动真实 sidecar endpoint，不替换 app bundle sidecar，不触碰正式版 `/Applications/GetTokens.app`。
- 不读取或写入真实 `~/.codex/config.toml`。
- 不改变 no-network partition：listener tests 仍需显式 tag 或 smoke script 运行。

## 5. 验证结果

    GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge

结果：通过，默认 package gate 仍可运行。

    GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 -tags protocolbridge_unrestricted_listener ./internal/protocolbridge

结果：通过，4 个 listener tests 在当前 full-access 环境真实通过。

    GOCACHE=/private/tmp/gettokens-go-cache node docs-linhay/scripts/check-protocolbridge-no-network.mjs

结果：通过，脚本继续输出 63 个 default package gate tests、1 个 tag-only no-network verifier、4 个 tagged unrestricted listener tests，并只执行 default + no-network verifier。

    GOCACHE=/private/tmp/gettokens-go-cache node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs

结果：通过，JSON 输出包含 `classification="passed"`、`environment_conclusion="real_unrestricted_pass"`、`real_unrestricted_pass=true`，且没有 localhost listen restriction 证据。

## 6. 结论

ProtocolBridge unrestricted listener boundary 当前已闭环：

- 默认 no-network / no-listener package gate 通过。
- `protocolbridge_no_network` verifier partition 通过。
- `protocolbridge_unrestricted_listener` listener suite 在 full-access 环境真实通过。
- unrestricted smoke 能用 machine-readable 字段区分 real pass、环境限制和真实测试失败。

## 7. 剩余风险

- listener suite 仍不是默认 package gate 的一部分；后续新增 `httptest.NewServer` 测试时仍必须显式归类到 default / `protocolbridge_no_network` / `protocolbridge_unrestricted_listener`。
- 当前通过只证明 ProtocolBridge real HTTP transport contract 和 localhost listener 测试通过，不证明真实 sidecar management endpoint 已提供完整 protocol bridge runtime。
- 本轮未启动 Wails dev App，也未构建或替换任何 sidecar / app bundle；这是符合本轮 protocolbridge package 级验收边界的。
