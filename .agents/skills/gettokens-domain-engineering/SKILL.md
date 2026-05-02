---
name: gettokens-domain-engineering
description: GetTokens 领域工程：账号池、quota、UI 体系、调试与 CLIProxyAPI fork。
---

# GetTokens Domain & Engineering

This skill unifies the technical rules for building, styling, and debugging GetTokens.

## 1. Accounts Domain & Unified Inventory
- **Model**: Unified `AccountRecord` combining auth files (sidecar), API keys (local store), and Codex quota (projected telemetry).
- **Rules**:
  - Keep `provider` and `credentialSource` separate.
  - Uniqueness is by asset (e.g., `auth-file:<name>`).
  - `codex api key` records must prefer a persisted stable local id over a derived config fingerprint. Editing `apiKey / baseUrl / prefix` must not change the record id used by frontend selection, modal state, disable state, or rotation ordering.
  - Duplicate detection for `codex api key` still uses the normalized config identity (`apiKey + baseUrl + prefix`), even when the persisted record id is stable.
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
  - Account list filters must not be collapsed into a single enum once source and availability semantics diverge. Prefer a filter object such as:
    - `source`
    - `hasLongestQuota`
    - `errorsOnly`
  - Persist account-list filter preferences separately from ephemeral UI state. Persist filters; do not persist search drafts, modal open state, or bulk-selection state unless a later requirement explicitly needs that.

## 2. Feature / Page Boundary
- **Pages**: `frontend/src/pages/*` should be route wrappers, not long-lived business implementation files.
- **Features**: Heavy page assembly, data loading, derived state, and mutation orchestration should live under `frontend/src/features/<domain>/`.
- **Migration Rule**:
  - First move the page body into `features/<domain>/<Domain>Feature.tsx`
  - Then shrink the page file to a thin prop-forwarding wrapper
  - Then split feature internals into `components / hooks / model / tests`
- **Refactor Cadence for Large Features**:
  - When a feature is already live and the file is too large, do not jump straight into many tiny components.
  - Preferred reduction order is:
    1. keep the page working and stabilize the page shell + bridge/data loop first
    2. extract heavy view blocks into a dedicated view file
    3. extract copy/text factories and pure constants/helpers
    4. extract focused mutation hooks such as modal/editor flows
    5. extract data-loading hooks such as `snapshot` / `detail`
    6. only then consider a final view-state hook for selectors and derived UI state
  - The goal is to turn the main `*Feature.tsx` into a page controller instead of a second catch-all file.
- **Session Management Baseline**:
  - For Wails-backed workbench pages like `session-management`, the stable split target is:
    - `*Feature.tsx` -> page controller
    - `*View.tsx` -> business presentation blocks
    - `*Copy.ts` -> copy factory
    - `*Utils.ts` -> pure constants/helpers
    - `use*Snapshot` / `use*Detail` / `use*Mutation` -> focused async hooks
  - If the page also has browser-dev fallback data or dev bridge logic, keep that outside the controller and do not mix it back into JSX-heavy files.
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
  - “Apply to local Codex” is a local workbench flow, not a sidecar truth editor:
    - `provider / model / reasoning effort` are local Codex defaults for future sessions
    - provider options should merge the page-local options with existing `[model_providers.*]` read from `~/.codex/config.toml`
    - model options should prefer aggregated account-pool catalogs, and only fall back to `~/.codex/models_cache.json` when the aggregated result is empty
  - Writing local Codex config must be preservative:
    - `config.toml` uses minimal text patch updates for owned keys
    - `auth.json` uses field-level merge
    - do not rewrite the whole file and destroy user ordering, comments, or unknown fields

## 4. Quota Rules
- **Path**: `AccountsPage` -> `GetCodexQuota` -> Wails -> `POST /v0/management/api-call`.
- **Logic**: CLIProxyAPI injects token via `auth_index` for target `chatgpt.com/backend-api/wham/usage`.
- **Debugging**: Verify both Wails debug events and CLIProxyAPI token resolution.
- **Time**: Relative reset countdown must use raw unix seconds (`resetAtUnix`). Do not re-parse `resetLabel` for countdown logic, because display labels lose seconds and drift into false `0s`.
- **Filter Semantics**:
  - “Only with longest quota” applies only to `auth-file + codex` assets.
  - If a quota has one window, that window is the longest window.
  - If a quota has multiple windows, prefer `weekly / *-weekly`; otherwise fall back to the last displayed window.
  - Only keep the account when that chosen window has `remainingPercent > 0`.
  - Treat `loading / error / empty / no window` as not satisfying this filter, not as a separate success case.
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
- **Action Selects**: For `select + right-side actions` patterns, use the project-level `frontend/src/components/ui/ActionSelect.tsx` instead of hand-rolling label/select/button grids. Keep `+` and optional delete actions inside the select frame so field widths align across sibling rows.
- **Status Local CLI Config**: In `StatusApplyLocalSection`, Codex and Claude Code tabs must share field components for equivalent concepts such as Relay API key, endpoint/base URL, provider, and model. Do not maintain parallel JSX just because one tab has fewer fields.
- **Account Cards**: Account cards should support whole-card detail entry, but clicks originating from nested interactive controls (`button`, `input`, etc.) must not trigger the card-level detail action.
- **Rotation Cards**: `AccountRotationModal` is a variant of the account card, not a second visual system. Reuse the account-card content hierarchy and only replace the bottom action strip plus rotation-only affordances such as rank rail and drag marker.
- **Rotation Disable Semantics**:
  - Disabled accounts stay in the saved rotation order.
  - Disabled accounts do not participate in runtime rotation.
  - The unified disable entrypoint is `SetAccountDisabled`, which must cover `auth-file`, `codex-api-key`, and `openai-compatible` assets consistently across cards, modal, and workspace views.

## 7. Frontend Debugging & Inspection
- **Tools**: Use `@linhey/react-debug-inspector` in `main.tsx` (dev-only).
- **Config**: Use `createViteDebugInspectorPlugin()` in `vite.config.js` for stable JSX metadata.
- **Workflow**: Prove handler -> bridge call -> backend response. Use `data-collaboration-id` for markers.
- **Overlay Rule**: When a dropdown, listbox, or popover inside a card “has DOM but is not visible”, inspect the full ancestor `overflow` chain before touching `z-index`. In Status/Settings style panels, `overflow-hidden` on the owning card is the first suspect.
- **Chart Layering Rule**: For charts that mix `svg` paths/areas with HTML point labels or hit targets, all layers must share the same width coordinate system. Do not let `svg` scale to container width while HTML points still use the original logical width.
- **Chart Verification Rule**: For visual fixes in `UsageDesk` or similar chart-heavy surfaces, static code reasoning is not sufficient. Re-open the real page, switch the relevant time ranges, and keep traceable screenshots under the owning `space/screenshots/` directory before claiming the fix is live.
- **Status Surface Verification Rule**: For browser-checkable Wails surfaces such as `#frame=status` or `#frame=session-management`, use `bb-browser` to verify the real rendered interaction and keep acceptance screenshots under `docs-linhay/screenshots/<date>/<module>/` when the fix is visual or interaction-sensitive.

## 8. CLIProxyAPI Fork Maintenance
- **Remotes**: `origin` (AxApp), `linhay` (legacy fork backup), `upstream` (router-for-me).
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
