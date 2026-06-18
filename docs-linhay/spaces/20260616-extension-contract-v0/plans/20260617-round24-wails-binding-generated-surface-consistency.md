# Round 24 Wails Binding Generated Surface Consistency

日期：2026-06-17

## 目标

校准 Round20-23 新增 Extension dry-run root/Wails DTO 与 frontend generated binding tests，证明 `PreviewGetTokensExtensionCodexConfigDryRunInput.configText` 与 operation `patchPlan` 不会在 root/Wails/frontend generated surface 中丢失。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Twenty-Fourth Dispatch 指定 Wails binding generated surface consistency，要求证明 extension dry-run input / patchPlan 不会丢。 |
| 代码事实位置 | `internal/wailsapp/gettokens_extensions.go`、`app_types.go`、`app_mappers.go`、`frontend/wailsjs/go/models.ts`、`frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`。 |
| 当前现象 | Root/Wails 已支持 `configText` 和 `patchPlan`，但当前 generated `models.ts` 少了 dry-run `configText` 与 operation `patchPlan` typed conversion。 |
| 预期验收 | Binding test 先红后绿；`models.ts` 最小手动同步；Go focused tests 证明 root mapper、internal Wails dry-run 与 patchPlan 输出一致。 |

## 实现边界

- 不启动 dev App。
- 不运行 Wails generator，避免覆盖并行 subagents 的 generated files。
- 不新增 `Save*` / `Apply*` / capability runner。
- 不读取或写入真实 `~/.codex/config.toml`；`configText` 仍是测试/preview 输入。
- 不接 marketplace、Git source、网络或外部 provider。

## BDD Scenarios

1. Given frontend code constructs `PreviewGetTokensExtensionCodexConfigDryRunInput` from generated models
   When the input includes `configText`
   Then the generated class declares and assigns `configText`.

2. Given dry-run preview returns candidate operations
   When frontend generated models convert operations
   Then every operation exposes typed `patchPlan` with `targetSection/operation/beforeSnippet/afterSnippet/validation`.

3. Given root `main.App` maps dry-run input to internal Wails
   When `roots`, `statePath`, `targetPath` and `configText` are provided
   Then the mapper clones list fields, forces roots read-only, and preserves the read-only TOML input.

## 验收计划

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test . ./internal/wailsapp -run 'GetTokensExtension|PreviewGetTokensExtensionCodexConfigDryRun'
node --test frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
npm --prefix frontend run typecheck
```

## 剩余风险

- 本轮手动同步 `frontend/wailsjs/go/models.ts`，未运行 generator；后续若运行 generator，必须保留这些字段或让 binding tests 失败。
- `patchPlan` 仍是 read-only snippet planner，不是真实 TOML writer；保存链路、局部 patch 和格式保留仍属于后续切片。
