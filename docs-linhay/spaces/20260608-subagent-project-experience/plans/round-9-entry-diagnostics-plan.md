# 第 9 轮：入口诊断与扩展可恢复性修复方案

## 背景

第 8 轮已经完成第一批低风险修复，但仍有几项入口类和诊断类问题只停留在“有 hash / 有摘要 / 有动作”层面，尚未形成真实可用闭环。本轮继续在 dev / 本仓环境内推进，不触碰正式版 GetTokens、正式进程或正式数据目录。

## 范围

1. `P13/P14` 收尾：菜单栏 `filter=risk` 进入账号页后必须真实应用风险筛选，而不是只写入 hash。
2. `P2`：账号页刷新入口拆分为账号列表刷新与运行态刷新，避免用户无法判断刷新的是列表还是额度/用量/限流。
3. `P8`：Usage Desk 索引刷新、重建当日、重建索引需要展示影响范围，明确不删除原始 session 文件。
4. `E14`：Codex Skill 详情 modal 接入独立 hash 路由，支持刷新/直达恢复，并且关闭时只移除对应 `detail` 标记。
5. `E9`：Skill 文件扫描增加数量/深度预算 warning，详情页可见扫描被截断或跳过的原因。

## 非目标

- 不实现新的运营巡检视图排序体系。
- 不修改 sidecar runtime routing 热路径。
- 不增加完整 TOML AST patch 或 MCP preflight。
- 不触碰 `/Applications/GetTokens.app`，不 kill / restart 正式版进程。
- 不从正式目录搬运数据；本轮自动化验证预计不需要真实正式数据。

## BDD 场景

### 场景 1：菜单栏风险入口可落到账号筛选

- Given 菜单栏风险摘要入口生成 `#frame=accounts&workspace=all&filter=risk`
- When 账号页加载或 hash 变化
- Then 账号页应用风险筛选，保留 disabled/error 账号，排除普通 requestable 账号
- And 搜索、plan、source 等已有筛选结构不被破坏

### 场景 2：账号刷新动作语义清楚

- Given 用户在账号页 header
- When 点击账号列表刷新
- Then 只重新拉取账号列表，不主动刷新 supplemental runtime 数据
- When 点击运行态刷新
- Then 刷新额度、用量、限流等 supplemental runtime 数据并显示刷新态

### 场景 3：Usage Desk 高风险操作有影响说明

- Given 用户看到刷新索引、重建当日、重建索引三个动作
- Then 每个动作旁或 tooltip 中显示影响范围
- And 文案说明这些动作只处理本地投影/索引，不删除原始 session 文件

### 场景 4：Skill 详情可由 hash 恢复

- Given URL 为 `#frame=codex&workspace=skills&detail=<skill-id>`
- When Skills 工作区加载并找到对应 Skill
- Then 自动打开该 Skill 的详情 modal
- When 关闭 modal
- Then 只移除 `detail`，保留当前 frame/workspace

### 场景 5：Skill 扫描预算 warning 可见

- Given 某个 Skill 目录文件数量或深度超过扫描预算
- When 后端返回 Skills snapshot
- Then snapshot/record 带有 warning
- And 前端详情 modal 展示 warning，避免用户误以为文件完整列出

## TDD 计划

- `frontend/src/tests/menuBarNavigation.test.mjs`：覆盖 `filter=risk` hash 解析。
- `frontend/src/features/accounts/tests/accountFilters.test.mjs`：覆盖 risk filter state 派生与过滤结果。
- `frontend/src/features/accounts/tests/*`：覆盖 header 双刷新入口与 Usage Desk 影响说明源码断言。
- `frontend/src/features/codex-extensions/model.test.mjs` / `featureSource.test.mjs`：覆盖 Skill warning 映射、详情 hash open/close。
- `internal/wailsapp/codex_extensions_test.go`：覆盖 Skill 文件扫描数量/深度预算 warning。

## 验收命令

1. Focused frontend tests for accounts / Usage Desk / Codex extensions。
2. `cd frontend && npm run test:unit`
3. `cd frontend && npm run typecheck`
4. `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`
5. `go test ./...`
6. `docs-linhay/scripts/check-docs.sh`

## 桌面验收

本轮必须补真实 macOS dev App 手点验收：使用本仓 `build/bin/GetTokens.app` 以 `GETTOKENS_APP_PROFILE=dev` 启动，点击菜单栏 `DEV` 状态项，点击 popover 内 `打开账号池`，确认主窗口进入账号池风险筛选并截图归档。自动化、hash resolver、Wails build 只能作为前置门禁，不能替代这条真实入口验收。验收期间不得触碰 `/Applications/GetTokens.app`、正式 sidecar 或正式配置。
