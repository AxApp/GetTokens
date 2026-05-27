# Codex Live Session Timing Summary

## 背景

`#frame=codex&workspace=live-sessions` 的请求耗时图下方有一组 `总耗时 / TTFT / 首 token / 流式 / 排队 / 选号 / 连接 / 平均间隔 / 最大间隔 / 输出速率` 指标。

当前前端可以从 sidecar 返回的 `requests[].timing` 逐条 request 计算平均值，但这会带来两个理解问题：

1. 用户容易误以为这些数值是进入页面后才开始统计。
2. 平均窗口、样本数量、序号范围和 active request 是否参与投影都没有由 sidecar 明确声明。

更稳定的边界应是：sidecar 负责运行时采集与聚合摘要，GetTokens 前端负责展示；前端仅在旧 sidecar 或 preview 数据缺少摘要时做兼容 fallback。

## 目标

1. sidecar 在 live-session snapshot / detail 数据中直接返回请求耗时聚合摘要。
2. 摘要明确统计窗口、样本数量、请求序号范围、active request 是否纳入，以及各 timing 字段的平均值。
3. GetTokens Wails/root DTO 与前端模型端到端透传该摘要。
4. 前端 live sessions 详情优先展示 sidecar 提供的摘要；缺失时回退到现有前端聚合，避免旧 sidecar 页面退化为空。
5. UI 文案清晰表达这是“最近保留请求的平均耗时”，不是最新单次请求值，也不是页面打开后才开始计时。

## 范围

### 后端 / sidecar

- CLIProxyAPI live-session tracker 在构建 session snapshot 与 request detail/history 响应时生成 `timingSummary`。
- `timingSummary` 基于当前 retained requests 聚合，不读取或展示 request/response payload。
- active request 的 `totalDurationMs` 可按 sidecar 当前 `generatedAt` 或等价 server-side now 投影，且投影口径必须可测试。
- 历史 stale streaming request 不能因为 snapshot 刷新而持续增长。

### GetTokens Wails / root DTO

- `internal/wailsapp` 增加 timing summary DTO。
- root `main.App` 对应 DTO 和 mapper 保持字段一致。
- 重新生成或同步 `frontend/wailsjs` 类型。

### 前端

- `frontend/src/features/codex-live-sessions/model/types.ts` 增加 timing summary 类型。
- backend adapter 透传 summary。
- `TimingMetrics` 优先使用 sidecar summary；缺失时回退到当前 `buildCodexLiveRequestTimingMetricAverages`。
- UI 标题/辅助文案表达 `耗时均值`、样本数与序号范围，例如 `最近 50 请求 · #4-#53`。
- browser preview/mock 数据提供 summary，便于无 Wails 环境验收。

## 非目标

- 不新增请求取消、重放、强制 WebSocket 恢复等控制能力。
- 不展示 raw payload、凭证、cookie、header 原文、未脱敏错误体。
- 不在本期做全历史任意窗口聚合接口，例如 `last_5m / last_30m / session_all / p95`；这些可作为后续增强。
- 不改变请求耗时趋势图的一请求一柱、固定数量窗口和 request sequence x 轴语义。
- 不删除前端 fallback 聚合；它仍用于旧 sidecar、browser preview 兼容和测试隔离。

## 验收标准

### BDD 场景

1. **sidecar 直接返回 retained request 耗时摘要**
   - Given 一个 live session 保留了多条 completed requests 和一条 active request
   - When 管理接口返回 live sessions snapshot
   - Then 每个 session 带有 `timingSummary`
   - And `timingSummary.sampleCount` 等于参与聚合的 retained request 数
   - And `sequenceFrom / sequenceTo` 对应参与聚合的 request sequence 范围
   - And `averages.totalDurationMs / firstEventMs / firstTokenMs / streamDurationMs / queueWaitMs / authSelectMs / upstreamConnectMs / averageEventGapMs / longestEventGapMs` 为平均值

2. **active request 的总耗时由 sidecar 投影**
   - Given 当前 active request 没有 `completedAt`
   - And request startedAt 早于 snapshot generatedAt
   - When sidecar 计算 summary
   - Then `activeIncluded=true`
   - And active request 的 `totalDurationMs` 按 generatedAt 与 startedAt 的差值参与平均
   - And first event / first token 等未记录字段不被凭空生成

3. **历史 stale streaming request 不随刷新增长**
   - Given retained requests 中存在非当前 active 的 `streaming/reconnecting` request
   - When sidecar 连续生成两次 snapshot
   - Then 该历史 request 只使用已记录 `timing.totalDurationMs` 或 `completedAt-startedAt`
   - And 不因第二次 snapshot 的 generatedAt 变晚而增长

4. **GetTokens 前端优先展示 sidecar summary**
   - Given Wails snapshot 中包含 `timingSummary`
   - When 用户进入 `#frame=codex&workspace=live-sessions`
   - Then 耗时区域标题表达为 `耗时均值`
   - And 显示样本数量与序号范围
   - And 指标值来自 sidecar summary，而不是最新单条 request

5. **旧 sidecar 兼容 fallback**
   - Given snapshot 缺少 `timingSummary`
   - When 页面渲染 live-session detail
   - Then 前端使用现有 request window 聚合 fallback
   - And 页面不空白、不报错
   - And UI 可标注为本地估算或保持兼容态文案

6. **敏感信息边界**
   - Given request payload / headers / auth token 存在于运行时链路
   - When 生成 `timingSummary`
   - Then summary 只包含计数、时间、速率和 request sequence 范围
   - And 不包含 payload、header、token、cookie、完整错误体

### 测试门禁

- CLIProxyAPI focused Go tests：summary 平均值、active 投影、stale streaming 不增长、无 timing 字段过滤、sequence 范围。
- GetTokens Go/Wails DTO tests：sidecar JSON 到 Wails/root DTO 字段不丢失。
- 前端 model tests：adapter 透传、优先 sidecar summary、fallback 聚合兼容。
- 前端结构/显示测试：标题 `耗时均值`、样本数、序号范围、最新请求 timeline 仍保留单请求值。
- 验证命令至少覆盖：
  - `go test ./internal/gettokenshooks -run 'LiveSessions.*TimingSummary|TimingSummary' -count=1`（CLIProxyAPI fork 内执行，具体路径按实际测试命名调整）
  - `go test ./internal/wailsapp -run 'CodexLiveSessions' -count=1`
  - `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`
- 浏览器验收：`#frame=codex&workspace=live-sessions` 可见 `耗时均值`、样本数量和序号范围；timeline 最新行仍显示单请求耗时。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-codex-live-session-timing-summary`
- worktree：`../GetTokens-worktrees/20260527-codex-live-session-timing-summary/`

## 相关链接

- 需求来源：用户要求“让 sidecar 直接返回聚合摘要”
- 当前 live sessions 领域规则：`.agents/skills/gettokens-domain-engineering/SKILL.md`
- 既有 UI 沉淀：`docs-linhay/dev/20260523-session-distillation-codex-live-sessions-ui.md`
- 相关 workspace：`#frame=codex&workspace=live-sessions`

## 当前状态
- 状态：requirements-ready
- 最近更新：2026-05-27
