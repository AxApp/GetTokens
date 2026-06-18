# Extension Contract v0 Phase 1 Read-only Registry Implementation Plan

日期：2026-06-16

## 1. Phase 1 边界

本计划原本为后续实现提供技术方案与验收输入。2026-06-16 已先落地独立 Go runtime core 包：`internal/gettokensextensions`；随后已接到 Wails core 与 root `main.App` 的只读 DTO bridge。

当前已完成的 runtime core 边界：

1. 支持 manifest path 列表读取。
2. 支持 extension root 扫描 `gettokens.extension.json`。
3. 输出 read-only registry snapshot，不返回 manifest 原文。
4. valid example 进入 `readonly-compatible`。
5. unknown capability、forbidden permission、duplicate extension id、JSON parse error 进入 `invalid` diagnostics。
6. `declared-endpoint` 仅作为声明解析，不构造 HTTP client，不发网络请求。

当前已完成的 Wails/root bridge 边界：

1. `internal/wailsapp.GetGetTokensExtensionRegistrySnapshot` 支持 `manifestPaths` / `roots` 输入。
2. root `main.App.GetGetTokensExtensionRegistrySnapshot` 提供 Wails-facing DTO 映射，保留 `readOnly`、`registryMode`、`extensions`、`capabilities`、`diagnostics`。
3. 无输入时只扫描 GetTokens app-owned root：`~/.config/gettokens/extensions` 或 dev profile 下的 `~/.config/gettokens-dev/extensions`。
4. 默认 root 不读取 `~/.codex/config.toml`，不读取 Codex Skills / MCP 配置，不写 enable/disable state。
5. root 不存在返回空 read-only snapshot，并通过 `extension-root-not-found` warning diagnostic 表达，不作为 hard error。
6. `frontend/wailsjs` 已手工最小同步方法与 DTO；未运行 Wails generator，未接 frontend 页面。

当前仍未接入的边界：

1. 不接 frontend management UI。
2. 不接 sidecar management API。
3. 不接 Codex Skills / MCP。
4. 不执行 extension capability。
5. 不写 enable/disable state。

Phase 1 的目标是建立只读 registry 骨架：

1. 扫描本地 extension manifest 候选文件。
2. 解析 `gettokens.extension.json`。
3. 按 `schemas/gettokens-extension-v0.schema.json` 做 schema validation。
4. 生成 registry snapshot，包含 extension、capability、permission、compatibility hint、diagnostics。
5. 输出 read-only DTO 给后续 Wails/frontend 管理界面使用。

Phase 1 不产生 active runner，不写 registry state，不执行 capability，也不接入 Codex Skills / MCP。

## 2. BDD 场景

### Scenario 1：valid manifest 进入只读 snapshot

Given 本地扫描目录中存在 `examples/provider-metadata-model-catalog.valid.json` 等价 manifest
When registry loader 读取并校验 manifest
Then snapshot 中出现 extension `com.example.openai-metadata`
And extension state 为 `compatible` 或 `readonly-compatible`
And capability 列表包含 `provider-metadata` 与 `model-catalog-source`
And diagnostics 不包含 error
And snapshot 不包含 token、cookie、bearer credential 或 account raw secret。

### Scenario 2：unknown capability / JS hook 被拒绝

Given 本地扫描目录中存在 `examples/js-hook-unknown-capability.invalid.json` 等价 manifest
When registry loader 读取并校验 manifest
Then extension state 为 `invalid`
And diagnostics 包含 `unknown-capability-kind` 或 schema enum violation
And diagnostics 能指出 `runtime.request.hook` 不是 v0 permission
And registry 不生成任何 active contribution。

### Scenario 3：schema parse failure 可解释

Given manifest JSON 语法无效或根对象缺少必填字段
When registry loader 读取该文件
Then snapshot 保留 source path 与 invalid state
And diagnostics 包含机器可分类 code 与人类可读 message
And 解析失败的文件内容不回传给 frontend。

### Scenario 4：只读 registry 不改变用户状态

Given registry loader 完成扫描
When 生成 registry snapshot
Then 不创建、不修改 enable/disable state 文件
And 不写 manifest
And 不写 `~/.codex/config.toml`、Codex Skills、MCP 或 Claude 配置
And 不启动网络请求、probe、importer 或任何 extension 代码。

### Scenario 6：Wails/root 只读 bridge 可消费 registry snapshot

Given root `main.App` 收到 `manifestPaths` 或 `roots` 输入
When 调用 `GetGetTokensExtensionRegistrySnapshot`
Then 返回 Wails-facing DTO，而不是 manifest raw content
And DTO 保留 `readOnly`、`registryMode`、`extensions`、`capabilities`、`diagnostics`
And 默认无输入时只扫描 GetTokens app-owned extension root，不读取 Codex config。

### Scenario 5：重复 id 在只读阶段可诊断

Given 扫描目录中存在两个 manifest 使用同一 extension id
When registry loader 聚合 snapshot
Then 后发现者 state 为 `invalid`
And diagnostics 包含 `duplicate-extension-id`
And 先发现者仍保留自身 schema validation 结果
And Phase 1 不尝试自动合并、排序抢占或覆盖。

## 3. 证据矩阵

| 证据项 | 当前输入 | 预期 Phase 1 产物 | 验收方式 |
| --- | --- | --- | --- |
| Manifest schema | `schemas/gettokens-extension-v0.schema.json` | loader 使用同一 schema 做 validation | 单元测试覆盖 valid / invalid examples |
| Valid example | `examples/provider-metadata-model-catalog.valid.json` | snapshot extension state 可诊断为 compatible | fixture test 比对 snapshot 核心字段 |
| Invalid JS hook example | `examples/js-hook-unknown-capability.invalid.json` | state 为 invalid，diagnostics 可解释 | fixture test 断言 diagnostic code |
| Source path | 本地候选 manifest 路径 | DTO 只暴露 normalized path / source uri / source type | 单元测试断言不泄露文件内容 |
| Secret redaction | manifest 中禁止 inline secret | snapshot 与 diagnostics 不出现 secret value | 负向 fixture + string scan |
| Codex 隔离 | Codex Skills / MCP 属于独立产品线 | loader 不读取、不写入 Codex config | 单元测试使用 fake fs 断言无 Codex path access |
| Read-only state | Phase 1 不支持 enable / disable | DTO 中可有 `readOnly: true`，无 active view 写入 | 单元测试断言无 state file write |
| Wails/root bridge | Wails 绑定 root `main.App` | root DTO 映射只读 snapshot，不执行 capability | `internal/wailsapp` 与 root mapper tests |
| Frontend binding shell | 本轮不做页面 | `frontend/wailsjs` 仅有方法/DTO 壳 | Node binding 存在性测试 |

## 4. 扫描与读取输入

后续实现建议以 sidecar registry service 为 owner，但 Phase 1 仅暴露只读方法。

候选输入：

1. App-owned extension roots 下的 `*/gettokens.extension.json`。
2. Bundled read-only root 下的 `*/gettokens.extension.json`。
3. 测试 fixture 直接传入 manifest path list。

读取规则：

1. 只读取 manifest JSON 与 schema validation 需要的静态本地 JSON 文件。
2. `model-catalog-source.source.path` 在 Phase 1 可只记录为 declared path，不读取模型文件；若读取，也只能读取 extension 包内相对 JSON，并进入独立 fixture 测试。
3. `declared-endpoint` 只作为声明字段进入 DTO，不发起网络请求。
4. `account-importer` 只展示 schema/format 声明，不读取用户账号文件。
5. `quota-probe` 只展示 request/response 声明，不构造 HTTP client。

## 5. DTO / Registry Snapshot 形态

Phase 1 snapshot 推荐形态：

```json
{
  "contractVersion": "0.1.0",
  "registryMode": "read-only",
  "generatedAt": "2026-06-16T08:00:00Z",
  "roots": [
    {
      "id": "local",
      "path": "/Users/me/Library/Application Support/GetTokens/extensions",
      "readOnly": true
    }
  ],
  "extensions": [
    {
      "id": "com.example.openai-metadata",
      "name": "Example OpenAI Metadata",
      "version": "0.1.0",
      "publisher": {
        "name": "Example Labs",
        "url": "https://example.com"
      },
      "source": {
        "type": "local",
        "uri": "file:///Users/me/extensions/openai-metadata",
        "revision": "local",
        "manifestPath": "/Users/me/extensions/openai-metadata/gettokens.extension.json"
      },
      "state": "readonly-compatible",
      "readOnly": true,
      "compatibility": {
        "manifestContract": "0.1.0",
        "sidecarContract": "^0.1.0",
        "capabilityContract": "^0.1.0",
        "status": "compatible"
      },
      "permissions": [
        "provider.metadata.read",
        "model.catalog.read"
      ],
      "capabilities": [
        {
          "id": "openai-model-catalog",
          "kind": "model-catalog-source",
          "state": "readonly-compatible",
          "requiredPermissions": [
            "model.catalog.read"
          ],
          "declaredContributions": [
            "provider:openai/model:gpt-4.1"
          ],
          "diagnostics": []
        }
      ],
      "diagnostics": []
    }
  ],
  "diagnostics": []
}
```

DTO 规则：

1. `state` 在 Phase 1 不使用 `enabled`，避免误导为 active view。
2. `readOnly = true` 必须在 snapshot 与 extension 级别显式出现。
3. `declaredContributions` 只表示可推导声明，不表示已启用贡献。
4. `diagnostics` 使用稳定 `code`、`severity`、`path`、`message`、`source`。
5. DTO 不包含 manifest 原文、不包含 secret、不包含账号原始数据、不包含 Codex config 内容。

## 6. Validation 状态

Phase 1 validation 状态只覆盖读取与静态校验：

| State | 触发条件 | 是否进入 snapshot | 是否进入 active view |
| --- | --- | --- | --- |
| `discovered` | 找到候选 path，尚未解析 | 可短暂内部状态 | 否 |
| `invalid` | JSON parse、schema、unknown capability、forbidden permission、duplicate id 失败 | 是 | 否 |
| `readonly-compatible` | schema 通过且 contract range 可被当前 sidecar 识别 | 是 | 否 |
| `readonly-incompatible` | schema 通过但 sidecar/capability contract 不兼容 | 是 | 否 |
| `readonly-conflicted` | 只读阶段可确定重复 id 或同包重复 contribution | 是 | 否 |
| `readonly-unchecked` | Phase 1 不做的深层冲突或 runner 前置条件 | 是 | 否 |

说明：

1. `enabled`、`disabled`、`active` 不属于 Phase 1。
2. Phase 1 可以预计算明显冲突诊断，但不做冲突解决。
3. `readonly-conflicted` 只用于可完全从静态 manifest 推导的冲突，例如 duplicate extension id、同 extension 重复 capability id、同 extension 重复 provider/model declaration。

## 7. Conflict 只读诊断范围

Phase 1 可做：

1. Duplicate extension id。
2. Same extension duplicate capability id。
3. Same extension duplicate provider id。
4. Same extension duplicate `providerId + model.id`。
5. Forbidden permission。
6. Unknown capability kind。
7. Inline secret pattern 的保守扫描。

Phase 1 不做：

1. 与内置 provider authority 的最终覆盖判定。
2. 与已启用 extension 的 active conflict 判定。
3. priority review。
4. allowlist。
5. 用户交互式 resolution。

这些进入 Phase 2 / Phase 3。

## 8. Focused Tests 计划

### Unit tests

1. `LoadRegistrySnapshotValidExampleReturnsReadonlyCompatible`。已落地。
2. `LoadRegistrySnapshotInvalidUnknownCapabilityAndForbiddenPermission`。已落地。
3. `LoadRegistrySnapshotDuplicateExtensionIDMarksLaterInvalid`。已落地。
4. `LoadRegistrySnapshot_sameExtensionDuplicateCapability_marksInvalid`。
5. `LoadRegistrySnapshotParseErrorKeepsSourcePathWithoutRawContent`。已落地。
6. `LoadRegistrySnapshot_inlineSecret_redactsDiagnostic`。
7. `LoadRegistrySnapshotDeclaredEndpointDoesNotFetchNetwork`。已落地。
8. `LoadRegistrySnapshot_doesNotReadOrWriteCodexConfig`。
9. `LoadRegistrySnapshot_doesNotWriteRegistryState`。
10. `LoadRegistrySnapshotScansRootsForManifestFiles`。已落地。

### Fixture tests

1. 使用当前 valid example 作为 golden input。已落地。
2. 使用当前 invalid JS hook example 作为 golden invalid input。已落地。
3. duplicate extension id 使用临时 manifest fixture 覆盖。已落地。
4. 补充 inline secret fixture，断言输出不包含 secret literal。

### Contract tests

1. Snapshot JSON 可被 frontend DTO schema 或 typed decoder 接收。
2. Diagnostic code 枚举稳定，前端可按 code 分组展示。
3. `readOnly` 与 `registryMode` 字段存在，防止 UI 误展示 enable toggle。

## 9. 明确不做项

Phase 1 不做：

1. 不实现 enable / disable。
2. 不写 registry state。
3. 不生成 active view。
4. 不运行 provider metadata runner。
5. 不读取用户账号导入文件。
6. 不发起 model catalog endpoint 请求。
7. 不执行 quota probe。
8. 不执行 JS、shell、Node、Python 或 extension 包内任何文件。
9. 不接 Codex Skills / MCP，不读写 `~/.codex/config.toml`。
10. 不接 frontend management UI；本切片只手工同步 `frontend/wailsjs` 方法和 DTO。
11. 不改 CLIProxyAPI reference。
12. 不实现 marketplace、远程安装、自动更新或 Git source。

## 10. 后续交接输入

Phase 1 实现前需要确认：

1. Sidecar registry root 最终路径。
2. Snapshot API 名称和 owner，是 sidecar management API 还是 Wails bridge。
3. 是否在 Phase 1 读取 `model-catalog-source.source.path` 指向的静态 JSON。
4. Diagnostic code 枚举是否需要单独 schema 文件。
5. 是否将 Phase 1 DTO schema 落成 `schemas/gettokens-extension-registry-snapshot-v0.schema.json`。

完成 Phase 1 后，下一步才进入 Phase 2：permission derivation、内置 authority conflict、enabled extension conflict 与 enable 前检查。
