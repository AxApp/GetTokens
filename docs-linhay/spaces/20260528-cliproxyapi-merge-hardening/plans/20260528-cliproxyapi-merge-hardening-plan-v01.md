# CLIProxyAPI 合并后续收口计划 v01

日期：2026-05-28

## 现状

- `docs-linhay/references/CLIProxyAPI` 已合并 upstream `v7.1.24`，当前 fork HEAD 为 `d21a74b5`。
- 这批改动已通过 `go test ./...`、`git diff --check` 和 `./scripts/ensure-sidecar.sh darwin arm64`。
- 这次合并把 `TTFT` 和 translated reasoning effort 接进了 usage 链路，但 `ttft_ms` 仍缺少明确消费侧。
- `codex_websockets_executor.go` 同时维护 GetTokens live-session 事件和 upstream TTFT 时序点，后续继续合并 upstream 时是高频冲突区。

## 决策

1. 先把采集链路收口，再决定是否扩展示意图展示面。
2. `ttft_ms` 先按“可用 telemetry”对待，不默认承诺展示页消费。
3. WebSocket executor 的冲突热区要用测试固定时序，而不是靠手工 merge 记忆。

## 执行步骤

### 阶段一：边界确认

1. 盘点 `TTFT` 的产出位置、序列化位置和当前消费位置。
2. 明确 `ttft_ms` 是继续只存在于队列/日志，还是要接入 GetTokens 前端或报表。
3. 给 translated reasoning effort 补齐 provider 边界测试。

### 阶段二：补测试

1. 为 `UsageReporter.TrackHTTPClient` 保留现有 TTFT 回归测试。
2. 为 WebSocket 路径补 `StartResponseTTFT` / `MarkFirstResponseByte` 顺序测试。
3. 为 `SetTranslatedReasoningEffort` 补非 Codex / 空 payload / 兼容 payload 边界测试。
4. 如决定消费 `ttft_ms`，补队列结构读取测试和下游映射测试。

### 阶段三：最小实现

1. 若只收口采集，则补文档说明 `ttft_ms` 的定位和预期消费方。
2. 若要消费 `ttft_ms`，只做最小读链路，不扩散到新的 UI 设计。
3. 视需要把 WebSocket 关键时序封装成更小的 helper，降低后续 merge 冲突。

### 阶段四：验证与写回

1. 跑定向 Go 测试与全量 `go test ./...`。
2. 跑 `git diff --check` 和 `./scripts/ensure-sidecar.sh darwin arm64`。
3. 更新 space、memory 和 qmd。

## 验收标准

1. `TTFT` 采集链路有稳定测试。
2. `ttft_ms` 的消费边界被明确记录，不再悬空。
3. `SetTranslatedReasoningEffort` 的边界行为有测试覆盖。
4. 下一次合并时，WebSocket executor 的冲突面减少或更易手工确认。
5. 文档、记忆和索引同步完成。

## 风险

- 如果过早推进 `ttft_ms` 消费，会把这次纯 telemetry 改动拖成新的展示需求。
- 如果不把 WebSocket 时序测试补上，后续 upstream 再改 executor 时仍容易在合并后才暴露差异。
- 这次父仓库仍有大量无关改动，后续执行时要继续只碰 `docs-linhay/references/CLIProxyAPI` gitlink 和本 space 范围内的文档。

## 执行记录

### 实施摘要

- fork 提交：`fbcf3bb5 fix: harden usage reasoning and ttft reporting`
- 推送状态：`origin/gettokens/sidecar` 已更新到 `fbcf3bb5`
- sidecar meta：`fbcf3bb5:clean:a3f32c9be29306928d103699760db583cbd8dde4dd899893313ea7731000d630:darwin:arm64`

### 关键改动

1. `UsageReporter.SetTranslatedReasoningEffort`
   - 修复 translated effort 缺失时把 context reasoning effort 覆盖为空的问题。
   - 保留 translated effort 存在时优先使用 translated upstream value 的语义。

2. `UsageReporter` TTFT 路径
   - 抽出 `observeResponseBody`，让 `TrackHTTPClient` 和 `ObserveResponse` 共用 body 包裹逻辑。
   - `TrackHTTPClient` 不再重复调用会再次启动 TTFT 的 `ObserveResponse`，减少重复劳动。

3. `redisqueue` telemetry 边界
   - 补 `ttft_ms` payload 断言，锁定 TTFT 已经从 `usage.Record` 序列化到队列 payload。
   - 当前 `ttft_ms` 仍定位为 telemetry 字段，不在本期推进 UI/报表消费。

### 验证记录

- `go test ./internal/runtime/executor/helps -run 'TestUsageReporter(SetTranslatedReasoningEffort|TrackHTTPClient|ObserveResponse|BuildRecordIncludesReasoningEffort)' -count=1`
- `go test ./internal/thinking -run 'TestExtract(TranslatedReasoningEffort|ReasoningEffort)' -count=1`
- `go test ./internal/redisqueue -run 'TestUsageQueuePluginPayloadIncludesStableFieldsAndSuccess' -count=1`
- `go test ./internal/runtime/executor ./internal/runtime/executor/helps ./internal/thinking ./internal/redisqueue`
- `go test ./...`
- `git diff --check`
- `./scripts/ensure-sidecar.sh darwin arm64`

### 后续建议

- 下一次 upstream 合并若再次触碰 `codex_websockets_executor.go`，优先检查 `RecordCodexLiveUpstreamConnected`、`RecordCodexLiveFirstEvent`、`StartResponseTTFT`、`MarkFirstResponseByte` 四个时序点是否仍同时存在。
- 如果后续要展示 `ttft_ms`，先定义消费侧归属和窗口口径，再进入 UI 或报表实现；不要在 usage queue 写入层直接耦合展示语义。
