---
name: gettokens-accounts-domain
description: Use when modifying GetTokens account inventory, auth-file flows, codex api key persistence, quota refresh, or the Wails-to-sidecar account bridge in this repo.
---

# GetTokens Accounts Domain

Use this skill when the task touches the account pool as a business slice, not just isolated UI styling.

The current account system is a unified inventory that combines:

- auth files from sidecar management APIs
- codex api keys from local persisted store plus sidecar sync
- Codex quota telemetry projected onto auth-file records

## Primary files

- `frontend/src/pages/AccountsPage.tsx`
- `frontend/src/types.ts`
- `app.go`
- `internal/wailsapp/accounts.go`
- `internal/wailsapp/auth_files.go`
- `internal/wailsapp/codex_api_key_store.go`
- `internal/wailsapp/quota.go`
- `internal/accounts/account_records.go`
- `internal/accounts/codex_quota.go`
- `internal/cliproxyapi/`
- `internal/sidecar/manager.go`
- `frontend/wailsjs/go/main/App.{js,d.ts}`
- `frontend/wailsjs/go/models.ts`

## Current architecture

1. Sidecar remains the source of truth for auth-file inventory.
2. Codex API keys are persisted locally under `~/.config/gettokens-data/codex-api-keys/` and synced into sidecar after startup.
3. Wails exports a unified `ListAccounts` surface to the frontend.
4. Frontend account cards consume a unified `AccountRecord` model instead of binding directly to raw auth-file DTOs.

## Working rules

1. Do not treat auth files and api keys as the same asset type.
2. Keep `provider` and `credentialSource` separate. Do not collapse them into one display field.
3. Asset uniqueness is by credential asset, not by person:
   - `auth-file:<name>`
   - `codex-api-key:<fingerprint>@<normalized-base-url>#<prefix>`
4. Do not do cross-source dedup between auth files and api keys even if email or provider matches.
5. Frontend list state is a projection. After create/delete flows, reload from Wails instead of hand-merging long-lived state.
6. If Go exports change, regenerate and verify Wails bindings before touching frontend call sites.
7. If sidecar is not `ready`, do not fetch account inventory.

## Quota rules

1. Quota currently applies only to Codex auth-file credentials, not generic api-key records.
2. Quota fetch path is:
   - `AccountsPage` -> `GetCodexQuota(name)`
   - Wails -> `POST /v0/management/api-call`
   - CLIProxyAPI injects token by `auth_index`
   - external target is `https://chatgpt.com/backend-api/wham/usage`
3. When debugging quota, verify both:
   - the Wails-side debug panel event
   - the CLIProxyAPI token resolution path

## Failure modes exposed by recent sessions

1. Uploading two auth files with the same filename overwrites one record unless upload names are uniquified first.
2. Rewriting sidecar `config.yaml` wholesale can silently erase `codex-api-key` config.
3. Storing api-key JSON under the auth directory causes fake auth accounts like `CODEX-API-KEYS/.../UNKNOWN`.
4. Looking only at frontend cards can hide that the real quota bug lives in CLIProxyAPI token parsing or `auth_index` resolution.

## Acceptance checklist

- Account pool still renders after sidecar becomes ready.
- Auth files and api keys both appear in the unified list.
- API key records survive app restart.
- Ghost auth artifacts from `codex-api-keys/*.json` do not appear in the list.
- Auth-file quota refresh still works through `/api-call`.
- Wails bindings remain in sync with Go exports.
