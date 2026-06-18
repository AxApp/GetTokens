# Round 20 Config Apply Dry-run Boundary

日期：2026-06-17

## 目标

在 Round 19 local enable-state mutation 基础上，补齐 Codex config apply 的 dry-run / diff preview 边界：

1. 基于当前 registry snapshot 与 GetTokens app-local enable-state 判断 enabled extensions。
2. 输出将要触达的 Codex Skills / MCP 配置区域的 dry-run preview。
3. 输出 validation errors，明确 Extension Contract v0 当前不允许 enabled extensions 写 Codex Skills/MCP config。
4. 不写真实 `~/.codex/config.toml`，不读取真实 Codex config，不执行 capability，不接 marketplace。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Twentieth Dispatch 指定 Extension Contract config apply dry-run boundary，要求只允许 dry-run / diff preview / validation。 |
| 代码事实位置 | Round 19 已有 `internal/gettokensextensions/state.go`、`internal/wailsapp/gettokens_extensions.go`、root app DTO/mappers 和 frontend registry feature。 |
| 当前缺口 | local enable-state 已可写，但缺少 Codex config apply 前的 preview 边界；如果直接新增 save/apply 容易误写用户 `~/.codex/config.toml`。 |
| 预期验收 | preview 方法返回 `dryRun=true`、`target=codex-config`、Skills/MCP sections、enabled/skipped summary、validation errors；operation count 为 0；测试证明 target path 不被创建或写入。 |

## 实现边界

- Core 新增 `PreviewCodexConfigDryRun` 与 `CodexConfigDryRunPreview` DTO。
- Wails core/root 暴露 `PreviewGetTokensExtensionCodexConfigDryRun`，只复用 snapshot loader 与 enable-state merge。
- Frontend registry aside 显示 `Codex Config Dry-run`、section diff preview 与 validation list。
- Wails generated binding tests 锁住 preview 方法与 DTO。

## 非目标

- 不新增 `Save*`、`Apply*` 或真实 config 写入口。
- 不读取、patch 或保存 `~/.codex/config.toml`。
- 不执行 extension capability。
- 不接 marketplace、远程安装、Git source 或 runner。

## 验收记录

已运行 focused checks：

```bash
go test ./internal/gettokensextensions ./internal/wailsapp -run 'Extension|CodexConfig|GetTokensExtension'
go test . -run 'GetTokensExtension|CodexConfig'
npm --prefix frontend run test:unit -- src/features/gettokens-extension-registry/model.test.mjs src/features/gettokens-extension-registry/featureSource.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
```

结果：以上命令通过。第三条当前 npm script 会执行项目 unit test 集合，输出 915 pass。

## 剩余风险

- Extension Contract v0 manifest schema 尚无 Codex Skills/MCP 写入声明，因此 dry-run 当前只能返回 blocked sections 与 validation errors，不生成可应用 operation。
- 后续若引入真实 Codex config mutation，必须单独实现局部 TOML patch、raw/structured editor 重读同步、`bearer_token_env_var` 约束和 MCP 一级 table 解析门禁。
