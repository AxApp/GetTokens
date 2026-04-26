---
name: gettokens-domain-engineering
description: Technical engineering for GetTokens. Covers the Accounts domain (auth files, API keys, quota rules), UI system (Swiss-industrial aesthetic, theme, l10n), frontend debugging (inspectors, logs), and CLIProxyAPI fork maintenance.
---

# GetTokens Domain & Engineering

This skill unifies the technical rules for building, styling, and debugging GetTokens.

## 1. Accounts Domain & Unified Inventory
- **Model**: Unified `AccountRecord` combining auth files (sidecar), API keys (local store), and Codex quota (projected telemetry).
- **Rules**:
  - Keep `provider` and `credentialSource` separate.
  - Uniqueness is by asset (e.g., `auth-file:<name>`).
  - Do not fetch accounts until sidecar is `ready`.
  - Reload from Wails after create/delete instead of hand-merging state.
  - `codex api key` lives in local storage under `~/.config/gettokens-data/codex-api-keys/`, not in `auth-dir`.
  - `AccountsPage` is route-only; heavy assembly lives under `frontend/src/features/accounts/`.
  - Feature-internal layering for `accounts` is:
    - `components/`
    - `hooks/`
    - `model/`
    - `tests/`
  - Do not re-introduce `helpers.ts`-style catch-all files. Split by responsibility such as config snippets, selectors, presentation, quota formatting, and actions.

## 2. Feature / Page Boundary
- **Pages**: `frontend/src/pages/*` should be route wrappers, not long-lived business implementation files.
- **Features**: Heavy page assembly, data loading, derived state, and mutation orchestration should live under `frontend/src/features/<domain>/`.
- **Migration Rule**:
  - First move the page body into `features/<domain>/<Domain>Feature.tsx`
  - Then shrink the page file to a thin prop-forwarding wrapper
  - Then split feature internals into `components / hooks / model / tests`
- **Current Baseline**:
  - `AccountsPage` -> `features/accounts/AccountsFeature.tsx`
  - `StatusPage` -> `features/status/StatusFeature.tsx`
  - `SettingsPage` -> `features/settings/SettingsFeature.tsx`

## 3. Relay Service Config Boundary
- **Model**: Relay service client keys are sidecar top-level `api-keys`, not upstream provider assets such as `codex-api-key`.
- **Rules**:
  - Never use account-pool `api-key` assets as the Status page relay key source.
  - Status/relay configuration must read and write sidecar `api-keys` through Wails + management API.
  - Relay key editing may be multi-value; preserve order, trim blanks, and deduplicate exact duplicates.
  - Relay endpoint previews should expose `localhost`, hostname, and LAN IP forms when available.
  - If relay config is meant for LAN clients, sidecar bind host must not be restricted to `127.0.0.1`.

## 4. Quota Rules
- **Path**: `AccountsPage` -> `GetCodexQuota` -> Wails -> `POST /v0/management/api-call`.
- **Logic**: CLIProxyAPI injects token via `auth_index` for target `chatgpt.com/backend-api/wham/usage`.
- **Debugging**: Verify both Wails debug events and CLIProxyAPI token resolution.
- **Time**: Relative reset countdown must use raw unix seconds (`resetAtUnix`). Do not re-parse `resetLabel` for countdown logic, because display labels lose seconds and drift into false `0s`.
- **Split Template**: When quota logic grows too large, prefer separating:
  - `types`
  - `auth parser`
  - `client`
  - `builder`
  - `debug`

## 5. Auth File Normalize & Status Surface Boundary
- **Normalize**: Legacy `codex` auth payloads must be normalized to the minimal sidecar-consumable shape, not persisted as “original payload plus patched fields”.
- **Minimal Fields**:
  - `type`
  - `access_token`
  - `id_token`
  - `refresh_token`
  - `account_id`
  - `email`
  - `plan_type`
- **Reuse**: Frontend sanitize/preview UI must call the same backend normalize entrypoint that import/upload uses. Do not fork normalization rules in the frontend.
- **Status Message**: Auth-file failure reasons come from sidecar `statusMessage` and must be preserved end-to-end:
  - sidecar auth file item
  - Wails DTO / account DTO
  - frontend `AccountRecord`
  - account card failed-state display
- **Display Rule**: Failed-state cards should show the failure reason inline. Do not force users into details modals for the first diagnostic hop.

## 6. UI System & Visual Thesis
- **Aesthetic**: Swiss-industrial (black/white/gray, thick borders, hard shadows, monospace).
- **Themes**: Support `system`, `light`, and `dark`. Ensure `--bg-main` and `--bg-surface` are distinct in dark mode.
- **l10n**: Add new copy to both `zh.json` and `en.json`. Default is Chinese.
- **Controls**: Use segmented controls for discrete settings.
- **Account Cards**: Account cards should support whole-card detail entry, but clicks originating from nested interactive controls (`button`, `input`, etc.) must not trigger the card-level detail action.

## 7. Frontend Debugging & Inspection
- **Tools**: Use `@linhey/react-debug-inspector` in `main.tsx` (dev-only).
- **Config**: Use `createViteDebugInspectorPlugin()` in `vite.config.js` for stable JSX metadata.
- **Workflow**: Prove handler -> bridge call -> backend response. Use `data-collaboration-id` for markers.

## 8. CLIProxyAPI Fork Maintenance
- **Remotes**: `origin` (linhay), `upstream` (router-for-me).
- **Workflow**: Sync upstream -> patch maintenance branch -> rebuild sidecar -> replace binary in `GetTokens.app`.
- **Binary**: Sidecar binary lives at `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`.

## 9. Build Metadata & Version Boundary
- **Rule**: Keep `Version` for updater comparison and release/tag semantics. Do not reuse it for UI-only date labels.
- **Display**: Use a separate `ReleaseLabel` for UI surfaces such as Sidebar build/version badges.
- **Format**: `ReleaseLabel` uses `YYYY.MM.DD.HH`.
- **Injection**: Inject `ReleaseLabel` at release build time via `-ldflags`, and keep the generation timezone explicit.
- **Fallback**: Development builds may derive a local fallback label in the frontend, but release builds must prefer the injected value.
- **Release Source**: The updater repo slug must match the actual published release repository.
- **Visibility**: `go-selfupdate` release checks are anonymous by default; a private GitHub repo will look like “no update available” to end users even if releases exist.

## 10. Go Large-File Split Heuristics
- **Goal**: Reduce mixed files that simultaneously hold external IO, parsing, business rules, DTO assembly, and debug formatting.
- **Preferred First Split**:
  - transport / client
  - parser / normalize
  - builder / mapper
  - debug / redaction
  - types / DTO
- **Sidecar Template**: For lifecycle-heavy files, first peel off:
  - `config`
  - `port`
  - `process_support`
- **Compatibility Rule**: Keep exported Wails and manager method signatures stable during the first split pass. Shrink internals first, then consider deeper API design changes in later passes.

## Acceptance Checklist
- Accounts and API keys survive restart and render correctly.
- UI maintains visual consistency and legibility across themes.
- Debug helpers are guarded by dev-only checks.
- CLIProxyAPI patches are committed to the fork and reflected in the runtime binary.
- Build metadata does not couple UI display labels to updater version comparison.
