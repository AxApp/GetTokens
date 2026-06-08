# 第 8 轮第一修复包验收

## 状态

- 日期：2026-06-08
- 当前状态：自动化与构建验收通过；真实 macOS 菜单栏点击验收待 dev App 启动后执行
- 环境：本仓 dev 构建产物；未触碰 `/Applications/GetTokens.app`、正式版进程或正式数据目录

## 已修复范围

1. `P15` 账号禁用错误归因
   - 新增 `accountActionErrors` 模型。
   - 禁用/启用失败改为进入账号动作通知，不再复用 `deleteError`。
   - 测试覆盖禁用失败、启用失败文案均不含删除语义。

2. `P16/P17` 账号用量失败态和 hook 测试
   - `AccountUsageSummary` 增加兼容字段 `loadState` / `errorMessage`。
   - 用量加载失败时，首次加载显示 `error`，合并刷新失败保留旧数据并标记 `stale`。
   - 账号卡片 mini metrics 在失败时显示 `ERR`，旧数据失败时显示 `STALE`。

3. `R2` Channel routing reason summary
   - route audit event 支持 `filtered` / `filteredReasonCounts`。
   - 最近路由事件摘要在有明细时展示 top filtered reasons，例如 `runtime-rate-limit x2`。
   - 无明细时继续保留原过滤数量展示，不伪造原因。

4. `R3` Rate-limit legacy key 检测
   - 新增 `isLegacyRateLimitAccountKey` 与 `collectLegacyRateLimitBindings`。
   - `RateLimitRulesSection` 检测到旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` key 时展示诊断提示。
   - 本轮只读检测，不自动迁移、不删除历史事件。

5. `P13/P14` 菜单栏真实入口和风险摘要
   - 菜单栏打开窗口 payload 从裸 `{ page: "accounts" }` 改为风险入口 `{ page: "accounts", workspace: "all", filter: "risk" }`。
   - 前端 resolver 支持 `#frame=accounts&workspace=all&filter=risk`。
   - quota snapshot summary 增加 `riskSummary` 与 `moreRiskLabel`，保留 `riskAccounts` 兼容字段。

## 验证结果

已通过：

```bash
cd frontend && node --test src/features/accounts/tests/accountActionErrors.test.mjs src/features/accounts/tests/accountUsage.test.mjs src/features/accounts/tests/rateLimit.test.mjs src/features/channel-routing/tests/channelRouting.test.mjs src/tests/menuBarNavigation.test.mjs
go test ./internal/wailsapp -run 'Test(MenuBar|BuildMenuBar)'
cd frontend && npm run typecheck
go test ./internal/wailsapp
docs-linhay/scripts/check-docs.sh
cd frontend && npm run test:unit
go test ./...
./scripts/wails-cli.sh build
```

结果摘要：

- 前端 focused tests：49 项通过。
- `go test ./internal/wailsapp -run 'Test(MenuBar|BuildMenuBar)'`：通过。
- `npm run typecheck`：通过。
- `go test ./internal/wailsapp`：通过。
- `npm run test:unit`：767 项通过。
- `go test ./...`：通过。
- `check-docs.sh`：通过。
- `wails-cli.sh build`：通过，构建产物为 `build/bin/GetTokens.app`。

## 未完成验收

- 未启动 dev App 做真实 macOS 菜单栏点击验收。
- 原因：该步骤会启动桌面应用并显示/注册状态栏入口；本轮先完成自动化、源码和构建验证，不主动打断用户桌面。
- 剩余检查：启动 dev 构建后，点击菜单栏打开入口，确认窗口 hash 进入 `#frame=accounts&workspace=all&filter=risk`，并归档截图到 `screenshots/`。

## 风险与后续

- `filter=risk` 当前是菜单栏入口 payload 和 hash 证据；账号页如需真实按风险筛选，还需要后续把该 hash 参数接入账号筛选状态。
- `R2` 对真实 route ledger 的原因摘要依赖后端是否返回 `filtered` 或 `filteredReasonCounts`；前端已兼容，有字段即展示，无字段保持旧数量摘要。
- `R3` 只做 legacy key 检测，不负责迁移。迁移或自动修复需另开技术方案。
