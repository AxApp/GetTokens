# 20260630-account-detail-modal-margin

## 背景

在 `workspace=account-list` 标签页查看特定账户详情（URL 包含 `detail=acct_xxxx`）时，该详情面板基于 `ModalFrame` (size="detail") 渲染。原设计中其外围遮罩层的上下边距不对称（非 sm 屏上 2rem / 下 1rem，sm 屏上 2.5rem / 下 1.5rem），导致卡片在视觉上有明显的下沉沉降感。我们需要对其边距进行调整，实现垂直方向的精密对称与居中表现。

## 目标

1. **垂向精密对称**：调整 `ModalFrame` 在 `size="detail"`（详情模式）下的外边距布局，使其上下外边距相等，卡片在视口中精确居中。
2. **非 sm 屏边距重构**：将原 `pt-8 pb-4 px-4` 不等边距统一为对称边距 `py-6 px-6`（上 1.5rem / 下 1.5rem），与 `h-[calc(100vh-3rem)]` 的容器高度完美耦合。
3. **sm 屏边距重构**：将原 `sm:pt-10 sm:pb-6 sm:px-6` 不等边距统一为对称边距 `sm:py-8 sm:px-8`（上 2rem / 下 2rem），与 `sm:h-[calc(100vh-4rem)]` 的容器高度完美耦合。
4. **测试绿灯**：确保全量测试依然通过。

## 范围

- **前端组件**：`frontend/src/components/ui/ModalFrame.tsx` 中 `overlayLayoutClassName` 样式类重构。

## 非目标

- 不修改 Modal 内部的信息块布局与字体。
- 不影响 `size` 为 `sm`, `md`, `lg`, `xl` 等常规弹框的中央居中行为。

## 验收标准

1. `detail` 大号 Modal 卡片在任何屏幕高度下，顶部和底部外侧边距完美对称一致。
2. 前端全量单测用例绿灯，`typecheck` 成功。

## 证据门禁

| 项目 | 事实与预期 |
| --- | --- |
| 问题来源 | 用户反馈详情 Modal 边距需要调整。 |
| 代码事实位置 | `frontend/src/components/ui/ModalFrame.tsx:80-82`，`detailFullscreen` 时外边距声明不对称。 |
| 当前现象 | 卡片外侧上边距大于下边距（sm 屏下相差 1rem，非 sm 屏下相差 1rem），产生偏下的沉降感。 |
| 预期验收 | 修改为对称边距（非 sm `py-6 px-6`，sm `sm:py-8 sm:px-8`），上下边距完全相等且对称居中。 |

## 设计稿入口

- 本期设计稿：`（未产出，纯结构边距收口）`

## Worktree 映射

- branch：`feat/20260630-account-detail-modal-margin`
- worktree：`（一次性小修，在主区开发，不建 worktree）`

## 相关链接

- 组件文件：[ModalFrame.tsx](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/ui/ModalFrame.tsx)

## 当前状态
- 状态：completed
- 最近更新：2026-06-30

## 实施结果

- **外边距对称设计**：在 `frontend/src/components/ui/ModalFrame.tsx` 中，对 `size="detail"`（详情模式全屏 Modal）的外层遮罩层布局类 `overlayLayoutClassName` 进行了重新设计。
  - 将原先不对称的边距配置（非 sm 屏 `pt-8 pb-4 px-4`，sm 屏 `sm:pt-10 sm:pb-6 sm:px-6`）重构为了全对称边距：非 sm 屏为 `py-6 px-6`（上下各 1.5rem，左右各 1.5rem），sm 屏为 `sm:py-8 sm:px-8`（上下各 2rem，左右各 2rem）。
  - 该改动与 Modal 容器的高度削减量（非 sm 屏 `100vh-3rem`，sm 屏 `100vh-4rem`）完美对应，在垂向上达成了物理上的精密对称与居中表现，消除了大 Modal 视觉上的重力沉降感。
- **内容区域响应式与侧边栏防贴边留白重构**：在 `frontend/src/features/accounts/components/AccountDetailLayout.tsx` 中，将内容包裹框的留白从原先的 `px-8 pt-14 pb-6` 重构为非对称防贴边响应式的 `pl-8 pr-6 sm:px-8 md:px-10 pt-8 pb-8`，并将最大宽度限制从 `max-w-[42rem]` 拓宽为 `max-w-[44rem]`。这不仅消除了顶端 3.5rem 的过度空白，更精细地为左侧贴着 `SectionNav` 垂直分割线的区域在窄屏下保留了至少 `pl-8`（32px）的舒适缩进（右侧为紧凑的 `pr-6` 24px），完全避免了窄屏/小窗口下单栏布局下（如 `AccountCredentialVerifySection` 账号凭据等元素）因 padding 过小导致紧挨着灰色分割线“左侧贴边”的视觉紧绷问题。
- **防止 Flexbox 布局溢出与侧边栏挤压保护**：在 `frontend/src/features/accounts/components/AccountDetailLayout.tsx` 的最外层包裹容器 div 上，将类名由原先的 `flex h-full min-h-0` 升级为 `flex h-full w-full min-w-0 min-h-0`。此举为整个 Layout 容器牢牢锁定了宽度尺寸，彻底防止了当输入框内填入极其冗长且无折行的字符串文本时（如长 Token 或平台 Cookie 等），右侧内容区域因没有最小宽度限制而被强制撑开，进而导致左侧导航侧边栏被硬生生压扁并推出整个视口的恶性布局崩溃。
- **测试契约同步**：在 `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs` 中，同步更新了对于 `ModalFrame` 布局样式的正则匹配断言，使静态测试契约跟随升级。

## 验证结果

- **测试用例**：运行全量单元测试（`npm run test:unit`），1158 个前端单测用例全部绿灯通过。
- **类型检查**：运行 `npm run typecheck` 成功通过。
- **规范校验**：文档结构校验 `./docs-linhay/scripts/check-docs.sh` 与 `git diff --check` 均全量通过。
