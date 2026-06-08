# 第 3 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 3 轮：评估 + 修复**。
- 基线：延续第 2 轮报告列出的下一轮候选，基于当前工作树继续，不回退第 1/2 轮或其他 subagent 改动。
- 环境边界：仅修改仓库 dev 代码与本 space 文档；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

## 候选复核与选择

### 本轮选中

1. **账号池筛选空态拆分**
   - 原因：当前账号页 `filteredAccounts.length === 0` 统一显示 `accounts.empty`，会把“账号库真实为空”和“已有账号但搜索/筛选无结果”混在一起。
   - 低风险边界：只增加前端纯模型和空态渲染，不改变账号加载、筛选规则、sidecar 或 Wails 数据契约。

2. **MCP env/header 行级校验**
   - 原因：`env`、`http_headers`、`env_http_headers` 使用 `KEY=value` textarea。无 `=` 行和非法 TOML key 后续无法安全写入 inline map，旧链路会形成误导或静默丢字段。
   - 低风险边界：只增加前端模型校验和保存按钮禁用提示，不改变后端 patch 行为。

### 本轮未选

- raw `config.toml` 保存前 TOML 预检与备份提示：需要 Go 侧 TOML parser、备份文件生成、返回 DTO 和保存失败语义，仍建议作为下一轮独立后端/Wails 小步修复。
- MCP raw/结构化 editor dirty arbitration：需要梳理 `configEditor`、MCP server editor 和 reload 时序，避免两个 modal 状态互相覆盖；适合下一轮单独做。

## 红灯测试

本轮先补测试并确认失败：

- `frontend/src/features/accounts/tests/accountFilters.test.mjs`
  - 新增 `resolveAccountsEmptyState` 断言：无账号返回 `empty`，有账号但筛选无结果返回 `filtered`，且分别控制 `showClearSearch`、`showResetFilters`。
  - 红灯表现：`accountFilters.ts` 尚无该导出。
- `frontend/src/features/codex-extensions/model.test.mjs`
  - 新增 `validateMcpEnvRows` 断言：合法 `X-Client` 通过，`Authorization Header` 返回 `invalid-key`，无 `=` 行返回 `missing-separator`。
  - 红灯表现：`model.ts` 尚无该导出。

## 本轮修复清单

### 1. 账号池空态拆分

- 新增 `resolveAccountsEmptyState` 纯模型：
  - `accountCount <= 0`：真实无账号，展示 `accounts.empty` + `accounts.empty_hint`。
  - `accountCount > 0 && filteredAccountCount === 0`：筛选空态，展示 `accounts.filter_empty_title` + `accounts.filter_empty_hint`。
  - 筛选空态按当前状态显示 `清空搜索` 与 `重置筛选` 操作。
- `AccountsFeature` 使用该模型渲染空态：
  - 清空搜索调用 `setSearchTerm('')`。
  - 重置筛选调用 `setFilters({ ...defaultAccountsFilterState })`。
- 新增中英文文案，避免继续把筛选空态写成“当前库中无匹配记录”。

### 2. MCP env/header 行级校验

- `parseMcpEnv` 对无 `=` 行保留 `source: 'missing-separator'`，使 UI 能解释该行为什么不能安全保存。
- 新增 `validateMcpEnvRows` 和 `isBareTomlKey`：
  - 拒绝含空格等无法写入 bare TOML inline map key 的行。
  - 拒绝缺少 `=` 的行。
- MCP server editor 保存区展示校验摘要，并在存在问题时禁用保存。
- 新增中英文文案：说明 Env/Header 行无法安全写入 TOML，并区分非法 key 与缺少 `=`。

## 变更文件

- `frontend/src/features/accounts/model/accountFilters.ts`
- `frontend/src/features/accounts/tests/accountFilters.test.mjs`
- `frontend/src/features/accounts/AccountsFeature.tsx`
- `frontend/src/features/codex-extensions/model.ts`
- `frontend/src/features/codex-extensions/model.test.mjs`
- `frontend/src/features/codex-extensions/McpModals.tsx`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes-round-3.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
cd frontend && node --test src/features/accounts/tests/accountFilters.test.mjs src/features/codex-extensions/model.test.mjs src/features/codex-extensions/adapters.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
```

说明：

- 未启动 Wails dev app 做桌面点击验收。本轮改动是前端纯模型、页面空态渲染、MCP editor 保存前校验与 i18n 文案，已用 focused node tests 和 typecheck 覆盖。
- 未运行全量 `npm run test:unit`，沿用前两轮说明：该脚本此前会触发无关账号卡片既有断言失败，本轮只运行匹配修复面的 focused tests。

## 下一轮候选判断

仍有可继续修改的下一轮候选：

1. raw `config.toml` 保存前 TOML 预检与备份提示。
2. MCP raw/结构化 editor dirty arbitration。
3. MCP quoted server id 读取/写回对称性保护。
4. Skills 启停规则来源解释。

仍不建议直接进入的候选：route probe sidecar endpoint、usage reconciliation、SQLite busy 治理、request diagnostics index。这些属于较大技术方案，应先定接口边界和失败测试。
