# Round 27 TOML Temp Writer Fidelity

## 目标

在 Round26 temp-file only apply engine 的基础上，把字符串级 apply 行为向真实局部保存器再推进一步，但继续严格停留在 caller-supplied `ConfigText` + `TempDir` 边界内：不读取、不写入真实 `~/.codex/config.toml`，也不把 preview helper 升级成正式保存链路。

## 证据门禁

| 项目 | 内容 |
| --- | --- |
| 问题来源 | Round27 指令要求增强 temp-file apply fidelity，覆盖重复 apply 幂等、目标 section update 保真，以及敏感字段 redaction 边界。 |
| 代码事实位置 | `internal/gettokensextensions/config_apply_preview.go` 现有实现可把 preview operation 写入 temp file，但 add 类 operation 依赖旧 patchPlan 分类，重复 apply 时会再次追加 generated block；同时 temp output 仍可能原样携带 caller-supplied 敏感 literal。 |
| 当前缺口 | 缺少“按当前输入文本真实状态重判 add/update/noop”的 apply 逻辑；缺少二次 apply 稳定性测试；缺少 temp output redaction gate。 |
| 预期验收 | 同一 preview 对第一次输出再次 apply 时文本保持稳定；目标 MCP parent update 保留 sibling tables、nested tools/oauth、注释、未知字段、其他 MCP server、多个 `[[skills.config]]`；`bearer_token` literal 不出现在 `AppliedText` 或 temp file 中，`bearer_token_env_var` 继续保留。 |

## BDD 场景

1. Given 同一份 preview 第一次已把缺失的 Skills/MCP generated block 写入 temp TOML
   When 第二次对第一次输出再次 apply
   Then engine 应按当前输入文本把原本 stale 的 add/update 操作降级成 noop，且输出文本完全稳定。

2. Given `ConfigText` 已包含目标 `[mcp_servers.<id>]` 父 table、nested `tools`/`oauth`、未知字段与注释
   When temp apply 命中该 parent table
   Then 只补 generated source marker，不破坏 sibling tables、nested 子表、注释顺序和未知字段。

3. Given `ConfigText` 含多个 `[[skills.config]]`，其中只有部分 block 属于当前 extension/capability
   When apply 同一 preview
   Then 已有 generated block 维持 noop，缺失 block 仅追加一次，不影响其它 skills block。

4. Given caller-supplied TOML 含 `bearer_token` 或其他敏感 literal
   When temp apply 生成 `AppliedText` 和 `config-preview-*.toml`
   Then 敏感 RHS 必须 redacted，`bearer_token_env_var` 这类 env-var 引用仍保留原值。

## 实现摘要

- `internal/gettokensextensions/config_apply_preview.go`
  - apply engine 不再盲信 preview 初次分类，而是按当前 `ConfigText` 重新判断：
    - `skills.config`：已有 matching generated block => noop，否则 add。
    - `mcp_servers.<id>`：已有 matching generated parent => noop；已有 parent 但未带 source marker => update；完全缺失 => add。
  - temp output 在写入前统一走全文 redaction，复用既有敏感键识别规则，阻断 `bearer_token` literal 泄漏。
- `internal/gettokensextensions/registry_test.go`
  - 扩充 Round26 apply test，覆盖 nested oauth sibling、`bearer_token_env_var` 保留、`bearer_token` redaction，以及第二次 apply 文本稳定 / operation 降级为 noop。

## 验收命令

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test -count=1 ./internal/gettokensextensions
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test -count=1 ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun|Apply'
bash docs-linhay/scripts/check-docs.sh
git diff --check -- internal/gettokensextensions docs-linhay/spaces/20260616-extension-contract-v0/README.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-round27-toml-temp-writer-fidelity.md
```

## 剩余风险

- 当前仍是字符串级 preview helper，不是完整 TOML AST writer；更复杂的跨段落格式保持仍需正式保存链路证明。
- temp output 为安全起见会 redaction 敏感 RHS，因此它是“安全预览产物”，不是可直接替代真实 config 的保存结果。
- raw editor / 结构化 editor 保存后互相重读同步、真实 `~/.codex/config.toml` 局部 patch 和正式 apply 事务仍不属于本轮。
