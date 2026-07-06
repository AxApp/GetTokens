---
name: gettokens-session-management-plugin-contract
description: GetTokens 会话管理插件契约：修改会话分析/复盘/导出类插件结果字段、Wails DTO、dev bridge、前端映射和验收时使用。
---

# GetTokens Session Management Plugin Contract

Use this skill when changing `session-management` plugin inputs, outputs, runtime bindings, dev bridge data, or result UI.

## Contract Change Checklist
1. Update Go plugin logic under `internal/wailsapp/`, including DTO structs and focused tests.
2. Mirror Wails-facing DTO changes in `cmd/gettokens/app_types.go` and mappers in `cmd/gettokens/app_mappers.go`.
3. Keep generated frontend bindings aligned in `frontend/wailsjs/go/models.ts`.
4. Update the browser dev bridge in `frontend/dev/sessionManagementDevData.js` so localhost preview returns the same fields as Wails runtime.
5. Update frontend model interfaces and response mappers in `frontend/src/features/session-management/model.ts`.
6. Render new result fields in `SessionManagementView.tsx` without blocking existing list/detail workflows.
7. Add or update `model.test.mjs` assertions for runtime mapping, UI structure, and dev bridge contract.
8. Update the matching `docs-linhay/spaces/<space-key>/README.md`, plan, and memory.

## Verification
- Run focused Go tests for `AnalyzeCodexSessions` when analysis logic changes.
- Run `go test ./...` after Wails-facing DTO or mapper changes.
- Run `node --test src/features/session-management/model.test.mjs`.
- Run `npm run test:unit`, `npm run typecheck`, and `npm run build` before closure.
- Use headless browser validation for localhost interaction and screenshot acceptance; do not open visible browser windows for routine checks.

## Known Pitfall
Updating only Wails runtime is not enough. Localhost browser preview uses `frontend/dev/sessionManagementDevData.js`; if it does not return the new fields, the UI may pass runtime tests while the dev preview silently drops data.
