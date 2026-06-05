# Codex app model catalog template projection

## 背景

对照 `docs-linhay/references/cc-switch` 后确认：cc-switch 让 Codex app 显示 DeepSeek 的关键链路不是写入特殊 app 目录，而是在 `~/.codex/config.toml` 写入 `model_catalog_json`，并用 Codex 官方 `gpt-5.5` 模型模板生成 `cc-switch-model-catalog.json`。GetTokens 当前也会写 `~/.codex/gettokens-model-catalog.json`，但 catalog entry 是手写结构，对 Codex CLI 已可用，对 Codex app 的兼容性不如 cc-switch。

用户确认：不把 Codex 默认 `model` 自动切到 DeepSeek 是 GetTokens 的既定设计，本 space 只处理 catalog 结构兼容，不改变默认模型选择策略。

## 目标

1. GetTokens 生成 `gettokens-model-catalog.json` 时优先复用 Codex 官方模型模板，贴近 cc-switch 的 model catalog projection。
2. 模板来源优先级参考 cc-switch：`~/.codex/models_cache.json` -> `codex debug models --bundled` -> GetTokens 内置 fallback。
3. DeepSeek 等 GetTokens relay 模型应继承 Codex app 可能依赖的模型字段，例如 context window、speed/service tier 占位、verbosity/search/tool 能力字段等。
4. 保持 `model_catalog_json` ownership 规则：只覆盖 GetTokens-owned 指针，不覆盖外部 catalog。
5. 明确锁住默认模型策略：启用 catalog projection 不自动把顶层 `model` 改成 DeepSeek。

## 范围

- `internal/wailsapp/codex_model_catalog_projection.go`
- `internal/wailsapp/codex_model_catalog_projection_test.go`
- 相关文档与 memory 写回

## 非目标

- 不自动切换 Codex 默认 `model` 到 `deepseek-v4-flash` / `deepseek-v4-pro`。
- 不改 GetTokens sidecar 路由语义，不新增前端伪造模型列表。
- 不触碰正式版 `/Applications/GetTokens.app`，验证只在本仓库/dev 环境内完成。
- 不做 Codex app 可见窗口验收；本轮先完成 Go 单元回归与文档闭环。

## 验收标准

1. Given `CODEX_HOME/models_cache.json` 存在 `gpt-5.5` 模型模板，When GetTokens 生成 Codex model catalog，Then DeepSeek entry 继承模板级字段并替换 slug/display/description/priority。
2. Given 没有可读取的 `models_cache.json`，When 生成 catalog，Then 使用 Codex bundled/static fallback，仍能输出合法 `models` 列表。
3. Given `config.toml` 顶层 `model = "gpt-5.5"`，When 启用 GetTokens model catalog projection 且 catalog 包含 DeepSeek，Then 顶层 `model` 保持 `gpt-5.5`。
4. Given 已存在外部 `model_catalog_json`，When 启用 GetTokens projection 且未显式 override，Then 保留外部指针。
5. 单元测试覆盖模板继承、默认 model 不切换、既有 alias/slug 去重逻辑。

## 设计稿入口

- 本期设计稿：`（无 UI 设计稿；后端/本地配置投影改造）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260605-codex-app-model-catalog-template`
- worktree：`../GetTokens-worktrees/20260605-codex-app-model-catalog-template/`
- 当前执行：短改动，直接在主工作区补测试和最小实现；若后续扩大为 Codex app 实机验收再迁移 worktree。

## 相关链接

- 参考实现：`docs-linhay/references/cc-switch/src-tauri/src/codex_config.rs`
- DeepSeek preset：`docs-linhay/references/cc-switch/src/config/codexProviderPresets.ts`
- GetTokens 当前实现：`internal/wailsapp/codex_model_catalog_projection.go`
- 相关前序：`docs-linhay/spaces/20260603-model-catalog-account-cache/README.md`
- 相关前序：`docs-linhay/spaces/20260603-codex-model-catalog-alias-routing/README.md`

## 实施记录

### 2026-06-05

- 已确认用户设计边界：不自动把默认 `model` 切换到 DeepSeek。
- 已补 BDD/TDD：新增 `TestBuildGetTokensCodexModelCatalogUsesCodexTemplateFromModelsCache`，复现旧手写 catalog 缺少 Codex 官方模板字段的问题。
- 已补默认模型边界测试：`TestApplyRelayServiceConfigToLocalV2ModelCatalogDoesNotSwitchDefaultModel`，确认启用 DeepSeek catalog 不会把顶层 `model` 从用户选择的 `gpt-5.5` 切到 DeepSeek。
- 已实现模板级 catalog projection：优先读取 `CODEX_HOME/models_cache.json` 的 `gpt-5.5` 模板，其次尝试 `codex debug models --bundled`，最后使用 GetTokens 内置 fallback；生成 relay model entry 时替换 slug/display/description/priority/reasoning，并保留 app-facing 模板字段。
- 已运行验证：
  - `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalogUsesCodexTemplateFromModelsCache|TestApplyRelayServiceConfigToLocalV2ModelCatalogDoesNotSwitchDefaultModel'`
  - `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2WritesGetTokensModelCatalogPointer|TestEnableGetTokensCodexModelCatalogProjectionWritesPointerWithoutRelayApply|TestApplyRelayServiceConfigToLocalV2DoesNotOverwriteExternalModelCatalogPointer|TestDisableGetTokensCodexModelCatalogProjectionRemovesOnlyOwnedPointer|TestModelCatalogProjectionPublicMethodsPersistSyncPreference|TestApplyRelayServiceConfigToLocalV2OffPersistsAndRemovesOwnedCatalogPointer|TestApplyRelayServiceConfigToLocalV2WithoutProjectionModePreservesCatalogPreference|TestShutdownRemovesOwnedModelCatalogPointerWithoutChangingSyncPreference|TestShutdownPreservesExternalModelCatalogPointer'`
  - `go test ./internal/wailsapp`

## 当前状态
- 状态：implemented-awaiting-codex-app-smoke
- 最近更新：2026-06-05

### 2026-06-05 Codex.app 包内二次排查：前端 Statsig 白名单过滤

用户重启 GetTokens 与 Codex.app 后，Codex.app 模型选择器仍不显示 DeepSeek。本轮只读检查 `/Applications/Codex.app/`，未修改正式 app 包。

#### 证据链

1. Codex.app 是 Electron 包，主资源为 `/Applications/Codex.app/Contents/Resources/app.asar`，内置 CLI 为 `/Applications/Codex.app/Contents/Resources/codex`，版本为 `codex-cli 0.137.0-alpha.4`。
2. 解析 `app.asar` 后确认前端模型查询路径：
   - `webview/assets/model-queries-CpstxAte.js` 调用 `list-models-for-host`，再由 `models-and-reasoning-efforts-Bqf_x2Fv.js` 过滤。
   - `webview/assets/app-server-manager-signals-SKi6YePu.js` 将 `listModels` 映射到 app-server RPC `model/list`。
   - `webview/assets/app-main-BS0FY7Dz.js` 通过 `getDynamicConfig("107580212")` 读取模型可见性配置。
3. 直接拉起同一个内置 app-server 并发送 `initialize` + `model/list`，返回结果已经包含：
   - `deepseek-v4-flash`
   - `deepseek-v4-pro`
   - `gpt-5.5`
   - `gpt-5.4`
   - `gpt-5.4-mini`
   - `gpt-5.3-codex`
   - `gpt-5.2`
   - `codex-auto-review`
4. 本机 Codex.app Local Storage LevelDB 中缓存的 Statsig config `107580212` 明确为：
   ```json
   {
     "available_models": ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2"],
     "use_hidden_models": true,
     "default_model": "gpt-5.4"
   }
   ```
5. 前端过滤逻辑为：当 `useHiddenModels=true` 且 auth method 不是 `amazonBedrock` 时，只保留 `available_models` 白名单内的 `model`；否则才展示非 hidden 模型。因此 DeepSeek 虽然已进入 app-server `model/list`，仍被 Codex.app 前端过滤掉。

#### 根因结论

当前 Codex.app 不显示 DeepSeek 的根因不是 GetTokens `model_catalog_json` 没生效；`model_catalog_json` 已让内置 app-server `model/list` 返回 DeepSeek。根因在 Codex.app 前端二次过滤：远端/缓存 Statsig 动态配置 `107580212` 开启 `use_hidden_models=true`，且 `available_models` 只包含官方 GPT 白名单，不包含 `deepseek-v4-flash` / `deepseek-v4-pro`。

#### 与 cc-switch 的差异校准

`docs-linhay/references/cc-switch` 的稳定做法主要是生成 Codex `model_catalog_json`，让 `/model` 命令或 CLI/app-server 的模型 catalog 能认识第三方模型。GetTokens 已对齐这层，并且不自动切默认 model 是用户确认的产品设计。

在当前 Codex.app 版本中，还多了一层桌面前端 Statsig 白名单过滤。这个过滤层不属于 cc-switch 的 `model_catalog_json` 方案本身，也不是 GetTokens sidecar/runtime route 能直接控制的稳定公开接口。

#### 后续方案候选

1. **稳定方案（推荐）**：继续保证 CLI / app-server / runtime route 全链可用；在 GetTokens UI 中明确提示“当前 Codex.app 模型弹窗受官方白名单控制，DeepSeek 可通过 config/default model 或 CLI 指定使用”。
2. **风险方案（需单独授权）**：研究 Codex.app Local Storage Statsig cache overlay，把 `107580212.available_models` 合并 DeepSeek；该方案依赖私有缓存，可能被 Codex.app 网络刷新覆盖，不适合作为默认产品能力。
3. **不推荐方案**：把 DeepSeek 伪装成 `gpt-5.4`/`gpt-5.5` 等白名单 model slug。这样会污染请求 model 语义，破坏 GetTokens 按真实 client-facing model 路由的边界。


### 2026-06-05 动态修改 / 覆盖入口排查补充

用户要求继续寻找除 `model_catalog_json` 外，是否存在可动态修改或覆盖 Codex.app 前端模型白名单的入口。本轮仍只读检查 `/Applications/Codex.app/` 与本机 Codex.app 用户数据目录，未修改正式 Codex.app 包与 GetTokens 正式版。

#### 已确认的潜在入口

1. **Statsig Local Storage cache overlay**
   - Codex.app 的 Statsig JS SDK 使用浏览器 `localStorage` provider，Electron 落盘在：
     - `~/Library/Application Support/Codex/Default/Local Storage/leveldb/`
   - 当前 post-login Statsig cache key 为 `statsig.cached.evaluations.3864402225`，内部包含 dynamic config `107580212`。
   - 覆盖方式理论上是离线修改该 cached evaluations JSON，把 `107580212.value.available_models` 合并 `deepseek-v4-flash` / `deepseek-v4-pro`。
   - 风险：Codex.app 运行中 LevelDB 有锁；网络刷新会把本地 overlay 覆盖；cache key 与 user/storage hash 会变；属于私有数据结构。

2. **ChatGPT backend bootstrap rewrite**
   - 登录后 Statsig bootstrap 不是直接从 `ab.chatgpt.com` 唯一路径获得，`codex-api-DgBJbn3B.js` 导出的 `Se` 会请求：
     - `/wham/statsig/bootstrap`
   - Electron main 会把相对路径解析到：
     - 默认生产：`https://chatgpt.com/backend-api/wham/statsig/bootstrap`
     - 若设置 `CODEX_API_BASE_URL`：使用该 env 覆盖 backend API base。
   - 理论上可以在 GetTokens dev sidecar / 本地代理中实现 `/wham/statsig/bootstrap` response rewrite，把返回的 `statsigPayload` 内 `107580212` 合并 DeepSeek。
   - 风险：`CODEX_API_BASE_URL` 会影响 Codex Desktop 的整组 ChatGPT backend API，不只是 Statsig；需要完整反代 `chatgpt.com/backend-api` 并透传登录 auth，否则会破坏账号、任务、环境等功能。

3. **Statsig networkOverride / system proxy rewrite**
   - Statsig SDK 普通 initialize/logging 使用 `networkOverrideFunc`，最终经 Electron main 的 `net.fetch` 发往 `https://ab.chatgpt.com/v1` / `sdk_exception`。
   - Electron `net.fetch` 理论上会走系统代理，因此 GetTokens system proxy 可以作为实验入口拦截响应。
   - 但 HTTPS response rewrite 需要 MITM 证书信任，且 `ab.chatgpt.com` 在 Codex main 的 auth allowlist 中被明确排除，只适合无 auth 的 Statsig 初始化/日志，不适合复用 ChatGPT backend token。

4. **运行时 DevTools / CDP 注入 overrideAdapter**
   - Statsig SDK 支持 `overrideAdapter`，`getDynamicConfigOverride` 会在每次 `getDynamicConfig` 时被调用。
   - Codex 当前初始化 StatsigClient 时没有传 overrideAdapter，但运行时对象暴露在 `globalThis.__STATSIG__`，理论上可通过 DevTools / Chrome DevTools Protocol 注入：对 config `107580212` 返回合并后的 value。
   - 若以 `--remote-debugging-port=<port>` 启动 Codex.app，可由 GetTokens 连接 CDP 并执行一次注入脚本；不需要改 app 包或 LevelDB。
   - 风险：需要由 GetTokens 接管 Codex.app 的启动或要求用户以调试参数重启；远程调试端口有安全暴露；前端 bundle 变更后注入时机和刷新机制可能失效。

5. **shared object / persisted atom 不是模型白名单入口**
   - preload 暴露 `electronBridge.sendMessageFromView`，renderer 可发送 `shared-object-set` 与 `persisted-atom-update`。
   - 但模型选择器直接通过 `statsig-BP9zNYqZ.js` 的 dynamic config hook 读取 `107580212`；`sharedObjectRepository` 与 `electron-persisted-atom-state` 没有稳定映射到该 dynamic config。
   - `statsig_default_enable_features` 只同步 feature gate 名称，不影响 `available_models` 白名单。

6. **app-server / CLI wrapper 入口已不足以解决弹窗显示**
   - 自定义 `codex_cli_command`、`model_catalog_json` 或 app-server `model/list` wrapper 可以影响 `model/list` 返回，但当前返回已经包含 DeepSeek。
   - 前端过滤发生在 `model/list` 之后，所以继续改 CLI/app-server 不能单独让弹窗显示。

#### 方案判断

- 产品默认不应走“伪装成 GPT 白名单 slug”，会破坏 GetTokens route alias 语义。
- 若目标是“正式产品稳定能力”，优先做 **明确提示 + CLI/app-server/runtime 完整可用**。
- 若目标是“实验性让 Codex.app 弹窗显示 DeepSeek”，优先级建议：
  1. CDP runtime injection（可回滚、不改磁盘，但需要调试端口）
  2. Statsig cache overlay（可离线写入，但会被刷新覆盖）
  3. backend/system-proxy rewrite（最重，影响面最大，最后考虑）

### 2026-06-05 cc-switch 最新版 `03a9296c` 对照结论

用户要求将参考项目 cc-switch 更新到最新版并复查是否有更好的 Codex.app DeepSeek 显示入口。本轮已将 `docs-linhay/references/cc-switch` 从 `c67494ba` 快进到 `03a9296c`。

#### 复查范围

- `src-tauri/src/codex_config.rs`
- `src/config/codexProviderPresets.ts`
- `src-tauri/src/commands/provider.rs`
- `src-tauri/src/proxy/providers/transform_codex_chat.rs`
- `src-tauri/src/proxy/providers/streaming_codex_chat.rs`
- `src-tauri/src/proxy/handlers.rs`
- `docs/guides/codex-deepseek-routing-guide-zh.md`

#### 新版 cc-switch 仍没有进入 Codex.app 前端 Statsig 层

全局搜索未发现 `Statsig` / `statsig` / `107580212` / `available_models` / `use_hidden_models` / `remote-debugging` / `DevTools` / `wham/statsig/bootstrap` 相关实现。最新版 cc-switch 的 Codex 模型显示能力仍然集中在 Codex `model_catalog_json` projection：生成 `cc-switch-model-catalog.json`，并在 `config.toml` 写入 `model_catalog_json`。

这说明 cc-switch 的稳定方案仍是让 Codex CLI / app-server `/model` 或 `model/list` 认识 DeepSeek 等第三方模型；它没有提供绕过当前 Codex.app 桌面前端 Statsig 白名单的公开或半公开入口。

#### 可吸收的小改进

最新版 cc-switch 有一处值得 GetTokens 后续吸收的小兼容改进：

- 写入 `model_catalog_json` 时不再写绝对路径，而是只写相对文件名 `cc-switch-model-catalog.json`。
- 判断 ownership / 删除指针时按 `file_name()` 匹配，既能兼容历史绝对路径，也能兼容相对文件名。
- 该改动主要解决 GUI/WSL/UNC/path round-trip 类路径兼容问题，不改变模型白名单层，也不能单独让 Codex.app 前端弹窗显示 DeepSeek。

GetTokens 当前 `gettokens-model-catalog.json` 若要进一步贴近 cc-switch，可考虑把 owned catalog pointer 从绝对路径改为相对文件名，并保留对历史绝对路径的删除/识别兼容。这个优化属于配置健壮性，不属于 Codex.app 弹窗解锁方案。

#### Provider / proxy 变更与本问题关系

- DeepSeek preset 仍是 `deepseek-v4-flash` / `deepseek-v4-pro`，并保留 Codex Chat reasoning 配置。
- Zhipu GLM endpoint 改为 `/api/coding/paas/v4`，新增 CherryIN preset；这些是供应商预设维护，不影响 DeepSeek 在 Codex.app 弹窗是否可见。
- Proxy 新增/优化了 413 上游错误提示、usage 默认 reasoning tokens、Responses↔Chat 转换细节；这些影响请求转发和错误呈现，不影响前端模型白名单。

#### 当前推荐方案保持不变

- 正式稳定路径：继续保证 GetTokens `model_catalog_json`、app-server `model/list`、sidecar route/runtime 全链正确，并在 UI 中提示 Codex.app 桌面前端模型弹窗受官方 Statsig 白名单控制。
- 实验性弹窗显示路径：优先 CDP runtime injection 覆盖 `globalThis.__STATSIG__` / dynamic config `107580212`，合并 DeepSeek 到 `available_models`；它比 cache overlay 和 HTTPS rewrite 更可回滚、影响面更小。
- 不推荐伪装模型 slug：不要把 DeepSeek 暴露成 `gpt-5.4` / `gpt-5.5`，避免污染 GetTokens route alias 语义。


### 2026-06-05 按 cc-switch 优化 GetTokens catalog pointer

用户要求先按 cc-switch 的最新版路径策略优化，便于重新试 Codex。本轮只改 `model_catalog_json` pointer 兼容，不改默认 model，也不处理 Statsig/CDP。

#### 行为变更

- GetTokens 仍写 catalog 文件到 `CODEX_HOME/gettokens-model-catalog.json`。
- 写入 Codex `config.toml` 时，从绝对路径改为相对文件名：
  ```toml
  model_catalog_json = "gettokens-model-catalog.json"
  ```
- Wails 返回结果中的 `ModelCatalogPath` 仍是绝对路径，便于 UI/诊断展示。
- 关闭同步/清理时按 basename 识别 GetTokens-owned pointer，既能移除历史绝对路径，也能移除新的相对 filename。
- 非 GetTokens filename 的外部 `model_catalog_json` 仍保留，不静默覆盖。

#### 验证

- 已先修改测试得到红灯：旧实现仍写绝对路径，且不能移除相对 filename pointer。
- 已实现最小修复并通过：
  - `go test ./internal/wailsapp -run 'TestApplyRelayServiceConfigToLocalV2WritesGetTokensModelCatalogPointer|TestEnableGetTokensCodexModelCatalogProjectionWritesPointerWithoutRelayApply|TestDisableGetTokensCodexModelCatalogProjectionRemovesOnlyOwnedPointer|TestDisableGetTokensCodexModelCatalogProjectionRemovesRelativeOwnedPointer|TestApplyRelayServiceConfigToLocalV2DoesNotOverwriteExternalModelCatalogPointer' -count=1`
  - `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2.*ModelCatalog|TestEnableGetTokensCodexModelCatalogProjection|TestDisableGetTokensCodexModelCatalogProjection|TestModelCatalogProjectionPublicMethodsPersistSyncPreference|TestShutdownRemovesOwnedModelCatalogPointerWithoutChangingSyncPreference|TestShutdownPreservesExternalModelCatalogPointer|TestApplyPersistedCodexModelCatalogCacheSnapshot|TestCodexModelCatalogDiagnostics' -count=1`
  - `go test ./internal/wailsapp -count=1`

