# 20260603-account-card-route-guard-progress

## 背景
账号卡片已经承载账号身份、额度、usage 与 route guard 状态，但当前操作入口和运行态进度不完整：

- Codex OAuth 账号的“重新登录”只在卡片底部操作区出现，右上角菜单缺少同等入口；在紧凑或列表密度下不够可达。
- 配置 route guard 后，卡片只展示规则百分比，缺少类似额度模块的窗口标题、当前/上限、重置/评估时间和 stale/degraded 提示，用户无法快速判断保护规则进度。

## 目标
1. 在账号卡片右上角菜单中为所有 Codex OAuth/auth-file 账号添加“重新登录”选项，复用现有 `onStartReauth` 行为和 pending 状态。
2. 将账号卡片上的 route guard 进度展示调整为额度模块同类信息结构：规则标题、当前/上限、进度条、窗口与重置/评估信息。
3. 保持 route guard 展示消费 sidecar/Wails 投影的 `RateLimitState`，不在前端重新推断阻塞条件。

## 范围
- `frontend/src/features/accounts/components/AccountCard.tsx`
- `frontend/src/features/accounts/components/CardSections.tsx`
- `frontend/src/features/accounts/model/rateLimit.ts`
- 前端账号相关单元测试

## 非目标
- 不改 sidecar route guard 评估逻辑。
- 不新增移动端适配门禁。
- 不调整账号详情页 route guard CRUD 表单。

## 验收标准
1. 对 `isCodexAuthFile(account)` 为真的账号，右上角菜单显示“重新登录”；点击后关闭菜单并调用 `onStartReauth(account)`。
2. OAuth pending 时，菜单里的“重新登录”显示 pending 文案并禁用。
3. 配置 route guard 且有规则状态的账号卡片，展示每条规则的：
   - 规则标签与 `currentUsage / limitValue`
   - 百分比进度条
   - window 与 next reset / last evaluated 信息
4. route guard stale/degraded 时，卡片上显示可见警告，不把陈旧数据伪装成正常 pass。
5. 相关前端单元测试通过，至少覆盖菜单入口和 route guard 展示模型。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`（主工作区短改动，未创建独立分支）`
- worktree：`（未创建；当天可闭环小范围改动）`

## 相关链接
- 截图：`screenshots/20260603/account-card/20260603-account-card-routeguard-after-v01.png`
- 相关代码：
  - `frontend/src/features/accounts/components/AccountCard.tsx`
  - `frontend/src/features/accounts/components/CardSections.tsx`
  - `frontend/src/features/accounts/model/rateLimit.ts`

## 验证记录
- 2026-06-03：先补红灯测试后实现，聚焦测试 `node --test src/features/accounts/tests/rateLimit.test.mjs src/features/accounts/tests/accountCardInteractions.test.mjs` 通过。
- 2026-06-03：`npm run typecheck` 通过。
- 2026-06-03：`npm run build` 通过；仅保留 Vite 既有大 chunk 提示。
- 2026-06-03：`npm run test:unit` 运行 662 项，661 通过；1 项失败为既有 design-system manifest 期望 `StatusCodexConfigRows.tsx`，与本次账号卡片改动无关。
- 2026-06-03：Vite 预览 + Playwright 自动化 DOM 验收通过：22 张账号卡、3 条 route guard 进度行；正常 OAuth 卡片 `ops-pro@example.com` 与失败 OAuth 卡片右上角菜单均包含“重新登录”。

## 当前状态
- 状态：done
- 最近更新：2026-06-03
