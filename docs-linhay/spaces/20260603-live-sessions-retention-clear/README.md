# 20260603-live-sessions-retention-clear

## 背景

用户反馈 `#frame=codex&workspace=live-sessions` 的“运行会话-会话列表”在请求运行期间会出现“闪一下就消失”的现象。按运行态观测语义，列表应作为当前工作台的实时导航：运行期间新捕获的会话只应追加或更新，不应因为某次 sidecar snapshot 暂时漏行而从导航区移除。

## 目标

1. 修复会话列表在连续轮询期间被后续 snapshot 缩短导致的闪退/消失。
2. 在会话列表导航区增加“清空”按钮，允许用户显式清空当前实时 snapshot/本地保留列表。
3. 保留 sidecar 为运行态自治层：桌面模式清空应调用 `DELETE /v0/management/gettokens/live-sessions`，前端只做展示状态同步。

## 范围

- Codex Live Sessions 前端 snapshot 合并模型。
- Codex Live Sessions 会话列表导航区按钮。
- Wails App 清空实时 live sessions 的桥接方法与绑定。
- 聚焦测试：前端 merge 单测、Wails management API 单测、typecheck 与 docs 校验。

## 非目标

- 不删除磁盘历史 ledger；本次只清理 realtime snapshot。
- 不改变 live session history 分页详情接口。
- 不触碰正式版 `/Applications/GetTokens.app`。

## 验收标准

1. Given 当前列表已有会话 A/B，When 下一次 live snapshot 只返回 A，Then UI 合并结果仍保留 A/B，避免运行期间 B 闪退。
2. Given 用户点击会话列表导航区“清空”，When 桌面 Wails 绑定可用且 sidecar ready，Then 调用 `DELETE /v0/management/gettokens/live-sessions` 并清空本地选中/详情/列表。
3. Given 浏览器预览模式，When 点击“清空”，Then 不依赖 Wails 绑定，直接清空本地列表。
4. 自动化验证通过：`go test ./internal/wailsapp`、`node --experimental-strip-types frontend/src/features/codex-live-sessions/model.test.mjs`、`npm run typecheck`、`docs-linhay/scripts/check-docs.sh`。

## 设计稿入口

- 本期设计稿：`（未产出，按钮沿用现有 btn-swiss 列表导航区样式）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`（短改动，主工作区直接处理）`
- worktree：`（未创建）`

## 相关链接

- 代码：`frontend/src/features/codex-live-sessions/model/snapshotMerge.ts`
- 代码：`frontend/src/features/codex-live-sessions/components/CodexLiveSessionFeed.tsx`
- 代码：`internal/wailsapp/codex_live_sessions.go`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-03

## 追加需求：会话列表表头切换请求汇总

### 需求

用户要求“会话列表”的表头也能点击切换；切换后展示当前保留窗口内的汇总请求，并重新设计表头文案。

### 实现

- 表头从静态标题“会话列表”改为双态切换：
  - `会话导航`：按项目/账号组织当前运行会话。
  - `请求汇总`：汇总当前会话窗口内的请求，点击请求回到所属会话详情。
- 请求汇总支持两类来源：
  - snapshot 内嵌 `requests`：逐条展示请求。
  - row-only snapshot：使用 `activeRequestID / lastRequestID` 合成导航行，避免桌面实时 snapshot 无内嵌 request 时请求汇总为空。
- 请求行展示：请求短 ID、协议、项目、模型、账号、总耗时/TTFT、序号与状态。

### 验收补充

1. Given 用户在会话列表表头点击 `请求汇总`，Then 列表切换为请求级汇总行，右上计数单位显示 `个请求`。
2. Given 用户在 `请求汇总` 点击任一请求行，Then 选中其所属会话并打开/刷新右侧详情。
3. Given snapshot 没有内嵌 `requests` 但有 `activeRequestID`，Then 请求汇总仍展示一条合成请求导航行。

### 验证补充

- `node --experimental-strip-types frontend/src/features/codex-live-sessions/model.test.mjs`：62/62 通过。
- `npm run typecheck`：通过。
- `npm run build`：通过（仅有既有 chunk size warning）。
- `go test ./internal/wailsapp`：通过（cached）。
- `docs-linhay/scripts/check-docs.sh`：通过。
