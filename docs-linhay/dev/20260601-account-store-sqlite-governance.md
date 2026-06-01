# Account Store SQLite Governance

## 背景

账号卡片额度刷新在 2026-06-01 出现“点击刷新但数值不变”。运行态证据显示 sidecar 访问 `/v0/management/accounts` 时返回 `ensure account store metadata: database is locked (SQLITE_BUSY)`；同时 `TablePro` 与 `cli-proxy-api` 打开同一个 `accounts-v1.sqlite`。

## 结论

根因不是前端刷新按钮失效，而是 Codex API key 额度刷新切到 sidecar-native 后依赖账号 SQLite。旧实现每次 `openAccountStore()` 都执行 `EnsureSchema()`，而 `EnsureSchema()` 会写 `account_store_meta`，导致读账号和 quota refresh 路径也可能争用写锁。Wails 在刷新失败后返回旧 `quota-status` 缓存，又没有标记退化状态，所以卡片看起来像“刷新成功但没有变化”。

## 治理规则

1. `accounts-v1.sqlite` schema/metadata 初始化只允许发生在 store 生命周期初始化、迁移或切库路径，不允许发生在常规读请求热路径。
2. sidecar management handler 复用已初始化的 account store；测试或嵌入调用切换 DB path 时关闭旧 store 并清空缓存。
3. SQLite 优先采用 WAL、`busy_timeout` 和保守连接池治理。不要在没有证据的情况下先做分库或主从式读写分离。
4. Codex API key quota refresh 失败后，如果 Wails 使用旧 `quota-status` 缓存，必须返回 `stale=true` 和 `degradedReason`，让账号卡片明确展示旧数据来源。

## 验证覆盖

- CLIProxyAPI fork：`TestOpenAccountStoreReusesInitializedStoreWhenExternalWriterHoldsLock` 覆盖初始化后的 handler store 在外部写锁存在时不会重新跑 schema。
- GetTokens root：`TestGetCodexQuotaMarksCachedUnifiedQuotaStaleWhenRefreshFails` 覆盖 quota refresh 失败但缓存可显示时，Wails 返回 stale/degraded DTO。
