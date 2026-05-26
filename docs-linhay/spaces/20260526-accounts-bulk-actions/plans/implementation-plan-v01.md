# Accounts Bulk Actions 实施计划 v01

## BDD 场景

1. 选择态入口：进入 `#frame=accounts` 后点击“批量选择”，显示选中数量、全选 / 清空、导出、移除、刷新、激活、禁用。
2. 批量刷新：选中多个账号后点击“刷新”，仅对支持额度刷新的账号调用刷新流程；不支持的账号跳过并保留选择态。
3. 批量启停：选中多个账号后点击“禁用”或“激活”，仅对支持启停的账号调用状态更新；跳过项不报错但需要有摘要提示。
4. 批量移除：点击“移除”先进入二次确认，再逐个调用既有删除逻辑；删除后列表与选中态同步清理。
5. 部分失败：某个账号失败时不中断后续账号，最终展示成功 / 跳过 / 失败摘要。
6. 分组操作：分组标题右侧常驻刷新和更多菜单；只有顶部批量选择开启后，才显示本组选择 / 取消选择。
7. 分组启停：分组更多菜单提供激活本组和禁用本组，并复用批量启停执行路径与摘要反馈。

## TDD 顺序

1. 在 `accountSelection.test.mjs` 或新增模型测试中补批量动作目标筛选与结果摘要红灯。
2. 实现 `accountSelection.ts` 中的批量动作纯函数。
3. 在 `useAccountsActions` 中新增批量操作 action，复用现有单账号删除、启停、刷新能力。
4. 在 `AccountsToolbar` / `AccountsListWorkbenchView` 接入选择态批量按钮与二次确认。
5. 在 `AccountGroupSection` / `AccountGroupSectionView` 接入分组选择、刷新、激活、禁用入口。
6. 补中英文文案。

## 验证

1. 前端 focused test：`npm run test:unit -- src/features/accounts/tests/accountSelection.test.mjs`（若项目脚本不支持单文件参数，则直接 `node --test`）。
2. 前端全量 unit：`npm run test:unit`。
3. 类型检查：`npm run typecheck`。
4. 构建：`npm run build`。
5. 无头浏览器打开 `http://localhost:5173/#frame=accounts`，验证选择态工具条与截图归档到 `screenshots/`。

## 风险与边界

- 第一阶段不引入后端批量接口，连续调用单账号接口可能比真正批量慢；但实现风险低，并且能复用现有权限、删除和状态更新边界。
- 删除是危险操作，必须保留二次确认。
- `openai-compatible` provider 与 Codex API key 的删除路径不同，批量移除必须继续走 `resolveAccountDeleteRequest`。
