# 第 9 轮：入口诊断与扩展可恢复性验收

## 状态

- 日期：2026-06-08
- 状态：自动化、构建与真实 dev App 手点验收通过
- 环境：dev / 本仓
- 正式版触碰：否
- 正式数据搬运：否

## 变更清单

- `P13/P14`：账号页消费 `#frame=accounts&workspace=all&filter=risk`，进入后重置为风险巡检筛选：保留 error / disabled，排除普通 requestable，并放宽 source / resource / plan，避免旧筛选藏掉风险账号。
- `P2`：账号页 header 拆出两个刷新入口：`刷新账号列表` 调用 `loadAccounts({ refreshSupplementalData: false })`，`刷新额度 / 用量 / 限流` 调用运行态刷新函数。
- `P8`：Usage Desk 本地投影动作增加影响范围说明，并从 `usageDeskProjectedActionImpacts` 常量渲染；`重建索引` 明确不会删除原始 session 文件。
- `E14`：Codex Skills 详情 modal 支持 `detail=<skillId>` hash 路由，打开写 hash，关闭只清 `detail`，刷新/直达可恢复详情。
- `E9`：Skill 文件扫描增加预算 warning：最多 200 个文件、最多 8 层深度；后端写入 `warnings`，前端详情 modal 展示告警。
- `P13/P14` 真实手点补修：首次真实点击 `DEV` 菜单栏 popover 的 `打开账号池` 暴露 dev App SIGSEGV。根因是 native menu bar 回调同步从 AppKit/SwiftUI 事件栈进入 Go/Wails window 操作；修复为 SwiftUI action 先延后到下一轮 main queue，Go 导出回调再通过 goroutine 派发，避免阻塞 native 事件栈。

## 自动化验证

- `node --test frontend/src/features/accounts/tests/accountFilters.test.mjs frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/tests/menuBarNavigation.test.mjs frontend/src/utils/pagePersistence.test.mjs`：通过，79 项。
- `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs`：通过，33 项。
- `cd frontend && npm run typecheck`：通过。
- `cd frontend && npm run test:unit`：通过，776 项。
- `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`：通过。
- `go test ./...`：通过。
- `docs-linhay/scripts/check-docs.sh`：通过。
- `./scripts/wails-cli.sh build`：通过，生成本仓 `build/bin/GetTokens.app`。

## 桌面验收

已执行真实 macOS dev App 手点验收：

1. 使用本仓构建产物启动 dev App：`GETTOKENS_APP_PROFILE=dev ./build/bin/GetTokens.app/Contents/MacOS/GetTokens`。
2. 确认正式版仍为 `/Applications/GetTokens.app` 与正式 sidecar，未 kill、未重启、未替换；dev sidecar 使用 `/Users/linhey/.config/gettokens-dev/config.yaml` 并监听 `18317`。
3. 真实点击菜单栏 `DEV` 状态项，展开 `GetTokens Dev` popover，截图：`docs-linhay/spaces/20260608-subagent-project-experience/screenshots/20260608/menubar/20260608-round9-dev-menubar-popover-before-v02.png`。
4. 真实点击 popover 内 `打开账号池`，dev App 未崩溃，主窗口进入账号池，左侧 `账号池` 高亮，页面仅筛出 1 项风险资产（禁用账号），截图：`docs-linhay/spaces/20260608-subagent-project-experience/screenshots/20260608/menubar/20260608-round9-dev-menubar-open-accounts-after-v02.png`。

真实手点期间发现并修复了菜单栏按钮 native callback 崩溃；修复后同一路径复测通过。保留早期失败截图 `*-v01.png` 作为定位证据，最终验收以 `*-v02.png` 为准。

## 剩余风险

- 当前工作树包含第 8 轮与第 9 轮连续修复的多组改动，未单独提交拆分。
- Skill 扫描预算 warning 已覆盖文件数和深度；预算值后续若需要产品化配置，需要另起需求。
- `filter=risk` 当前作为入口意图会重置筛选为风险巡检宽筛选；这是为了保证菜单栏风险入口不被旧本地筛选隐藏。
