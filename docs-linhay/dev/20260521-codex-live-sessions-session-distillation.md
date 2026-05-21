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

### 4. fallback 只能观测和提示，不承诺透明恢复

Codex upstream HTTP fallback 属于 Codex / sidecar 运行时链路的 sticky 状态。GetTokens 可以：

- 记录 downstream / upstream transport。
- 推断 `WS -> HTTP` 降级。
- 展示降级提示和诊断摘要。

GetTokens 不应宣称可以在同一个已降级会话中透明恢复 WebSocket。若未来要做主动恢复，必须单独设计取消/重放/新会话语义和用户确认。

### 5. 脏工作区提交要双仓精确暂存

本轮工作区存在大量 Claude Code 并行改动，Codex live sessions 提交必须做到：

1. CLIProxyAPI fork 先提交运行时 tracker 和管理端点。
2. 父仓库再提交 fork gitlink、GetTokens Wails、前端和文档。
3. 使用 `git add -p` 或精确路径暂存，避免混入无关 Claude / asset workbench / session-management 改动。
4. 提交前运行 `git diff --cached --check`，特别注意生成文件局部 hunk 的尾随空白。

## 不纳入沉淀的临时内容

- 本轮 UI 反复调整过的列宽、阴影、边框细节不写入治理规则；它们属于该页面的当前设计，而不是长期流程。
- 不新增独立 `gettokens-codex-live-sessions` skill；当前边界可并入 `gettokens-domain-engineering` 的 Codex workspace / runtime observability 部分。
- 不升级 `AGENTS.md`；已有 fork commit order、Wails binding boundary、docs/memory/qmd 规则已经覆盖 repo-wide 行为。

## 后续复用入口

- 运行时观测、Codex workspace 新 tab、CLIProxyAPI fork 运行链路：使用 `.agents/skills/gettokens-domain-engineering`。
- space、memory、qmd 和收尾整理：使用 `.agents/skills/gettokens-ops-governance`。
- 明确说“整理会话”：先使用 `.agents/skills/gettokens-session-skill-distill`，再按稳定边界写回 skill / docs / memory。

## 验证记录

本轮提交前已通过：

- CLIProxyAPI fork：`go test ./internal/gettokenshooks ./internal/runtime/executor ./sdk/api/handlers/openai`
- GetTokens：`go test ./internal/wailsapp -run CodexLive`
- GetTokens 全量：`go test ./...`
- 前端：`npm --prefix frontend run typecheck`
- 前端模型 / 设计系统：`node --test frontend/src/features/codex-live-sessions/model.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
- 前端构建：`npm --prefix frontend run build`
- 文档结构：`docs-linhay/scripts/check-docs.sh`
