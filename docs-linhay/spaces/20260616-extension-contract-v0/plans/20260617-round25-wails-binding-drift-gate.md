# Round 25 Wails Binding Drift Gate

日期：2026-06-17

## 目标

补一个不依赖真实 Wails generator / dev App 的 generated binding surface drift 门禁，覆盖 Extension dry-run input `configText`、dry-run operation `patchPlan` typed fields，并顺带把 Route action / ledger 相关 generated surface 的现有关键字段纳入集中检查。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Round25 retry 指定上一批 agent 因上游 stream disconnected 中断，需要继续补 generated binding surface drift gate。 |
| 代码事实位置 | `internal/wailsapp/gettokens_extensions.go`、`internal/gettokensextensions/config_preview.go`、`internal/wailsapp/channel_routing.go`、`app.go`、`app_types.go`、`app_mappers.go`、`frontend/wailsjs/go/main/App.js`、`frontend/wailsjs/go/main/App.d.ts`、`frontend/wailsjs/go/models.ts`。 |
| 当前现象 | Round24 已有分散 `frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs` 与 `routeResilienceActionBinding.test.mjs`；缺少集中脚本同时检查 root/internal/generated/frontend surface。当前 Route action surface 没有独立 `ledgerError` 字段，已存在 ledger 相关字段为 `auditId`、`before`、`after`、`error`、`httpStatus`、`droppedSources`、`droppedReasons`。 |
| 预期验收 | `docs-linhay/scripts/check-wails-binding-surface.mjs` 与 `frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs` 能证明 `configText`、typed `patchPlan`、Route action ledger/error fields，以及现有 `limit` / `truncated` generated fields 不漂移。 |

## BDD Scenarios

1. Given Extension dry-run receives read-only TOML through `configText`
   When the drift gate checks internal input, root input, root mapper and generated model
   Then `configText` remains available without depending on real config file writes.

2. Given dry-run returns operation patch plans
   When the drift gate checks root DTO, mapper, planner result and generated model
   Then `patchPlan` remains typed and includes `targetSection`、`operation`、`beforeSnippet`、`afterSnippet`、`validation`。

3. Given Route action and related generated surfaces are checked
   When the drift gate inspects current root/internal/generated fields
   Then `auditId`、`before`、`after`、`error`、`httpStatus`、`droppedReasons`、route decision `limit` 和 session `truncated` / page `limit` 不会被静默丢失。

## TDD 记录

- 红灯：`node docs-linhay/scripts/check-wails-binding-surface.mjs` 失败，原因是脚本不存在，当前没有集中 drift gate 入口。
- 绿灯计划：新增集中脚本，并通过 `node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs` 纳入 Node test 层。

## 实现边界

- 不启动 dev App。
- 不运行 Wails generator。
- 不新增 Save / Apply / capability runner。
- 不读写真实 `~/.codex/config.toml`。
- 不修改 Extension / Route action 业务实现；若脚本发现字段缺失，才做最小 generated 同步。

## 验收命令

```bash
node docs-linhay/scripts/check-wails-binding-surface.mjs
node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-wails-binding-surface.mjs frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round25-wails-binding-drift-gate.md
```

## 验收结果

- `node docs-linhay/scripts/check-wails-binding-surface.mjs`：通过。
- `node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`：通过，5 个 binding tests 全绿。
- `npm --prefix frontend run typecheck`：通过。
- `git diff --check -- ...round25 files...`：通过。
- `docs-linhay/scripts/check-docs.sh`：未通过；当前工作区既有 `check-docs.sh` 会调用缺失的 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`，该文件不属于本轮 Round25 binding gate 改动。

## 剩余风险

- 本门禁验证当前 generated surface；不替代未来真正运行 Wails generator 后的 diff review。
- 当前代码没有 `RouteResilienceActionResult.ledgerError` 字段；脚本会在 root surface 将来出现 `LedgerError` 时自动要求 internal/generated 同步。
