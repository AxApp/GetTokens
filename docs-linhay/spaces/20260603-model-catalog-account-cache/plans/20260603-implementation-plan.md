# 2026-06-03 实施计划

## BDD 场景

### 场景 A：启动缓存优先写入
- Given 上次 DeepSeek 账号缓存了 `deepseek-v4-flash` / `deepseek-v4-pro`
- And 当前启动时 sidecar 或远端模型接口暂不可用
- When GetTokens 应用持久化同步 Codex model catalog
- Then 先从账号关联缓存生成 catalog
- And Codex 下次启动可直接读取 DeepSeek 模型

### 场景 B：后台刷新覆盖缓存
- Given 启动时先用缓存写入 catalog
- When sidecar ready 后账号聚合返回最新模型
- Then 写入最新 catalog
- And 更新账号关联缓存，供下次启动使用

### 场景 C：禁用/删除账号不贡献缓存
- Given DeepSeek 账号曾经缓存过模型
- When 账号被禁用或删除
- Then 该账号缓存不再进入 catalog 聚合

## 技术方案

1. 新增 `codex-model-account-cache` 本地 JSON 文件，放在 GetTokens data 目录，按 account key 记录账号模型快照。
2. `ListRelaySupportedModels` 聚合成功后，将启用账号的显式/远端模型写回缓存。
3. `applyPersistedCodexModelCatalogSyncSetting` 在常规聚合失败或返回空时，读取缓存模型先写 catalog。
4. 缓存聚合复用既有 `listRelaySupportedModels` 语义：不合并 sidecar-only 模型，只保留账号支撑与本地 Codex 已知模型。
5. 增加 Go 单元测试覆盖缓存读写与启动 fallback。

## 验证命令

- `go test ./internal/wailsapp -run 'TestRelayModelAccountCache|TestApplyPersistedCodexModelCatalogSyncSetting'`
- `go test ./internal/wailsapp -run 'TestListRelaySupportedModels'`
- `docs-linhay/scripts/check-docs.sh`
