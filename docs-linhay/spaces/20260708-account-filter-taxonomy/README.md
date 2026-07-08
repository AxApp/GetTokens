# 20260708-account-filter-taxonomy

## 背景
- 用户连续标注账号池筛选与卡片状态不一致：
  - OAuth 失效账号已显示“异常 / 重新登录”，但【可请求】筛选仍能筛出异常账号。
  - 旧【需处理】预设实际同时选择 `error + disabled`，且自动勾选所有 HTTP code，导致“需要用户处理”和“手动禁用”混在同一个主入口。
  - 顶部 active tag 只显示“可请求 / 异常”等孤立词，缺少“状态:”前缀，容易和卡片标签、套餐标签混淆。
- 已通过 `$wise-council-dialogue` 咨询 `agy`。结论：第一期不做完整 issue taxonomy，不改后端/Wails 契约；先收窄为四个主视图并统一筛选与卡片运行态证据。

## 目标
- 账号筛选第一期主视图固定为：
  - `全部`
  - `可请求`
  - `需处理`
  - `已禁用`
- `可请求` 只包含可参与请求的账号，不包含 OAuth token 失效、`auth-error`、需要重新登录、上游不可用等账号。
- `需处理` 包含需要用户动作或上游异常排查的账号，不混入手动禁用账号。
- `已禁用` 只包含手动禁用账号。
- 保持旧存储字段兼容：`status.error` 映射到 `needs_attention`，`status.requestable` 映射到 `requestable`，`status.disabled` 映射到 `disabled`。

## 范围
- 前端账号池筛选模型、预设与工具栏显示。
- 账号筛选与状态分组使用统一 operational bucket：
  - `requestable`
  - `needs_attention`
  - `disabled`
  - `pending`
- 第一期开启的 reason：
  - `reauth_required`
  - `auth_error`
  - `upstream_error`
  - `not_observed`
  - `manual_disabled`
- 状态 active tag 增加分组前缀，例如 `状态: 可请求`。

## 非目标
- 不拆完整 HTTP code / resource 四态 taxonomy。
- 不调整 sidecar、Wails DTO 或账号存储结构。
- 不删除旧 `http-errors`、`with-quota`、`api-key` preset 函数兼容逻辑；只是不再作为快捷筛选主入口展示。
- 不把卡片自身“可用”状态文案在本期强制改名为“可请求”。

## 验收标准
- 单元测试：
  - `buildAccountsFilterPresetState('attention')` 只选择 `status.error`，不选择 `status.disabled`，不自动选择 HTTP code。
  - `buildAccountsFilterPresetState('disabled')` 只选择 `status.disabled`。
  - `resolveAccountOperationalStatus()` 能区分 `requestable / needs_attention / disabled / pending`。
  - `filterAccounts()` 的 `requestable` 过滤排除 OAuth `auth-error` / `invalid_refresh_token` / 需要重登账号。
- DOM 验收：
  - 【可请求】不出现异常/重登卡。
  - 【需处理】出现异常/重登卡。
  - 【已禁用】只出现禁用卡，不混异常卡。
  - 筛选弹层快捷入口只显示 `全部 / 可请求 / 需处理 / 已禁用`。
- 构建验收：
  - `node --test frontend/src/features/accounts/tests/accountFilters.test.mjs frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountCardLayout.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260708-account-filter-taxonomy`
- worktree：`../GetTokens-worktrees/20260708-account-filter-taxonomy/`

## 相关链接
- 关联前置 space：`docs-linhay/spaces/20260609-account-card-401-status/README.md`
- 关联诊断 space：`docs-linhay/spaces/20260708-accounts-dev-diagnostics/README.md`
- 关联技能：`.agents/skills/gettokens-domain-engineering/SKILL.md`

## 当前状态
- 状态：implemented
- 最近更新：2026-07-08

## 验收记录

- 2026-07-08：
  - 单元测试通过：`node --test frontend/src/features/accounts/tests/accountFilters.test.mjs frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountCardLayout.test.mjs`，120 项通过。
  - 类型检查通过：`npm --prefix frontend run typecheck`。
  - 前端构建通过：`npm --prefix frontend run build`。
  - Playwright headless Chrome 访问 `http://127.0.0.1:34115/#frame=accounts`：
    - `可请求`：18 张可见卡，状态计数 `{ 可用: 18 }`，active tag 为 `状态: 可请求`。
    - `需处理`：4 张可见卡，状态计数 `{ 异常: 4 }`，均含 `重新登录`。
    - `已禁用`：3 张可见卡，状态计数 `{ 已禁用: 3 }`。
    - 筛选弹层快捷入口为 `全部 / 可请求 / 需处理 / 已禁用`，未出现旧 `HTTP 错误 / 有额度 / API Key` 主预设。
