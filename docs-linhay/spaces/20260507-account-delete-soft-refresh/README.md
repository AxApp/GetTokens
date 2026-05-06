# Account Delete Soft Refresh

## 背景
账号页删除单个账号时，删除成功后会调用 `loadAccounts()` 全量刷新。当前 `loadAccounts()` 会把页面级 `loading` 置为 `true`，导致账号列表区域整体切换为 skeleton，看起来像刷新了整个页面。

## 目标
删除单个账号后，只从当前列表中移除对应账号卡片，同时后台静默重新拉取 Wails 事实源，保持账号、quota、usage、选择状态一致。

## 范围
- Codex auth-file 账号删除。
- Codex API key 账号删除。
- 删除后的账号列表局部更新、选中态清理与静默重载。

## 非目标
- 不改变新增、上传、导入、重命名、优先级保存等其他操作的全量刷新策略。
- 不调整后端删除接口或 Wails binding。
- 不引入新的动画系统。

## 验收标准
1. Given 账号列表已有多个账号，When 删除其中一个账号成功，Then 页面只移除该账号卡片，不把整个账号列表切换为 skeleton。
2. Given 删除的是当前详情弹窗选中的账号，When 删除成功，Then 详情选择被清空，避免展示已删除账号。
3. Given 删除成功后后台事实源发生变化，When 静默重载完成，Then 列表、选择状态、quota/usage 请求基于最新账号集合对齐。
4. Given 删除失败，When 后端返回错误，Then 保留当前列表并展示删除错误。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260507-account-delete-soft-refresh`
- worktree：`../GetTokens-worktrees/20260507-account-delete-soft-refresh/`

## 相关链接
- 实现：`frontend/src/features/accounts/hooks/useAccountsPageState.ts`
- 实现：`frontend/src/features/accounts/hooks/useAccountsActions.ts`
- 测试：`frontend/src/features/accounts/tests/accountDelete.test.mjs`

## 当前状态
- 状态：done
- 最近更新：2026-05-07
