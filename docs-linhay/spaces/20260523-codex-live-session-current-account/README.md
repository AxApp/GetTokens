# Codex 实时会话当前账号判定修复

## 背景

Codex live sessions 页面在账号额度耗尽并切换候选账号后，列表和详情有时仍显示旧账号，看起来像 sidecar 没有切号。经核对，sidecar 已经切换，问题出在 live session 里“当前 request / 当前账号”的选择逻辑仍偏向旧的 session 级 sticky auth 或数组首条 request。

## 目标

1. 让 live sessions 的列表行、详情页和诊断摘要都展示“最新有效 request 的账号”。
2. 处理 `activeRequestID` 缺失、请求已完成、session 已降级等场景时的 request 选择顺序。
3. 用测试锁定：不能再回退到 `requests[0]` 作为默认当前 request。

## 范围

- `frontend/src/features/codex-live-sessions/components/CodexLiveSessionFeed.tsx`
- `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx`
- `frontend/src/features/codex-live-sessions/model/selectors.ts`
- `frontend/src/features/codex-live-sessions/model.test.mjs`
- 必要时补充前端文案或 DTO 映射，不改 sidecar 切号策略本身

## 非目标

1. 不修改 sidecar 的账号选择和重试策略。
2. 不做请求重放或强制切账号控制。
3. 不重构 live sessions 的整体信息架构。

## 验收标准

1. `activeRequestID` 存在时，页面优先展示对应 request 的账号。
2. `activeRequestID` 不存在时，页面优先展示 `lastRequestID` 对应 request。
3. 再无显式 id 时，页面回退到最新 sequence 的 request，而不是数组第一条。
4. 诊断摘要里的账号字段与列表、详情保持一致。
5. 新增或更新测试能锁定上述规则。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260523-codex-live-session-current-account`
- worktree：`../GetTokens-worktrees/20260523-codex-live-session-current-account/`

## 相关链接

## 当前状态
- 状态：ready-for-review
- 最近更新：2026-05-23
