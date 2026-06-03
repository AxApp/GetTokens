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

## 2026-06-03 display alias slug 修复

现象：开启 `sync_model_catalog` 后，Codex TUI 顶部显示 `model: GPT 5.5 high`，发起请求失败为 `unknown provider for model GPT 5.5`。本地 `~/.codex/gettokens-model-catalog.json` 中也能看到 `slug` 被写成 `GPT 5.5`、`GPT 5.4 Mini` 等展示名。

根因：`OpenAICompatibleModel.Alias` 在不同来源里语义不一致。openai-compatible 账号映射里的 `Alias` 是可路由的 Codex-facing model alias，例如 `deepseek`；但 sidecar static model definitions 和本机 `models_cache.json` 的 `display_name` 也被映射到了同一个 `Alias` 字段，例如 `GPT 5.5`。`buildGetTokensCodexModelCatalog` 无条件优先用 `Alias` 生成 static catalog `slug`，导致 Codex 把展示名当请求 body `model` 发给 relay，而 sidecar registry 只注册真实 model id `gpt-5.5`。

修复边界：

- `internal/wailsapp/codex_model_catalog_projection.go`：生成 catalog 时，带空白字符的 alias 只作为 `display_name`；`slug` 回退到 `Name`。不带空白的 alias 继续视为 route alias，保留 `deepseek-chat -> deepseek` 这类 Codex-facing alias 能力。
- `frontend/src/features/status/model/relayModelCatalog.ts` 与 `StatusPanels.tsx`：`sync_model_catalog` 预览采用同一 slug 规则，避免 UI 继续提示错误请求模型。
- 回归测试覆盖 `GPT 5.5` / `GPT 5.4 Mini` 展示名不再成为请求 slug，同时保留 `deepseek` route alias。

已验证：

```bash
go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2.*ModelCatalog|TestEnableGetTokensCodexModelCatalogProjection|TestDisableGetTokensCodexModelCatalogProjection' -count=1
go test ./internal/wailsapp -count=1
node --test frontend/src/features/status/tests/relayModelCatalog.test.mjs frontend/src/features/status/tests/statusTypography.test.mjs
npm --prefix frontend run typecheck
```

运行态处理：既有 `~/.codex/gettokens-model-catalog.json` 不会因代码修复自动热刷新。用户需要在 GetTokens Status 页重新执行一次本地 Codex apply 或关闭再开启 `sync_model_catalog`，然后重启 Codex；临时回滚仍可删除/注释 `~/.codex/config.toml` 顶层 `model_catalog_json`。

## 2026-06-03 Codex cache + local supported catalog 修复

口径校准：`sync_model_catalog` 的真源应是 `Codex 客户端已知可请求模型缓存` + `GetTokens 本地 active 账号支持的模型列表`。`openai-compatible` active 账号只要声明或拉取到的模型名与 Codex 请求模型匹配，就应支持 Codex `/v1/responses` -> openai-compatible -> Chat Completions 转换；但不能仅凭 sidecar static model definitions 把没有本地账号 backing 的 DeepSeek 写入 Codex `/model`。

根因：`ListRelaySupportedModels` 把 sidecar `/v0/management/model-definitions/codex` 返回的 static definitions 当成完整可选模型来源合并，同时本地 Codex `models_cache.json` 只在聚合为空时 fallback。当前本机 SQLite 中 `openai_compatible_accounts = 0`，但 static definitions 仍可包含 `deepseek-v4-flash`，导致 catalog 让 Codex 可选择 DeepSeek；实际请求进入 sidecar 后没有 active openai-compatible auth 承接，失败为 `auth_unavailable: no auth available (providers=codex, model=deepseek-v4-flash)` 或 `unknown provider for model deepseek-v4-flash`。

修复边界：

- `internal/wailsapp/relay_model_catalog.go`：本地 Codex `models_cache.json` 常规并入 catalog；active openai-compatible / codex-api-key 模型常规并入 catalog；sidecar static definitions 只作为 metadata merge，给已存在的模型补充 display name、reasoning metadata，不再单独新增 catalog 模型。
- `internal/wailsapp/relay_model_catalog_test.go`：新增 sidecar-only DeepSeek 不暴露的回归；同时保留 active provider 模型可进入 catalog、本地 Codex cache 始终进入 catalog、sidecar metadata 可补充已有模型的场景。
- 运行态如果存在 active `openai-compatible` DeepSeek provider 且模型名为 `deepseek-v4-flash`，catalog 仍会同步该模型，Codex 请求仍由 sidecar 转换到 Chat Completions。

已验证：

```bash
go test ./internal/wailsapp -run 'TestListRelaySupportedModelsIncludesLocalCodexModelsCache|TestListRelaySupportedModels(MergesSidecarModels|ProviderAliasOverridesSidecarAlias|DoesNotExposeSidecarOnlyDeepSeek|KeepsUserAliasAsOnlyCodexFacingModel)' -count=1
go test ./internal/wailsapp -count=1
node --test frontend/src/features/status/tests/relayModelCatalog.test.mjs frontend/src/features/status/tests/statusTypography.test.mjs
```

当前本机诊断：`/Users/linhey/.config/gettokens/accounts-v1.sqlite` 中没有 active `openai-compatible` 账号，只有一个名为 `DeepSeek` 的 `codex-api-key` 账号；按产品边界它不会进入 openai-compatible Responses -> Chat 转换链路。

## 2026-06-03 接手复核记录

接手会话 `019e8925-758c-7a32-b6b1-4525f4226371` 后复核当前修复闭环：

- Wails catalog projection 已避免把 `GPT 5.5` / `GPT 5.4 Mini` 这类 display alias 写成 Codex request slug。
- Status 页 `sync_model_catalog` 预览与后端使用同一 slug 规则。
- `ListRelaySupportedModels` 已按“Codex 本机 cache + active 本地账号模型”为真源，sidecar static definitions 只补 metadata，不再把无 active backing 的 DeepSeek 暴露给 Codex `/model`。
- CLIProxyAPI sidecar fork 当前 HEAD 为 `131b7740 fix: route openai-compatible account-store models`，本地 `build/bin/cli-proxy-api.meta.json` 已指向 `131b7740:clean`，sidecar 二进制无需重建。

接手复核验证：

```bash
go test ./... -count=1
go test ./internal/wailsapp -count=1
node --test src/features/accounts/tests/rateLimit.test.mjs src/features/accounts/tests/accountCardInteractions.test.mjs src/features/status/tests/relayModelCatalog.test.mjs
npm run typecheck
(cd docs-linhay/references/CLIProxyAPI && go test ./... -count=1)
docs-linhay/scripts/check-docs.sh
```


## 2026-06-03 openai-compatible alias 上游模型还原修复

真实 DeepSeek 连通测试发现：account-store openai-compatible 账号声明 `name=deepseek-v4-flash`、`alias=ds-test-flash` 时，sidecar 能按 alias 选中 DeepSeek auth，但 executor 收到的 `req.Model` 仍是 `ds-test-flash`。DeepSeek 上游只接受 `deepseek-v4-flash` / `deepseek-v4-pro`，因此返回 400。

根因：openai-compatible alias pool 只从运行时 `config.OpenAICompatibility` 读取模型映射。进入 SQLite 统一账号库后，account-store 合成出的 auth 已把非敏感模型定义写入 `auth.Attributes["openai_compat_models"]`，但 `Manager.resolveOpenAICompatUpstreamModelPool` 未消费该 attribute，导致 account-store openai-compatible alias 没有在执行前还原为 upstream `name`。

修复边界：

- `sdk/cliproxy/auth/oauth_model_alias.go`：新增轻量 JSON model alias entry 解码，复用既有 `resolveModelAliasPoolFromConfigModels` 逻辑。
- `sdk/cliproxy/auth/conductor.go`：openai-compatible API-key auth 优先从 `auth.Attributes["openai_compat_models"]` 解析 alias -> upstream name；没有 attribute 命中时再回退 config。
- `sdk/cliproxy/auth/openai_compat_pool_test.go`：新增 account-store openai-compatible alias 回归，确保客户端 `ds-test-flash` 执行时传给 executor 的模型为 `deepseek-v4-flash`。

已验证：

```bash
go test ./sdk/cliproxy/auth -run TestManagerExecute_OpenAICompatAccountStoreAliasResolvesUpstreamModel -count=1
go test ./sdk/cliproxy/auth ./sdk/cliproxy ./internal/watcher/synthesizer -count=1
go test ./... -count=1
./scripts/ensure-sidecar.sh darwin arm64
```

真实请求验证：使用临时 CLIProxyAPI + 临时 account-store openai-compatible DeepSeek 账号，模型配置 `name=deepseek-v4-flash`、`alias=ds-test-flash`；请求 `/v1/responses` 的 `model=ds-test-flash` 返回 HTTP 200，响应 `model=deepseek-v4-flash`，assistant 文本为“DeepSeek alias 修复成功。”

## 2026-06-03 DeepSeek WebSocket -> HTTP fallback 修复

用户在 Proxyman 中看不到 DeepSeek 请求后确认：DeepSeek 不支持 Codex WebSocket。Codex TUI 选中 `deepseek-v4-flash` 后仍保持 `/v1/responses` WebSocket transport，sidecar 不能在同一 downstream WebSocket 内伪装 DeepSeek 已支持 WSS；必须主动拒绝该 WebSocket，让 Codex 客户端切到 HTTP `/v1/responses`。

修复边界：

- `sdk/api/handlers/openai/openai_responses_websocket.go`：在首条 normalized `response.create` 取得模型后，若该模型存在可用 openai-compatible auth 且 auth 不允许 WebSocket，则发送 close code `1003` 并关闭 downstream WebSocket，提示客户端 retry over HTTP。
- 仅对 openai-compatible / account-store compat auth 触发；Codex OAuth / Codex API key 的 WebSocket 能力保持原逻辑。
- `sdk/api/handlers/openai/openai_responses_websocket_test.go`：新增 `TestResponsesWebsocketClosesForOpenAICompatibleHTTPFallback`，覆盖 authenticated WebSocket 首包被 close 1003，以触发 Codex HTTP fallback。

dev 验证（不依赖正式版、不修改生产账号库）：

1. 使用临时 account-store DB 创建 openai-compatible DeepSeek 账号。
2. 启动临时 sidecar 端口 `28326`。
3. 带 Authorization 的 WebSocket 请求 `model=deepseek-v4-flash` 返回 close `1003`: `websocket transport is not supported for model deepseek-v4-flash; retry over HTTP`。
4. 同一临时 sidecar 的 HTTP `/v1/responses` 请求返回 HTTP 200，DeepSeek 文本为“DeepSeek HTTP fallback 成功。”

已验证：

```bash
go test ./sdk/api/handlers/openai -run TestResponsesWebsocketClosesForOpenAICompatibleHTTPFallback -count=1
go test ./sdk/api/handlers/openai ./sdk/cliproxy/auth ./sdk/cliproxy ./internal/watcher/synthesizer -count=1
go test ./... -count=1
./scripts/ensure-sidecar.sh darwin arm64
```

## 2026-06-03 路由诊断日志补强

为排查 `GPT-5.5` display slug、DeepSeek 卡片协议类型、WebSocket/HTTP fallback 等问题，补充低敏默认日志：

- `sdk/api/handlers/openai/openai_handlers.go`：`/v1/models` 输出时记录 catalog 模式、`client_version` 和模型数量。
- `sdk/api/handlers/handlers.go`：请求模型解析时记录 original model、resolved model、base model、provider set；unknown provider 时以 warn 记录同一组字段。
- `sdk/cliproxy/auth/conductor.go`：auth selection 从 debug 提升为 info，记录 provider、model、auth_id、account_key、kind、base_url、compat_name、websockets；API key 仍只打印脱敏值。

这些日志用于快速区分：

1. Codex 是否把 display name 当 request model 发出，例如 `GPT-5.5` vs `gpt-5.5`。
2. 模型是否有 registry provider backing。
3. 选中的是 Codex OAuth、Codex API key，还是 openai-compatible auth。
4. openai-compatible 是否会触发 WebSocket close / HTTP fallback。

已验证：

```bash
go test ./sdk/api/handlers/openai ./sdk/api/handlers ./sdk/cliproxy/auth -count=1
```

## 2026-06-03 账号关联模型缓存启动优化

用户反馈“最新正式版本地 DeepSeek 模型不显示”后确认：`~/.codex/gettokens-model-catalog.json` 与 `codex debug models` 已包含 `deepseek-v4-flash` / `deepseek-v4-pro`，但 Codex 选择器存在启动时读取/会话缓存窗口。为降低 GetTokens 启动到 sidecar ready、远端 provider 模型刷新之间的空窗，本轮补充账号关联模型缓存。

实现边界：

- 新增 `internal/wailsapp/relay_model_account_cache.go`，缓存路径为 `~/.config/gettokens-data/codex-model-account-cache/account-models-v1.json`。
- 缓存以账号为单位保存 Codex-facing 模型快照：`accountKey`、`kind`、`providerName`、`models`。
- `ListRelaySupportedModels` 在成功读取当前账号库存后，按启用账号生成最新快照并覆盖缓存；禁用/删除账号不再写入快照。
- 若远端 provider 模型暂时不可用，但当前账号仍启用且存在同账号缓存，则本轮模型聚合可使用该账号缓存，避免刷新失败导致模型目录短暂丢模型。
- App `Startup` 在 sidecar ready 前异步执行 `applyPersistedCodexModelCatalogCacheSnapshot`：当 `codexModelCatalogSyncEnabled=true` 且本地缓存非空时，先写 `~/.codex/gettokens-model-catalog.json` 与 `model_catalog_json` 指针。
- sidecar ready 后继续执行既有 `applyPersistedCodexModelCatalogSyncSetting`，用账号/远端 provider 最新聚合结果覆盖 catalog 与缓存。
- 若 sidecar ready 后最新聚合为空，则移除 GetTokens model catalog 指针，避免旧账号缓存继续暴露已禁用/已删除模型。

验证：

```bash
go test ./internal/wailsapp -run 'TestRelayModelAccountCache|TestListRelaySupportedModelsUsesAccountCache|TestListRelaySupportedModelsRefreshesAccountCache|TestLoadRelaySupportedModelsFromAccountCache|TestCodexAPIKeyAccountCacheUsesLocalID|TestApplyPersistedCodexModelCatalogCacheSnapshot'
go test ./internal/wailsapp -run 'TestListRelaySupportedModels|TestRelayModelAccountCache|TestApplyPersistedCodexModelCatalogCacheSnapshot|TestCodexAPIKeyAccountCacheUsesLocalID|TestLoadRelaySupportedModelsFromAccountCache'
go test ./internal/wailsapp
```
