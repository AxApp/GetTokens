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

### 3.1 Account Template Local CLI Apply
- **Scope**: Use this when account cards, vendor presets, or local CLI apply flows map an account template into Codex or Claude Code configuration.
- **Entry Rule**:
  - Account-card actions are intent launchers only. They may open a confirmation page/modal, but must not write local CLI files before the user confirms.
  - Only show Codex / Claude Code apply actions for official or verified template targets. Do not infer a Codex button from generic OpenAI-compatible capability alone.
  - DeepSeek is currently treated as a Claude Code-only official template target; do not show a Codex action unless a later verified template explicitly enables it.
- **Mapping Boundary**:
  - Keep template resolution in pure model code under `frontend/src/features/accounts/model/`, not inside `AccountCard`.
  - A single account has a fixed application mode from its source: Codex API key accounts use API key mode; Codex OAuth/auth-file accounts use OAuth mode. Do not offer an API key/OAuth toggle inside the confirmation page for one account.
  - Codex provider id should default to the user's current root `model_provider`; avoid forcing a stable provider id such as `gettokens` because existing Codex sessions may depend on the current provider.
- **Confirmation UI**:
  - Use a file-preview layout: left side target file list, right side selected file diff.
  - Avoid explanatory card stacks inside the modal. Keep summary metadata compact and make the file diff the primary content.
  - Modal height should stay stable when switching files; file tabs/list selection must not resize the shell.
- **Codex auth.json Semantics**:
  - API key mode writes the minimal Codex auth payload: `auth_mode=apikey` plus `OPENAI_API_KEY`. Clear OAuth `tokens`, flat token fields, refresh metadata, agent identity, and user metadata.
  - OAuth/auth-file mode writes `auth_mode=chatgpt` plus native nested `tokens`. If the source auth-file is sidecar-normalized into flat `access_token` / `id_token` / `refresh_token` fields, convert it back to Codex native nested tokens before writing.
  - Codex auth detection follows source behavior: explicit `auth_mode` wins; only when it is missing should `OPENAI_API_KEY` cause API key fallback.
  - For OAuth mode, provider config must not leave `env_key` or `experimental_bearer_token` values that would make Codex choose API key / relay token auth instead of ChatGPT OAuth.
- **Claude Code Settings Semantics**:
  - Only patch controlled `env` keys such as `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, and model family fields.
  - Preserve unrelated settings such as permissions, hooks, status line, MCP, and unknown fields.
- **Rendering Rule**:
  - Account groups should render available local data first. Do not block the full account list on slower per-account enrichment; update enrichment-dependent fields incrementally.

## 3.2 Codex Workspace & Local Config Surfaces
- **Codex Binary**: For Codex CLI binary version/source management, use the dedicated `gettokens-codex-binary-management` skill. Keep it as an independent binary-management business; do not merge it into account pool, local apply, usage, session, or routing flows.
- **Codex Account List**: For Codex account request order, route probing, OAuth/auth-file model aliasing, openai-compatible model mappings, and `#frame=codex&workspace=account-list`, use the dedicated `gettokens-codex-account-list` skill. Keep request order semantics in that skill: draggable account order is the test order, while allow/deny only filters candidates.
- **Codex Extensions**: For Codex Skills / MCP Servers, `[[skills.config]]`, `tk://github.com` / `tk://gitlab.com` skill sources, and `#frame=codex&workspace=skills|mcp-servers`, use the dedicated `gettokens-codex-extensions-management` skill. Keep source-accurate parsing, modal/list UI semantics, and cleanup split rules in that skill instead of expanding this general domain skill.
- **Browser Support**: New Codex workspace tabs must be usable in a normal browser preview when the interaction is layout/config-flow checkable. Do not let missing `window.go.main.App` make the page blank; provide explicit preview data and visible preview-only save behavior.
- **Frame URL Rule**: Modal/detail layers opened from Codex workspaces should preserve the frame hash, for example `#frame=codex&workspace=<key>&detail=<id>`, when the surrounding feature already follows frame/detail routing. Closing a modal should remove only the detail marker.
- **Wails Binding Boundary**: Any Wails-facing Codex method added under `internal/wailsapp` must also be exposed through root `app.go`, mirrored in root DTOs/mappers when needed, and regenerated into `frontend/wailsjs`. Frontend should import from generated bindings only after the root `main.App` method exists.
- **Raw + Structured Config Editors**:
  - If a page provides both a structured editor and a raw `config.toml` editor, saving either path must reload or resync the other path before showing success.
  - Browser preview raw editors should edit in-memory preview text and label the result as preview-only; desktop editors should read/write the real file through Wails.
  - Raw saves must not bypass structured validation for later structured edits. After raw save, re-read the parsed snapshot and surface TOML errors instead of keeping stale rows.
- **MCP Config Semantics**:
  - `[mcp_servers.<id>.tools.<tool>]` belongs to the parent server and must not be rendered as a separate server row.
  - `bearer_token` is not a valid Codex MCP field for saved config; prompt for `bearer_token_env_var` instead.
  - Preserve unknown fields and non-MCP config when patching a single server section.
- **Skills UI Semantics**:
  - Skills list rows should be whole-row detail entries. Nested toggles must stop propagation and stay semantically independent.
  - Skill detail is a modal/detail layer, not a permanent right column. Keep source/root/file metadata in the modal when the list row would otherwise become too dense.
  - Render `SKILL.md` with the existing safe Markdown stack (`react-markdown` + `rehype-sanitize`) after stripping front matter; do not inject raw HTML.

## 4. Quota Rules
- **Path**: `AccountsPage` -> `GetCodexQuota` -> Wails -> `POST /v0/management/api-call`.
- **Logic**: CLIProxyAPI injects token via `auth_index` for target `chatgpt.com/backend-api/wham/usage`.
- **Debugging**: Verify both Wails debug events and CLIProxyAPI token resolution.
- **Time**: Relative reset countdown must use raw unix seconds (`resetAtUnix`). Do not re-parse `resetLabel` for countdown logic, because display labels lose seconds and drift into false `0s`.
- **Quota Curl Template Boundary**:
  - Treat user-provided quota curl as a structured HTTP request template, not as a shell command to execute.
  - Keep shell operators blocked: pipes, redirects, multi-command separators, backticks, and `$()` remain parse errors.
  - Support known HTTP-shaping options directly: URL, method, headers, body, and cookie.
  - For unsupported but safe curl options, ignore the option and still attempt the request. Do not fail fast solely because the option is unknown.
  - Record ignored options on the parsed request. If the request succeeds, stay silent and allow save. If the request fails or the response cannot be parsed, append the ignored-option hint to the user-facing error so the user can debug the copied curl.
  - When saving an enabled quota curl from the account detail UI, preflight the current draft with `TestCodexAPIKeyQuotaCurl` before `UpdateCodexAPIKeyConfig`; save only after the test succeeds.
  - Do not promise full curl compatibility. Cookie jar files, `.netrc`, file upload, config files, proxy/TLS runtime behavior, and other curl-native features need explicit support before they are considered effective.
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
- **Professional Tooling Bias**: When a mature, domain-standard frontend tool directly solves a design-system, component-workbench, accessibility, visual-regression, or interaction-preview problem, recommend it explicitly even if it is outside the user's stated vocabulary. Do not default to self-building a weaker internal version just because it avoids a new tool.
- **Storybook Baseline**: For GetTokens design-system work, Storybook is the default primary component workbench. Use `@storybook/react-vite` for the current React + Vite stack. Keep any in-app `design-system` route as a discovery/entry page unless a later requirement explicitly needs production-embedded component previews.
- **Storybook Scope**:
  - Stories must render real components, not copied static HTML.
  - Stories must use mock data and must not call Wails bindings or sidecar APIs.
  - Load `frontend/src/style.css` and the relevant providers in Storybook preview so CSS variables, theme behavior, text scale, and localization are visible.
  - Start with `frontend/src/components/ui` and token stories before pulling in business-heavy account/Codex components.
  - Component stories must include an `Overview` story that shows key states in one page for design review and screenshot regression; keep single-state stories for isolated interaction debugging.
  - Component examples that are officially admitted into the design system must be wrapped with `DesignSystemStoryFrame`; this keeps the `data-design-system-component="true"` automation marker without drawing an admission border or corner label inside Storybook. Visible component framing belongs to project/product-page identification flows, not to the design system preview itself.
  - Project/runtime pages must mark admitted design-system component roots with `data-design-system-component="true"` and `data-design-system-component-name="<ComponentName>"`. In dev, App owns the `data-design-system-highlight="project"` scope and CSS draws the visible red outline there only; Storybook must not receive that project highlight scope.
  - Feature component收编必须循环执行：发现未纳入组件 -> 匹配现有设计系统组件/模式 -> 匹配不到则抽象或新建设计组件 -> 写 mock story + `Overview` + `DesignSystemStoryFrame` -> 运行 catalog/typecheck/Storybook 验收。
  - 每个 `frontend/src/features/*/components/**/*.tsx` 文件必须在 `componentManifest.ts` 中有收编决策：`admitted`、`candidate`、`deferred` 或 `excluded`。不得让新组件“沉默缺席”。
  - `admitted` feature component 必须同步进入 `storyCatalog.ts` 的 `feature-components` 分组，并记录 story path、Storybook title、mock data source 和 required states。
  - Keep Storybook dependency and generated config isolated to the frontend dev toolchain; it must not affect Wails runtime behavior.
- **Complex Workflow Screens**: When a flow/configuration page starts feeling complex, reduce the information architecture before adding more components:
  - put the final route/result summary first
  - keep the expanded editor to the fewest decision zones users must act on
  - hide proxy/route choices until the selected account can actually use them
  - remove duplicate “current configuration” KV panels when the path summary already carries the same truth
  - keep locators/debug metadata available, but visually subordinate to the main decision path
- **Action Selects**: For `select + right-side actions` patterns, use the project-level `frontend/src/components/ui/ActionSelect.tsx` instead of hand-rolling label/select/button grids. Keep `+` and optional delete actions inside the select frame so field widths align across sibling rows.
- **Status Local CLI Config**: In `StatusApplyLocalSection`, Codex and Claude Code tabs must share field components for equivalent concepts such as Relay API key, endpoint/base URL, provider, and model. Do not maintain parallel JSX just because one tab has fewer fields.
- **Codex Feature Config UI**: The local Codex `[features]` bool editor is a config list, not a data table. Each feature is one row with feature key as the title, stage as a compact tag before the subtitle, localized description as the subtitle, and the switch as the only bool value expression. Do not add duplicate `default/local/on/off` value labels when the switch already communicates the state. Do not force feature keys or descriptions to uppercase; preserve source and localization casing.
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
- **Canonical Upstream**: The desired upstream source of truth is `router-for-me/CLIProxyAPI`. Treat it as the project to track for upstream sync, compatibility checks, and release-tag comparison.
- **Remotes**: `upstream` = `router-for-me/CLIProxyAPI` (canonical upstream), `origin` = `AxApp/CLIProxyAPI` (maintained GetTokens fork), `linhay` = legacy fork backup.
- **GitHub Fork Lineage**: As of 2026-05-19, `AxApp/CLIProxyAPI` was rebuilt as a fresh fork of `router-for-me/CLIProxyAPI`; GitHub reports `parent=router-for-me/CLIProxyAPI` and `source=router-for-me/CLIProxyAPI`.
- **Legacy Backup**: The previous fork, whose immediate GitHub parent was `linhay/CLIProxyAPI`, was renamed to `AxApp/CLIProxyAPI-legacy-20260519`. Treat it as a backup only, not as the active release/build source.
- **Fork Boundary**: `AxApp/CLIProxyAPI#gettokens/sidecar` carries GetTokens runtime patches and is the source used for release sidecar builds. The older `gettokens/wham-token-fix` branch name was a historical artifact and has been removed from the active fork.
- **Codex Compatibility Ingress**: For OpenAI root-path compatibility needed by Codex-style clients, prefer centralized ingress normalization such as `/models` -> `/v1/models` and `/responses*` -> `/v1/responses*`. Do not scatter duplicate route handlers when a NoRoute rewrite can preserve the existing middleware and handler chain.
- **Responses Tool Conversion**: The generic Responses-to-Chat converter should accept both flat `function` tool payloads and nested `tools[].function` payloads, and skip invalid function tools without a name.
- **Reasoning Content Boundary**: Do not inject `reasoning_content` globally in the generic OpenAI Responses converter. Provider-specific response quirks belong in provider normalizers/executors such as the existing Kimi pattern.
- **Workflow**: Sync from canonical upstream -> patch maintenance branch -> rebuild sidecar -> replace binary in `GetTokens.app`.
- **Binary**: Sidecar binary lives at `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`.
- **Fork Commit Order**: When the fork changes, commit inside `docs-linhay/references/CLIProxyAPI` first, then commit the parent repository gitlink and rebuilt sidecar artifacts. Do not leave the parent pointing at an uncommitted fork state.
- **Rebuild Command**: After fork changes that affect runtime behavior, rebuild the local sidecar with `./scripts/ensure-sidecar.sh darwin arm64` before desktop or Proxyman acceptance.
- **Upstream Sync Closure**: For upstream merges, finish both repository layers: commit merge/fixes inside the fork, then commit the parent gitlink and memory/docs in GetTokens. If an amend or follow-up fork commit changes the fork HEAD, rerun `./scripts/ensure-sidecar.sh darwin arm64` and update the parent gitlink again.
- **Binary Artifact Hygiene**: Before deciding whether to commit an untracked file in `docs-linhay/references/CLIProxyAPI`, inspect it with `file`, `ls -lh`, `git ls-files`, and `git log --all -- <path>`. Large Mach-O/ELF/PE outputs such as `server` are local build artifacts; do not commit them. Add a narrow ignore rule in the fork `.gitignore` when the artifact repeatedly pollutes status.
- **Dirty Build Fingerprint**: `ensure-sidecar.sh` fingerprints tracked and untracked fork files. If the fork worktree is dirty or has unignored generated files, the sidecar meta will record a dirty fingerprint. Clean, commit, or intentionally ignore generated files before treating a sidecar rebuild as the final acceptance artifact.
- **System Proxy Coverage**: `use-system-proxy` must cover every sidecar egress path that can reach external services, not only the default HTTP transport. Include standard HTTP requests, management `api-call`, Codex WebSocket upstream connections, and Claude/uTLS-specific transports.
- **Proxy Priority**: Keep the runtime proxy order explicit: account-level `proxy-url` > global `proxy-url` > request/context roundtripper > `use-system-proxy` > direct. A configured `direct` route must bypass system proxy.

### 8.1 System Proxy / Proxyman Verification
- **When to use**: Use this flow when debugging whether local sidecar traffic can be captured by Proxyman or another macOS system proxy.
- **Proxy discovery**:
  - `proxyman-cli proxy-host` should report the active Proxyman host/port.
  - `scutil --proxy` should show matching HTTP and HTTPS proxy settings, usually `127.0.0.1:9090` in local testing.
- **A/B acceptance**:
  1. Clear Proxyman state with `proxyman-cli clear-session`.
  2. Apply sidecar config with `use-system-proxy: false`.
  3. Send a real HTTPS request through sidecar management `api-call`.
  4. Export a domain-filtered HAR with `proxyman-cli export-log --mode domains --domains <domain> --format har`.
  5. The OFF run should export no sidecar CONNECT entry for that domain.
  6. Repeat after applying `use-system-proxy: true`.
  7. The ON run must contain a `CONNECT` entry whose `_clientName` is `cli-proxy-api`.
- **Probe request**:
  ```bash
  curl -sS -X POST \
    -H 'Authorization: Bearer gettokens-local-management-key' \
    -H 'Content-Type: application/json' \
    --data '{"method":"GET","url":"https://www.example.com/?gettokens_proxy_probe=on"}' \
    http://127.0.0.1:18317/v0/management/api-call
  ```
- **HAR evidence**: Treat `_clientName=cli-proxy-api`, `method=CONNECT`, `status=200`, and `_clientBundlePath` pointing at the current `build/bin/cli-proxy-api` as the practical capture proof.
- **Cleanup**: Restore the dev sidecar config after the A/B run so later tests do not inherit a temporary proxy mode.

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
