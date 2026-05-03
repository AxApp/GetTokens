# 20260429 Text Scale Settings

## 背景

用户反馈 GetTokens 当前界面的文字整体偏小，连续使用时存在阅读负担。问题不是单一页面样式失误，而是当前黑白红 mono 视觉体系为了追求高密度，广泛使用了 `text-[8px]`、`text-[9px]`、`text-[10px]` 等固定字号，且缺少“用户可调节”的全局文字缩放层。

当前已确认：
1. `Settings` 页面已有主题、语言、本地投影刷新间隔等偏好设置，具备继续承载“显示设置”的产品位置。
2. `ThemeContext` / `I18nContext` 已使用前端本地持久化模式，适合作为文字缩放偏好的实现参考。
3. 高风险受影响区域集中在 `Sidebar`、`Settings`、`Status`、`Accounts`、详情/编辑类弹窗与 `Usage Desk`。

## 目标

1. 为用户提供一个明确、稳定、全局生效的“文字大小”设置项。
2. 在不破坏现有产品视觉语言的前提下，提高核心界面的可读性与可点击性。
3. 把散落在组件里的固定字号收口成可维护的 typography scale。
4. 为后续更多可访问性设置预留实现边界。

## 范围

1. 产品方案规划：
   - 设置入口放在 `Settings -> Appearance`
   - 明确档位、默认值、文案与持久化策略
2. 前端实现边界规划：
   - 新增全局 text scale preference
   - 新增 `TextScaleContext + CSS variable + typography token`
   - 收口共享组件与高风险页面的字号使用方式
3. 回归验收规划：
   - `Sidebar`
   - `Settings`
   - `Status`
   - `Accounts`
   - 账号详情/编辑类弹窗
   - `Usage Desk`

## 非目标

1. 本轮不改系统字体家族，不把 mono 风格整体替换为比例字体。
2. 本轮不实现任意百分比滑杆，也不做复杂的系统无障碍适配桥接。
3. 本轮不顺手重做所有视觉层级；重点是可读性和稳定落地，不是整套 UI redesign。
4. 本轮不采用浏览器/webview 缩放作为产品方案。

## 验收标准

1. 用户能在 `Settings` 页面看到“文字大小”设置项，并能在 2 到 3 个离散档位中选择。
2. 修改设置后，全局界面即时生效，重新打开 APP 后仍保留用户选择。
3. 默认档位下视觉与当前版本保持近似一致，不引入无意布局回归。
4. 放大档位下，`Sidebar`、`Settings`、`Status`、`Accounts`、核心弹窗和 `Usage Desk` 不出现大面积文字重叠、按钮内容被截断或关键指标不可见。
5. 新实现不是“逐组件写死另一套字号”，而是形成一层共享的 text scale 机制。

## 当前裁定

### 产品口径
1. 能力定义为“文字大小”，不是“页面缩放”。
2. 推荐档位固定为：
   - `默认`
   - `较大`
   - `更大`
3. 设置入口放在 `Settings -> Appearance`。
4. 首版默认沿用前端本地偏好持久化，不引入 Go / sidecar 配置写回。

### 技术口径
1. 先做 `TextScaleContext + typography tokens`。
2. 再改共享控件和极薄基础层。
3. 最后替换页面级硬编码字号。
4. 当前优先进入第一批的可复用基础层只有：
   - `typography tokens`
   - 升级版 `SegmentedControl`
   - 极薄 `ModalFrame`
   - 微型文案原语：`Eyebrow / FieldLabel / MetaCode / HelperText`

### 当前实现进度
1. 已新增前端本地持久化的 `TextScaleContext`，支持 `default / large / x-large` 三档，并在 `App` 根层接入。
2. 已通过 root CSS variable 与 `html font-size` 驱动全局文字缩放基线。
3. `Settings -> Appearance` 已新增“文字大小”设置项，风格与现有 `Theme / Language` 一致。
4. `SegmentedControl` 已接入第一批 text scale token：字号、高度、左右内边距、选中条高度。
5. 页面级收口现已覆盖：
   - `Sidebar`
   - `Settings`
   - `Status`
   - `AccountCard`
   - `AccountDetailModal`
   - `Usage Desk`
   - 以及一批高频账号弹窗/工具条里的 `8/9/10px` 文本到 `rem` 的替换
6. 当前前端代码已不存在 `text-[Npx]` 形式的固定字号类名；核心文字缩放链路已完成从设置入口到页面响应的闭环。
7. 已完成 Wails dev 绑定层回归：通过 `http://localhost:34115` 验证设置页三档切换会同步更新 root `data-text-scale`、`html font-size` 与 settings typography token。
8. 已归档本轮截图证据：
   - `screenshots/20260429/text-scale-settings/20260429-text-scale-settings-page-default-baseline-v01.png`
   - `screenshots/20260429/text-scale-settings/20260429-text-scale-settings-page-large-baseline-v01.png`
   - `screenshots/20260429/text-scale-settings/20260429-text-scale-settings-page-x-large-baseline-v01.png`
   - `screenshots/20260429/text-scale-settings/20260429-text-scale-debug-page-x-large-baseline-v01.png`
   - `screenshots/20260429/text-scale-settings/20260429-text-scale-accounts-page-x-large-baseline-v01.png`
9. 当前环境下真实 `GetTokens.app` 进程已成功拉起，但终端缺少 macOS 辅助访问与屏幕录制权限，无法继续自动操控原生窗口或直接抓取桌面窗口截图；本轮因此以“Wails 绑定层页面验证 + 原生进程运行证据”完成自动化闭环。
10. 尚未继续推进的部分只剩“更系统化的组件抽象”，但这不再阻塞本需求的用户价值与验收闭环。

## 设计稿入口

- 本期设计稿：`text-scale-design-gallery.html`
- 约束：本期只以这一个 HTML 文件作为当前主入口；若需要比较多个字号档位，也在该文件内完成。
- 历史过程稿：`text-scale-design-option-a-editorial-utility.html`、`text-scale-design-option-b-raw-terminal-control-room.html`、`text-scale-design-option-c-warm-paper-console.html` 仅保留参考，不再作为当前主入口。

## Worktree 映射

- branch：`feat/20260429-text-scale-settings`
- worktree：`../GetTokens-worktrees/20260429-text-scale-settings/`

## 相关链接

- [text-scale-design-gallery.html](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/text-scale-design-gallery.html)
- [实施计划 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-text-scale-settings-plan-v01.md)
- [组件复用候选 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-component-reuse-candidates-v01.md)
- [handoff v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-text-scale-settings-handoff-v01.md)
- [debate v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/debate/20260429/text-scale-settings/20260429-text-scale-settings-v01.md)
- [默认档截图](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/screenshots/20260429/text-scale-settings/20260429-text-scale-settings-page-default-baseline-v01.png)
- [更大档截图](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/screenshots/20260429/text-scale-settings/20260429-text-scale-settings-page-x-large-baseline-v01.png)
- [Debug 页截图](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/screenshots/20260429/text-scale-settings/20260429-text-scale-debug-page-x-large-baseline-v01.png)
- [Accounts 页截图](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-text-scale-settings/screenshots/20260429/text-scale-settings/20260429-text-scale-accounts-page-x-large-baseline-v01.png)
- `frontend/src/context/ThemeContext.tsx`
- `frontend/src/context/I18nContext.tsx`
- `frontend/src/features/settings/SettingsFeature.tsx`
- `frontend/src/style.css`

## 当前状态

- 状态：implemented-complete
- 最近更新：2026-04-29
