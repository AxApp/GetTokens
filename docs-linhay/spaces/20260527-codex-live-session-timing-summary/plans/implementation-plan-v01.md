# Codex Live Session Timing Summary 执行计划 v01

## 目标

将 live sessions 的耗时聚合摘要从前端临时计算前移到 sidecar，由 CLIProxyAPI live-session tracker 在 snapshot/detail 响应中返回 `timingSummary`。GetTokens 负责 Wails/root DTO 透传、前端优先展示 sidecar summary，并保留旧 sidecar fallback。

## 当前事实

1. sidecar 已经为每条 request 返回 `timing` 字段，包括 `totalDurationMs`、`firstEventMs`、`firstTokenMs`、`streamDurationMs`、`queueWaitMs`、`authSelectMs`、`upstreamConnectMs`、gap 与速率。
2. GetTokens 的 `internal/wailsapp` 与 root `main.App` 已透传 request-level timing。
3. 前端当前可以用 `buildCodexLiveRequestTimingMetricAverages` 基于 retained request window 计算平均值。
4. 当前不足是 summary 口径不由 sidecar 声明，用户无法从数据结构上判断样本范围、序号范围和 active request 是否纳入。

## 数据契约草案

建议在 session 级增加：

```json
{
  "timingSummary": {
    "window": "retained_requests",
    "sampleCount": 50,
    "sequenceFrom": 4,
    "sequenceTo": 53,
    "activeIncluded": true,
    "generatedAt": "2026-05-27T15:30:00+08:00",
    "averages": {
      "totalDurationMs": 7100,
      "firstEventMs": 740,
      "firstTokenMs": 1200,
      "streamDurationMs": 5900,
      "queueWaitMs": 70,
      "authSelectMs": 66,
      "upstreamConnectMs": 409,
      "averageEventGapMs": 105,
      "longestEventGapMs": 632,
      "reconnectCount": 0,
      "outputTokensPerSecond": 536,
      "totalTokensPerSecond": 2702
    }
  }
}
```

字段说明：

- `window`：本期固定为 `retained_requests`，表示基于实时内存保留窗口。
- `sampleCount`：参与聚合的 request 数量，不等同于 session 全历史请求数。
- `sequenceFrom / sequenceTo`：参与聚合的 request sequence 范围。
- `activeIncluded`：当前 active request 是否参与聚合。
- `generatedAt`：summary 计算时刻，用于解释 active request 总耗时投影。
- `averages`：各可用 timing 字段的均值；缺失字段不参与该字段均值。

兼容策略：

- 老 sidecar 没有 `timingSummary` 时，前端继续使用 request window fallback 聚合。
- 新 sidecar 返回 `timingSummary` 时，前端不再重新计算该卡片值。
- preview/mock 必须带 summary，防止浏览器验收长期只覆盖 fallback。

## 阶段 1：CLIProxyAPI sidecar 红灯测试

目标：先在 fork 内锁定 summary 口径。

建议测试：

1. `TestLiveSessionsTimingSummaryAveragesRetainedRequests`
   - 构造 3 条 completed request。
   - 断言 sampleCount、sequenceFrom/to、平均值。
2. `TestLiveSessionsTimingSummaryProjectsOnlyActiveRequest`
   - 构造一条 active request，使用固定 generatedAt。
   - 断言 activeIncluded 与 totalDurationMs 投影。
   - 断言 firstEvent/firstToken 缺失时不被生成。
3. `TestLiveSessionsTimingSummaryDoesNotGrowStaleStreamingRequest`
   - 构造 stale streaming request 与 current active request。
   - 连续两次生成 snapshot。
   - 断言 stale request 不随 generatedAt 增长。
4. `TestLiveSessionsTimingSummaryIgnoresMissingTimingValues`
   - 混入缺失 timing 或字段缺失的 request。
   - 断言字段均值只按可用值计算。
5. `TestLiveSessionsTimingSummarySequenceRangeUsesRetainedWindow`
   - 构造被裁剪后的 request window。
   - 断言 sequenceFrom/to 保留真实 lifecycle sequence，不重新编号。

实现入口：

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/live_sessions.go`
- 对应测试文件按 fork 当前结构放在 `internal/gettokenshooks/*live_sessions*_test.go`

验收命令：

```bash
go test ./internal/gettokenshooks -run 'LiveSessions.*TimingSummary|TimingSummary' -count=1
go test ./internal/gettokenshooks -run 'LiveSessions' -count=1
```

## 阶段 2：CLIProxyAPI sidecar 最小实现

实现要点：

1. 在 sidecar DTO 中增加 `TimingSummary` 结构。
2. 在生成 session snapshot 时，从 retained `session.requests` 计算 summary。
3. 使用 snapshot 统一 `generatedAt` 作为 active request 投影基准，避免每个字段独立取 `time.Now()`。
4. active 投影只作用于当前 active request 的 `totalDurationMs`。
5. completed request 缺少 `totalDurationMs` 时，可沿用已有趋势规则回退到 `completedAt - startedAt`。
6. 所有平均值用整数毫秒或整数速率输出；浮点速率如已有 DTO 需要保留 float，可在 DTO 层明确类型。
7. summary 不读取 payload，不透出 headers/token/cookie。

风险：

- 如果 sidecar 当前 request struct 没有足够字段区分 current active 与 stale streaming，需要先复用现有 `activeRequestID`。
- 如果历史 ledger 也要 summary，本期先不做；避免把实时 retained window 与完整历史窗口混成一个口径。

## 阶段 3：GetTokens Wails/root DTO 透传

目标：保证新字段从 sidecar 到前端类型端到端可见。

改动范围：

- `internal/wailsapp/codex_live_sessions.go`
- `app_codex_live_sessions.go`
- 相关 root mapper 或 DTO 转换代码
- `frontend/wailsjs/go/models.ts`

测试：

1. `internal/wailsapp/codex_live_sessions_test.go` 增加 sidecar JSON fixture，包含 `timingSummary`。
2. 断言 Wails DTO 与 root DTO 字段不丢失。
3. 如果有生成绑定校验测试，补充 `TimingSummary` 类型存在性断言。

验收命令：

```bash
go test ./internal/wailsapp -run 'CodexLiveSessions' -count=1
```

注意：

- 任何新增 Wails-facing DTO 都必须 root 层同步，否则生成绑定会丢前端 export。
- 当前工作区可能存在其他未完成改动，实施时需只读/只改本需求相关文件，不吸收无关 diff。

## 阶段 4：前端模型与 adapter

目标：前端优先消费 sidecar summary，缺失时 fallback。

改动范围：

- `frontend/src/features/codex-live-sessions/model/types.ts`
- `frontend/src/features/codex-live-sessions/model/adapters.ts`
- `frontend/src/features/codex-live-sessions/model/requestTimingTrend.ts`
- `frontend/src/features/codex-live-sessions/model/mockData.ts`
- `frontend/src/features/codex-live-sessions/model.test.mjs`

实现要点：

1. 增加 `CodexLiveTimingSummary` 类型。
2. adapter 透传 `timingSummary.window / sampleCount / sequenceFrom / sequenceTo / activeIncluded / generatedAt / averages`。
3. 抽一个前端选择函数，例如 `resolveCodexLiveTimingMetricSummary(session, request, options)`：
   - 优先返回 `session.timingSummary`
   - 缺失时返回现有 `buildCodexLiveRequestTimingMetricAverages` fallback
   - 输出统一 display model，便于组件不关心来源
4. preview/mock 数据补 summary，且数值与 mock requests 保持一致或在测试中明确断言。

测试：

1. adapter 透传 sidecar summary。
2. summary 存在时优先使用 sidecar 值，即使 request window 本地可算出不同值。
3. summary 缺失时 fallback 正常。
4. preview selected session 带 summary，避免浏览器预览只测 fallback。

验收命令：

```bash
node --test frontend/src/features/codex-live-sessions/model.test.mjs
```

## 阶段 5：前端 UI 展示

目标：让用户看懂这是 sidecar 聚合摘要。

改动范围：

- `frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`

UI 建议：

- 标题从 `耗时` 改为 `耗时均值`。
- 在标题右侧或次级文本显示：
  - `最近 50 请求`
  - `#4-#53`
  - `Sidecar 汇总` 或 `本地估算`（fallback 时）
- 单请求最新值继续放在 chart footer 与 timeline row。
- 不新增说明性大段文字，保持工作台密度。

测试：

1. 源结构测试断言 `耗时均值` copy key 存在。
2. DOM/browser 验收断言页面出现样本数和序号范围。
3. timeline 最新行仍显示单请求值，不被 summary 覆盖。

验收命令：

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## 阶段 6：浏览器 / 桌面验收

浏览器预览：

1. 打开 `http://localhost:5173/#frame=codex&workspace=live-sessions`。
2. 验证 `耗时均值`、样本数、序号范围可见。
3. 验证 timeline 最新行仍显示单请求值。
4. 保存截图到：
   `docs-linhay/spaces/20260527-codex-live-session-timing-summary/screenshots/20260527/codex-live-sessions/`

真实 Wails / sidecar：

1. 若 CLIProxyAPI sidecar fork 有改动，需要重建并让 GetTokens 使用新 sidecar。
2. 重启 Wails app，确认 sidecar ready。
3. 通过真实 Codex 请求生成 live session。
4. 验证 management endpoint 返回 `timingSummary`。
5. 验证 UI 显示 `Sidecar 汇总` 而不是 fallback。

## 阶段 7：文档与记忆收尾

1. 更新 `docs-linhay/dev/20260523-session-distillation-codex-live-sessions-ui.md`，记录 sidecar summary 成为权威摘要，前端聚合降级为 fallback。
2. 更新 `.agents/skills/gettokens-domain-engineering/SKILL.md` 的 Codex Live Sessions 小节。
3. 写入 `docs-linhay/memory/YYYY-MM-DD.md`。
4. 运行：

```bash
docs-linhay/scripts/check-docs.sh
qmd update && qmd embed
```

不需要更新 `AGENTS.md`，除非实施过程中沉淀出 repo-wide 的新治理规则。

## 里程碑

1. `M1 sidecar summary contract`：CLIProxyAPI tests + implementation 通过。
2. `M2 GetTokens DTO bridge`：Wails/root/frontend generated 类型透传通过。
3. `M3 frontend display`：UI 优先 sidecar summary，fallback 兼容，前端测试通过。
4. `M4 acceptance`：浏览器截图与真实 sidecar 验收完成，文档记忆同步。

## 执行结果

### 已完成

- `M1 sidecar summary contract`：已在 CLIProxyAPI fork 增加 `LiveTimingSummary` 与 retained requests 聚合构建器，focused live-session 测试通过。
- `M2 GetTokens DTO bridge`：已在 `internal/wailsapp`、root `main.App`、`frontend/wailsjs/go/models.ts` 增加 timing summary DTO 与 mapper，Wails focused 测试通过。
- `M3 frontend display`：前端类型、adapter、preview mock、summary resolver 和详情 UI 已接入；`耗时均值` 优先展示 sidecar summary，缺失时 fallback 本地估算。
- `M4 acceptance`：已完成浏览器预览验收与截图归档；文档、memory、领域 skill 已写回。

### 最终验证

```bash
go test ./internal/gettokenshooks -run 'LiveSessions.*TimingSummary|TimingSummary' -count=1
go test ./internal/gettokenshooks -run 'LiveSessions' -count=1
go test ./internal/wailsapp -run 'CodexLiveSessions' -count=1
node --test frontend/src/features/codex-live-sessions/model.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

浏览器预览验收：

- URL：`http://localhost:5173/#frame=codex&workspace=live-sessions`
- 截图：`../screenshots/20260527/codex-live-sessions/20260527-codex-live-sessions-timing-summary-after-v01.png`
- DOM 结果：详情区显示 `耗时均值` 与 `最近请求 50 · #36-#85 · SIDECAR 汇总`，timeline 仍显示最新单请求耗时。

### 未覆盖项

- 未重启真实桌面 app 并发起真实 Codex 请求做端到端 runtime 验收。本期验证覆盖 sidecar fork 单元测试、Wails DTO、前端模型/构建和浏览器预览。

## 开放问题

1. `timingSummary` 放在 session 级即可，还是 request detail/history response 也要独立返回同一 summary？
   - 建议本期先 session 级；detail/history 如复用同一 session 数据可同步携带。
2. active request 投影是否每次 snapshot 都更新 summary？
   - 建议是，由 sidecar snapshot generatedAt 控制；前端可继续每秒本地投影图表，但 summary 以 sidecar 响应为准。
3. 是否需要 p95 / max / min？
   - 本期不做。当前 UI 只需要平均值，后续性能诊断再扩展 percentile。
