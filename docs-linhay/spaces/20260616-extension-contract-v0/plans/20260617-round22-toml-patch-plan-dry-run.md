# Round 22 TOML Patch-plan Dry-run

日期：2026-06-17

## 目标

在 Round 21 dry-run operation projection 基础上，为 Codex config preview operation 增加 TOML patch plan 预览。输出只用于 UI / contract inspection，不读取或写入真实 `~/.codex/config.toml`。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Twenty-Second Dispatch 指定 `Extension Contract TOML patch-plan dry-run`，要求基于 Round21 operation projection 输出目标 section、operation、before/after snippet 和 validation。 |
| 代码事实位置 | `internal/gettokensextensions/config_preview.go` 已能从 enabled extension capabilities 投影 `skills.config` 与 `mcp_servers` candidate operation，但 operation 只有旧 `preview` 文本。 |
| 当前现象 | 前端能看到 candidate operation，但无法审查未来局部 TOML patch 的目标 section、操作类型、before/after 片段和安全 validation。 |
| 预期验收 | `PreviewGetTokensExtensionCodexConfigDryRun` 返回 `operation.patchPlan`；section diff 汇总 patch-plan；Go/root/frontend focused tests 覆盖 no write、MCP parent table、no bearer_token literal 与 dry-run validation。 |

## 实现边界

- 仍只使用 `RegistrySnapshot` / `CapabilitySnapshot` 投影，不读取 manifest 原文。
- 不读取、不创建、不写入 `TargetPath` 或 `~/.codex/config.toml`。
- 不新增 `Save*`、`Apply*`、真实 patch 执行器或 capability runner。
- 不接 marketplace、Git source、网络或外部 provider。
- TOML patch plan 只作为 preview DTO：
  - `targetSection`
  - `operation`
  - `beforeSnippet`
  - `afterSnippet`
  - `validation`
- MCP 只投影 `[mcp_servers.<id>]` 父 server table；nested `tools` / `oauth` 必须继续属于父 server，不作为独立 server。
- 不输出 `bearer_token`；validation 记录 future patch 只能使用 `bearer_token_env_var`。

## Patch-plan 预览语义

| Capability kind | Target section | Operation | After snippet 语义 |
|---|---|---|---|
| `provider-metadata` | `skills.config` | `append-array-table-preview` | 预览 `[[skills.config]]` array table，标记 source extension / capability / contribution；不绑定真实 skill install path。 |
| `model-catalog-source` | `mcp_servers` | `upsert-parent-table-preview` | 预览 `[mcp_servers.<sanitized-extension-capability-id>]` 父 table，标记 source extension / capability / contribution；不生成 nested server，不写 token literal。 |

## 验收计划

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun'
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test . -run 'GetTokensExtension|PreviewGetTokensExtensionCodexConfigDryRun'
npm --prefix frontend run test:unit -- src/features/gettokens-extension-registry/model.test.mjs
npm --prefix frontend run test:unit -- frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
```

## 剩余风险

- 本轮仍不是真实 TOML local patch writer；后续若进入保存链路，必须单独实现局部 patch、raw editor 与结构化 editor 保存后重读同步、未知字段和注释保留。
- Wails generated bindings 需要主控聚合阶段统一刷新；本轮只更新 root DTO / mapper / binding gate，不直接改 `frontend/wailsjs/go/*` generated files。
- Extension Contract v0 还没有真实 Codex skill install path 或 MCP runtime transport，因此 after snippet 只保留 source / contribution 注释，不生成可执行配置。
