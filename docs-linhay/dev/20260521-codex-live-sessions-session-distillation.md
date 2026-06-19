# Codex 运行会话观测交付沉淀

## 背景

本轮围绕 Codex WebSocket 连接、HTTP fallback、GetTokens 是否能提示/代理恢复、以及 Codex 一级 `live-sessions` tab 完成了调研、设计、实现、审查和提交。需求最终落到只读运行时观测：实时列出正在运行的 Codex 会话，请求级展示速率、连接方式和关键耗时，不暴露内部 payload。

## 沉淀模式

### 1. Runtime observability 必须从 sidecar fork 起步

Codex live sessions 这类信息不是前端状态，也不是本地 session 文件。可信源应在 CLIProxyAPI fork：

1. 在 fork 内建立内存 runtime tracker。
2. 在 fork 管理 API 暴露只读 snapshot。
3. GetTokens `internal/wailsapp` 只做 management API 透传和 DTO 校验。
4. root `main.App` 暴露 Wails 方法并生成 `frontend/wailsjs`。
5. 前端 feature 桌面模式轮询真实 snapshot，浏览器模式使用 mock preview。

这样可以避免前端凭日志或本地状态推断运行链路。

### 2. 用户关心字段先行，内部标识后置

默认列表只展示：

- 状态
- 模型 / 账号
- 连接方式
- 输出速率
- 首 token / TTFT
- 运行时长

`request_id`、`session_id`、`execution_session_id`、timeline 和脱敏诊断摘要保留在展开详情。这样既能满足排障，又不会把用户淹没在内部实现细节里。

### 3. WebSocket 与 usage 归因必须共用 request id

WebSocket handler 生成的 request id 必须写入 context，并贯穿 Codex WebSocket executor 与 usage attribution hook。usage hook 看到同一个 request id 时，应更新已有 WebSocket request，而不是新建 HTTP-only session。

该规则防止 UI 同时出现一条 WebSocket session 和一条重复 HTTP session，尤其适用于 `response.completed` 后 usage 被异步归因的场景。

### 4. Codex 运行会话按 conversation_id 收拢

Codex 请求中的稳定会话标识是 `conversation_id` / `ThreadId`，它会出现在 `session_id`、`x-client-request-id`、`prompt_cache_key`、`x-codex-window-id` 等字段中。Live sessions tracker 的条目 key 应优先使用该值，而不是 sidecar WebSocket handler 临时生成的 `passthroughSessionID`。

实现规则：

1. 从 downstream headers / WebSocket body / upstream request headers 和 body 中抽取 identity。
2. 优先级为 `session_id`、`prompt_cache_key`、`x-codex-window-id` 去掉 `:<window_generation>`、`x-client-request-id`。
3. 若请求先以 passthrough session 建立临时条目，后续拿到 conversation_id 后必须迁移并合并到 canonical session。
4. `execution_session_id`、`downstream_session_id`、`codex_window_id` 保留为诊断字段，不作为主聚合 key。

这样可以把同一个 Codex 会话中的多次请求、WebSocket 重连、HTTP fallback 或 sidecar execution session 变化收拢到同一个 UI 条目。

### 5. fallback 只能观测和提示，不承诺透明恢复

Codex upstream HTTP fallback 属于 Codex / sidecar 运行时链路的 sticky 状态。GetTokens 可以：

- 记录 downstream / upstream transport。
- 推断 `WS -> HTTP` 降级。
- 展示降级提示和诊断摘要。

GetTokens 不应宣称可以在同一个已降级会话中透明恢复 WebSocket。若未来要做主动恢复，必须单独设计取消/重放/新会话语义和用户确认。

### 6. 脏工作区提交要双仓精确暂存

本轮工作区存在大量 Claude Code 并行改动，Codex live sessions 提交必须做到：

1. CLIProxyAPI fork 先提交运行时 tracker 和管理端点。
2. 父仓库再提交 fork gitlink、GetTokens Wails、前端和文档。
3. 使用 `git add -p` 或精确路径暂存，避免混入无关 Claude / asset workbench / session-management 改动。
4. 提交前运行 `git diff --cached --check`，特别注意生成文件局部 hunk 的尾随空白。

### 7. 实时趋势图要把“请求时间”作为一等模型

本轮追加的请求耗时趋势图暴露出一个可复用模式：运行时观测图表不能只做静态 SVG 装饰，必须从 request 记录生成可测试的时间序列。

执行规则：

1. 先新增纯模型，例如 `requestTimingTrend.ts`，输入 request 列表、当前 active request 和显式 `nowMs`。
2. 按 `requestID` 合并 active request，按 `startedAt` 排序；无效时间戳直接丢弃。
3. `streaming / active / reconnecting` 且没有 `completedAt` 的请求，用 `nowMs - startedAt` 投影 `totalDurationMs`，并加上安全上限，避免坏时间戳把图表拉爆。
4. SVG 的 x 轴使用 `startedAtMs` 在 min/max 范围内定位，不用数组下标均分。这样多个请求间隔不均时，曲线仍表达真实请求时间。
5. 图表视觉跟随 GetTokens Swiss-industrial 体系：主线、辅助线、面积填充、硬边界和底部摘要；不要把图表再包成卡中卡。
6. 浏览器 preview 必须提供多条 completed request 加一条 streaming request，让 `#frame=codex&workspace=live-sessions` 能直接验收曲线、footer 和 live marker。

验收组合：

- 纯模型测试覆盖排序、active request 合并、实时 total 投影和 max 值。
- 源码结构断言覆盖 `setInterval`、`nowMs`、`trendChartX(point.startedAtMs...)`、面积 path 和 live marker。
- `node --test src/features/codex-live-sessions/model.test.mjs`、`npm run typecheck`、`npm run build`、必要时完整 `npm run test:unit`。
- 浏览器或 DevTools 检查 SVG 非空、path / circle / dashed marker 数量合理，并归档一张干净 section 截图。

## 不纳入沉淀的临时内容

- 本轮 UI 反复调整过的列宽、阴影、边框细节不写入治理规则；它们属于该页面的当前设计，而不是长期流程。
- 本轮趋势图的具体曲线张力、面积透明度、点半径和截图中浮动调试按钮不写入规则；这些属于当前视觉调参，不是长期约束。
- 不新增独立 `gettokens-codex-live-sessions` skill；当前边界可并入 `gettokens-domain-engineering` 的 Codex workspace / runtime observability 部分。
- 不升级 `AGENTS.md`；已有 fork commit order、Wails binding boundary、docs/memory/qmd 规则已经覆盖 repo-wide 行为。

## 后续复用入口

- 运行时观测、Codex workspace 新 tab、CLIProxyAPI fork 运行链路：使用 `.agents/skills/gettokens-domain-engineering`。
- space、memory、qmd 和收尾整理：使用 `.agents/skills/gettokens-ops-governance`。
- 明确说“整理会话”：先使用 `.agents/skills/gettokens-ops-governance` 的 `Session Skill Distillation`，再按稳定边界写回 skill / docs / memory。

## 验证记录

本轮提交前已通过：

- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/runtime/executor ./sdk/api/handlers/openai`
- GetTokens：`go test ./internal/wailsapp -run CodexLive`
- GetTokens 全量：`go test ./...`
- 前端：`npm --prefix frontend run typecheck`
- 前端模型 / 设计系统：`node --test frontend/src/features/codex-live-sessions/model.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
- 前端构建：`npm --prefix frontend run build`
- 文档结构：`docs-linhay/scripts/check-docs.sh`
