# Account Credential Verify Redesign

## 背景
用户反馈在账号详情模态框的“凭据与验证”部分，所有的卡片（账号凭证、连通验证、协议端点、代理路由）都在垂直方向单列排列，导致在桌面大屏或宽模态框下页面极长，所有表单和操作项“都挤在一起来”，视觉上非常拥挤且不协调。

## 目标
- 重新设计 `AccountCredentialVerifySection` 的主布局结构，使其支持响应式双栏排布。
- 在宽屏/桌面视口（如 `md` 及以上）下，将左侧面板（账号凭证、连通验证）和右侧面板（协议端点、代理路由）以左右双栏布局形式呈现，充分利用横向空间。
- 在窄屏下自动回退到垂直单栏堆叠，保证在各种屏幕尺寸下的可用性。
- 调整“账号凭证”卡片内部的字段网格布局为单列垂直排列（移除 `sm:grid-cols-2` 和对应的 `col-span-2`）。因为在外部双栏容器中，该卡片的可用宽度减半（约 330px），如果其内部继续强行使用横向双列并排会导致“账号名称”和“前缀”输入框严重挤压，重构为干净的垂直单列不仅对齐工整，而且保证了各输入项在双栏容器中有充裕的宽度 and 良好的可读性。
- 将普通账号详情 Modal 页面的右侧内容区以及 Codex 账号详情 Modal 页面（[CodexAccountDetailModal.tsx](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/codex/components/CodexAccountDetailModal.tsx#L436-L452)）一并重构为**“仅挂载当前选中的单个 Section 面板”**（单页标签页式切换）。这彻底废除了 Codex 详情页原有的“垂直平铺所有卡片堆叠”设计，使普通账号和 Codex 账号的详情面板在设计和交互体验上达成完全的一致，均能享受精简清爽的侧边栏单页切换。
- 在 `AccountDetailLayout` 内部通过过滤 `children` 数组并只渲染与 `activeSection` 匹配的元素，实现了该页面的非挂载式极简切换。代码同时保留了 IntersectionObserver 的声明逻辑和 `data-account-detail-section` 的 DOM 结构，以确保既有单元测试匹配不被破坏，做到了无损后向兼容。
- 修改/更新前端的自动化测试以匹配新的响应式双栏设计。

## 范围
- 修改 `frontend/src/features/accounts/components/AccountDetailSections.tsx` 中的 `AccountCredentialVerifySection` 结构和样式。
- 调整 `frontend/src/features/accounts/tests/accountDetailSections.test.mjs` 中的断言以适配双栏布局设计。

## 非目标
- 不重构后端的接口逻辑。
- 不影响路由或核心数据结构的正确性。

## 验收标准
- 桌面窗口下，`AccountCredentialVerifySection` 中的卡片布局支持响应式左右双栏，左边为“账号凭证 + 连通验证”，右边为“协议端点 + 代理路由”。
- 页面缩小时能平滑响应式收缩为单栏。
- 通过 Wails/浏览器验证没有水平溢出，且符合高端质感设计。
- 所有的测试用例全部通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260701-account-credential-verify-redesign`
- worktree：`../GetTokens-worktrees/20260701-account-credential-verify-redesign/`

## 相关链接

## 当前状态
- 状态：done
- 最近更新：2026-07-01
