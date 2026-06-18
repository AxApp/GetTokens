# Round24: Sidecar Rebuild Smoke Evidence

日期：2026-06-17

## 目标

在 `docs-linhay/references/CLIProxyAPI` 内补一个 bounded smoke 入口，证明当前 `gettokens/sidecar` reference 能把 `internal/gettokenshooks` 的 Doctor diagnostics 与 Route Resilience management route 编进测试侧 `cmd/server` sidecar binary。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Twenty-Fourth Dispatch 指定：`CLIProxyAPI sidecar rebuild smoke evidence`。 |
| 当前代码事实位置 | `cmd/server/main.go` import `internal/gettokenshooks` 并调用 `gettokenshooks.InstallRoutingPolicies()`；Doctor diagnostics 与 Route Resilience routes 分别在 `internal/gettokenshooks/doctor_diagnostics.go`、`internal/gettokenshooks/route_resilience_actions.go` 下注册到 `/v0/management/gettokens/...`。 |
| 当前现象 / 缺失证明 | Round19-23 已有 focused hooks 实现和测试，但缺少一个明确、不发布、不替换 bundle 的 sidecar reference rebuild smoke 入口。 |
| 预期验收方式 | 运行 reference 内脚本：focused management route tests 通过，no-network `go build ./cmd/server` 输出到 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/`，并只执行 built binary `-h`。 |
| 反证条件 | 脚本写入 GetTokens app bundle、触碰 `/Applications/GetTokens.app`、启动真实 sidecar endpoint、写正式配置目录，或需要发布/签名流程才算通过。 |

## 范围

- 新增 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`。
- 新增 `docs-linhay/references/CLIProxyAPI/SIDECAR_BUILD_SMOKE.md`。
- 本计划记录 Round24 验收边界。

## 非目标

- 不替换 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`。
- 不替换 `/Applications/GetTokens.app` 正式版 sidecar。
- 不启动 dev App、正式 App 或真实 sidecar HTTP 服务。
- 不修正 Round19-23 hooks 行为；本轮只补 rebuild smoke evidence。

## BDD 场景

1. 给定 reference worktree 存在当前 `gettokenshooks` 实现，当执行 smoke 脚本时，Doctor diagnostics 与 Route Resilience management route registration focused tests 必须通过。
2. 给定 focused tests 通过，当脚本执行 build 时，`./cmd/server` 必须构建成 `/private/tmp` 下的测试侧 binary。
3. 给定 binary 构建成功，当脚本执行 binary `-h` 时，只验证 flag/entrypoint 可启动，不启动服务、不监听端口、不写正式 profile。
4. 给定 smoke 在受限环境运行，当脚本执行 Go 命令时，默认使用本地 module cache、`GOPROXY=off` 和 `/private/tmp` 下的 `GOCACHE`。

## 验收命令

```bash
cd docs-linhay/references/CLIProxyAPI
scripts/gettokens-sidecar-build-smoke.sh
```

## 验收记录

执行结果：通过。

```text
== gettokens management route focused tests ==
GOCACHE=/private/tmp/gettokens-cliproxyapi-sidecar-smoke/gocache
GOPROXY=off
ok  	github.com/router-for-me/CLIProxyAPI/v7/internal/gettokenshooks	0.346s
== bounded sidecar reference build ==
a38e143eed680f647f8a9e7028695fe8b1438243d9c3e1b80de4c6f69400190f  /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round24-smoke
smoke ok
commit: 91dd8d8e+dirty
binary: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round24-smoke
help: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round24-smoke-help.txt
sha256: /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round24-smoke.sha256
```

环境备注：Go 仍尝试向默认 module stat cache 写入 `~/go/pkg/mod/cache/download/...` 并在 sandbox 下打印 `operation not permitted` warning；命令最终退出码为 0，focused tests、build、binary `-h`、sha256 均完成。该 warning 表示当前 sandbox 对默认 Go module cache 只读，不表示 sidecar build 失败。

## 剩余风险

- 该 smoke 使用当前 reference worktree；若 worktree dirty，binary metadata 会标记 `+dirty`，不能作为 release artifact。
- 该 smoke 不替代完整 `go test ./...`、Wails build、dev App ready 验收或正式 release packaging。
- built binary 留在 `/private/tmp` 仅供测试侧证据使用，不应复制进 app bundle。
- 本轮未启动真实 sidecar HTTP endpoint，因此只证明 build/entrypoint 与 management route registration，不证明运行态 ready 或 Wails 消费链路。
