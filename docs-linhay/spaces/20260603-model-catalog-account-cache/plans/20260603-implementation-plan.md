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

## 2026-06-03 补充：运行中及时刷新

用户补充要求：App 启动/运行期间账号卡变更后，模型缓存需要及时修改，不能只依赖下次启动或 sidecar ready 的周期性同步。

执行补充：

1. 账号变更成功后立即调度 Codex model catalog refresh。
2. refresh 复用当前账号库存聚合逻辑，写入账号关联缓存与 `~/.codex/gettokens-model-catalog.json`。
3. 当前无启用账号模型时移除 GetTokens catalog 指针，防止旧缓存继续展示已禁用/删除账号模型。
4. 单元测试覆盖运行中刷新与禁用账号清理。

## 2026-06-03 补充：P0 稳定性优化

本轮继续执行模型缓存 P0 优化：

1. 账号 mutation 后的刷新调度改为 debounce + single-flight + pending rerun，避免连续操作时并发刷新。
2. 删除/禁用账号成功后，先即时 prune 对应 account cache entry，再异步全量刷新。
3. catalog 文件写入前比较新旧 bytes；内容不变时跳过写入，减少 mtime 变化。
4. 单元测试覆盖：prune、去抖只跑一次、执行中 pending 只补跑一次、catalog unchanged 不重写。

## 2026-06-03 补充：模型目录诊断 API 与 trace

用户要求继续优化并先补充到 space。本轮新增可观测性能力：

### 目标

1. 提供 `GetCodexModelCatalogDiagnostics`，让 GetTokens 能直接回答“模型有没有写入 catalog、缓存里有什么、Codex config 是否指向 GetTokens catalog”。
2. 每次生成账号模型聚合时写入轻量 trace 文件，记录模型来源、账号快照数量、catalog/cache 路径与生成时间。
3. 诊断结果能区分：同步开关、config 指针、catalog 文件、账号缓存、trace 文件、当前 Codex provider/model。
4. 为后续前端诊断面板和“需要重启 Codex”提示提供后端数据基础。

### 验收标准

- Given 已存在账号模型缓存与 catalog，When 调用 `GetCodexModelCatalogDiagnostics`，Then 返回 sync enabled、路径、catalog 模型数量、缓存账号/模型数量、当前 provider/model、模型列表和 warnings。
- Given catalog 指针不是 GetTokens 管理路径，When 调用 diagnostics，Then warnings 包含外部 `model_catalog_json` 提示。
- Given 账号模型聚合成功，When 刷新缓存/catalog，Then 写入 `catalog-trace-v1.json`，包含 generatedAt、cachePath、catalogPath、accounts、models。
- Given catalog 文件内容不变，When 再次写入，Then catalog 不更新 mtime，但 diagnostics 仍可读取现有状态。

### 验证命令

```bash
go test ./internal/wailsapp -run 'TestCodexModelCatalogDiagnostics|TestRelayModelCatalogTrace'
go test ./internal/wailsapp
go test ./...
docs-linhay/scripts/check-docs.sh
```
