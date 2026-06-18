# Extension Contract v0 Artifacts Plan

日期：2026-06-16

## 1. 本切片产物

本切片只固化 Extension Contract v0 的后续实现输入，不进入代码实现：

- Schema：`schemas/gettokens-extension-v0.schema.json`
- Enable-state schema：`schemas/gettokens-extension-enable-state-v0.schema.json`
- Valid example：`examples/provider-metadata-model-catalog.valid.json`
- Invalid example：`examples/js-hook-unknown-capability.invalid.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-forbidden-permission.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-missing-required.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-unknown-top-level-field.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-source-type.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-capability-source-missing-required.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-declared-endpoint-missing-endpoint.json`
- Invalid example：`examples/provider-metadata-model-catalog.invalid-static-json-missing-path.json`
- Enable-state example：`examples/enable-state-v0.valid.json`
- Enable-state invalid fixtures：
  - `examples/enable-state-v0.invalid-enum.json`
  - `examples/enable-state-v0.invalid-action-availability.json`
  - `examples/enable-state-v0.invalid-missing-required.json`
- Matrix 与阶段计划：本文档

这些 artifact 只服务 GetTokens 自有 extension registry，不复用 Codex Skills、MCP Servers、`~/.codex/config.toml` 或 Codex Git skill source。

新增约束：

1. `enable-state` artifact 只表达前端/管理层只读解释语义，不回写 manifest，也不代表真实 mutation DTO。
2. `enabled / disabled / blocked / pending / readonly-unsupported` 与 `action availability = read-only | disabled` 必须由独立 artifact 固化，避免 README、plan、前端测试各自漂移。
3. manifest artifact gate 必须同时证明：
   - `provider-metadata-model-catalog.valid.json` 能通过本地 schema-level validation；
   - invalid fixtures 会因 unknown capability、forbidden permission、required 字段缺失而失败；
   - 顶层 unknown field、manifest `source.type` 非法值、capability 缺失必填 `source` 字段也会失败。
   - `model-catalog-source.source.type = declared-endpoint` 缺 `endpoint`、`static-json` 缺 `path` 也会失败。
4. enable-state artifact gate 必须同时证明：
   - valid example 能通过本地 schema-level validation；
   - invalid fixtures 会因状态枚举、actionAvailability 枚举、必填字段缺失而失败。
5. Round 17 条件 source gate 只做 manifest schema/example/validator，不进入 runtime runner、enable/disable、marketplace 或 Codex config 保存链路。

## 2. Compatibility Matrix

| 检查项 | 输入 | 兼容结果 | 不兼容结果 | 实现提示 |
| --- | --- | --- | --- | --- |
| Manifest contract | `contractVersion` | `0.1.x` 可进入下一步 | extension `invalid` | 不按 GetTokens app version 替代 manifest contract。 |
| Sidecar registry contract | `compatibility.sidecarContract` | 在 sidecar 支持范围内 | extension `incompatible` | 由 sidecar 暴露当前支持范围。 |
| Capability contract | `compatibility.capabilityContract` + capability kind | capability 可诊断或启用 | capability `incompatible` | 单个 capability 不兼容不应隐藏整个 extension 诊断。 |
| Product version hint | `compatibility.gettokens` | 展示可用 | 只作为提示 | 首期不得仅凭 app version 判定运行安全。 |
| Unknown top-level field | manifest object | 无未知字段 | `invalid` | 顶层 `additionalProperties = false`。 |
| Unknown capability field | capability object | 无未知字段 | `invalid` | capability 内部默认拒绝未知字段。 |

## 3. Enable / Disable Registry State

Enable / disable 属于本机 registry state，不写回 manifest。建议后续实现将状态与来源 manifest 分离：

```json
{
  "schemaVersion": 1,
  "extensions": {
    "com.example.openai-metadata": {
      "enabled": true,
      "enabledCapabilities": {
        "openai-provider-metadata": true,
        "openai-model-catalog": true
      },
      "updatedAt": "2026-06-16T08:00:00Z"
    }
  }
}
```

状态规则：

1. `enabled = false` 只从 active view 移除 contribution，不删除 extension 目录。
2. Capability-level disable 只移除对应 contribution，不修改 manifest。
3. `invalid`、`incompatible`、`conflicted` extension 不得写成 enabled active contribution。
4. Disable 不回滚用户已经确认导入的账号；清理账号需要独立 UX。
5. Registry snapshot、diagnostics、frontend DTO 不得包含 token、cookie、bearer credential 或 account raw secret。

## 4. Conflict Detection Matrix

| Capability | Conflict key | Same extension duplicate | Builtin conflict | Enabled extension conflict | 允许处理 |
| --- | --- | --- | --- | --- | --- |
| `provider-metadata` | `provider:<providerId>` | manifest `invalid` | 默认拒绝覆盖 authority；`augment` 只允许 UI metadata | 新 extension `conflicted` | disable 旧 extension、删除或替换本地包、后续 allowlist |
| `model-catalog-source` | `provider:<providerId>/model:<modelId>` | manifest `invalid` | 默认 `conflicted`，不得覆盖 routeability/account eligibility/quota truth | 同 priority 拒绝，不同 priority 进入 review | disable、替换本地包、人工审查 |
| `account-importer` | `provider:<providerId>/importer-format:<formatId>` | manifest `invalid` | 不覆盖内置 importer | 新 importer `conflicted` | disable、替换本地包 |
| `quota-probe` | `provider:<providerId>/quota-probe:<scope>:<dimension>` | manifest `invalid` | 不允许声称高于内置 authority | 可共存但必须标注 source/confidence/freshness；authority 冲突则拒绝 | disable、替换、后续 allowlist |

跨 capability 的通用拒绝项：

| Class | 触发条件 | 结果 |
| --- | --- | --- |
| `duplicate-extension-id` | 两个 manifest 使用同一 extension id | 拒绝后发现者 |
| `permission-missing` | capability required permission 不在顶层 `permissions` 内 | capability invalid |
| `unsafe-endpoint` | endpoint 非静态声明、非 https 或 runtime 改写目标 | capability invalid |
| `secret-inline` | manifest 出现明文 token/api key/cookie/bearer credential | manifest invalid |
| `unknown-capability-kind` | capability kind 不在 v0 白名单 | manifest invalid |
| `runtime-hook-requested` | 声明 JS hook、shell/node/python execution 或 route hook 权限 | manifest invalid |

## 5. Implementation Slices

### Phase 1：Schema 与只读 registry

目标：

- 扫描本地 `gettokens.extension.json`。
- JSON parse + schema validation。
- 输出 registry snapshot，包含 state、capabilities、permissions、diagnostics。
- 前端只读展示 extension 与 capability 诊断。

验收：

- valid example 进入 compatible 诊断。
- invalid JS hook / unknown capability example 被拒绝且错误可解释。
- Codex Skills / MCP 页面和 `~/.codex/config.toml` 不受影响。

### Phase 2：Compatibility、permission derivation、conflict detection

目标：

- 实现三维 compatibility 检查。
- 按 capability kind 推导 required permissions。
- 生成 conflict keys 与 conflict classes。

验收：

- missing permission、duplicate model、builtin authority overwrite 都能进入确定状态。
- unknown top-level/capability field 不被静默接受。
- inline secret 不进入 diagnostics 明文输出。

### Phase 3：Enable / disable registry state

目标：

- 引入 registry state 文件。
- extension-level 与 capability-level toggle。
- active view 由 schema、compatibility、permission、conflict、enable state 共同生成。

进入真实 mutation 之前，必须先保持 `schemas/gettokens-extension-enable-state-v0.schema.json`、`examples/enable-state-v0.valid.json`、README 和 round12 plan 四处同义。

验收：

- enable 前展示权限与冲突摘要。
- disable 后 active view 移除 contribution，但保留 manifest/source/diagnostics。
- 保存单个 extension 状态时只 patch 目标项，避免覆盖其他 registry state。

### Phase 4：首个 safe capability runner

目标：

- 优先落地 `provider-metadata` 或静态 `model-catalog-source`。
- 不读取 credential、不发起网络请求、不进入 hot path。

验收：

- 新 provider metadata 或 model UI hint 可进入 sidecar active view。
- 内置 authority 不被 extension 覆盖。
- account selection、route selection、quota truth 不被 extension 直接改写。

### Phase 5：受控 probe runner

目标：

- 在 registry、redaction、endpoint allowlist、diagnostics 稳定后加入 `quota-probe`。
- 只使用 sidecar 内置 runner 和内置 parser。

验收：

- probe 只能产出 fact candidate。
- 请求 URL、method、headers 均来自 manifest 静态声明和受控 credential ref。
- response parser 只使用内置 parser，不执行 extension 代码。

## 6. 后续未决项

1. Extension 包最终目录归属 sidecar data 目录还是 Wails app data 目录。
2. `bundled` source 是否需要签名或 hash 校验。
3. v0.1 是否先禁止 `model-catalog-source` declared endpoint，只允许 static JSON。
4. `quota-probe` 是否保留 `POST`，还是首期只开放 `GET`。
5. 人工 allowlist 是否需要独立审计日志与 UI。
