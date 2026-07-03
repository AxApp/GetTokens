# 20260630-account-card-frame-redesign

## 背景

`AccountCardFrame` 作为 GetTokens 所有账号卡片（如 `AttributionCard`）的底层通用容器组件，原本仅是简单地包裹 `{children}`。为了提供更 premium 的视觉体验与无障碍可访问性（a11y），我们需要对其内部结构进行重新设计，优化其在聚焦（focus-visible）、激活（active）等交互状态下的样式细节，并加强布局的健壮性。

## 目标

1. **结构化容器重塑**：在 `Card` 内部为 `{children}` 提供弹性布局内衬包裹，增强子元素占满高度与尺寸响应的稳定性。
2. **优雅的焦点视觉表现**：在 `style.css` 中引入对 `[data-account-card]:focus-visible` 的高清晰度轮廓线微调，移除浏览器粗糙的默认 outline，对齐 Quiet Workspace。
3. **可访问性（Accessibility）升级**：为交互性卡片在内部增加无障碍隐藏指引文本（sr-only），使屏幕阅读器能够准确播报操作提示。
4. **测试绿灯**：确保所有修改对齐现有的测试契约与样式防回流门禁。

## 范围

- **前端组件**：`frontend/src/features/accounts/components/AccountCardFrame.tsx` 中的 `Card` 内部结构重新排布。
- **公共样式**：`frontend/src/style.css` 补充关于卡片聚焦、交互态等修饰类。
- **自动化测试**：运行全量单元测试与类型校验确保没有 regression。

## 非目标

- 不重新开发各账号卡片的具体信息展示块（保留 `AttributionCard` 既有字段）。
- 不引入重影动效或破坏 Quiet Workspace 静态视觉规范的渐变。

## 验收标准

1. 账号卡片交互正常，鼠标 hover、键盘 Tab 聚焦时有精致且清澈的视觉边缘反馈。
2. 可访问性辅助标签存在，对屏幕阅读器友好。
3. 前端全量单测 100% 绿灯，`typecheck` 成功。

## 证据门禁

| 项目 | 事实与预期 |
| --- | --- |
| 问题来源 | 用户要求重新设计 `AccountCardFrame` 的 `Card` 内部。 |
| 代码事实位置 | `frontend/src/features/accounts/components/AccountCardFrame.tsx` 中 `{children}` 没有进行布局性与无障碍包装。 |
| 当前现象 | 卡片没有精致的键盘聚焦指示，缺少无障碍深度支持，内层 children 在复杂布局下可能会有尺寸撑爆风险。 |
| 预期验收 | 引入内衬 flex 容器、sr-only 操作提示与优雅的 `:focus-visible` 轮廓线样式。 |

## 设计稿入口

- 本期设计稿：`（未产出，纯结构及样式收口）`

## Worktree 映射

- branch：`feat/20260630-account-card-frame-redesign`
- worktree：`（一次性小修，在主工作区开发，不建 worktree）`

## 相关链接

- 卡片框代码：[AccountCardFrame.tsx](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/AccountCardFrame.tsx)
- 公共样式表：[style.css](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/style.css)

## 当前状态
- 状态：completed
- 最近更新：2026-06-30

## 实施结果

- **容器结构优化**：在 `frontend/src/features/accounts/components/AccountCardFrame.tsx` 中，将 Card 内部的 `{children}` 包裹进了统一的 `<div className="account-card-frame-inner relative flex h-full flex-1 flex-col min-w-0">` 弹性包装层，确保了子元素的高宽布局稳定性。
- **无障碍辅助（a11y）**：为 `interactive={true}` 的卡片额外渲染了一个隐藏的辅助提示 `<span className="sr-only">Interactive account card. Press Enter or Space to open details.</span>`，提升了可访问性体验。
- **样式细节与 AntD 规范对齐**：在 `frontend/src/style.css` 中重构了 `[data-account-card]` 类：
  - 移除了默认的 outline，引入了平滑的 `border-color` transition 过渡。
  - 对齐 Ant Design 默认主色调聚焦规范，将 `:focus-visible` 的聚焦 `border-color` 调整为 `var(--gettokens-color-primary, #1677ff)`。
  - 为 `:focus-visible` 的 `outline` 颜色使用 `color-mix(in srgb, var(--gettokens-color-primary, #1677ff) 20%, transparent)`，使卡片被键盘聚焦时的外圈呈现出精致、半透明的 AntD 焦点轮廓视觉，不仅完全与 status-tint 状态指示线和谐共存，更能自适应主题预设。
  - 增加公共 `.sr-only` 视障隐藏辅助类样式。

## 验证结果

- **测试绿灯**：运行 `npm run test:unit`，1158 个前端单元测试全部通过。
- **类型检查**：运行 `npm run typecheck` 成功无报错。
- **差异规范**：运行 `git diff --check` 与 `./docs-linhay/scripts/check-docs.sh` 全量通过。
