# 20260630-account-detail-layout-redesign

## 背景
用户反馈，在打开详情 Modal 后，窄屏下内部布局左侧贴边（例如 `AccountCredentialVerifySection` 处），并且原有的输入框排版（占满全宽且纵向堆叠）造成界面显得过于臃肿、不协调。用户要求“重新设计内部布局”。

## 目标
- 重新设计 Account Detail 内各 Section 的表单和信息展示布局。
- 解决贴边问题，修正 `AccountDetailLayout` 和 `AccountDetailSections` 内不合理的 padding/margin 与最大宽度。
- 采用更高密度的信息排版（例如将表单改为 inline-label 或响应式的两列栅格），优化信息层级与留白，提升视觉高级感（对齐 AntD 规范和设计原则）。

## 范围
- 修改 `frontend/src/features/accounts/components/AccountDetailSections.tsx` 中的 `AccountCredentialVerifySection` 及表单项（如 `CredentialInputField`）。
- 调整详情页外围的容器宽度、内边距，确保内容不会在窄屏下贴边，且宽屏下展示不过分拉伸。

## 非目标
- 不重构后端的接口逻辑。
- 不影响路由或核心数据结构的正确性。

## 验收标准
- 详情页面在桌面窗口（例如 1024x768 或更窄的抽屉状态）不再有内容紧贴左侧边缘的情况。
- 账号名称、API 密钥等表单项在视觉上具有良好的对齐方式与边界感，不再是粗糙的全宽矩形块。
- 通过 Wails/无头浏览器确认界面渲染正常且不出现水平溢出。
- 无报错且单测全部通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260630-account-detail-layout-redesign`
- worktree：`../GetTokens-worktrees/20260630-account-detail-layout-redesign/`

## 相关链接

## 当前状态
- 状态：done
- 最近更新：2026-07-01
