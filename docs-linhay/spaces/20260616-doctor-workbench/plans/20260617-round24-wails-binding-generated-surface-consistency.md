# Round 24 Wails Binding Generated Surface Consistency

日期：2026-06-17

## 目标

校准 Round20-23 新增 Doctor typed diagnostics DTO 与 frontend generated binding tests，证明 nested `droppedReason` 不会在 internal Wails、root `main.App` DTO、root mapper 与 `frontend/wailsjs/go/models.ts` generated surface 中丢失。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Twenty-Fourth Dispatch 指定 Wails binding generated surface consistency，要求证明 `droppedReason` 不会在 root/Wails/frontend generated surface 中丢失。 |
| 代码事实位置 | `internal/wailsapp/types.go`、`app_types.go`、`app_mappers.go`、`frontend/wailsjs/go/models.ts`、`frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs`。 |
| 当前现象 | Round20-23 已接 nested `droppedReason`，但 release-readiness 需要一条不依赖 dev App / generator 的 generated surface 断言。 |
| 预期验收 | Focused Go tests 证明 Wails/root JSON 与 mapper 保留 nested payload；frontend binding test 证明 generated `DoctorEvidenceRef` class 对 `droppedReason` 使用 typed conversion。 |

## 实现边界

- 不启动 dev App。
- 不运行 Wails generator。
- 不新增 Doctor repair / mutation surface。
- 不把 `label`、`summary`、`refID`、`source` 或顶层冲突字段升级为 route authority。
- 本轮只校准 binding/generated-surface 证据，不修改 sidecar diagnostics 语义。

## BDD Scenarios

1. Given sidecar diagnostics evidence includes conflicting top-level route text and nested `droppedReason`
   When Wails/root DTOs map the Doctor snapshot
   Then nested `droppedReason` survives and remains the authoritative typed payload.

2. Given frontend consumes generated `DoctorEvidenceRef`
   When the generated class is checked without rerunning the generator
   Then `droppedReason` is declared as `DoctorRouteEvidencePayload` and converted with `convertValues`.

## 验收计划

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-clang-module-cache go test . ./internal/wailsapp -run 'Doctor|GetTokensExtension|PreviewGetTokensExtensionCodexConfigDryRun'
node --test frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
```

## 剩余风险

- 本轮不运行 generator；一致性由 generated surface 文本断言和 Go DTO/mapping tests 证明。
- 本轮不替代真实 Wails runtime / dev App 验收；本任务明确禁止启动 dev App。
