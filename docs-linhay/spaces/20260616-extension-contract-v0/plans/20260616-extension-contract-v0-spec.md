# Extension Contract v0 Spec

日期：2026-06-16

## 1. 任务边界

本文件定义 GetTokens Extension Contract v0。它服务于后续 `sidecar registry + Wails/frontend 管理界面` 的声明式扩展能力，不服务于 Codex Skills / MCP Servers 的现有本地扩展工作台。

本期只设计契约，不实现代码，不修改现有 Codex Skills / MCP 行为。

### 1.1 问题来源

- `docs-linhay/dev/20260615-omniroute-capability-architecture.md` 将 `extension contract` 定义为中期能力线。
- `docs-linhay/spaces/20260616-extension-contract-v0/README.md` 要求形成 v0 manifest/schema、capability kind 白名单、enable/disable、compatibility、conflict detection。
- `docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260616-subagent-supervision-dispatch-v01.md` 将本任务限定为契约设计，并禁止引入任意执行型插件系统或修改 Codex Skills / MCP 现有行为。

### 1.2 事实校准

现有 Codex 扩展工作台的语义来自 `docs-linhay/dev/codex-skills-mcp-architecture-2026-05-12.md` 与 `.agents/skills/gettokens-codex-extensions-management/SKILL.md`：

- Skills 是 Codex `SKILL.md` 扫描、预览、启停、Git source 安装链路。
- Skill 启停使用 Codex 支持的 `[[skills.config]] enabled = false`；启用时移除禁用 override，不写 `enabled = true`。
- Git skill source 只支持 `tk://github.com/...` / `tk://gitlab.com/...` schema，并维护安装来源与 lock。
- MCP 只把 `[mcp_servers.<id>]` 一级 table 作为 server；`tools` / `oauth` 是父 server 的嵌套配置。
- MCP 保存必须局部 patch，保留未知字段、注释、排序和非目标 section；不写 `bearer_token`，只允许 `bearer_token_env_var`。

因此 Extension Contract v0 不复用 Codex `[[skills.config]]`、MCP `[mcp_servers]`、Codex skill Git manifest，也不向 `~/.codex/config.toml` 写入任何扩展状态。

### 1.3 验收场景

1. Manifest 能声明一个或多个受控 capability，且每个 capability 都能被 schema 校验。
2. Registry 能判断 extension 是否兼容当前 GetTokens / sidecar contract 版本。
3. Enable / disable 只影响 registry active view，不触发任意代码执行。
4. Conflict detection 能在启用前发现 provider/model/account/quota probe 等命名或 authority 冲突。
5. 文档明确禁止 JS hook、marketplace、远程安装、热路径执行和第二运行时。
6. 与 Codex Skills / MCP 管理边界清晰，不覆盖或改写既有语义。

## 2. 设计原则

1. 声明式优先：extension 只能声明 metadata、catalog、importer schema 或 probe endpoint，不携带可执行 hot-path hook。
2. Sidecar authority：运行时真相由 sidecar 输出，frontend/Wails 只能管理、展示、解释和提交受控配置。
3. 最小权限：manifest 中声明权限，registry 在 install/enable 时校验，运行时只暴露对应 capability 所需的窄接口。
4. 冲突先于启用：任何会改变 provider/model/account/quota 可见事实的 extension，启用前必须跑 conflict detection。
5. 可回滚：disable 不删除来源文件，不破坏用户数据，只从 active registry view 移除贡献。
6. 不接管 Codex：GetTokens extension registry 与 Codex Skills / MCP workbench 是两条产品线。

## 3. 名词

| 名词 | 含义 |
| --- | --- |
| Extension | 一个本地声明式扩展包，入口为 `gettokens.extension.json`。 |
| Manifest | Extension 的静态契约文件。 |
| Capability | Extension 声明的一项受控能力，例如 provider metadata 或 quota probe。 |
| Registry | Sidecar 读取、校验、索引 extension 后形成的本地注册表。 |
| Active view | 过滤 disabled / incompatible / conflicted extension 后，sidecar 可使用的只读能力视图。 |
| Contribution | 单个 capability 对 provider/model/importer/probe namespace 的声明贡献。 |

## 4. Manifest v0

### 4.1 文件名与位置

建议入口文件名：

```text
gettokens.extension.json
```

v0 仅支持本地已存在目录的导入或手动放置，不支持 marketplace、远程安装、自动更新。后续实现可选择一个 app-owned registry 目录，例如：

```text
~/Library/Application Support/GetTokens/extensions/<extension-id>/
```

但本 spec 不绑定最终路径。

### 4.2 顶层 schema

```json
{
  "contractVersion": "0.1.0",
  "id": "com.example.openai-metadata",
  "name": "Example OpenAI Metadata",
  "version": "0.1.0",
  "publisher": {
    "name": "Example Labs",
    "url": "https://example.com"
  },
  "description": "Adds provider metadata and model catalog hints.",
  "homepage": "https://example.com/gettokens-extension",
  "source": {
    "type": "local",
    "uri": "file:///Users/me/extensions/openai-metadata",
    "revision": "local"
  },
  "compatibility": {
    "gettokens": ">=0.0.0",
    "sidecarContract": "^0.1.0",
    "capabilityContract": "^0.1.0"
  },
  "permissions": [
    "provider.metadata.read",
    "model.catalog.read"
  ],
  "capabilities": [],
  "metadata": {
    "labels": ["local", "declarative"],
    "supportContact": "support@example.com"
  }
}
```

### 4.3 顶层字段规则

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| `contractVersion` | 是 | v0 固定为 semver 字符串，首期建议 `0.1.0`。 |
| `id` | 是 | 反域名或 DNS-safe id，必须全局唯一；只允许 `[a-z0-9][a-z0-9._-]{2,127}`。 |
| `name` | 是 | UI 展示名，1-80 字符。 |
| `version` | 是 | semver。 |
| `publisher.name` | 是 | 发布方展示名。 |
| `description` | 否 | 1-300 字符。 |
| `homepage` | 否 | 只展示，不自动访问。 |
| `source` | 是 | v0 只允许 `type = local` 或 `type = bundled`。 |
| `compatibility` | 是 | 见第 8 节。 |
| `permissions` | 是 | 顶层权限上限；capability 不得请求未包含的权限。 |
| `capabilities` | 是 | capability 数组，不能为空。 |
| `metadata` | 否 | 非运行时字段，只供 UI 展示与诊断。 |

### 4.4 JSON Schema 草案

后续实现可将以下草案落为 `extension.schema.json`。这里保留核心约束，不穷尽每个 capability 的内部结构。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://gettokens.local/schemas/extension-contract-v0.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "contractVersion",
    "id",
    "name",
    "version",
    "publisher",
    "source",
    "compatibility",
    "permissions",
    "capabilities"
  ],
  "properties": {
    "contractVersion": { "type": "string", "pattern": "^0\\.1\\.\\d+$" },
    "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9._-]{2,127}$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$" },
    "publisher": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name"],
      "properties": {
        "name": { "type": "string", "minLength": 1, "maxLength": 80 },
        "url": { "type": "string", "format": "uri" }
      }
    },
    "description": { "type": "string", "maxLength": 300 },
    "homepage": { "type": "string", "format": "uri" },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "uri"],
      "properties": {
        "type": { "enum": ["local", "bundled"] },
        "uri": { "type": "string" },
        "revision": { "type": "string", "maxLength": 120 }
      }
    },
    "compatibility": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sidecarContract", "capabilityContract"],
      "properties": {
        "gettokens": { "type": "string" },
        "sidecarContract": { "type": "string" },
        "capabilityContract": { "type": "string" }
      }
    },
    "permissions": {
      "type": "array",
      "uniqueItems": true,
      "items": { "$ref": "#/$defs/permission" }
    },
    "capabilities": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/capability" }
    },
    "metadata": {
      "type": "object",
      "additionalProperties": {
        "type": ["string", "number", "boolean", "array", "object", "null"]
      }
    }
  },
  "$defs": {
    "permission": {
      "enum": [
        "provider.metadata.read",
        "model.catalog.read",
        "account.import.preview",
        "account.import.apply",
        "quota.probe.read",
        "network.fetch.declared-endpoints",
        "secret.ref.read"
      ]
    },
    "capability": {
      "type": "object",
      "required": ["id", "kind"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9._-]{2,127}$" },
        "kind": {
          "enum": [
            "provider-metadata",
            "model-catalog-source",
            "account-importer",
            "quota-probe"
          ]
        }
      },
      "allOf": [
        { "if": { "properties": { "kind": { "const": "provider-metadata" } } }, "then": { "$ref": "#/$defs/providerMetadata" } },
        { "if": { "properties": { "kind": { "const": "model-catalog-source" } } }, "then": { "$ref": "#/$defs/modelCatalogSource" } },
        { "if": { "properties": { "kind": { "const": "account-importer" } } }, "then": { "$ref": "#/$defs/accountImporter" } },
        { "if": { "properties": { "kind": { "const": "quota-probe" } } }, "then": { "$ref": "#/$defs/quotaProbe" } }
      ]
    },
    "providerMetadata": { "type": "object" },
    "modelCatalogSource": { "type": "object" },
    "accountImporter": { "type": "object" },
    "quotaProbe": { "type": "object" }
  }
}
```

## 5. Capability kinds

v0 白名单只包含四类：

1. `provider-metadata`
2. `model-catalog-source`
3. `account-importer`
4. `quota-probe`

任何未列入的 `kind` 必须拒绝载入，不能降级成 unknown capability 继续启用。

### 5.1 `provider-metadata`

用途：声明 provider 的静态元数据、展示信息、协议能力和非敏感 endpoint 形态。

示例：

```json
{
  "id": "openai-provider-metadata",
  "kind": "provider-metadata",
  "provider": {
    "id": "openai",
    "displayName": "OpenAI",
    "family": "openai-compatible",
    "homepage": "https://platform.openai.com"
  },
  "endpoints": [
    {
      "id": "default-api",
      "baseUrl": "https://api.openai.com/v1",
      "protocol": "openai-compatible",
      "auth": "bearer-token"
    }
  ],
  "ui": {
    "accent": "#111827",
    "docsUrl": "https://platform.openai.com/docs"
  }
}
```

输入：

- Manifest 中的 provider metadata。
- Registry 现有 provider id。

输出：

- Provider display metadata。
- Provider endpoint declaration。
- UI hint。

权限：

- 必需：`provider.metadata.read`
- 如声明 endpoint 可由 probe 使用：`network.fetch.declared-endpoints`

冲突规则：

- `provider.id` 与内置 provider 冲突时默认拒绝覆盖。
- 允许新增 provider id。
- 允许补充内置 provider 的非 authority UI metadata，但必须标记为 `contributionMode = "augment"`；不得覆盖 auth、routeability、quota authority。
- 同一个 extension 内不能重复声明相同 `provider.id`。

### 5.2 `model-catalog-source`

用途：声明 provider/model 列表来源。v0 只支持静态文件或声明 endpoint，不支持运行任意脚本生成模型。

示例：

```json
{
  "id": "openai-model-catalog",
  "kind": "model-catalog-source",
  "providerId": "openai",
  "source": {
    "type": "static-json",
    "path": "models/openai-models.json"
  },
  "models": [
    {
      "id": "gpt-4.1",
      "displayName": "GPT-4.1",
      "inputModalities": ["text", "image"],
      "outputModalities": ["text"],
      "contextWindow": 1047576,
      "status": "available"
    }
  ]
}
```

输入：

- Static inline `models`。
- 或 extension 包内相对路径 `source.path` 指向的 JSON。
- 或声明式 `source.endpoint`，由 sidecar 以固定 fetcher 拉取。

输出：

- Model catalog entries。
- Model feature hints。
- Last refresh diagnostics。

权限：

- 必需：`model.catalog.read`
- 若使用 endpoint：`network.fetch.declared-endpoints`

冲突规则：

- 同一 `providerId + model.id` 与内置 catalog 冲突时默认进入 `conflicted`，不自动覆盖。
- 可允许 `augment` 模式补充 UI hints，例如 displayName、docsUrl、modalities，但不得覆盖 routeability、account eligibility、quota truth。
- 同一 priority 下多个 extension 声明同一 model 必须拒绝；不同 priority 也必须进入 review，不自动胜出。

### 5.3 `account-importer`

用途：声明账号导入格式、字段映射和校验规则。v0 不提供任意解析脚本，只支持受控格式。

示例：

```json
{
  "id": "openai-env-importer",
  "kind": "account-importer",
  "providerId": "openai",
  "formats": [
    {
      "id": "env",
      "mediaType": "text/plain",
      "parser": "env-key-value",
      "fields": [
        {
          "source": "OPENAI_API_KEY",
          "target": "credential.apiKey",
          "required": true,
          "secret": true
        },
        {
          "source": "OPENAI_BASE_URL",
          "target": "endpoint.baseUrl",
          "required": false
        }
      ]
    }
  ],
  "preview": {
    "redactSecrets": true,
    "requiresUserConfirm": true
  }
}
```

输入：

- 用户选择的本地文件或粘贴文本。
- Manifest 中声明的 parser type、字段映射、校验规则。

输出：

- Import preview。
- Redacted account draft。
- User-confirmed import request。

权限：

- 必需：`account.import.preview`
- 应用导入时必需：`account.import.apply`
- 如果字段引用系统 secret ref：`secret.ref.read`

冲突规则：

- Importer 不直接创建账号，必须先生成 preview。
- 应用导入时按 provider/account unique key 做重复检测。
- 对既有账号默认不覆盖；只能创建新账号或让用户显式选择 merge target。
- Importer 不得写入 Codex `config.toml`、Claude config 或其他外部配置。

### 5.4 `quota-probe`

用途：声明如何以受控方式探测 provider/account quota 或 requestability。v0 只允许 sidecar 内置 probe runner 执行固定 HTTP 方法，不允许运行 extension 提供的代码。

示例：

```json
{
  "id": "openai-quota-probe",
  "kind": "quota-probe",
  "providerId": "openai",
  "target": {
    "scope": "account",
    "credentialRef": "account.defaultCredential"
  },
  "request": {
    "method": "GET",
    "urlTemplate": "https://api.openai.com/v1/usage",
    "headers": [
      {
        "name": "Authorization",
        "valueFrom": "credential.bearer"
      }
    ],
    "timeoutMs": 5000
  },
  "response": {
    "parser": "json-pointer",
    "fields": {
      "remaining": "/limits/requests/remaining",
      "resetAt": "/limits/requests/reset_at"
    }
  },
  "schedule": {
    "mode": "manual-or-background",
    "minIntervalSec": 300
  }
}
```

输入：

- Provider/account runtime context。
- Declared request template。
- Sidecar-managed credentials。

输出：

- Quota fact candidate。
- Diagnostics evidence。
- Confidence / stale state。

权限：

- 必需：`quota.probe.read`
- 必需：`network.fetch.declared-endpoints`
- 如读取 credential ref：`secret.ref.read`

冲突规则：

- Probe 不能直接修改 quota truth，只能产出 fact candidate，由 sidecar quota intelligence 合并。
- 同一 `providerId + scope + quotaDimension` 多个 probe 可共存，但必须标注 source、confidence、freshness。
- 如果 probe 声称 authority 高于内置 provider source，默认拒绝；需要后续实现显式 allowlist。
- Probe endpoint 必须与 manifest 声明一致，不允许 runtime 改写到任意 URL。

## 6. Permissions

### 6.1 权限枚举

| Permission | 说明 |
| --- | --- |
| `provider.metadata.read` | 允许 registry 读取 provider metadata capability。 |
| `model.catalog.read` | 允许 registry 读取 model catalog capability。 |
| `account.import.preview` | 允许生成账号导入预览。 |
| `account.import.apply` | 允许在用户确认后提交账号导入。 |
| `quota.probe.read` | 允许注册 quota probe。 |
| `network.fetch.declared-endpoints` | 允许 sidecar 访问 manifest 声明 endpoint。 |
| `secret.ref.read` | 允许 sidecar runner 使用受控 credential ref，不把 secret 暴露给 extension 文件或 UI。 |

### 6.2 权限规则

1. 顶层 `permissions` 是 extension 上限。
2. 每个 capability 根据 `kind` 推导 required permissions；未声明 required permission 时该 capability 不可启用。
3. 权限只授权 GetTokens 内置 runner 读取声明，不授权 extension 执行代码。
4. Secret 只能通过 `valueFrom` / `credentialRef` 间接引用，不能出现在 manifest 明文、日志或 registry snapshot 中。
5. UI 必须在 enable 前展示权限摘要和冲突摘要。

### 6.3 禁止权限

v0 不提供以下权限：

- `runtime.request.hook`
- `runtime.response.hook`
- `route.selector.execute`
- `filesystem.write`
- `shell.execute`
- `node.execute`
- `python.execute`
- `config.codex.write`
- `config.claude.write`
- `marketplace.install`

这些权限即使出现在 manifest 中也必须导致 validation failed。

## 7. Registry lifecycle

### 7.1 状态机

```text
discovered
  -> invalid
  -> compatible
  -> incompatible
  -> conflicted
  -> disabled
  -> enabled
```

推荐状态含义：

| 状态 | 含义 |
| --- | --- |
| `discovered` | 找到 manifest，尚未完成校验。 |
| `invalid` | manifest schema、路径或权限无效。 |
| `compatible` | schema 与版本兼容，尚未启用。 |
| `incompatible` | contract 或 GetTokens/sidecar 版本不兼容。 |
| `conflicted` | 与内置或已启用 extension 冲突。 |
| `disabled` | 用户关闭，保留来源与诊断。 |
| `enabled` | 进入 active registry view。 |

### 7.2 Registry snapshot

后续实现可暴露以下 DTO 给 Wails/frontend：

```json
{
  "contractVersion": "0.1.0",
  "generatedAt": "2026-06-16T08:00:00Z",
  "extensions": [
    {
      "id": "com.example.openai-metadata",
      "name": "Example OpenAI Metadata",
      "version": "0.1.0",
      "source": { "type": "local", "uri": "file:///..." },
      "state": "enabled",
      "enabled": true,
      "capabilities": [
        {
          "id": "openai-model-catalog",
          "kind": "model-catalog-source",
          "state": "enabled",
          "contributions": ["provider:openai/model:gpt-4.1"]
        }
      ],
      "permissions": ["model.catalog.read"],
      "diagnostics": []
    }
  ]
}
```

Snapshot 不得包含 secret、bearer token、account raw credential、Codex config 内容。

## 8. Compatibility

### 8.1 Version dimensions

Extension v0 至少校验三个维度：

1. `contractVersion`：manifest 文件格式版本。
2. `compatibility.sidecarContract`：sidecar registry/runner 契约版本。
3. `compatibility.capabilityContract`：capability kind 的输入输出契约版本。

`compatibility.gettokens` 可选，用于产品版本提示；首期不得只凭 GetTokens app version 判定运行安全。

### 8.2 Semver 规则

1. `contractVersion = 0.1.x` 表示同一 v0 minor 契约。
2. Sidecar 只接受自己声明支持范围内的 `sidecarContract`。
3. `capabilityContract` minor 不兼容时，该 capability 进入 `incompatible`，不影响同 extension 中其他 capability 的诊断展示。
4. 同一个 extension 如果所有 capability 都 incompatible，则 extension 不可启用。

### 8.3 Unknown fields

Manifest 顶层默认 `additionalProperties = false`。原因是 v0 是安全边界契约，不应静默接受未知能力。

Capability 内部也应默认拒绝未知字段。需要扩展时升级 capability contract，而不是让实现猜测字段含义。

## 9. Conflict detection

### 9.1 Conflict keys

Registry 应为每个 contribution 生成稳定 conflict key：

| Capability | Conflict key |
| --- | --- |
| `provider-metadata` | `provider:<providerId>` |
| `model-catalog-source` | `provider:<providerId>/model:<modelId>` |
| `account-importer` | `provider:<providerId>/importer-format:<formatId>` |
| `quota-probe` | `provider:<providerId>/quota-probe:<scope>:<dimension>` |

### 9.2 Conflict classes

| Class | 处理 |
| --- | --- |
| `duplicate-extension-id` | 拒绝后发现者。 |
| `builtin-authority-overwrite` | 拒绝；v0 不允许覆盖内置 authority。 |
| `enabled-extension-conflict` | 新 extension 进入 `conflicted`，不自动启用。 |
| `same-extension-duplicate` | manifest invalid。 |
| `permission-missing` | capability invalid。 |
| `unsafe-endpoint` | capability invalid 或需要用户显式审查。 |
| `secret-inline` | manifest invalid。 |

### 9.3 Resolution

v0 不提供自动 merge 或 priority override。

允许的处理只有：

1. Disable 冲突 extension。
2. 删除或替换本地 extension 包。
3. 后续实现新增人工 allowlist，但 allowlist 也只能开启声明式贡献，不能开启执行型代码。

## 10. Enable / disable

### 10.1 存储语义

Enable / disable 状态属于 GetTokens extension registry，不属于 manifest 本身。原因：

- Manifest 应保持可复现、可校验。
- 用户开关是本机状态。
- 修改 manifest 会破坏来源校验和后续更新路径。

建议 registry state 形态：

```json
{
  "schemaVersion": 1,
  "extensions": {
    "com.example.openai-metadata": {
      "enabled": true,
      "enabledCapabilities": {
        "openai-model-catalog": true
      },
      "updatedAt": "2026-06-16T08:00:00Z"
    }
  }
}
```

### 10.2 Enable 流程

1. 读取 manifest。
2. Schema validation。
3. Compatibility check。
4. Permission derivation。
5. Conflict detection。
6. UI 展示权限与冲突摘要。
7. 用户确认。
8. 写 registry state。
9. 重新生成 active view。

Enable 不得：

- 执行 extension 包内脚本。
- 改写 Codex / Claude / shell 配置。
- 自动下载远程内容。
- 自动创建账号。

### 10.3 Disable 流程

1. 写 registry state `enabled = false` 或 capability-level disabled。
2. 从 active view 移除贡献。
3. 保留 manifest、source、diagnostics。
4. 不删除 extension 目录。
5. 不删除由用户确认导入的账号；如需要清理，应作为后续独立 UX 设计。

## 11. Security boundary

### 11.1 明确不开放

v0 不开放：

- JS hook：无 `onRequest`、`onResponse`、`onRoute`、`onProviderSelect`。
- Marketplace：无远程发现、评分、安装、更新、自动同步。
- Hot-path execution：不允许 extension 代码进入 route selection、account selection、fallback、quota truth 合并热路径。
- Shell/Node/Python execution：不运行扩展包内可执行文件。
- Config writer：不允许 extension 写 `~/.codex/config.toml`、Claude config、shell profile、system proxy。
- Provider market：不以 provider 数量作为产品主方向。

### 11.2 Endpoint 安全

若 capability 声明 endpoint：

1. URL 必须在 manifest 中静态声明。
2. 只允许 `https`，本地开发 allowlist 另议。
3. 不允许从 response 中二次读取跳转 URL 继续请求。
4. 请求方法白名单：`GET`、必要时 `POST`；首期优先只支持 `GET`。
5. Header 只能来自固定模板和受控 credential ref。
6. Response parser 必须是内置 parser，例如 `json-pointer`。

### 11.3 Secret 安全

1. Manifest 中不得出现 token、api key、cookie、bearer credential。
2. Registry snapshot、diagnostics、frontend DTO 必须 redacted。
3. `secret.ref.read` 只授权 sidecar runner 使用 secret，不把 secret 返回给 extension、Wails 或 frontend。

## 12. 与 Codex Skills / MCP 工作台的关系

### 12.1 不复用的语义

Extension Contract v0 不使用：

- Codex `SKILL.md`。
- Codex `[[skills.config]]`。
- Codex Git skill `tk://github.com` / `tk://gitlab.com` 安装链路。
- Codex MCP `[mcp_servers.<id>]` 配置。
- MCP nested `tools` / `oauth` 解析规则。

这些能力继续归属 Codex Extensions Workbench。

### 12.2 可复用的工程原则

可以复用原则，但不能复用存储语义：

- 局部 patch：如果后续 registry state 落为文件，保存单个 extension 状态时只 patch 目标项。
- 不写 secret：manifest、registry、diagnostics 都不能保存明文 token。
- 结构化视图与 raw view 同步：若后续提供 raw manifest viewer，保存/导入后必须重新读取 registry snapshot。
- 预览安全：manifest 与 README 预览需要 sanitize，不执行 HTML/JS。
- 三条链路独立：Codex Skills、Codex MCP、GetTokens Extension Registry 不合并成一个通用保存接口。

### 12.3 UI 边界

建议后续产品上将本能力命名为 `GetTokens Extensions` 或 `Capability Registry`，不要放进 Codex `Skills / MCP Servers` tab 内。可以在同一工作台框架中复用组件，但导航、状态、保存 API 必须独立。

## 13. 后续实现切片

### 13.1 Phase 1：只读 registry

目标：

- 扫描本地 extension manifest。
- 校验 schema。
- 输出 registry snapshot。
- 前端只读展示状态、capabilities、permissions、diagnostics。

验收：

- invalid manifest 可解释。
- Codex Skills/MCP 页面不受影响。

### 13.2 Phase 2：enable / disable

目标：

- Registry state 文件。
- Extension-level toggle。
- Capability-level diagnostics。

验收：

- Enable 前有 compatibility、permission、conflict 结果。
- Disable 后 active view 移除贡献。

### 13.3 Phase 3：首个 safe capability

建议先做 `provider-metadata` 或 `model-catalog-source` 的静态 JSON 路径，不先做 `quota-probe`。

原因：

- 无 credential。
- 无网络请求。
- 不触碰 hot-path。
- 更适合作为 contract runner 和 UI 的低风险验证。

### 13.4 Phase 4：受控 probe

只有当 registry、diagnostics、secret redaction、endpoint allowlist 都稳定后，才加入 `quota-probe` runner。

## 14. 测试建议

后续实现至少覆盖：

1. Manifest schema valid / invalid。
2. Unknown top-level field rejected。
3. Unknown capability kind rejected。
4. Missing permission rejects capability。
5. Inline secret rejected。
6. Duplicate extension id rejected。
7. Builtin provider authority overwrite rejected。
8. Disabled extension absent from active view。
9. Incompatible sidecar contract not enabled。
10. Codex `~/.codex/config.toml` 未被读取或写入。

## 15. Open questions

1. Extension 包的最终本地目录是否归 sidecar 数据目录，还是 Wails app data 目录。
2. 是否需要支持 bundled extension；如果支持，bundled 来源应由构建产物签名或 hash 校验。
3. `model-catalog-source` endpoint 是否应在 v0.1 禁止，只允许 static JSON。
4. `quota-probe` 的 response parser 是否只保留 `json-pointer`，还是允许内置 named parser。
5. 是否需要为人工 allowlist 设计单独审计日志。

## 16. 本期结论

Extension Contract v0 是 GetTokens 自有 capability registry 契约，不是 Codex Skills / MCP 的第三个 tab，也不是 OmniRoute 风格 JS 插件系统。

v0 的核心安全线是：

1. Manifest 声明式。
2. Capability kind 白名单。
3. Permission 最小化。
4. Compatibility 与 conflict 先于 enable。
5. Disable 只改变 registry active view。
6. 不开放 JS hook、marketplace、hot-path execution、任意配置写入。
