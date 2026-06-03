# Sidecar Account SQLite IOERR 优化方案

## 推荐方向

采用“三层防线”：

1. **降低触发概率**：升级 sidecar fork 的 `modernc.org/sqlite`，校准 SQLite DSN / WAL 参数。
2. **自动恢复**：management handler 对账号 store IOERR 做连接失效与重开，避免坏连接长期挂住账号页。
3. **可诊断兜底**：Wails / 前端保留旧额度缓存，但明确展示 sidecar 失败原因，并在恢复后清除 stale 状态。

不推荐只靠“重启 sidecar”或“前端隐藏 STALE”。这会掩盖账号 store 热路径问题，且与 sidecar 自治层原则冲突。

## 方案分层

### Phase 0：复现与红灯测试

目标：先让问题在测试里可被描述，而不是直接改实现。

1. 新增 accountstore / management handler 测试夹具：
   - 模拟第一次 `ListAccounts` 返回 SQLite IOERR / short read。
   - 验证 handler 不把坏 store 永久缓存。
   - 验证第二次请求会重新打开 store 并成功返回账号。
2. 新增 `GetAccount` 单账号路径测试：
   - 单账号详情接口不应依赖全量 `ListAccounts` 扫描。
   - 查询失败时错误信息包含 account key 与 SQLite 分类。
3. 保留 Wails quota 现有测试，并增加账号 store 500 场景：
   - `GetCodexQuota(accountKey)` 在 `GetAccount` IOERR 时返回错误；若已有 quota runtime cache，则可返回 stale quota。
4. 前端测试：
   - 旧 quota cache + `GetCodexQuota` 抛出 sidecar 500 -> 显示 `STALE` 和原因。
   - 后续成功刷新 -> stale 文案消失。

### Phase 1：升级 SQLite driver 与 DSN 校准

目标：降低 `SQLITE_IOERR_SHORT_READ` 的发生概率。

1. 将 sidecar fork `docs-linhay/references/CLIProxyAPI/go.mod` 中 `modernc.org/sqlite v1.39.1` 升级到与主仓一致或更新的版本（当前主仓为 `v1.50.0`）。
2. 保留 `busy_timeout`、`foreign_keys`、`journal_mode(WAL)`。
3. 补充/确认以下 PRAGMA 策略：
   - `busy_timeout(5000)`：已存在，保留。
   - `journal_mode(WAL)`：已存在，保留。
   - `wal_autocheckpoint`：根据测试结果设置合理阈值，避免 WAL 长期增长造成读态不稳定。
   - `synchronous(NORMAL)`：若当前默认过重或产生 fsync 抖动，可评估；账号凭证写入不应牺牲安全性，默认先不降低。
4. 回归 accountstore 并发读写测试，覆盖单连接与多调用场景。

### Phase 2：账号 store 连接恢复机制

目标：偶发 IOERR 后自动恢复，不需要重启 GetTokens。

1. 在 management handler 引入 account store 错误分类：
   - `IsRecoverableSQLiteIOError(err)`：识别 `SQLITE_IOERR`、`SQLITE_IOERR_SHORT_READ` 等可通过重开连接恢复的错误。
   - 明确不把 schema 缺失、账号不存在、参数错误归为 recoverable。
2. 在 `ListAccounts` / `GetAccount` / 写操作入口处理 recoverable IOERR：
   - 第一次失败：关闭 `h.accountStore`，清空 `h.accountStoreDBPath`。
   - 对只读请求允许重试一次。
   - 对写请求默认不自动重放写事务，除非操作幂等且测试覆盖；否则只关闭连接并返回可诊断错误。
3. 日志增加结构化字段：
   - endpoint
   - account_key（如有）
   - db_path（可脱敏或只输出 basename）
   - sqlite_code / sqlite_extended_code
   - recovered=true/false
4. 确保并发安全：
   - 仍由 `accountStoreMu` 控制 store 指针替换。
   - 避免一个请求关闭另一个请求正在使用的连接；若现有长期共享连接无法安全关闭，需要改为短生命周期 open 或引用计数。

### Phase 3：单账号查询路径收窄

目标：降低账号详情 / quota 刷新对全量账号列表的依赖。

当前 `Store.GetAccount(ctx, accountKey)` 通过 `ListAccounts()` 全量扫描后过滤。优化为：

1. 新增 `GetAccount` 专用 SQL：
   - `WHERE c.account_key = ? AND c.deleted_at_unix_ms IS NULL`
   - 只 attach 当前账号 credential。
2. `ListAccounts()` 保持列表语义；`GetAccount()` 不再复用列表。
3. management `GET /accounts/:account_key` 使用新单账号路径。
4. Wails `GetCodexQuota(accountKey)` 的账号加载受益于更小读面。

### Phase 4：Quota stale 语义与前端展示优化

目标：让用户能判断“数据旧但可用”还是“账号读取失败”。

1. Wails `GetCodexQuota`：
   - quota refresh 失败但存在 runtime quota cache：返回 `status=stale`、`stale=true`、`degradedReason`。
   - 账号 store 读取失败且无法拿到账号：返回错误，不伪造额度。
2. 前端 `failQuotaRefreshState`：
   - 继续保留旧 quota cache。
   - 错误原因归一化，不重复拼接同一错误。
   - 恢复成功后清除旧 degradedReason。
3. UI 文案：
   - 将 `STALE sidecar 请求失败...` 保留为诊断文案，但限制长度，避免撑破卡片。
   - tooltip / detail 可展示完整错误；卡片只展示摘要。

### Phase 5：运行态自检与维护入口

目标：减少后续排障成本。

1. 增加 sidecar health / diagnostics 字段：
   - account store path
   - journal mode
   - wal checkpoint 状态
   - last account store error class
   - last recovery time
2. 增加一个只读诊断 endpoint 或纳入现有 status：
   - 不返回凭证、API key、auth JSON。
3. 如 WAL 文件异常增长，提供明确提示：
   - 只读 checkpoint 建议。
   - 禁止前端直接操作数据库文件。

## 被拒绝方案

### 只前端隐藏 STALE

拒绝。它会掩盖 sidecar 账号读取失败，用户看到的额度会像实时数据，误导后续路由/额度判断。

### 每次请求都重启 sidecar

拒绝。恢复成本太高，会打断 WebSocket、live session 和系统代理状态。

### 放弃 SQLite WAL

暂不采用。WAL 对多读少写的账号与运行态读取仍合理。除非复现证明 WAL 是核心触发条件，否则先升级 driver + 恢复连接。

### 将账号列表缓存搬到 Wails / 前端

拒绝。违反 sidecar 自治层原则；账号选择、凭证、runtime apply 状态应由 sidecar 闭环。

## 实施顺序

1. 建立测试红灯：accountstore / management handler recoverable IOERR。
2. 升级 `modernc.org/sqlite` 并跑 sidecar 测试。
3. 实现 account store recoverable IOERR 分类与只读重试。
4. 将 `GetAccount` 改为专用单账号查询。
5. 补 Wails quota 与前端 stale 展示测试。
6. 重建 sidecar，跑桌面/Wails 冒烟。
7. 更新 docs / memory，必要时沉淀 sidecar SQLite 诊断 skill。

## 验证命令建议

```bash
# sidecar fork
cd docs-linhay/references/CLIProxyAPI
go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks ./sdk/cliproxy

# GetTokens Wails/backend
go test ./internal/wailsapp ./internal/cliproxyapi

# 前端账号相关测试
cd frontend
npm test -- accountQuota rateLimit accountCard

# 文档结构
cd ..
docs-linhay/scripts/check-docs.sh
```

## 风险与缓解

1. **升级 sqlite driver 引入兼容变化**：先限定 sidecar accountstore / usage ledger 测试范围，再跑完整 sidecar tests。
2. **自动重试误重放写操作**：只读请求自动重试；写请求只关闭坏连接并返回错误，后续由用户或上层重新发起。
3. **关闭共享连接影响并发请求**：需要在 handler 层设计 store 指针失效机制，避免关闭仍在使用的连接；必要时改为按请求短连接。
4. **错误日志泄露敏感信息**：日志只记录 account key、错误分类和 endpoint，不记录 API key、auth JSON、响应体明文。

## 完成定义

- 可复现测试先失败后通过。
- sidecar 遇到 recoverable SQLite IOERR 后可自动恢复账号列表。
- 账号详情 / quota 刷新不再强依赖全量 `ListAccounts()`。
- 前端 stale 展示准确、可恢复、不过度扩散错误文案。
- 文档与 memory 已更新。

## 2026-06-03 第一轮实施记录

已完成：

1. 红灯测试：
   - `TestListAccountsReopensCachedStoreAfterRecoverableReadFailure`
   - `TestGetAccountUsesSingleAccountQueryInsteadOfFullList`
2. sidecar account store：
   - `Store.GetAccount` 改为单账号只读事务查询，不再通过 `ListAccounts()` 全量扫描。
3. sidecar management handler：
   - `GetAccount` / `ListAccounts` 增加 recoverable read failure 重开 store 并重试一次。
   - recoverable 分类覆盖 SQLite code 主码 `10`、扩展 IOERR、`SQLITE_IOERR` 字符串、`disk I/O error`、`522`、以及测试使用的 `sql: database is closed`。
   - 仅只读接口自动重试；写接口仍不自动重放。
4. sidecar SQLite driver：
   - `modernc.org/sqlite` 从 `v1.39.1` 升级到 `v1.50.0`。

已验证：

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./sdk/cliproxy
go test ./internal/gettokenshooks
```

结果均通过。

待继续：

1. 根据需要重建并嵌入当前 macOS sidecar binary。
2. 跑 GetTokens 主仓 Wails/backend 冒烟测试。
3. 如前端仍需文案收敛，再补 accounts stale 展示测试与 UI 调整。

### 2026-06-03 构建与主仓回归补充

已重建当前 macOS arm64 sidecar：

```bash
scripts/ensure-sidecar.sh darwin arm64
file build/bin/cli-proxy-api
```

验证结果：`build/bin/cli-proxy-api` 为 `Mach-O 64-bit executable arm64`，版本输出包含 `v7.1.28-78-g131b7740-dirty`。

补充主仓后端测试：

```bash
go test ./internal/cliproxyapi ./internal/wailsapp
```

结果通过。

构建注意：重建 sidecar 时曾被 sidecar fork 中既有 dirty 文件 `sdk/api/handlers/handlers.go` 的 `log` import 缺失阻塞；本轮只补了对应 `logrus` import，让既有日志改动可编译。

## 2026-06-03 第二轮前端展示优化

已完成：

1. 新增 `frontend/src/features/accounts/model/runtimeWarning.ts`：
   - 将 sidecar stale / route guard degraded reason 归一为空白压缩后的短摘要。
   - 卡片摘要默认限制在 96 字符以内。
   - 完整原始错误保留给 tooltip，不在卡片正文中展开。
   - 避免截断到括号中间，例如 `(522)`。
2. `CardSections.tsx` 中 quota 与 route guard 的 `STALE` warning 共用 `RuntimeWarningBanner`：
   - 正文显示 `display.summary`。
   - `title` 保留 `display.full`。
   - 保留原有 `data-account-quota-runtime-warning` / `data-account-route-guard-runtime-warning` 标记。
3. 新增测试：
   - `frontend/src/features/accounts/tests/runtimeWarning.test.mjs`
   - `accountCardInteractions.test.mjs` 增加 banner 源码断言。
4. `frontend/package.json` 的 `test:unit` 已纳入 `runtimeWarning.test.mjs`。

已验证通过：

```bash
cd frontend
node --test \
  src/features/accounts/tests/accountCardInteractions.test.mjs \
  src/features/accounts/tests/runtimeWarning.test.mjs \
  src/features/accounts/tests/rateLimit.test.mjs \
  src/features/accounts/tests/accountQuotaCache.test.mjs
npm run typecheck
```

完整 `npm run test:unit` 当前未通过，但失败点是既有/并行改动导致的 design-system manifest 不一致：`StatusCodexConfigRows.tsx` 出现在实际 feature component 文件列表中，但 manifest 期望未同步。该失败与本轮 sidecar IOERR / accounts stale 展示改动无关，本轮未修改对应 manifest。

## 2026-06-03 第三轮 sidecar 诊断优化

已完成：

1. 新增 sidecar management 诊断接口：
   - `GET /v0/management/gettokens/account-store-diagnostics`
2. 诊断响应字段：
   - `path_basename`：只返回账号库文件名，不暴露完整路径。
   - `configured`：账号 store 路径是否已解析。
   - `open`：handler 当前是否持有打开的 account-store 连接。
   - `read_recovery.count`：只读 recoverable failure 恢复次数。
   - `read_recovery.last_endpoint`：最近一次触发恢复的只读端点。
   - `read_recovery.last_recovered`：最近一次是否重开并重试成功。
   - `read_recovery.last_error`：最近一次原始错误，便于确认 `SQLITE_IOERR_SHORT_READ` / `disk I/O error (522)`。
   - `read_recovery.last_recovered_at_unix_ms`：最近成功恢复时间。
3. 只在 `GetAccount` / `ListAccounts` 只读恢复路径记录诊断；写接口仍不自动重放，也不记录伪恢复。
4. 新增测试：
   - `TestAccountStoreDiagnosticsReportsReadRecovery`

已验证：

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./internal/api/handlers/management -run 'TestAccountStoreDiagnosticsReportsReadRecovery|TestListAccountsReopensCachedStoreAfterRecoverableReadFailure'
go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks ./sdk/cliproxy
```

已重建 sidecar：

```bash
scripts/ensure-sidecar.sh darwin arm64
file build/bin/cli-proxy-api
```

结果：`build/bin/cli-proxy-api` 为 `Mach-O 64-bit executable arm64`，构建版本 `v7.1.28-78-g131b7740-dirty`。

## 2026-06-03 第四轮 Wails bridge 优化

已完成：

1. `internal/cliproxyapi` 新增 account-store diagnostics DTO 与 client 方法：
   - `AccountStoreDiagnostics`
   - `AccountStoreReadRecoveryDiagnostics`
   - `Client.GetAccountStoreDiagnostics()`
2. `internal/wailsapp` 新增桌面 bridge：
   - `App.GetAccountStoreDiagnostics()`
3. 根 Wails `App` 新增 camelCase DTO 映射：
   - `AccountStoreDiagnostics.pathBasename`
   - `AccountStoreDiagnostics.readRecovery`
   - `AccountStoreReadRecoveryDiagnostics.lastRecoveredAtUnixMs`
4. 手动同步 Wails 前端绑定声明：
   - `frontend/wailsjs/go/main/App.d.ts`
   - `frontend/wailsjs/go/main/App.js`
   - `frontend/wailsjs/go/models.ts`
5. 新增测试：
   - `TestAccountStoreDiagnosticsClient`
   - `TestAccountStoreDiagnosticsBridgeCallsManagementAPI`
   - `TestMapAccountStoreDiagnosticsUsesFrontendFieldNames`

已验证通过：

```bash
go test ./internal/cliproxyapi ./internal/wailsapp .
```

前端 `npm run typecheck` 当前未通过，但失败点是既有/并行账号故事文件参数不一致：

- `AccountModalComponents.stories.tsx` 缺少 `UnifiedComposeModalProps.onBillingEnabledChange`
- `UnifiedComposeModal.tsx` 使用的 preset profile 中缺少 `billingEnabledLabel`

该失败与本轮新增 diagnostics Wails binding 无直接关系；本轮新增的 `frontend/wailsjs` 绑定未产生新的类型错误。

补充验证：

```bash
cd frontend
npx tsc --noEmit --ignoreConfig --target ES2020 --module ESNext --moduleResolution bundler \
  wailsjs/go/models.ts \
  wailsjs/go/main/App.d.ts
```

结果通过，用于确认本轮新增的 `GetAccountStoreDiagnostics` Wails 前端绑定声明自身可编译。全量 `npm run typecheck` 的无关 story 失败仍按上一节记录处理。

## 2026-06-03 第五轮状态页展示优化

已完成：

1. 新增前端状态模型：
   - `frontend/src/features/status/model/accountStoreDiagnostics.ts`
   - 将 `main.AccountStoreDiagnostics` 转成状态页展示视图。
   - 只显示 `pathBasename` 的 basename，防止完整本地路径进入 UI。
   - 恢复错误复用账号卡 runtime warning 摘要逻辑，正文最多 96 字符，完整错误放 tooltip。
2. `StatusFeature` 接入 Wails binding：
   - sidecar ready 时调用 `GetAccountStoreDiagnostics()`。
   - sidecar 非 ready 或请求失败时清空诊断状态。
3. 状态页新增 `ACCOUNT STORE` 诊断卡：
   - 显示 `OPEN/CLOSED/UNCONFIGURED · accounts-v1.sqlite`。
   - 显示 `NO RECOVERY EVENTS`、`RECOVERED · accounts · #N` 或 `FAILED · accounts/:account_key · #N`。
   - 若存在最近错误，卡片正文展示短摘要，tooltip 保留完整错误。
4. 新增/更新测试：
   - `frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs`
   - `frontend/src/features/status/tests/statusTypography.test.mjs`
   - `frontend/package.json` 的 `test:unit` 纳入 `accountStoreDiagnostics.test.mjs`。

已验证通过：

```bash
cd frontend
node --test \
  src/features/status/tests/accountStoreDiagnostics.test.mjs \
  src/features/status/tests/statusTypography.test.mjs
npm run typecheck

go test ./internal/cliproxyapi ./internal/wailsapp .
docs-linhay/scripts/check-docs.sh
```

完整 `npm run test:unit` 当前仍未通过，失败点仍是既有/并行的 design-system manifest 不一致：`StatusCodexConfigRows.tsx` 出现在实际 feature component 文件列表中，但 manifest 期望未同步。该失败与本轮 account-store diagnostics 状态页接入无关。

## 2026-06-03 补强：结构化 IOERR 与前端展示分流

本轮在既有 account-store 自愈实现基础上补齐两个缺口：

1. sidecar management `writeAccountStoreError` 对可恢复 SQLite I/O 读错误返回结构化 body：
   - `code: account_store_io_error`
   - `recoverable: true`
   - `error: <原始错误>`
   这样 Wails / 前端可以区分账号库 I/O 异常与普通参数、not found 或业务失败。
2. 前端 runtime warning 展示改为双模式：
   - 账号卡片 stale banner 默认将 `account_store_io_error` / `disk I/O error (522)` / `SQLITE_IOERR_SHORT_READ` 归一为“账号库读取异常，正在使用上次额度快照”。
   - 状态页 `ACCOUNT STORE` 诊断卡关闭友好替换，继续展示原始错误短摘要并把完整错误保留在 tooltip，方便排障。

新增/更新回归：

```bash
cd docs-linhay/references/CLIProxyAPI && go test ./internal/api/handlers/management -run 'Test(ListAccountsReopensCachedStoreAfterRecoverableReadFailure|AccountStoreDiagnosticsReportsReadRecovery|WriteAccountStoreErrorClassifiesRecoverableIOError)$' -count=1
cd frontend && node --experimental-strip-types src/features/accounts/tests/runtimeWarning.test.mjs
cd frontend && node --experimental-strip-types src/features/status/tests/accountStoreDiagnostics.test.mjs
```

更宽回归已通过：

```bash
cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./sdk/cliproxy -count=1
go test ./internal/cliproxyapi ./internal/wailsapp -count=1
cd frontend && node --experimental-strip-types src/features/accounts/tests/accountCardInteractions.test.mjs
```

## 2026-06-03 验收补充：完整前端 unit 与 sidecar 重建

在结构化 IOERR 与前端展示分流补强后，继续完成更宽验收：

1. 修复 design-system manifest：将 `StatusCodexConfigRows.tsx` 登记为 `candidate` 业务组件，说明其当前由 root settings / model providers 父级 section stories 间接覆盖，避免业务组件抽取后漏登记。
2. 完整前端验证通过：

```bash
cd frontend && npm run typecheck
cd frontend && npm run build
cd frontend && npm run test:unit
```

`test:unit` 汇总：`673 pass / 0 fail`。

3. sidecar 核心验证通过：

```bash
cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./sdk/cliproxy -count=1
```

4. 根仓 Go 验证通过：

```bash
go test . ./internal/cliproxyapi ./internal/wailsapp -count=1
```

5. sidecar 已按当前源码重建：

```bash
./scripts/ensure-sidecar.sh darwin arm64
```

输出确认：`Built CLIProxyAPI from source: build/bin/cli-proxy-api`。

6. 文档结构校验通过：

```bash
docs-linhay/scripts/check-docs.sh
```
