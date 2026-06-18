# Round 21 Dry-run Operation Projection

日期：2026-06-17

## 目标

在 Round 20 dry-run boundary 基础上，让 `PreviewGetTokensExtensionCodexConfigDryRun` 能从 Extension Contract v0 manifest capabilities 生成 Skills/MCP 候选 operations，避免长期只有 `operationCount=0`。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Twenty-First Dispatch 指定 `Extension Contract dry-run operation projection`，要求不写真实 Codex config 的前提下生成 Skills/MCP 候选 operations 与 validation。 |
| 代码事实位置 | `internal/gettokensextensions/config_preview.go` 当前 Round20 preview 只返回 blocked sections 和 validation，enabled valid manifest 的 `operationCount=0`。 |
| 当前现象 | UI 能展示 dry-run sections / validation，但无法预览任何候选操作，后续很难判断 capability 到 Codex Skills/MCP 的映射增长是否回归。 |
| 预期验收 | enabled valid manifest dry-run 生成 preview-only operations；`provider-metadata` 投影到 `skills.config`，`model-catalog-source` 投影到 `mcp_servers`；validation 明确 no save/apply；target config path 不被创建或写入。 |

## 实现边界

- Core 只从 `CapabilitySnapshot.DeclaredContributions` 和 capability kind 投影候选 diff，不回读 manifest 原文。
- `provider-metadata` -> `skills.config` candidate。
- `model-catalog-source` -> `mcp_servers` candidate。
- Operation `action` 固定为 `preview`，只输出 diff text 与 capability scope。
- Validation 对成功投影使用 warning：`codex-config-projection-only`。
- 无法投影、缺 extension id、无 capabilities、无 enabled extensions 仍走 validation；只有真正阻塞路径计入 `validationErrorCount`。

## 非目标

- 不新增 `Save*`、`Apply*` 或真实 config 写入口。
- 不读取、patch 或保存 `~/.codex/config.toml`。
- 不执行 extension capability。
- 不接 marketplace、Git source、网络或 runner。
- 不把 Extension Contract v0 变成 Codex Skills/MCP 的真实安装链路。

## 验收计划

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun'
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test . -run 'GetTokensExtension|PreviewGetTokensExtensionCodexConfigDryRun'
npm --prefix frontend run test:unit -- src/features/gettokens-extension-registry/model.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
```

## 剩余风险

- 当前 projection 是 v0 声明式候选，不是 Codex config 局部 patch 计划；后续若引入真实保存链路，必须单独实现 `~/.codex/config.toml` 局部 patch、MCP 一级 table 解析、raw/structured editor 重读同步和 `bearer_token_env_var` 约束。
