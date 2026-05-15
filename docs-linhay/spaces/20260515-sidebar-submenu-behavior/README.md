# 20260515-sidebar-submenu-behavior

## 背景
- Sidebar 二级菜单上一轮改成了 hover/focus 浮出，但当前实现把 `accounts` / `codex` 子菜单统一固定在一级菜单右侧。
- 在展开态侧边栏中，这会导致宽屏下的二级菜单仍然像收起态一样悬浮到右边，阅读路径断开。
- 现有展开状态只依赖 hover；点击一级菜单后，一旦鼠标离开一级按钮和右侧间隙，二级菜单会立刻消失，无法稳定移动到子菜单按钮。

## 目标
- 收起态侧边栏继续保留“右侧浮层”二级菜单，兼容窄宽度导航。
- 展开态侧边栏把二级菜单放到一级菜单下方，形成稳定的纵向浏览路径。
- 点击 `accounts` 或 `codex` 一级菜单后，当前二级菜单需要固定展开，直到用户切换到其他一级菜单。
- 一级侧边栏宽度切换、二级菜单展开和收起都要具备平滑过渡，而不是瞬时跳变。

## 范围
- 调整 `frontend/src/components/biz/Sidebar.tsx` 的二级菜单定位与展开状态。
- 提取并测试 sidebar 二级菜单的展开优先级与定位规则。
- 为侧边栏宽度和二级菜单补 CSS 过渡动画。
- 保持现有 `accounts` / `codex` workspace 切换逻辑不变。

## 非目标
- 不调整 Sidebar 的视觉主题、品牌区、版本区样式。
- 不重做整个一级/二级导航信息架构。
- 不引入新的桌面端专属交互或拖拽行为。

## 验收标准
- 当侧边栏为展开态时，`accounts` / `codex` 的二级菜单显示在对应一级菜单下方，而不是右侧。
- 当侧边栏为收起态时，`accounts` / `codex` 的二级菜单仍显示在一级菜单右侧。
- 点击 `accounts` 或 `codex` 一级菜单后，二级菜单在鼠标离开一级按钮时不会立即关闭，用户可以稳定移动到二级菜单按钮。
- 点击其他一级菜单后，已固定的二级菜单会关闭。
- 侧边栏本体宽度切换具备平滑过渡；二级菜单展开/收起具备 opacity + 位移过渡，宽屏底部展开额外具备高度过渡。
- 品牌文案、一级菜单文字、一级菜单箭头和版本文案在展开/收起时具备淡入淡出和轻微位移/缩放过渡，不直接卸载。
- `sidebarState` 回归测试覆盖“点击固定优先于 hover 清空”、“展开/收起态定位规则”和“不同定位下的动画状态映射”。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260515-sidebar-submenu-behavior`
- worktree：`../GetTokens-worktrees/20260515-sidebar-submenu-behavior/`

## 相关链接
- [Sidebar 组件](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/biz/Sidebar.tsx)
- [Sidebar 状态函数](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/biz/sidebarState.ts)
- [Sidebar 状态测试](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/biz/sidebarState.test.mjs)

## 当前状态
- 状态：done
- 最近更新：2026-05-15
