# Accounts Bulk Toolbar Session Distillation

## 背景

2026-05-27 账号池页面 `#frame=accounts&density=compact` 的批量选择操作栏连续出现三个可复现问题：

- 批量操作可以被页面滚走，或吸顶后顶部仍有空白区域露出账号卡片。
- 操作栏被设计成卡片/分段结构，存在虚线分割和过大的上下间距。
- 横向空间足够时仍把低频批量动作固定收进菜单，降低操作效率。

## 沉淀模式

账号池批量选择动作应作为一个 sticky workbench toolbar 处理，而不是账号列表里的普通卡片子区块。

- sticky 外层负责覆盖滚动容器顶部背景，避免卡片从顶部间距透出。
- 工具栏内部保持单条扫描路径：选中数量、全选/取消全选、清空选择、批量动作。
- 宽屏优先 inline 展开批量动作；只有测量后确认完整 inline 宽度不足时，才把次级动作收进 `MoreVertical` 菜单。
- 删除确认可以复用菜单浮层，不应撑高 sticky toolbar 或打破单行操作栏节奏。

## 验收方式

后续同类改动需要同时覆盖自动化与浏览器实测：

- 纯函数测试：锁定宽度判定边界，例如刚好满足 `inlineWidth + gap` 时不收起，差 1px 时收起。
- 结构测试：锁定 sticky selector、无卡片壳、无虚线分割、存在 inline 与 menu fallback 两条路径。
- 浏览器实测：点击批量选择并滚动内部滚动容器，检查 `stickyRect.top=0`、`topLeak=false`。
- 响应式实测：宽视口确认批量动作 inline 展开；窄视口确认只显示高频动作和更多菜单。

## 本轮验证记录

- 1203px 视口滚动后：可见 `全选 / 清空选择 / 批量刷新 / 导出选中 / 批量激活 / 批量禁用 / 移除`，无更多菜单，`topLeak=false`。
- 720px 视口滚动后：可见 `取消全选 / 清空选择 / 批量刷新 / 更多操作`，低频动作进入菜单，`topLeak=false`。
- 截图归档：
  - `docs-linhay/screenshots/20260527/accounts/20260527-accounts-bulk-toolbar-adaptive-inline-after-v01.png`
  - `docs-linhay/screenshots/20260527/accounts/20260527-accounts-bulk-toolbar-adaptive-menu-after-v01.png`

## 不纳入范围

- 不把该规则升级到 `AGENTS.md`，因为它属于账号池/工作台 UI 领域，不是 repo-wide 流程约束。
- 不要求所有页面的操作栏都采用同一响应式策略；其它页面只有出现相同的 sticky 操作条与横向空间问题时再复用。
