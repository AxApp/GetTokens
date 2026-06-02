# Codex model catalog projection plan

日期：2026-06-02

## 背景

Codex CLI 的 `/model` 列表可以来自远程 `/models`，也可以通过 `~/.codex/config.toml` 的顶层 `model_catalog_json` 指向一个本地静态 catalog。`model_catalog_json` 会让 Codex 使用 `StaticModelsManager`，启动时一次性读取本地 JSON；它会完全替换内置和远程 catalog。

GetTokens 当前已经具备动态路径：

- Codex 本地配置可指向 GetTokens relay provider，例如 `model_provider = "gettokens"`、`base_url = "http://127.0.0.1:8317/v1"`。
- GetTokens relay 的 `/v1/models?client_version=...` 可以返回 Codex catalog shape。
- Wails `ListRelaySupportedModels` 会聚合 openai-compatible provider、Codex API key、本地 `models_cache.json` 和 sidecar `/v0/management/model-definitions/codex`。
- DeepSeek openai-compatible 已在 sidecar Codex model definitions 和 Responses -> Chat executor 链路中完成第一阶段闭环。

问题是：Codex TUI `/model` 对远程模型目录有进程内状态、磁盘 cache 和首层 auto 模型弹窗等因素；当用户期望“账号卡里的 DeepSeek 立刻出现在 `/model`”时，仅靠动态 `/models` 不够可解释，也不够稳定。

## cc-switch 做法摘要

`docs-linhay/references/cc-switch` 的实现重点：

1. 前端 provider 表单维护简化模型表：`model / displayName / contextWindow`。
2. 保存 Codex provider 时，如果 provider 使用 Chat Completions 本地路由，则把模型表写入 provider settings 的 `modelCatalog.models`。
3. Tauri 后端从 `models_cache.json`、`codex debug models --bundled` 或静态 `gpt-5.5` 模板中找一个完整 Codex model entry 模板。
4. 用模板克隆出每个第三方模型 entry，改写 `slug`、`display_name`、`context_window`、`priority` 等字段。
5. 写入 `~/.codex/cc-switch-model-catalog.json`，并在 `config.toml` 顶层写入：

   ```toml
   model_catalog_json = "/Users/.../.codex/cc-switch-model-catalog.json"
   ```

6. 只反向解析自己维护的 `cc-switch-model-catalog.json`；用户手写的外部 catalog 不做简化 round-trip。
7. restore / proxy takeover 时保留或重建 catalog pointer，避免切换 provider 后模型列表丢失。

这个方案解决了 Codex `/model` 展示第三方模型的问题，但它的副作用也很明确：`model_catalog_json` 是完全替换，不是追加；并且 Codex 运行中修改文件不会生效。

## 推荐方向

GetTokens 不照搬 cc-switch 的“每个 provider 自带本地 catalog 真源”。推荐增加一层 **GetTokens-owned Codex model catalog projection**：

```text
account store / sidecar registry / channel routing
        |
        v
ListRelaySupportedModels / sidecar model-definitions
        |
        v
gettokens-model-catalog.json  +  config.toml:model_catalog_json
        |
        v
Codex CLI /model display
```

关键原则：

1. 运行时真源仍是 sidecar。账号选择、alias、禁用、quota、route guard、Responses -> Chat 适配都继续在 sidecar / CLIProxyAPI 内闭环。
2. `model_catalog_json` 只服务本地 Codex `/model` 展示和选择稳定性，不参与 GetTokens route engine 的真实候选判断。
3. 生成文件必须是完整 catalog，不是只包含 DeepSeek。因为 Codex 会完全替换内置 catalog，GetTokens 必须把当前 relay 可选模型全部写进去，包括 GPT 系列、DeepSeek、openai-compatible alias 等。
4. 只管理 `~/.codex/gettokens-model-catalog.json`。如果用户已有外部 `model_catalog_json`，不自动覆盖；在 UI 中给出冲突提示，让用户明确确认后才接管。
5. 写入后提示需要重启 Codex TUI。GetTokens 不能承诺运行中的 `/model` 立即刷新。

## 实施方案

### Phase 1：本地 catalog 投影能力

新增后端纯模型与写入能力：

- `internal/wailsapp/codex_model_catalog_projection.go`
  - `BuildCodexModelCatalog(models []OpenAICompatibleModel, template CodexModelTemplate)`.
  - `NormalizeCodexCatalogProjectionModels`：按 client-facing model name 去重，alias 优先用 `Alias` 作为 display name，slug 使用 `Name`。
  - `LoadCodexModelTemplate`：优先读 `CODEX_HOME/models_cache.json` 的 `gpt-5.5` entry；其次尝试 `codex debug models --bundled`；最后使用仓库内静态模板。
  - `WriteGetTokensCodexModelCatalog`：写 `CODEX_HOME/gettokens-model-catalog.json`，必须原子写。
  - `MergeCodexModelCatalogJSONPointer`：在 `config.toml` 顶层写入或移除 `model_catalog_json`，仅移除 GetTokens 自己的文件名。

复用现有 `relay_local_apply.go` 的 TOML 局部 patch 风格，不全量重写 `config.toml`。

### Phase 2：接入 Apply to local Codex

扩展 `RelayLocalApplyInput` / root DTO / Wails binding：

- `ModelCatalogProjectionMode`: `off | gettokens`.
- `ModelCatalogModels`: 可选；为空时由 Wails 调 `ListRelaySupportedModels` 聚合。
- `ModelCatalogRequiresRestart`: 返回给前端，用于结果提示。
- `ModelCatalogPath`: 返回实际写入路径。
- `ExistingExternalModelCatalogPath`: 当已有外部 catalog 且未确认接管时返回阻塞原因。

在 `ApplyRelayServiceConfigToLocalV2` 中：

1. 先按现有逻辑写 `auth.json` / provider / model / reasoning。
2. 当 `ModelCatalogProjectionMode=gettokens` 时，读取 relay catalog，生成 `gettokens-model-catalog.json`。
3. 成功写文件后，向 `config.toml` 写顶层 `model_catalog_json`。
4. 如果 catalog 生成失败，不应部分写 pointer；已写 provider config 的情况下，返回 degraded warning，避免把本地 Codex 配置留在不可启动状态。

默认策略：

- Status 页“应用到本地 Codex”默认开启 projection，因为它面向 GetTokens relay provider。
- 账号卡 direct upstream 的 Codex apply 仍按已验证模板白名单控制；DeepSeek 仍不因为支持 OpenAI-compatible 就自动出现 Codex direct action。

### Phase 3：UI 与诊断

前端改动范围：

- `frontend/src/features/status/StatusFeature.tsx`
  - 在 Codex apply 表单中增加“同步 `/model` 模型目录”开关，默认开启。
  - 当检测到外部 `model_catalog_json` 时展示冲突阻塞，允许用户确认由 GetTokens 接管。
  - apply 结果显示 catalog path 与“重启 Codex 后生效”。
- `frontend/src/features/accounts/AccountsFeature.tsx`
  - 账号卡 Codex apply draft 若走 GetTokens relay provider，也传入 projection mode。
  - direct upstream 模式不默认写 GetTokens catalog。
- `frontend/src/features/codex/CodexAccountListFeature.tsx`
  - 路由探测模型候选继续读 relay catalog，不依赖本地 JSON。

不要把 `model_catalog_json` 编辑塞进通用 Feature 配置页作为主要入口；它是本地 Codex apply 的派生产物，不是用户应该长期手写维护的主配置。

## 不做

- 不把 account store 的模型列表迁移到 `~/.codex/gettokens-model-catalog.json`。
- 不用前端 provider preset 作为 catalog 真源。
- 不在 Codex TUI 运行中尝试热刷新 `/model`。
- 不覆盖用户外部 `model_catalog_json`，除非用户在 apply 流程中确认接管。
- 不为 DeepSeek 自动开放账号卡 `应用到 Codex` direct upstream 动作；DeepSeek 的 Codex 路径默认通过 GetTokens relay + sidecar executor。

## 关键测试

后端：

```bash
go test ./internal/wailsapp -run 'TestBuildCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2.*ModelCatalog|TestListRelaySupportedModels' -count=1
```

前端：

```bash
npm --prefix frontend run test:unit -- src/features/accounts/tests/accountLocalCliMapping.test.mjs src/features/codex/codexAccountList.test.mjs
npm --prefix frontend run typecheck
```

真实冒烟：

```bash
codex -a never exec --skip-git-repo-check --ephemeral --sandbox read-only --model deepseek-v4-flash --output-last-message /tmp/gettokens-codex-smoke.out "Reply with exactly: ok"
```

验收点：

1. `~/.codex/gettokens-model-catalog.json` 存在，顶层为 `{"models":[...]}`，包含 `gpt-5.5`、`gpt-5.4`、`deepseek-v4-flash`、`deepseek-v4-pro` 等当前 relay 可选模型。
2. `~/.codex/config.toml` 顶层存在绝对路径 `model_catalog_json = ".../gettokens-model-catalog.json"`。
3. 重启 Codex 后 `/model -> All models` 能看到 DeepSeek 模型。
4. 选择 `deepseek-v4-flash` 后，请求仍命中 GetTokens relay `/v1/responses`，sidecar route engine 选择 openai-compatible DeepSeek executor，上游走 Chat Completions。
5. 删除/关闭 projection 时，只移除 GetTokens 自己的 pointer，不删除用户外部 catalog。

## 风险与回滚

风险：

- `model_catalog_json` 是完整替换；如果生成列表漏掉 GPT 模型，用户会以为内置模型丢失。
- Codex 只在启动时加载；用户可能误以为保存后立即刷新。
- 使用模板生成时，Codex 新版本新增字段可能缺失；需要优先用本机 `models_cache.json` 或 `codex debug models --bundled`。

回滚：

1. 删除或注释 `~/.codex/config.toml` 顶层 `model_catalog_json`。
2. 保留 `~/.codex/gettokens-model-catalog.json` 作为无害文件，或由 GetTokens 只在确认时删除。
3. 重启 Codex，回到远程 `/models` 或内置 catalog 路径。

## 推荐落地顺序

1. 先做后端 projection builder + tests，确保完整 catalog 和 TOML pointer 语义正确。
2. 再接 `ApplyRelayServiceConfigToLocalV2`，只服务 Status 页本地 Codex apply。
3. 再扩展账号卡 apply draft，保持 DeepSeek direct upstream 不自动开启。
4. 最后补真实 Codex CLI 冒烟和文档记忆。

该计划的最脆弱假设是：当前 Codex CLI 版本继续支持 `model_catalog_json` 且 catalog schema 与 `gpt-5.5` 模板兼容。如果未来 Codex 删除或改变该字段，GetTokens 仍可退回动态 `/v1/models?client_version=...`，sidecar 运行时路由不受影响。

## 2026-06-02 实施记录

已完成 Phase 1 与 Status 页接入：

- 新增 `internal/wailsapp/codex_model_catalog_projection.go`，生成 GetTokens-owned `CODEX_HOME/gettokens-model-catalog.json`。
- 扩展 `RelayLocalApplyInput` / `RelayLocalApplyResult` / root Wails DTO / `frontend/wailsjs`，支持 `modelCatalogProjectionMode`、`modelCatalogModels`、`modelCatalogPath`、`existingExternalModelCatalogPath` 与 restart 提示。
- `ApplyRelayServiceConfigToLocalV2` 在 `modelCatalogProjectionMode=gettokens` 时写入完整模型 catalog，并把 `config.toml` 顶层 `model_catalog_json` 指向 GetTokens 文件。
- 如果已有外部 `model_catalog_json`，默认保留外部指针并返回 `existingExternalModelCatalogPath`，不静默接管。
- 新增 `DisableGetTokensCodexModelCatalogProjection`，只移除指向 `gettokens-model-catalog.json` 的顶层 pointer；外部 catalog 不动。
- Status 页 Codex 本地应用面板新增“Codex /model 模型目录”同步开关，默认开启；打开开关会立即写入 GetTokens-owned `model_catalog_json` pointer，关闭开关会立即移除该 pointer。
- 账号卡 apply 维持 direct upstream 与 OAuth 模式的既有语义，本轮仅修正 V2 DTO 构造方式，不默认写 GetTokens catalog。

实际实现与 Phase 1 原计划有两点收窄：

- 本轮没有引入 `models_cache.json` / `codex debug models --bundled` 模板克隆，而是生成满足 Codex static catalog 的最小完整 entry。原因是当前必须先解决 `/model` 可见性与可撤销 pointer，模板来源不稳定不应阻塞核心闭环。
- 生成 slug 使用 client-facing 名称：有 alias 时用 `Alias`，否则用 `Name`。这与 GetTokens route engine 的“请求 body model 即路由输入”保持一致，用户在 Codex `/model` 选择 `deepseek` 时，sidecar 仍按 `deepseek` 进入 alias pool。

已验证：

```bash
go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2.*ModelCatalog|TestDisableGetTokensCodexModelCatalogProjection' -count=1
go test ./internal/wailsapp -count=1
go test ./... -count=1
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit -- src/features/accounts/tests/accountLocalCliMapping.test.mjs src/features/status/tests/codexFeatureConfig.test.mjs src/features/status/tests/statusTypography.test.mjs
```

待补真实冒烟：

- 使用隔离 `CODEX_HOME` 和临时 GetTokens relay config 启动 Codex CLI，确认 `/v1/models?client_version=...` 与 static catalog 均包含目标 DeepSeek alias。
- 重启 Codex 后在 `/model -> All models` 选择 DeepSeek，确认请求仍走 GetTokens relay `/v1/responses`，sidecar route engine 命中 openai-compatible executor。

## 2026-06-02 运行时路由修复

本地 Codex 报错 `auth_unavailable: no auth available (providers=codex, model=deepseek-v4-flash)` 后，补查相关 spaces，确认 DeepSeek 的正式产品边界是 `openai-compatible provider`，Codex 运行时路由只应消费 body `model`。

根因不在 `model_catalog_json` 本身，而在 sidecar account-store runtime synthesis：SQLite 账号库启用后，openai-compatible 账号合成出的 auth 只带 `models_hash`，没有带可用于注册 registry 的模型定义。进入 SQLite 统一账号库后，运行时真源必须是 account-store 合成出的 auth；旧 `config.OpenAICompatibility` 只参与迁移，不能参与运行时 synthesis，也不能在模型注册阶段作为 fallback。缺少自描述模型 attribute 时，DeepSeek auth 没有注册到 model registry，于是 `/v1/responses` 的 provider set 只剩 Codex 静态 catalog 的 `codex`。

本轮修复：

- `internal/watcher/synthesizer/config.go`：account-store openai-compatible auth 合成时写入非敏感 `openai_compat_models` attribute；DeepSeek 默认模型也只在 account-store 合成阶段 materialize。
- `sdk/cliproxy/service.go`：注册 openai-compatible auth 模型时只读取 auth attributes（`compat_name`、`provider_key`、`base_url`、`openai_compat_models`），不再反查 `cfg.OpenAICompatibility`。
- `sdk/cliproxy/service_excluded_models_test.go` 与 `internal/watcher/synthesizer/config_test.go`：补 account-store DeepSeek、自描述模型注册、DeepSeek 默认模型合成和“缺少 `openai_compat_models` 不回退旧 config”的回归。

已验证：

```bash
go test ./internal/watcher/synthesizer ./sdk/cliproxy -run 'TestConfigSynthesizer_UsesAccountStoreForCodexAndOpenAICompatible|TestConfigSynthesizer_OpenAICompat_DeepSeekDefaultsMaterialized|TestConfigSynthesizer_OpenAICompat_WithModels|TestRegisterModelsForAuth_AccountStoreOpenAICompatibilityModels|TestRegisterModelsForAuth_OpenAICompatibilityUsesAuthModelAttributes|TestRegisterModelsForAuth_OpenAICompatibilityDoesNotFallbackToConfig|TestRegisterModelsForAuth_OpenAICompatibilityImageModelType' -count=1
go test ./sdk/api/handlers/openai -run 'TestCodexDeepSeekOpenAICompatibleResponses.*Smoke|TestOpenAIModelsReturnsDeepSeekOpenAICompatibleCodexCatalogEntry' -count=1
go test ./sdk/api/handlers ./sdk/cliproxy/auth ./internal/registry -run 'TestGetRequestDetails|TestCodexStaticModelsIncludeDeepSeekV4OpenAICompatibleModels|TestExecuteStreamWithAuthManager_SelectionErrorIncludesProviderContext' -count=1
go test ./internal/watcher/synthesizer ./sdk/cliproxy ./sdk/api/handlers/openai ./sdk/api/handlers ./sdk/cliproxy/auth ./internal/registry -count=1
go build -o test-output ./cmd/server
./scripts/ensure-sidecar.sh darwin arm64
```
