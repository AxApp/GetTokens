# Round 23 Read-only TOML Patch Planner

日期：2026-06-17

## 目标

在 Round 22 `patchPlan` dry-run 基础上加入只读 TOML input parser / planner。调用方只能传入测试或 preview 用的 TOML 文本，planner 基于该文本生成 before / after patch snippets；本轮仍不读取或写入真实 `~/.codex/config.toml`。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Twenty-Third Dispatch 指定 `Extension Contract read-only TOML patch planner`，要求基于输入文本生成 patch snippets，但不写文件、不保留 token。 |
| 代码事实位置 | `internal/gettokensextensions/config_preview.go` 的 Round 22 `patchPlan` 只能输出“未读取目标 config”的静态 before snippet，无法反映 preview 输入里的既有 `[[skills.config]]` 或 `[mcp_servers.<id>]` 父 table。 |
| 当前现象 | UI / test 能看到 candidate operation，但不能用一段只读 TOML 文本验证未来局部 patch planner 对 existing section、nested MCP tables 和 token redaction 的行为。 |
| 预期验收 | `PreviewGetTokensExtensionCodexConfigDryRunInput.configText` 只读透传；core 从输入文本提取 `[[skills.config]]` 与精确 `[mcp_servers.<id>]` 父 table，nested `tools` / `oauth` 不作为 server；`bearer_token` literal 被 redacted；测试证明不读取/不写入真实 Codex config、不执行 capability、不接 marketplace/network。 |

## 实现边界

- 新增输入字段：`configText`。
- `configText` 是唯一 TOML 解析来源；`targetPath` 仍只是展示字段。
- 无 `configText` 时保持 Round 22 行为：before snippet 明确 `dry-run does not read ~/.codex/config.toml`。
- 有 `configText` 时：
  - `skills.config` 只提取 `[[skills.config]]` array-table snippets；
  - MCP 只提取精确 `[mcp_servers.<sanitized-extension-capability-id>]` 父 server table；
  - `[mcp_servers.<id>.tools.<tool>]` 与 `[mcp_servers.<id>.oauth]` 继续视为父 server 的 nested 配置，不作为独立 server snippet；
  - 输出前 redacts `bearer_token = ...`，after snippet 只允许提示 `bearer_token_env_var` 边界；
  - patch plan validation 增加 `input-toml-read-only`。
- 不新增 `Save*` / `Apply*` / capability runner。
- 不读取、不创建、不写入真实 `~/.codex/config.toml`。
- 不接 marketplace、Git source、网络或外部 provider。
- 本轮不重新生成 `frontend/wailsjs/go/*`；主控聚合阶段统一处理 generated bindings。

## 验收计划

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun'
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test . -run 'GetTokensExtension|PreviewGetTokensExtensionCodexConfigDryRun'
npm --prefix frontend run test:unit -- src/features/gettokens-extension-registry/model.test.mjs
npm --prefix frontend run test:unit -- frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
```

## 剩余风险

- 这是 read-only planner，不是真实局部 TOML writer；后续保存链路仍必须独立实现局部 patch、unknown field/comment/order 保留、raw editor 与结构化 editor 保存后重读同步。
- 当前 TOML parser 只服务 preview snippets，不做完整 TOML AST 修改；真实保存前必须替换为可保留格式的局部 patch 实现。
- `frontend/wailsjs/go/*` generated binding 尚未在本轮更新，需由主控聚合阶段统一再生成。
