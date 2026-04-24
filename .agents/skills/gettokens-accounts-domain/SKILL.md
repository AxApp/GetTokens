---
name: gettokens-accounts-domain
description: Use when modifying GetTokens account inventory or auth-file workflows in this repo, including listing, filtering, detail modal, model verification, delete, enable/disable, or Wails-to-sidecar bridge changes.
---

# GetTokens Accounts Domain

GetTokens has one high-churn business slice: the account inventory backed by the sidecar management API.

Use this skill when the task touches auth file data, account cards, detail modal behavior, or the bridge between the Svelte UI and sidecar endpoints.

## Primary files

- `app_accounts.go`: Wails-exported bridge methods and sidecar HTTP contract
- `frontend/src/pages/AccountsPage.svelte`: account list, search, delete, ready-state gating
- `frontend/src/components/biz/AccountDetailModal.svelte`: model lookup, raw file download, verify action
- `internal/sidecar/manager.go`: sidecar status lifecycle
- `frontend/wailsjs/go/main/App.{js,d.ts}`: generated bindings, verify after Go API changes

## Working rules

1. Treat the sidecar as the source of truth. Frontend state is a projection, not a cache you should hand-maintain unless necessary.
2. Do not call account endpoints before sidecar status is `ready`. `AccountsPage.svelte` intentionally gates fetches on `sidecarStatus.code === 'ready'`.
3. After any mutating action such as delete or enable/disable, refresh the list from `ListAuthFiles()` instead of patching UI state optimistically.
4. Keep empty data safe by normalizing nil or missing arrays to `[]` in Go before returning to the frontend.
5. When the sidecar response shape changes, fix the Go unmarshal layer first. The session exposed this exact failure mode for `GetAuthFileModels`.

## Contract reminders

- Base management prefix is `/v0/management`.
- `ListAuthFiles` expects `{ files, total }`.
- `DeleteAuthFiles` sends `{ "names": [...] }`.
- `SetAuthFileStatus` sends `{ "name": string, "disabled": bool }`.
- `GetAuthFileModels` currently unwraps `{ "models": [...] }`.
- `DownloadAuthFile` returns base64 content to the frontend.

## Acceptance checklist

- Accounts page shows loading or waiting state while sidecar is not ready.
- Accounts list renders after sidecar becomes ready.
- Search works on `name` and `provider`.
- Detail modal opens from a card and loads models plus raw content.
- Delete actually removes the record and refreshes the list.
- Empty state is still readable in both light and dark themes.

## If you change Go exports

1. Rebuild or rerun Wails so bindings regenerate.
2. Re-check `frontend/wailsjs/go/main/App.{js,d.ts}`.
3. Re-open the app and exercise the actual UI flow, not just compile success.
