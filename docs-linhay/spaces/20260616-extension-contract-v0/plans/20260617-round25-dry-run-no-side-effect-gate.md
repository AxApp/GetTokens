# Round 25 Dry-Run No-Side-Effect Gate

## 目标

强化 `PreviewGetTokensExtensionCodexConfigDryRun` 的 read-only TOML dry-run planner 证据：planner 只能消费调用方传入的 `configText` 与 registry snapshot/input，不读取或写入真实 `~/.codex/config.toml`，并能把已存在、缺失、可更新的候选 patch plan 明确分类。

## 证据门禁

| 项目 | 内容 |
| --- | --- |
| 问题来源 | Round25 retry 指令要求补强 Extension dry-run no-side-effect gate；上一批失败原因为上游 stream disconnected，不是代码失败。 |
| 代码事实位置 | `internal/gettokensextensions/config_preview.go` 已实现 read-only planner；`internal/gettokensextensions/registry_test.go` 与 `internal/wailsapp/gettokens_extensions_test.go` 已有 no-write / read-only TOML 输入测试，但缺少 caller-supplied-only 与 noop/add/update 分类断言。 |
| 当前缺口 | core planner 已天然无 filesystem 依赖，但 `PatchPlan.Operation` 之前只表达 append/upsert，无法证明已存在 generated action 不会重复追加；Wails handler 侧也缺少 targetPath 文件内容不参与 preview 的显式断言。 |
| 预期验收 | 测试使用 targetPath 诱饵真实配置与不同的 `configText`，证明输出只来自 caller-supplied TOML，target 文件未被读取或写入；已有 generated Skills action 分类为 noop，已有 MCP parent table 分类为 update，缺失 MCP parent table 分类为 add。 |

## BDD 场景

1. Given targetPath 指向一个真实但不应读取的 Codex config 文件
   When caller 同时传入不同的 `configText`
   Then dry-run preview 的 snippets 只能包含 `configText` 内容，不能包含 targetPath 文件内容，且 targetPath 文件内容保持不变。

2. Given `configText` 已包含带 `source_extension` 与 `source_capability` 的 `[[skills.config]]`
   When 同一个 extension/capability 生成 Skills patch plan
   Then planner 返回 `noop-existing-array-table-preview`，不追加重复 `[[skills.config]]`。

3. Given `configText` 已包含精确 `[mcp_servers.<id>]` 父 table
   When 同一个 model-catalog capability 生成 MCP patch plan
   Then planner 返回 `update-parent-table-preview`，nested `tools` / `oauth` 仍不被当作 server。

4. Given `configText` 不包含目标 `[mcp_servers.<id>]`
   When capability 需要 MCP server preview
   Then planner 返回 `add-parent-table-preview`。

## 实现摘要

- 新增 core focused test：`TestPreviewCodexConfigDryRunUsesOnlySuppliedTomlInputAndClassifiesNoopAddUpdate`。
- `config_preview.go` 将 patch plan operation 分成：
  - `add-array-table-preview`
  - `noop-existing-array-table-preview`
  - `add-parent-table-preview`
  - `update-parent-table-preview`
  - `noop-existing-parent-table-preview`
- Wails dry-run handler 测试补充 `TargetPath` 诱饵文件内容不泄漏、`ConfigText` 透传、target 文件不变断言。

## 验收命令

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions -run 'TestPreviewCodexConfigDryRun(UsesOnlySuppliedTomlInputAndClassifiesNoopAddUpdate|PlansFromReadOnlyTomlInput|ReportsEnabledExtensionsWithoutWritingConfig|RedactsSensitiveTomlFields)'
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun'
docs-linhay/scripts/check-docs.sh
git diff --check -- internal/gettokensextensions/config_preview.go internal/gettokensextensions/registry_test.go internal/wailsapp/gettokens_extensions_test.go docs-linhay/spaces/20260616-extension-contract-v0/README.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round25-dry-run-no-side-effect-gate.md
```

## 剩余边界

- 本轮仍不实现真实 Codex config apply/save。
- 不读取真实 `~/.codex/config.toml`，不写任何 Codex MCP/Skills 配置。
- 不执行 extension capability，不接 marketplace/network。
