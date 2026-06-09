# 2026-06-09 Group Delete Plan

## 场景

用户在账号池分组标题右侧的更多菜单中，已经能激活/禁用整组账号；同一批量操作语境下，需要支持删除整组账号。删除属于危险操作，必须先展示二次确认，再复用现有账号批量删除链路。

## 验收

1. 分组更多菜单显示“删除本组”，与禁用一样使用危险色。
2. 首次点击“删除本组”只展开确认区，不直接删除。
3. 确认后以 `group.accounts` 作为目标调用账号批量删除 action。
4. 批量删除仍走 `DeleteAccountsBatch`，不可删除的 legacy / 非 unified 账号按现有 `resolveBulkDeleteTargets` 跳过。
5. 删除完成后清理本地列表、选中态与结果摘要；失败时展示错误摘要。
6. 搜索或筛选激活时，分组删除文案显示为“移除本组当前显示账号”，确认文案明确只删除当前显示账号。

## 实施顺序

1. 红灯：补测试锁定分组菜单必须有 `onDeleteGroup`、确认态和“删除本组”文案。
2. 绿灯：抽出 `runAccountsBulkDelete(targetAccounts, label)`，让 selected 与 group 两个入口共用。
3. 接线：`AccountsFeature -> AccountGroupSection -> AccountGroupSectionView` 传递 `onDeleteGroup`。
4. 验证：跑 focused 单测、typecheck、文档校验；必要时跑无头浏览器 DOM/screenshot。
