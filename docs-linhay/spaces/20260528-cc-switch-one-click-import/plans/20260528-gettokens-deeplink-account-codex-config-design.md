# GetTokens deep link 账号与 Codex 配置导入设计

## 设计目标

设计 `gettokens://` deep link，让外部页面、厂商文档或团队配置可以把账号和 Codex 本地配置带入 GetTokens。设计必须满足两个前提：

1. Deep link 只表达“导入意图”，不直接落盘。
2. 最终写入必须复用现有账号、sidecar 和 Codex local apply 服务层，不能绕过既有校验去写 `auth.json`、`config.toml` 或 CLIProxyAPI 配置。

## 现有边界

### 账号服务

当前账号列表由三类来源组成：

| 来源 | 账号 ID | 现有创建/写入入口 |
| --- | --- | --- |
| Codex OAuth / auth file | `auth-file:<name>` | `UploadAuthFiles(files)` 经 sidecar `/v0/management/auth-files` 上传 |
| Codex API key | `codex-api-key:<local-id>` 或指纹 ID | `CreateCodexAPIKey(input)` 写入本地 `~/.config/gettokens-data/codex-api-keys/*.json` 并同步 sidecar |
| OpenAI-compatible provider | `openai-compatible:<name>` | `CreateOpenAICompatibleProvider(input)` 经 CLIProxyAPI Management API 写入 provider |

账号列表展示和路由语义已经区分 `auth-file`、`codex-api-key`、`openai-compatible`，后续 deep link 必须沿用这个分层。

### Codex 本地配置

Codex local apply 已有三类语义：

1. API Key 模式：写 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml`。
2. OAuth / auth-file 模式：写所选账号 OAuth `auth.json`，让 Codex 走 ChatGPT/Codex OAuth backend。
3. 保留 ChatGPT 登录态模式：只 patch `config.toml` 的 custom provider 字段。

`GetLocalCodexModelProviderState()` 能读取当前 `model_provider`、当前模型和已存在 provider；`mergeRelayCodexConfigToml()` 已经实现保留式 TOML patch。Deep link 不应新增完整覆盖 `config.toml` 的入口。

## 方案比较

### 方案 A：只支持账号 deep link

只让 `gettokens://v1/import?channel=codex&resource=account...` 创建账号，不触碰 Codex 本地配置。

- 成本：低。
- 风险：低。
- 问题：用户仍需手动进入 Codex local apply，无法满足“直接导入账号和 codex 配置”。

### 方案 B：账号与 Codex 配置分资源导入

支持 `resource=account` 和 `resource=codex-config` 两类 deep link。账号导入创建账号；Codex 配置导入只生成 local apply 草稿和 diff，确认后调用现有 local apply。

- 成本：中。
- 风险：中。
- 依赖：现有账号创建、Codex provider state、local apply diff / apply。
- 问题：外部平台想“一条链接完成账号和配置”时体验不够顺。

### 方案 C：账号、Codex 配置、组合导入三层协议

在方案 B 基础上增加 `resource=codex-setup`，一条链接可以同时携带账号草稿和 Codex 配置草稿。确认页分成两个步骤：先创建账号，再应用 Codex 配置；任一步失败都不吞掉错误。

- 成本：中高。
- 风险：可控，但需要更完整的测试矩阵。
- 依赖：同方案 B，并额外需要导入事务/回滚提示设计。
- 推荐：采用。它满足外部一键配置场景，同时保留账号和 Codex 配置的独立确认边界。

攻击角度校验：

| 角度 | 结论 |
| --- | --- |
| 依赖失败 | sidecar 未 ready 时只允许保存账号草稿或展示待执行，不写 Codex 配置；Codex local apply 失败不删除已创建账号 |
| 数据量放大 | deep link 只支持单账号、单 Codex 配置；批量导入改走 JSON 文件导入 |
| 回滚成本 | 账号创建和 Codex 配置写入分步展示，Codex 配置写入前有 diff；账号误导入可用现有删除入口 |
| 前提崩塌 | 如果系统未注册 URL scheme，仍可提供“粘贴 deep link”入口复用同一 parser |

## 推荐方案

采用方案 C：三类 resource，共用 parser 和确认弹窗。

```text
gettokens://v1/import?channel=codex&resource=account&...
gettokens://v1/import?channel=codex&resource=codex-config&...
gettokens://v1/import?channel=codex&resource=codex-setup&...
```

### 不做的事

1. 不支持远程 `configUrl`。
2. 不支持导入 usage script 或任意可执行脚本。
3. 不支持批量账号导入。
4. 不支持无确认自动启用、自动切换 Codex 当前账号。
5. 不支持完整替换 `CODEX_HOME/config.toml`。
6. 不支持把任意 TOML 片段拼进用户配置；只允许受控字段 patch。

## 协议设计

### 通用参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `channel` | 是 | 固定值 `codex`，明确这是 Codex 账号 / 配置导入，不与其他产品线混淆 |
| `resource` | 是 | `account` / `codex-config` / `codex-setup` |
| `version` | 否 | URL host 已表达 `v1`，query 中可省略 |
| `source` | 否 | 来源标识，用于确认页展示，不参与信任判断 |
| `nonce` | 否 | 外部生成的去重标识；同 nonce 重复点击时提示重复 |
| `config` | 否 | Base64URL 编码 JSON；复杂字段优先放这里 |
| `enabled` | 否 | 只表示账号创建后是否启用；默认 `false` |
| `apply` | 否 | 是否在确认后继续应用 Codex 配置；默认 `false` |

所有 query 参数和 `config` 合并时，query 参数优先级更高。`config` 只允许 JSON，使用 Base64URL UTF-8 编码，不支持 TOML、YAML 或远程 URL。

`config` 的 canonical 形式不是一组散落字段，而是一个 `documents[]` 补丁包。`account` / `codexConfig` 这类对象只是便捷语法，最终都要编译成对 `auth.json`、`config.toml` 或未来扩展文件的文档级 patch。

### 字段覆盖语义

Codex config patch 统一采用 presence 语义：

1. 字段在 query、`codexConfig` 或 `documents[]` operation 中显式出现时，才覆盖对应的本地字段。
2. 字段未出现时，保留用户现有 `auth.json` / `config.toml` 内容，不用默认值回填。
3. `false`、空字符串以外的零值都不能被当作“未出现”；例如 `supportsWebsockets=false` 和 `requires_openai_auth=false` 必须写入 `false`。
4. `providerID` 只作为身份值；本机已有显式 `model_provider` 时不改 root `model_provider`，只把显式字段 patch 到当前激活 provider section。
5. 手动“应用模板到 Codex”不是 deep link patch，它会把当前表单值作为显式字段提交，保持原有一键应用体验。

## 通用文件改写格式

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-xxx" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model_provider", "value": "team-relay" },
        { "op": "set", "path": "model_providers.team-relay.base_url", "value": "https://api.example.com/v1" }
      ]
    }
  ]
}
```

### 文档对象字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `target` | 是 | 目标文件名，如 `auth.json`、`config.toml` |
| `format` | 是 | `json` / `toml` / `text` |
| `mode` | 否 | `merge` / `patch` / `replace`，默认由格式推断 |
| `operations` | 是 | 按顺序执行的改写操作 |
| `preserveUnknown` | 否 | 是否保留未知字段，默认 `true` |
| `backup` | 否 | 是否在写入前保留备份，默认 `true` |

### 操作对象字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `op` | 是 | `set` / `delete` / `append` / `merge` |
| `path` | 是 | `json` 使用 JSON Pointer，`toml` 使用 dotted path |
| `value` | 否 | 新值，JSON value 形式 |
| `valueEncoding` | 否 | `plain` / `base64`，默认 `plain` |
| `allowCreate` | 否 | 不存在时是否创建路径，默认 `true` |

### 目标文件约定

| target | 说明 |
| --- | --- |
| `auth.json` | Codex auth file，适合 `replace` 或 root-level `set`/`merge` |
| `config.toml` | Codex 本地配置，适合 root key 和 `model_providers.<id>` patch |
| `settings.json` | 未来可扩展目标，当前不开放 |

### 推荐路径语义

| 文件 | 路径语义 |
| --- | --- |
| JSON 文件 | JSON Pointer，如 `/user/email`、`/tokens/access_token` |
| TOML 文件 | dotted path，如 `model_provider`、`model_providers.team-relay.base_url` |

### 典型操作

| 操作 | 语义 |
| --- | --- |
| `set` | 设置或覆盖路径值 |
| `delete` | 删除路径 |
| `append` | 向数组追加单项 |
| `merge` | 对对象/表执行深合并，保留未提及字段 |

## 字段总表

### 1. 通用字段

| 字段 | 必填 | 适用资源 | 说明 |
| --- | --- | --- | --- |
| `channel` | 是 | 全部 | 固定值 `codex`，用于明确这是 Codex 导入链路 |
| `resource` | 是 | 全部 | `account` / `codex-config` / `codex-setup` |
| `config` | 否 | 全部 | Base64URL JSON，优先承载复杂对象 |
| `source` | 否 | 全部 | 来源标识，仅用于确认页展示 |
| `nonce` | 否 | 全部 | 去重标识 |
| `enabled` | 否 | account | 账号导入后是否启用，默认 `false` |
| `apply` | 否 | codex-config / codex-setup | 是否在确认后继续应用 Codex 配置，默认 `false` |

### 2. account 资源字段

#### 2.1 `accountType = codex-api-key`

| 字段 | 必填 | 进入入口 | 说明 |
| --- | --- | --- | --- |
| `accountType` | 是 | `CreateCodexAPIKey` | 固定值 `codex-api-key` |
| `label` | 否 | `CreateCodexAPIKeyInput.Label` | 显示名 |
| `apiKey` | 是 | `CreateCodexAPIKeyInput.APIKey` | 账号 API key |
| `baseUrl` | 是 | `CreateCodexAPIKeyInput.BaseURL` | API base URL |
| `prefix` | 否 | `CreateCodexAPIKeyInput.Prefix` | 前缀 |
| `proxyUrl` | 否 | `CreateCodexAPIKeyInput.ProxyURL` | 代理 URL |
| `models` | 否 | `CreateCodexAPIKeyInput.Models` | 模型映射，放在 `config` 中更合适 |
| `formatBaseUrls` | 否 | `CreateCodexAPIKeyInput.FormatBaseURLs` | 格式级 base URL 映射 |
| `quotaCurl` | 否 | `CreateCodexAPIKeyInput.QuotaCurl` | 用量查询 curl，仅建议本地生成，不建议外链 |
| `billingCurl` | 否 | `CreateCodexAPIKeyInput.BillingCurl` | 账单 curl，仅建议本地生成，不建议外链 |
| `quotaEnabled` | 否 | `CreateCodexAPIKeyInput.QuotaEnabled` | 是否启用用量查询 |
| `billingEnabled` | 否 | `CreateCodexAPIKeyInput.BillingEnabled` | 是否启用账单查询 |

#### 2.2 `accountType = openai-compatible`

| 字段 | 必填 | 进入入口 | 说明 |
| --- | --- | --- | --- |
| `accountType` | 是 | `CreateOpenAICompatibleProvider` | 固定值 `openai-compatible` |
| `name` | 是 | `CreateOpenAICompatibleProviderInput.Name` | provider 名称 |
| `apiKey` | 是 | `CreateOpenAICompatibleProviderInput.APIKey` | 首个 API key |
| `baseUrl` | 是 | `CreateOpenAICompatibleProviderInput.BaseURL` | provider base URL |
| `prefix` | 否 | `CreateOpenAICompatibleProviderInput.Prefix` | provider 前缀 |
| `models` | 否 | 需扩展 `CreateOpenAICompatibleProvider` | 模型映射 |
| `apiKeys` | 否 | 需扩展 `CreateOpenAICompatibleProvider` | 多 key 账号 |
| `proxyUrl` | 否 | 需扩展 `CreateOpenAICompatibleProvider` | 代理 URL |
| `headers` | 否 | 首期不支持 | 需要手动补充，避免外链注入 |

#### 2.3 `accountType = auth-file`

| 字段 | 必填 | 进入入口 | 说明 |
| --- | --- | --- | --- |
| `accountType` | 是 | `UploadAuthFiles` | 固定值 `auth-file` |
| `name` | 是 | `UploadAuthFiles` | 文件名 |
| `config.documents[]` | 是 | `UploadAuthFiles` | 目标 `auth.json` 的补丁包，建议用 `merge` 或 `replace` |
| `enabled` | 否 | 仅在预览层解释 | auth file 本身不是启停字段 |

### 3. codex-config 资源字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `mode` | 是 | `api-key` / `oauth-auth-file` / `preserve-chatgpt-provider` |
| `config.documents[]` | 是 | 至少包含 `auth.json` 或 `config.toml` 之一的补丁包 |
| `model` | 否 | root `model`，可作为 `config.toml` 文档中的 `set` 操作简写 |
| `reasoningEffort` | 否 | root `model_reasoning_effort`，可作为 `config.toml` 文档中的 `set` 操作简写 |
| `providerID` | 否 | 当前无激活 provider 时的创建值；若已有激活值则保持原值，仅 patch 当前 section |
| `providerName` | 否 | provider 显示名，可作为 `config.toml` 文档中的 `set` 操作简写 |
| `baseUrl` | 按 mode | custom provider base URL，可写入 `auth.json` 或 `config.toml` |
| `apiKey` | `api-key` 必填 | 写入 `auth.json` 或 bearer token 草稿 |
| `accountRef` | 否 | `auth-file:<name>` / `codex-api-key:<id>` / `openai-compatible:<name>` |
| `supportsWebsockets` | 否 | patch `supports_websockets`；遵循 presence 语义，`false` 也是显式写入 |
| `providerScope` | 否 | `current-active` / `create-new`，显式标识沿用当前激活 provider 还是创建新 provider |
| `providerCompatibility` | 否 | 预览结果 | `compatible` / `blocked_builtin_openai` / `missing_chatgpt_auth` / `missing_provider_section` |
| `providerRewriteMode` | 否 | 预览结果 | `keep-current` / `patch-current` / `create-new` |

### 4. codex-setup 资源字段

`codex-setup` 主要通过 `config` 传入两块对象：

| 对象 | 字段 |
| --- | --- |
| `account` | `accountType`, `name`, `label`, `apiKey`, `apiKeys`, `baseUrl`, `prefix`, `proxyUrl`, `models`, `formatBaseUrls`, `quotaCurl`, `billingCurl`, `authFile` |
| `codexConfig` | `mode`, `model`, `reasoningEffort`, `providerID`, `providerName`, `providerScope`, `baseUrl`, `apiKey`, `supportsWebsockets`, `accountRef`, `providerCompatibility`, `providerRewriteMode` |

`codex-setup` 额外支持通用字段 `apply`、`enabled`、`source`、`nonce`，但不会新增自己的字段池。

### 5. 明确不支持的字段

| 字段 | 状态 | 说明 |
| --- | --- | --- |
| `configUrl` | 不支持 | 不做远程拉取 |
| `usageScript` | 不支持 | 不导入可执行脚本 |
| `headers`（openai-compatible 首期） | 不支持 | 防止外链注入请求头 |
| 批量账号数组 | 不支持 | 只做单账号导入 |
| 任意 TOML 片段 | 不支持 | 只允许受控 patch |
| 自动启用 / 自动切换当前账号 | 不支持 | 必须确认后再做 |

### resource=account

账号导入支持三种 `accountType`：

| accountType | 用途 | 最终服务入口 |
| --- | --- | --- |
| `codex-api-key` | 创建 GetTokens 本地 Codex API key 账号 | `CreateCodexAPIKey` |
| `openai-compatible` | 创建 CLIProxyAPI OpenAI-compatible provider | `CreateOpenAICompatibleProvider`，后续增强可走 `UpdateOpenAICompatibleProvider` 支持 models/headers |
| `auth-file` | 导入 Codex OAuth auth.json | `UploadAuthFiles` |

#### Codex API key 示例

```text
gettokens://v1/import?channel=codex&resource=account&accountType=codex-api-key&label=Team%20Relay&apiKey=sk-xxx&baseUrl=https%3A%2F%2Fapi.example.com%2Fv1&model=gpt-5-codex
```

字段：

| 字段 | 必填 | 映射 |
| --- | --- | --- |
| `label` | 否 | `CreateCodexAPIKeyInput.Label` |
| `apiKey` | 是 | `CreateCodexAPIKeyInput.APIKey` |
| `baseUrl` | 是 | `CreateCodexAPIKeyInput.BaseURL` |
| `prefix` | 否 | `CreateCodexAPIKeyInput.Prefix` |
| `proxyUrl` | 否 | `CreateCodexAPIKeyInput.ProxyURL` |
| `models` | 否 | `CreateCodexAPIKeyInput.Models`，从 `config` JSON 传数组 |
| `formatBaseUrls` | 否 | `CreateCodexAPIKeyInput.FormatBaseURLs` |
| `quotaCurl` / `billingCurl` | 否 | 默认只预览，不建议外链携带 |

#### OpenAI-compatible 示例

```text
gettokens://v1/import?channel=codex&resource=account&accountType=openai-compatible&name=deepseek&apiKey=sk-xxx&baseUrl=https%3A%2F%2Fapi.deepseek.com%2Fv1
```

字段：

| 字段 | 必填 | 映射 |
| --- | --- | --- |
| `name` | 是 | provider name，必须唯一 |
| `apiKey` | 是 | 首个 API key |
| `baseUrl` | 是 | provider base URL |
| `prefix` | 否 | provider prefix |
| `models` | 否 | 需要增强 root `CreateOpenAICompatibleProvider`，否则首期只能创建后再提示用户补模型 |
| `headers` | 否 | 首期不允许 deep link 写入，避免外链注入 header |

#### Auth file 示例

```text
gettokens://v1/import?channel=codex&resource=account&accountType=auth-file&name=team-codex-auth.json&config=<base64url-json>
```

`config` JSON：

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/auth_mode", "value": "chatgpt" },
        { "op": "set", "path": "/user/email", "value": "team@example.com" }
      ]
    }
  ]
}
```

auth-file 导入风险最高，确认页必须展示 email / plan / token 字段摘要，不展示完整 token。默认不支持从普通 query 参数直接传 `authJson`，只允许 `config`。

### resource=codex-config

Codex 配置导入只表达受控 patch，不表达整份 TOML。推荐把 `auth.json` 和 `config.toml` 都放进同一个 `documents[]` bundle。

示例：

```text
gettokens://v1/import?channel=codex&resource=codex-config&mode=api-key&model=gpt-5-codex&baseUrl=https%3A%2F%2Fapi.example.com%2Fv1&apiKey=sk-xxx&providerID=team-relay
```

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `mode` | 是 | `api-key` / `oauth-auth-file` / `preserve-chatgpt-provider` |
| `config.documents[]` | 是 | 目标 `auth.json` / `config.toml` 的补丁包 |
| `model` | 否 | root `model`，可由 `config.toml` 文档表示 |
| `reasoningEffort` | 否 | root `model_reasoning_effort`，可由 `config.toml` 文档表示 |
| `providerID` | 否 | 目标 provider；默认读取当前 `model_provider`，`mode=preserve-chatgpt-provider` 时不得为 `openai` |
| `providerName` | 否 | `[model_providers.<id>].name` |
| `baseUrl` | 按模式 | custom provider base URL，可写入 `config.toml` 文档 |
| `apiKey` | `api-key` 必填 | 只用于 auth 写入或 bearer token 草稿，可写入 `auth.json` 文档 |
| `supportsWebsockets` | 否 | patch `supports_websockets`；遵循 presence 语义，`false` 也是显式写入 |
| `accountRef` | 否 | 指向刚导入或已有账号，如 `codex-api-key:<id>` |

模式语义：

| mode | 写入策略 |
| --- | --- |
| `api-key` | 生成 Codex API key local apply 草稿，写 `auth.json` 的 `OPENAI_API_KEY`，并 patch `config.toml` |
| `oauth-auth-file` | 选择已有或刚导入的 `auth-file`，写 OAuth tokens，让 Codex 走 ChatGPT/Codex OAuth backend |
| `preserve-chatgpt-provider` | 不碰 `auth.json` tokens，只 patch custom provider；需要 preflight 确认本机有可保留 ChatGPT 登录态 |

`codex-config` 的确认页必须先调用 `GetLocalCodexModelProviderState()`，展示当前 provider。默认 patch 当前 provider，不默认创建 `gettokens` provider；如果本地已有激活的 `model_provider`，deep link 不得改写它，只能补齐当前 provider 的 section。

`providerScope` 是这个场景的显式标识：

1. `providerScope=current-active` 表示沿用当前激活 `model_provider`，只 patch 该 provider 的 section。
2. `providerScope=create-new` 表示创建新的 provider，并在没有当前激活 provider 时写入新的 `model_provider`。
3. 当 `providerScope=current-active` 但当前没有激活值时，确认页可退回到 `create-new`，但必须明确提示是降级执行。
4. `providerID` 只作为具体 provider 的身份值，不再承担“是否改写当前激活值”的语义。

### provider 改写与 status 页对齐

`/#frame=status` 里的 provider 语义，和 deep link 的 provider 改写语义必须一致：

1. provider 是本地工作台偏好，不是 sidecar 的单一真相。
2. 默认优先保留当前 `model_provider` 的连续性；是否沿用当前激活值由 `providerScope=current-active` 显式表达。
3. 只有 `providerScope=create-new`，或者当前没有激活值且已降级确认时，才允许新建 `model_provider` / `[model_providers.<id>]`。
4. `openai` 只作为内置连续性保留，不作为 `preserve-chatgpt-provider` 的目标 provider id。
5. 当本地 `config.toml` 已存在当前激活 provider section 时，deep link 只 patch 当前 section，不静默清空其他 provider section。
6. 当当前 provider section 缺失但符合兼容性要求时，确认页可以提示“将补齐当前 provider section”；只有 `providerScope=create-new` 时才提示“将创建新的 provider”。
7. 若当前 provider 不存在、为 builtin `openai`，或与 preserve 模式冲突，则预览阶段必须给出和 status 页一致的阻断/警告文案。
8. 所有受控字段都采用 presence 语义：显式出现才覆盖，未出现就保留；`supports_websockets=false`、`requires_openai_auth=false` 这类布尔 false 也必须写入。

兼容性结果沿用状态页的心智，建议至少分成：

| 结果 | 含义 |
| --- | --- |
| `compatible` | 可以按当前 provider 连续性应用 |
| `blocked_builtin_openai` | 目标 provider 或模式要求与内置 `openai` 冲突 |
| `missing_chatgpt_auth` | preserve 场景下本机 ChatGPT auth 不存在或无效 |
| `missing_provider_section` | 需要写入的 provider section 还不存在 |

### resource=codex-setup

组合导入用于“一条链接导入账号并配置 Codex”。推荐把复杂内容放在 `config` JSON。

```json
{
  "account": {
    "accountType": "codex-api-key",
    "label": "Team Relay",
    "apiKey": "sk-xxx",
    "baseUrl": "https://api.example.com/v1",
    "models": [
      { "name": "gpt-5-codex", "alias": "gpt-5-codex" }
    ]
  },
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "replace",
      "operations": [
        { "op": "set", "path": "/auth_mode", "value": "apikey" },
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-xxx" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "high" },
        { "op": "set", "path": "model_provider", "value": "team-relay" },
        { "op": "set", "path": "model_providers.team-relay.name", "value": "Team Relay" },
        { "op": "set", "path": "model_providers.team-relay.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.team-relay.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.team-relay.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

执行顺序：

1. Parse：只解析和校验，不写入。
2. Preview：展示账号草稿、Codex config diff、敏感字段脱敏。
3. Confirm account：创建账号。
4. Resolve accountRef：把刚创建账号的 ID 注入 Codex config 草稿或后续文档 patch。
5. Confirm/apply Codex config：调用现有 local apply。
6. Refresh：刷新账号列表、Codex channel routing、Codex config snapshot。

如果账号创建成功但 Codex config apply 失败，不回滚账号；确认页展示“账号已导入，Codex 配置未应用”的明确状态。

## 安全策略

1. 日志中 deep link 永远只记录 redacted URL，不记录 `apiKey`、`config`、token、header。
2. UI 中 API key 只展示前 4 位和后 4 位，中间脱敏。
3. `config` 大小限制建议 32 KB；超出要求改用文件导入。
4. URL scheme handler 和“粘贴链接导入”共用 parser，避免两套解析差异。
5. 所有写入前必须展示 diff 或字段级 change summary。
6. `enabled=true` 不代表切换当前 Codex 本地配置；只代表账号创建后是否在 GetTokens/sidecar 中禁用。
7. `apply=true` 只让确认页默认勾选“继续应用 Codex 配置”，不能跳过确认。
8. 不允许 deep link 写入 arbitrary headers；OpenAI-compatible headers 首期只展示“需要用户手动补充”。

## UI 交互

### DeepLinkImportDialog

`DeepLinkImportDialog` 不再新建一套独立确认 UI，而是作为 thin adapter 复用现有“应用模板到 Codex”确认页。deep link 解析和 preview 只负责把外部导入意图转换成现有 `AccountLocalCliApplyConfirm` 能消费的 Codex local apply 草稿，并补充来源、resource、providerScope 等 deep link 元信息。

复用边界：

| resource | UI 入口 | 说明 |
| --- | --- | --- |
| `account` | 账号导入确认 | 只创建账号，不进入“应用模板到 Codex” |
| `codex-config` | 直接打开“应用模板到 Codex” | deep link 转成 Codex local apply 草稿 |
| `codex-setup` | 账号草稿摘要 + “应用模板到 Codex” | 先确认账号草稿，再沿用同一 diff / apply 页面 |

必须复用的现有能力：

1. `ModalFrame` 的窗口外壳、遮罩、header/footer 分区。
2. `AccountLocalCliApplyConfirm` 的标题、summary badge、文件列表、diff 预览和 footer 状态。
3. `StatusSnippetPanel` / `buildCodexLocalApplyDiff` 的文件预览。
4. `/#frame=status` 已有 preflight / provider 兼容判断。

`codex-config` 单独导入时不展示“只导入账号”。

视觉稿入口：[../deep-link-import-modal-design.html](../deep-link-import-modal-design.html)。

### Modal 卡片结构

入口卡片按“应用模板到 Codex”原页面组织，不再采用新的 parse rail + draft panels 双栏结构：

1. Header summary：保留 `FILE PREVIEW CONFIRM` 和“应用模板到 Codex”标题；在现有 summary badge 里增加 `外部来源`、`resource`、`providerScope`、`providerRewriteMode`。
2. 左侧栏：继续展示文件列表；`codex-setup` 额外在文件列表上方插入一个紧凑账号草稿摘要，避免新建完整账号导入页面。
3. 右侧区域：继续展示 provider preflight 结果和文件 diff；`providerScope=current-active` 时必须突出“current user provider preserved”。
4. Footer：保留现有取消 / 确认应用节奏；`codex-setup` 增加“只导入账号”，`codex-config` 不展示该按钮。

### Modal 状态

| 状态 | 视觉处理 | 说明 |
| --- | --- | --- |
| `preview-ready` | 绿色状态条 | 解析成功，等待用户确认 |
| `warning` | 黄色状态条和 warning badge | 需要注意重名、兼容性降级、缺失 provider section |
| `blocked` | 黄色或红色 warning card | 不能继续写入，比如 preserve 场景缺失 ChatGPT auth |
| `preview-only` | footer 说明 + 按钮降级 | 浏览器 preview 或无 Wails runtime 时只读展示 |

### Modal 文案原则

1. 标题沿用“应用模板到 Codex”，避免用户误以为这是另一套写入链路。
2. `providerID` 永远写成身份值，不要写成“默认值”或“当前默认 provider”。
3. `current-active` 场景必须明确写出“保留 model_provider”。
4. `create-new` 场景必须明确写出“仅在没有激活值时创建新 provider”。
5. API key、token、auth 字段只展示脱敏值，diff 里也只展示脱敏值。

### 浏览器 preview

普通浏览器没有 Wails runtime 时可以解析示例链接并展示确认状态，但所有写入按钮进入 preview-only 状态，不调用真实绑定。

## 后端设计

新增 Wails-facing 方法建议：

| 方法 | 作用 |
| --- | --- |
| `ParseDeepLink(url string)` | 解析 `gettokens://` URL，返回结构化 request |
| `PreviewDeepLinkImport(request)` | 合并 config、读取现有账号/Codex 状态、生成确认模型和 diff |
| `ApplyDeepLinkImport(request, options)` | 按确认选项执行账号导入和 Codex local apply |

Wails 绑定要求同步 root `app.go`、`app_types.go`、`app_mappers.go` 和 `frontend/wailsjs`。

内部模块建议：

```text
internal/wailsapp/deeplink.go
internal/wailsapp/deeplink_parser.go
internal/wailsapp/deeplink_preview.go
internal/wailsapp/deeplink_apply.go
```

纯解析函数必须不依赖 App，方便单元测试。

## 数据结构草案

```go
type DeepLinkImportRequest struct {
    Channel     string
    Version     string
    Resource    string
    Source      string
    Nonce       string
    Account     *DeepLinkAccountDraft
    CodexConfig *DeepLinkCodexConfigDraft
}

type DeepLinkAccountDraft struct {
    AccountType    string
    Name           string
    Label          string
    APIKey         string
    APIKeys        []string
    BaseURL        string
    Prefix         string
    ProxyURL       string
    Models         []OpenAICompatibleModel
    FormatBaseURLs map[string]string
    AuthFileName   string
    AuthFileJSON   string
    Enabled        bool
}

type DeepLinkCodexConfigDraft struct {
    Mode               string
    AccountRef         string
    Model              string
    ReasoningEffort    string
    ProviderID         string
    ProviderName       string
    ProviderScope      string
    BaseURL            string
    APIKey             string
    SupportsWebsockets bool
    Apply              bool
}
```

## BDD 验收

### 场景 1：导入 Codex API key 账号

Given deep link 包含 `channel=codex&resource=account&accountType=codex-api-key`
When 用户确认导入账号
Then GetTokens 调用 `CreateCodexAPIKey`
And 新账号出现在账号列表
And 未确认 Codex 配置前不写 `CODEX_HOME/config.toml`

### 场景 2：导入 OpenAI-compatible provider

Given deep link 包含 `channel=codex&resource=account&accountType=openai-compatible`
When provider name 不存在且用户确认
Then GetTokens 调用 `CreateOpenAICompatibleProvider`
And 账号列表出现 `openai-compatible:<name>`

### 场景 3：导入 auth-file

Given deep link 包含 `channel=codex&resource=account&accountType=auth-file&config=<base64url-json>`
When 用户确认
Then GetTokens 归一化 auth file 内容并调用 `UploadAuthFiles`
And 确认页不显示完整 token

### 场景 4：预览 Codex config patch

Given deep link 包含 `channel=codex&resource=codex-config`
When 确认弹窗打开
Then GetTokens 读取当前 `CODEX_HOME/config.toml`
And 展示当前 provider、目标 provider 和 diff
And 不做完整文件覆盖

### 场景 5：provider 兼容性与 status 页一致

Given deep link 需要改写 provider 且 `/#frame=status` 当前显示的 provider 目录可用
When 目标 provider 为 `openai` 或本地 provider section 缺失
Then 预览阶段返回与 status 页一致的兼容性结果
And `openai` 在 preserve 场景下被阻断
And 只在兼容时才允许继续写入 `model_provider` 与 `[model_providers.<id>]`

### 场景 6：组合导入

Given deep link 包含 `channel=codex&resource=codex-setup`
When 用户点击确认
Then 系统先创建账号
And 再把创建出的账号 ID 作为 `accountRef` 生成 Codex local apply 草稿
And Codex config apply 失败时保留已创建账号并展示失败原因

### 场景 7：重复和冲突

Given deep link 要创建的 provider name 已存在
When 用户预览导入
Then 弹窗提示重名
And 默认不覆盖已有账号
And 用户只能选择取消或另存为新名称

### 场景 8：敏感信息保护

Given deep link 带有 `apiKey` 或 auth tokens
When 后端记录日志或前端展示确认页
Then 日志不包含明文密钥
And UI 默认脱敏

### 场景 9：无 Wails preview

Given 浏览器 preview 环境没有 Wails runtime
When 打开 deep link 预览
Then 页面能展示解析结果和确认布局
And 写入按钮不可执行

### 场景 10：字段 presence 覆盖

Given deep link 只提供部分 `auth.json` / `config.toml` 字段
When 用户确认应用 Codex 配置
Then 显式提供的字段覆盖本地配置
And 未提供的字段保留用户现有值
And `false` 被视为显式值，例如 `supports_websockets=false` 与 `requires_openai_auth=false` 都写入 false

## 测试计划

### Go 单元测试

1. `TestParseDeepLinkImportMergesConfigAndQueryWins`
2. `TestParseDeepLinkImportRejectsUnsupportedFieldsAndNonCodexChannel`
3. `TestPreviewDeepLinkImportRedactsURLAndKeepsCurrentActiveProvider`
4. `TestPreviewDeepLinkImportCreatesProviderOnlyWhenNoExplicitActiveProvider`
5. `TestPreviewDeepLinkImportBuildsCodexConfigFromDocuments`
6. `TestPreviewDeepLinkImportPreservesUnspecifiedConfigTomlFields`
7. `TestApplyDeepLinkImportCodexSetupReportsPartialSuccess`
8. `TestApplyRelayServiceConfigToLocalV2WritesExplicitSupportsWebsocketsFalse`
9. `TestApplyRelayServiceConfigToLocalV2PreservesSupportsWebsocketsWhenUnset`

### 前端单测

1. 解析后的确认模型能正确渲染账号类型。
2. API key 和 token 字段脱敏。
3. `codex-setup` 在账号重名时禁用主确认按钮。
4. preview-only 环境不调用 Wails 写入。

### 集成验证

1. macOS 安装包注册 `gettokens://` scheme 后可唤起 app。
2. sidecar ready 时组合导入能创建账号并刷新账号列表。
3. Codex local apply diff 与实际写入一致。

## 测试样例

### 1. Codex API key 账号导入

URL:

```text
gettokens://v1/import?channel=codex&resource=account&accountType=codex-api-key&label=Team%20Relay&apiKey=sk-test-123456&baseUrl=https%3A%2F%2Fapi.example.com%2Fv1&model=gpt-5-codex
```

Patch A（本机已有激活 `model_provider`，不改用户默认值）:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-test-123456" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_providers.<current-provider-id>.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.<current-provider-id>.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.<current-provider-id>.wire_api", "value": "responses" },
        { "op": "set", "path": "model_providers.<current-provider-id>.supports_websockets", "value": false }
      ]
    }
  ]
}
```

Patch B（本机没有激活 `model_provider`，才新建）:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-test-123456" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_provider", "value": "team-relay" },
        { "op": "set", "path": "model_providers.team-relay.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.team-relay.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.team-relay.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

### 2. OpenAI-compatible provider 导入

URL:

```text
gettokens://v1/import?channel=codex&resource=account&accountType=openai-compatible&name=deepseek&apiKey=sk-test-abc&baseUrl=https%3A%2F%2Fapi.deepseek.com%2Fv1
```

Patch A（当前 provider 已存在，保持 `model_provider` 不变）:

```json
{
  "documents": [
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model_providers.<current-provider-id>.name", "value": "deepseek" },
        { "op": "set", "path": "model_providers.<current-provider-id>.base_url", "value": "https://api.deepseek.com/v1" },
        { "op": "set", "path": "model_providers.<current-provider-id>.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.<current-provider-id>.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

Patch B（当前没有激活 provider，才创建新值）:

```json
{
  "documents": [
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model_provider", "value": "deepseek" },
        { "op": "set", "path": "model_providers.deepseek.name", "value": "deepseek" },
        { "op": "set", "path": "model_providers.deepseek.base_url", "value": "https://api.deepseek.com/v1" },
        { "op": "set", "path": "model_providers.deepseek.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.deepseek.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

### 3. auth-file 导入

URL:

```text
gettokens://v1/import?channel=codex&resource=account&accountType=auth-file&name=team-codex-auth.json&config=eyJkb2N1bWVudHMiOlt7InRhcmdldCI6ImF1dGguanNvbiIsImZvcm1hdCI6Impzb24iLCJtb2RlIjoibWVyZ2UiLCJvcGVyYXRpb25zIjpbeyJvcCI6InNldCIsInBhdGgiOiIvYXV0aF9tb2RlIiwidmFsdWUiOiJjaGF0Z3B0In0seyJvcCI6InNldCIsInBhdGgiOiIvdXNlci9lbWFpbCIsInZhbHVlIjoidGVhbUBleGFtcGxlLmNvbSJ9XX1dfQ
```

Patch:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/auth_mode", "value": "chatgpt" },
        { "op": "set", "path": "/user/email", "value": "team@example.com" }
      ]
    }
  ]
}
```

### 4. Codex config 仅改写当前 provider

URL:

```text
gettokens://v1/import?channel=codex&resource=codex-config&mode=api-key&model=gpt-5-codex&reasoningEffort=high&baseUrl=https%3A%2F%2Fapi.example.com%2Fv1&apiKey=sk-test-123456&providerID=team-relay&providerName=Team%20Relay&providerScope=current-active
```

Patch A（当前 provider 已存在，保持 `model_provider` 不变）:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-test-123456" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "high" },
        { "op": "set", "path": "model_providers.<current-provider-id>.name", "value": "Team Relay" },
        { "op": "set", "path": "model_providers.<current-provider-id>.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.<current-provider-id>.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.<current-provider-id>.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

Patch B（当前没有激活 provider，才创建新值）:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-test-123456" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "high" },
        { "op": "set", "path": "model_provider", "value": "team-relay" },
        { "op": "set", "path": "model_providers.team-relay.name", "value": "Team Relay" },
        { "op": "set", "path": "model_providers.team-relay.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.team-relay.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.team-relay.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

### 5. preserve ChatGPT 登录态

URL:

```text
gettokens://v1/import?channel=codex&resource=codex-config&mode=preserve-chatgpt-provider&model=gpt-5-codex&reasoningEffort=medium&baseUrl=https%3A%2F%2Fapi.example.com%2Fv1&providerID=relay-chatgpt-preserve&providerName=Relay%20Preserve&providerScope=current-active
```

Patch A（当前 provider 已存在，保持 `model_provider` 不变）:

```json
{
  "documents": [
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "medium" },
        { "op": "set", "path": "model_providers.<current-provider-id>.name", "value": "Relay Preserve" },
        { "op": "set", "path": "model_providers.<current-provider-id>.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.<current-provider-id>.experimental_bearer_token", "value": "<preserved-token>" },
        { "op": "set", "path": "model_providers.<current-provider-id>.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.<current-provider-id>.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

Patch B（当前没有激活 provider，才创建新值）:

```json
{
  "documents": [
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "medium" },
        { "op": "set", "path": "model_provider", "value": "relay-chatgpt-preserve" },
        { "op": "set", "path": "model_providers.relay-chatgpt-preserve.name", "value": "Relay Preserve" },
        { "op": "set", "path": "model_providers.relay-chatgpt-preserve.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.relay-chatgpt-preserve.experimental_bearer_token", "value": "<preserved-token>" },
        { "op": "set", "path": "model_providers.relay-chatgpt-preserve.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.relay-chatgpt-preserve.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

### 6. 组合导入

URL:

```text
gettokens://v1/import?channel=codex&resource=codex-setup&config=eyJhY2NvdW50Ijp7ImFjY291bnRUeXBlIjoiY29kZXgtYXBpLWtleSIsImxhYmVsIjoiVGVhbSBSZWxheSIsImFwaUtleSI6InNrLXRlc3QtMTIzNDU2IiwiYmFzZVVybCI6Imh0dHBzOi8vYXBpLmV4YW1wbGUuY29tL3YxIiwibW9kZWxzIjpbeyJuYW1lIjoiZ3B0LTUuNCIsImFsaWFzIjoiZ3B0LTUuNCJ9XX0sImNvZGV4Q29uZmlnIjp7Im1vZGUiOiJhcGkta2V5IiwibW9kZWwiOiJncHQtNS1jb2RleCIsInJlYXNvbmluZ0VmZm9ydCI6ImhpZ2giLCJwcm92aWRlcklEIjoidGVhbS1yZWxheSIsInByb3ZpZGVyTmFtZSI6IlRlYW0gUmVsYXkiLCJwcm92aWRlclNjb3BlIjoiY3VycmVudC1hY3RpdmUiLCJiYXNlVXJsIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vdjEiLCJhcGlLZXkiOiJzay10ZXN0LTEyMzQ1NiIsInN1cHBvcnRzV2Vic29ja2V0cyI6dHJ1ZX19
```

Patch A（当前 provider 已存在，保持 `model_provider` 不变）:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-test-123456" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "high" },
        { "op": "set", "path": "model_providers.<current-provider-id>.name", "value": "Team Relay" },
        { "op": "set", "path": "model_providers.<current-provider-id>.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.<current-provider-id>.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.<current-provider-id>.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

Patch B（当前没有激活 provider，才创建新值）:

```json
{
  "documents": [
    {
      "target": "auth.json",
      "format": "json",
      "mode": "merge",
      "operations": [
        { "op": "set", "path": "/OPENAI_API_KEY", "value": "sk-test-123456" }
      ]
    },
    {
      "target": "config.toml",
      "format": "toml",
      "mode": "patch",
      "operations": [
        { "op": "set", "path": "model", "value": "gpt-5-codex" },
        { "op": "set", "path": "model_reasoning_effort", "value": "high" },
        { "op": "set", "path": "model_provider", "value": "team-relay" },
        { "op": "set", "path": "model_providers.team-relay.name", "value": "Team Relay" },
        { "op": "set", "path": "model_providers.team-relay.base_url", "value": "https://api.example.com/v1" },
        { "op": "set", "path": "model_providers.team-relay.requires_openai_auth", "value": true },
        { "op": "set", "path": "model_providers.team-relay.wire_api", "value": "responses" }
      ]
    }
  ]
}
```

## 实施顺序

1. 先做 parser 和 Go 单元测试。
2. 增加 preview DTO，只返回脱敏确认模型，不写入。
3. 接前端确认弹窗和 preview-only 状态。
4. 接账号导入 apply。
5. 接 Codex config local apply。
6. 最后注册 macOS URL scheme 并做桌面验收。

## 待确认决策

1. URL scheme 使用 `gettokens://`，还是兼容旧名/产品名别名。推荐只注册 `gettokens://`。
2. auth-file 是否进入首期。推荐首期只做 `codex-api-key` 和 `openai-compatible`，auth-file 保留 parser 设计但不开放外链入口。
3. OpenAI-compatible 创建时是否同步支持 models/headers。推荐首期支持 models，不支持 headers。
