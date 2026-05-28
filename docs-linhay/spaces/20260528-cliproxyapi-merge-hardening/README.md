# CLIProxyAPI 合并后续收口

## 背景

2026-05-28 的 CLIProxyAPI 日常合并已经完成，fork `gettokens/sidecar` 已前进到 `d21a74b5`，并把 upstream `v7.1.24` 合入。这个批次的核心增量不是新功能页，而是侧车运行时采集链路的收口：`SetTranslatedReasoningEffort`、TTFT 计时、`usage_helpers`、`redisqueue` 的 `ttft_ms` 字段，以及 Codex WebSocket 路径的合并点。

这批改动已经能编译和通过测试，但还留下两个值得收口的判断：

1. `ttft_ms` 目前已经进入队列结构，但下游消费侧还没有明确落点。
2. `codex_websockets_executor.go` 同时承载 GetTokens 的 live-session 生命周期事件和 upstream TTFT 计时，后续继续合并 upstream 时容易再次撞冲突。

## 目标

1. 把这批合并后的运行时采集改动梳理成稳定边界，补齐最容易退化的测试。
2. 明确 `TTFT` 是“只采集待消费”还是“已经纳入展示/报表链路”，避免只写不看的悬空字段。
3. 给 WebSocket executor 的合并热区补结构化测试，降低下一次 upstream merge 的冲突和回归风险。
4. 产出一版可复用的合并收口计划，后续日常同步按此执行。

## 范围

- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/usage_helpers.go`
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/usage_helpers_test.go`
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
- `docs-linhay/references/CLIProxyAPI/internal/redisqueue/plugin.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/usage/manager.go`
- 需要时再补 `docs-linhay/dev/`、`docs-linhay/memory/`、`qmd` 索引和验证记录

## 非目标

- 不在本期再推进新的 live sessions UI。
- 不把 TTFT 展示页和统计页一并做掉，除非先明确消费侧归属。
- 不扩大到新的 upstream 合并或历史 fork 清理。
- 不在父仓库无关前端改动里穿插修补。

## 验收标准

1. `UsageReporter` 的 TTFT 行为有直接测试覆盖，至少包括 HTTP client 路径和 WebSocket 首字节路径。
2. `ttft_ms` 的写入链路清晰可解释，若暂不消费，也要在文档里明确它的定位。
3. `SetTranslatedReasoningEffort` 的提取逻辑有边界测试，避免不同 provider payload 退化。
4. `codex_websockets_executor.go` 的关键时序点有回归测试或结构化验证。
5. 相关改动通过 `go test ./...`、`git diff --check`、`./scripts/ensure-sidecar.sh darwin arm64`。
6. 完成 space、memory、qmd 写回。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260528-cliproxyapi-merge-hardening`
- worktree：`../GetTokens-worktrees/20260528-cliproxyapi-merge-hardening/`

## 相关链接

- 上轮合并记录：`docs-linhay/spaces/20260527-cliproxyapi-upstream-merge/README.md`
- 运行时采集沉淀：`docs-linhay/dev/20260519-cliproxyapi-upstream-sync-session-distillation.md`
- 今日 memory：`docs-linhay/memory/2026-05-28.md`

## 当前状态
- 状态：implemented-tested
- 最近更新：2026-05-28

## 实施记录

- fork `gettokens/sidecar` 已新增提交 `fbcf3bb5 fix: harden usage reasoning and ttft reporting`，并推送到 `origin/gettokens/sidecar`。
- `UsageReporter.SetTranslatedReasoningEffort` 改为只在提取到 translated effort 时覆盖，避免空 payload 清掉 context 中已有的 reasoning effort。
- HTTP TTFT 追踪消除重复启动：`TrackHTTPClient` 现在复用 body 包裹逻辑，不再经由会再次 `StartResponseTTFT` 的 `ObserveResponse`。
- `ttft_ms` 当前定位为可用 telemetry，已通过 redis queue payload 测试锁定序列化输出；本期不扩展 UI/报表消费面。
- WebSocket executor 本期未改结构；其 TTFT 计时与 live-session 生命周期事件已由 shared `UsageReporter` 行为测试和全量 executor 测试覆盖，后续若继续冲突再抽更小 helper。

## 验证记录

- `go test ./internal/runtime/executor/helps -run 'TestUsageReporter(SetTranslatedReasoningEffort|TrackHTTPClient|ObserveResponse|BuildRecordIncludesReasoningEffort)' -count=1`
- `go test ./internal/thinking -run 'TestExtract(TranslatedReasoningEffort|ReasoningEffort)' -count=1`
- `go test ./internal/redisqueue -run 'TestUsageQueuePluginPayloadIncludesStableFieldsAndSuccess' -count=1`
- `go test ./internal/runtime/executor ./internal/runtime/executor/helps ./internal/thinking ./internal/redisqueue`
- `go test ./...`
- `git diff --check`
- `./scripts/ensure-sidecar.sh darwin arm64`
