# Protocol Bridge Round27: listener tests quarantine

日期：2026-06-18

## 1. 本轮目标

把 internal/protocolbridge 中必须依赖 localhost listener / httptest.NewServer 的测试显式隔离到 unrestricted boundary，同时保留它们在非受限环境可运行：

- 默认 go test -count=1 ./internal/protocolbridge 在当前受限沙箱应只运行 no-listener package gate。
- package gate 之外，继续保留 protocolbridge_no_network verifier 覆盖纯本地 no-network tracer。
- 真实 listener / real HTTP transport 测试改为 protocolbridge_unrestricted_listener build tag 显式运行。
- unrestricted smoke 脚本只针对 tagged listener suite 分类，不再把整个 package 的受限环境失败误报为实现失败。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不删除 authorize-before-sidecar、token redaction、mapping、audit、stdio 等核心语义测试。
- 不把 unrestricted listener tests 改成无条件 skip。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮处理 |
| --- | --- | --- |
| internal/protocolbridge/sidecar_http_executor_factory_test.go | TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface 直接 httptest.NewServer(...)。 | 迁到新的 protocolbridge_unrestricted_listener tagged test 文件。 |
| internal/protocolbridge/sidecar_http_executor_test.go | TestSidecarHTTPExecutorWithRealTransportPreservesRequestContract、TestSidecarHTTPExecutorWithRealTransportClassifiesHTTPFailureTaxonomy、TestSidecarHTTPExecutorWithRealTransportHonorsContextDeadline 都依赖 httptest.NewServer / localhost port bind。 | 一并迁到 tagged listener suite，默认 package 不再编译这些 top-level tests。 |
| Round26 unrestricted smoke | 之前脚本运行完整 go test -count=1 ./internal/protocolbridge，当前沙箱只要 listener fail 就会把整包标成环境限制。 | 改成只跑 tagged listener suite，保持 passed / localhost_listen_restriction_only / real_test_failure 三态。 |
| Round25 no-network suite split | 已有人类可读分类，但默认 go test ./internal/protocolbridge 仍会被 listener 失败污染。 | no-network 脚本升级为三段边界：default package gate、tag-only verifier、tagged unrestricted listener。 |

红灯记录：

    GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge

结果（改动前）：在当前受限沙箱里会因 httptest: failed to listen on a port: listen tcp6 [::1]:0: bind: operation not permitted 失败，普通 package gate 无法区分实现失败与 listener 环境限制。

## 3. BDD 场景

### 场景 A：默认 package gate 在受限沙箱可直接运行

- Given 当前环境禁止 localhost listener bind。
- When 运行 go test -count=1 ./internal/protocolbridge。
- Then package 只包含 63 个 no-listener top-level tests。
- And 命令通过，不把 listener restriction 误报为实现失败。

### 场景 B：tag-only no-network verifier 继续保留

- Given protocolbridge_no_network build tag verifier 仍用于 package-level no-network tracer。
- When 运行 node docs-linhay/scripts/check-protocolbridge-no-network.mjs。
- Then 脚本必须验证三段分类：
  - 63 个 default package gate tests；
  - 1 个 protocolbridge_no_network tag-only verifier；
  - 4 个 protocolbridge_unrestricted_listener tests。
- And 只运行 default package gate + tag-only verifier，不要求当前沙箱通过 listener tests。

### 场景 C：unrestricted smoke 只针对 listener suite 分类

- Given 4 个 listener tests 只在 protocolbridge_unrestricted_listener tag 下可见。
- When 运行 node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs。
- Then 脚本执行 go test -count=1 -tags protocolbridge_unrestricted_listener ./internal/protocolbridge -run ^(...)$。
- And 当前沙箱若只因 localhost bind 失败，则分类为 localhost_listen_restriction_only。
- And 若 tagged listener suite 在非受限环境全部通过，则分类为 passed。
- And 若失败不是已知 listener restriction，则分类为 real_test_failure 并非 0 退出。

## 4. 实现边界

- 新增 internal/protocolbridge/sidecar_http_unrestricted_listener_test.go，使用 //go:build protocolbridge_unrestricted_listener 收纳 4 个 listener top-level tests。
- 原 sidecar_http_executor_factory_test.go / sidecar_http_executor_test.go 保留 no-listener tests，不再直接引用 httptest.NewServer。
- docs-linhay/scripts/check-protocolbridge-no-network.mjs 改为分别发现：
  - 默认 package tests；
  - protocolbridge_no_network tag tests；
  - protocolbridge_unrestricted_listener tag tests。
- docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs 改为只运行 tagged listener allowlist，并保留环境限制分类。

## 5. 验证结果

    GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge

结果：通过。默认 package gate 现在只跑 no-listener suite。

    node docs-linhay/scripts/check-protocolbridge-no-network.mjs

结果：通过。脚本输出 63 个 default package gate tests、1 个 tag-only no-network verifier、4 个 tagged unrestricted listener tests，并只执行前两类。

    node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs

结果：通过。脚本执行 tagged listener suite，在当前沙箱分类为 localhost_listen_restriction_only，失败测试只包含 TestMCPAdapterWithFactoryExecutorAuthorizesBeforeSidecarAndKeepsTokenOutOfCanonicalSurface，证据仍是 httptest 监听 [::1]:0 被 operation not permitted 拒绝。

2026-06-18 Final Completion Wave 复核：当前环境已切到 full-access 后，`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 -tags protocolbridge_unrestricted_listener ./internal/protocolbridge` 通过；`GOCACHE=/private/tmp/gettokens-go-cache node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs` 输出 `classification="passed"`、`environment_conclusion="real_unrestricted_pass"`、`real_unrestricted_pass=true`。Round27 的 quarantine 边界保持有效，但“当前受限沙箱无法证明通过”的风险在本 full-access 环境中已完成复核。

## 6. 剩余风险

- 默认 package gate 不再自动覆盖 4 个 listener tests；非受限环境需要显式运行 node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs 或对应 tagged go test 命令。
- 后续若新增 httptest.NewServer top-level test，必须同步决定其归属：默认 package / protocolbridge_no_network / protocolbridge_unrestricted_listener，否则 no-network 脚本 discovery 会失败。
- Round27 当时的受限沙箱无法证明 tagged listener suite 在 unrestricted 环境通过；Final Completion Wave 已在当前 full-access 环境完成该复核。后续风险转为：listener suite 仍需显式 tag/smoke 运行，不属于默认 no-network gate。
