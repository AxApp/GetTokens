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
  - `AccountsPage` is assembly-only; heavy UI lives under `frontend/src/pages/accounts/`, and data/actions live in hook modules.

## 2. Relay Service Config Boundary
- **Model**: Relay service client keys are sidecar top-level `api-keys`, not upstream provider assets such as `codex-api-key`.
- **Rules**:
  - Never use account-pool `api-key` assets as the Status page relay key source.
  - Status/relay configuration must read and write sidecar `api-keys` through Wails + management API.
  - Relay key editing may be multi-value; preserve order, trim blanks, and deduplicate exact duplicates.
  - Relay endpoint previews should expose `localhost`, hostname, and LAN IP forms when available.
  - If relay config is meant for LAN clients, sidecar bind host must not be restricted to `127.0.0.1`.

## 3. Quota Rules
- **Path**: `AccountsPage` -> `GetCodexQuota` -> Wails -> `POST /v0/management/api-call`.
- **Logic**: CLIProxyAPI injects token via `auth_index` for target `chatgpt.com/backend-api/wham/usage`.
- **Debugging**: Verify both Wails debug events and CLIProxyAPI token resolution.
- **Time**: Relative reset countdown must use raw unix seconds (`resetAtUnix`). Do not re-parse `resetLabel` for countdown logic, because display labels lose seconds and drift into false `0s`.

## 4. UI System & Visual Thesis
- **Aesthetic**: Swiss-industrial (black/white/gray, thick borders, hard shadows, monospace).
- **Themes**: Support `system`, `light`, and `dark`. Ensure `--bg-main` and `--bg-surface` are distinct in dark mode.
- **l10n**: Add new copy to both `zh.json` and `en.json`. Default is Chinese.
- **Controls**: Use segmented controls for discrete settings.

## 5. Frontend Debugging & Inspection
- **Tools**: Use `@linhey/react-debug-inspector` in `main.tsx` (dev-only).
- **Config**: Use `createViteDebugInspectorPlugin()` in `vite.config.js` for stable JSX metadata.
- **Workflow**: Prove handler -> bridge call -> backend response. Use `data-collaboration-id` for markers.

## 6. CLIProxyAPI Fork Maintenance
- **Remotes**: `origin` (linhay), `upstream` (router-for-me).
- **Workflow**: Sync upstream -> patch maintenance branch -> rebuild sidecar -> replace binary in `GetTokens.app`.
- **Binary**: Sidecar binary lives at `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`.

## 7. Build Metadata & Version Boundary
- **Rule**: Keep `Version` for updater comparison and release/tag semantics. Do not reuse it for UI-only date labels.
- **Display**: Use a separate `ReleaseLabel` for UI surfaces such as Sidebar build/version badges.
- **Format**: `ReleaseLabel` uses `YYYY.MM.DD.HH`.
- **Injection**: Inject `ReleaseLabel` at release build time via `-ldflags`, and keep the generation timezone explicit.
- **Fallback**: Development builds may derive a local fallback label in the frontend, but release builds must prefer the injected value.

## Acceptance Checklist
- Accounts and API keys survive restart and render correctly.
- UI maintains visual consistency and legibility across themes.
- Debug helpers are guarded by dev-only checks.
- CLIProxyAPI patches are committed to the fork and reflected in the runtime binary.
- Build metadata does not couple UI display labels to updater version comparison.
