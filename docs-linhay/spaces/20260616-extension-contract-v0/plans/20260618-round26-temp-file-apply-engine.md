# Round 26 Temp-File Apply Engine

## 目标

在 Round25 dry-run / no-side-effect planner 之后，补一个 temp-file only apply engine，证明 preview patch plan 能安全作用到调用方传入的临时 TOML 文本，并写入 `t.TempDir()` 下的临时 config 文件。该能力只用于缩窄“不是完整 TOML AST writer”的风险，不暴露真实 Codex config 保存入口。

## 证据门禁

| 项目 | 内容 |
| --- | --- |
| 问题来源 | Round26 指令要求补 temp-file only apply engine 或 apply preview helper，证明 patch plan 可以作用到临时 config，并保留未知字段 / 注释边界。 |
| 代码事实位置 | `internal/gettokensextensions/config_preview.go` 已能生成 `[[skills.config]]` 与 `[mcp_servers.<id>]` patch plan，但此前只停留在 snippet / dry-run 分类，没有 apply-to-temp evidence。 |
| 当前缺口 | 无法证明 add / update / noop 这些 preview operation 在字符串级局部 patch 时不会误读真实 target path、不会重复追加 generated block、不会把 nested MCP `tools` / `oauth` 当作独立 server。 |
| 预期验收 | focused test 使用 `t.TempDir()` 写临时 TOML；真实 `targetPath` 只作为诱饵并保持不变；temp apply 支持 `[[skills.config]]` add/noop 与 `[mcp_servers.<id>]` add/update/noop；非目标 section、未知字段、注释、nested tools 保留。 |

## BDD 场景

1. Given preview 的 `targetPath` 指向一个真实但不应读取的 Codex config 文件
   When temp apply helper 使用 caller-supplied `ConfigText`
   Then 只在 `t.TempDir()` 下生成 `config-preview-*.toml`，真实 target 文件内容不变且不泄漏到输出。

2. Given `ConfigText` 已包含带 `source_extension` / `source_capability` 的 `[[skills.config]]`
   When 同一 Skills operation 被 apply
   Then 返回 noop，不追加重复 array table。

3. Given `ConfigText` 缺少某个 provider metadata 对应的 `[[skills.config]]`
   When Skills add operation 被 apply
   Then 在临时 TOML 末尾追加一个 preview-only `[[skills.config]]` block。

4. Given `ConfigText` 已包含目标 `[mcp_servers.<id>]` 父 table 和 nested `[mcp_servers.<id>.tools.*]`
   When MCP update operation 被 apply
   Then 只在父 table 中补 source marker，保留原有 command、未知字段、注释和 nested tools section。

5. Given `ConfigText` 缺少目标 `[mcp_servers.<id>]`
   When MCP add operation 被 apply
   Then 在临时 TOML 末尾追加父 table，不生成 nested server。

6. Given `ConfigText` 已包含带 source marker 的目标 MCP parent table
   When 同一 MCP operation 被 apply
   Then 返回 noop，不重复追加 parent table。

## 实现摘要

- 新增 `internal/gettokensextensions/config_apply_preview.go`：
  - `ApplyCodexConfigDryRunPreviewToTempFile`
  - `CodexConfigTempApplyOptions`
  - `CodexConfigTempApplyResult`
- helper 只接受 preview DTO 与 `ConfigText`，只写 `TempDir/config-preview-*.toml`，不读取或写入 `TargetPath`。
- 支持的最小 operation：
  - `add-array-table-preview`
  - `noop-existing-array-table-preview`
  - `add-parent-table-preview`
  - `update-parent-table-preview`
  - `noop-existing-parent-table-preview`
- MCP 仍只识别 `[mcp_servers.<id>]` 父 table；nested `tools` / `oauth` 保持父 server 子配置语义。

## 验收命令

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions -run 'TestApplyCodexConfigDryRunPreviewToTempFilePreservesBoundaries'
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun|Apply'
bash docs-linhay/scripts/check-docs.sh
git diff --check -- internal/gettokensextensions/config_apply_preview.go internal/gettokensextensions/registry_test.go docs-linhay/spaces/20260616-extension-contract-v0/README.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-round26-temp-file-apply-engine.md
```

## 剩余边界

- 这仍不是完整 TOML AST writer，也不是 Codex config save/apply API。
- 不读取或写入真实 `~/.codex/config.toml`。
- 不执行 capability，不接 marketplace/network。
- 真实保存链路仍必须单独实现局部 patch、raw editor 与结构化 editor 保存后重读同步、`bearer_token_env_var` 门禁和更完整的 TOML 语义验证。
