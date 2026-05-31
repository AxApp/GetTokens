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
  - User-created or copied `codex api key` records may share the same normalized config identity (`apiKey + baseUrl + prefix`). Treat each persisted `local-id` as a separate editable account asset; store files should be keyed by `local-id` so duplicates do not overwrite each other.
  - Legacy sidecar mirror data without `local-id` may still be deduplicated against a stored local record with the same normalized config identity to avoid reintroducing the historical double-card bug.
  - Account-card copy/import must copy a structured account payload, not just a display name. The payload should round-trip all supported asset classes: `auth-file`, `codex-api-key`, and `openai-compatible`.
  - Account-card clipboard writes must tolerate browser preview and Wails permission differences. Prefer a shared clipboard helper with DOM copy, Web Clipboard, Wails runtime, and app-local fallback paths instead of calling `navigator.clipboard.writeText` directly from card components.
  - Copied account imports create a new editable asset even when the underlying config is identical. When the imported title/provider/file name already exists, append user-facing numeric suffixes from ` #2` onward; do not use `-copy` style suffixes. For auth-file imports, preserve `.json` after the numbered title, such as `codex-auth #2.json`.
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
  - Account list filters must not be collapsed into a single enum once source and availability semantics diverge. For account list and Codex account order filters, use AND-style requirement fields instead of a single `availability` enum or `*Only` compatibility fields:
    - `source`
    - `requiresRequestable`
    - `requiresBlocked`
    - `requiresDisabled`
    - `hasBalance`
    - `hasLongestQuota`
    - `requiresError`
  - Keep disabled and error/unavailable filters separate. A manually disabled account is route-excluded by user intent, while an error/unavailable account needs diagnostic attention.
  - Persist account-list filter preferences separately from ephemeral UI state. Persist filters; do not persist search drafts, modal open state, or bulk-selection state unless a later requirement explicitly needs that.
  - Account plan is runtime data, not a fixed frontend enum. Account list grouping, badges, and plan filters must aggregate plan keys from `AccountRecord.planType` and quota `planType`; new values such as `team`, `enterprise`, `billing`, or provider-specific plan keys must form their own groups/options instead of falling into unknown merely because the frontend has not hard-coded them. Old all-selected plan filter state should not hide newly discovered plan keys.
  - Account-list bulk selection actions should render as one sticky workbench toolbar, not as a nested card or dashed sub-section. High-frequency actions can stay inline; secondary actions should collapse into a menu only when measured available width is insufficient, using a small pure layout predicate plus browser scroll checks that prove no top blank band leaks account cards through the sticky area.
  - When simplifying an account detail surface, reduce repeated information before shrinking individual controls. Prefer these orderings:
    1. remove duplicated summary fields that already appear in a dedicated section below
    2. reuse shared primitives such as `QuotaBars`, compact stat strips, and embedded-label inputs instead of inventing detail-only variants
    3. keep deep-link restoration and detail hash behavior intact while changing layout
    4. lock the new density with focused tests that assert structure, module ordering, and route restoration
  - For account detail surfaces, keep top-of-page runtime summaries limited to live operational signals. Quota, balance, raw auth content, and export/route controls should live in their own sections rather than repeating in the runtime strip.
  - Detail modals backed by frame hash state must update their local detail state synchronously when opening or closing before relying on `hashchange`. If close only clears `selectedAccount` while the old `detail` value is still in local state, the hydration effect can reopen the modal and make the close button require two clicks.

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
  - Codex API key mode must write the currently selected account asset (`AccountRecord.apiKey` plus the matched source format base URL), not the GetTokens relay key or relay endpoint. Missing relay keys must not disable this path.
  - Claude Code local apply still writes the GetTokens relay key and relay endpoint. Do not reuse the Codex API key direct-write rule for Claude Code unless a later verified direct-upstream mode is explicitly designed.
  - When a Codex API key account is passed through `ApplyRelayServiceConfigToLocalV2`, mark it so relay key metadata is not updated; account-pool secrets must not be recorded as relay service key last-used metadata.
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
- **Codex Account List / Channel Routing**: For Codex account request order, route probing, OAuth/auth-file model aliasing, openai-compatible model mappings, channel route mode, and `#frame=codex&workspace=account-list`, use the dedicated `gettokens-codex-account-list` skill. In the Account Routing Engine rollout, Codex account list is the Codex Channel Routing workspace: channel order, route mode, channel group state, dry-run/explain, and probe are Codex-owned channel config, not global account inventory priority. Current channel route mode is two-mode only: `sequential / balanced`; `project`, `projectBindings`, `projectModeFallbackRouteMode`, `fallbackMode`, and upstream compat route modes such as `weighted / canary` are removed from Channel Routing save/execute/UI paths.
- **Channel Routing Source of Truth**: For Codex / Claude runtime routing, `~/.config/gettokens-data/channel-routing/config.json` is the main decision source. Treat sidecar `routing.strategy` in `~/.config/gettokens/config.yaml` as legacy relay/config compatibility only; it must not drive Codex / Claude candidate ordering once channel routing is configured. The CLIProxyAPI fork should install GetTokens channel routing as a pool-scope route policy before legacy selectors, and balanced mode should read active-session counts from the live-session tracker instead of a display snapshot.
- **Codex Extensions**: For Codex Skills / MCP Servers, `[[skills.config]]`, `tk://github.com` / `tk://gitlab.com` skill sources, and `#frame=codex&workspace=skills|mcp-servers`, use the dedicated `gettokens-codex-extensions-management` skill. Keep source-accurate parsing, modal/list UI semantics, and cleanup split rules in that skill instead of expanding this general domain skill.
- **Claude Code Workspace Parity**: When Claude Code adds a capability that corresponds to existing Codex workspace entries, keep the workspace granularity aligned with Codex unless Claude semantics clearly require a different information architecture.
  - If Codex exposes separate workspaces such as `#frame=codex&workspace=skills` and `#frame=codex&workspace=mcp-servers`, Claude should expose separate workspaces such as `#frame=claude&workspace=skills` and `#frame=claude&workspace=mcp-servers`, not a single merged page with internal tabs.
  - Claude skills read-only scanning must include both native Claude roots (`$CLAUDE_CONFIG_DIR/skills` or `~/.claude/skills`, plus project `.claude/skills`) and unified Agent Skills roots (`~/.agents/skills`, plus project `.agents/skills`). GetTokens installs project skills under `.agents/skills`, so scanning only `.claude/skills` produces a false empty state.
  - Implement this split as route-level feature components, for example `ClaudeCodeSkillsWorkspace` and `ClaudeCodeMcpServersWorkspace`, with the page wrapper only dispatching by `ClaudeWorkspace`.
  - Shared shells and visual primitives are still encouraged. Reuse `AssetWorkbenchShell`, preview data, DTO mappers, and list patterns where they fit, but do not let shared UI collapse distinct navigation surfaces into one tabbed page.
  - Keep legacy hash/storage compatibility explicit. A retired merged workspace such as `extensions` may migrate to the safest default (`skills`), but should not remain a first-class menu item once split pages exist.
  - Page-internal segmented controls should represent local field choices such as MCP transport, filters, or modes; they should not be used as replacement navigation for top-level or second-level workspaces that already exist in the sidebar.
- **Usage Desk Local Projection**:
  - Treat local file projection as a provider-specific data source, not a generic Codex-only feature. Each provider needs its own backend reader, runtime cache, progress events, root Wails binding, generated frontend binding, preview payload, and frontend source switching.
  - Claude Code local usage projection reads `CLAUDE_CONFIG_DIR || ~/.claude` under `projects/**/*.jsonl` only. It is read-only: never write, delete, compress, rename, or rewrite Claude native session files.
  - Claude Code projection must skip `subagents/agent-*` sidechain files and parse only assistant envelopes with `message.usage`; do not return prompt text, tool input, message body, credentials, emails, or raw content.
  - For streaming Claude Code assistant rows, dedupe by `message.id`. Keep the final row with non-empty `message.stop_reason`; if multiple comparable rows exist, keep the one with the larger `output_tokens`. Skip unfinished rows with empty `stop_reason` or `output_tokens=0`.
  - Token mapping is `input_tokens + cache_creation_input_tokens`, `cache_read_input_tokens || cached_input_tokens`, and `output_tokens`.
  - Frontend Usage Desk rendering must branch by `source === 'observed'` vs `source === 'projected'`, not by workspace. A workspace-specific override such as `workspace === 'claude'` inside the observed branch can make a projected button visually selected while still rendering observed data.
  - `usage-local:*` events must carry and filter `provider`, so Codex rollout projection and Claude session projection do not overwrite each other's page state.
  - Verification for this class of change must include fixture tests, generated binding assertions, preview projected rows, and a real local-file sanity check that reports counts/totals without reading or printing sensitive message content.
- **Session Management Local Files**:
  - Treat `~/.codex/sessions`, `~/.codex/archived_sessions`, and `~/.claude/projects` as potentially multi-GB local stores. Never make page entry depend on synchronous full-file parsing when a bounded snapshot or stale cache can satisfy the first paint.
  - Snapshot/list APIs should return summaries only. Do not carry full message bodies, raw tool payloads, or per-message `content` through snapshot DTOs.
  - Detail APIs used by the UI must be payload-bounded. Keep full parsing inside backend-only analysis paths when needed, but UI detail responses should prefer summary rows, cap message count, and avoid returning full `content` unless a scoped requirement explicitly needs it.
  - If the UI needs full session-detail visibility, split metadata from messages. `Get*SessionDetail` should return only metadata/counts, while a separate message-page API reads JSONL line windows (`offset / limit`) and stops after the current page plus one lookahead row for `hasMore`. Frontend detail views should append pages on demand and render only the loaded window.
  - Raw JSONL inspection must be per-message and on demand. Message-page DTOs may carry a source `lineNumber`, but raw JSON should be fetched through a separate line-read API only after explicit user interaction, never bundled into list/detail/page payloads.
  - Any in-process cache for session details must have both entry-count and approximate-byte limits. Oversized details should use disk cache only, not stay resident in `App`.
  - Disk caches must invalidate by file fingerprint such as size plus mtime. Do not use session id alone as a cache key for mutable JSONL files.
  - Regression coverage for this class should include cache hit, stale-cache invalidation, payload compaction, memory-bound eviction, and at least one live benchmark path gated by an explicit environment variable so CI never reads a developer's real sessions.
- **Codex Live Sessions**: For `#frame=codex&workspace=live-sessions`, treat the feature as runtime observability, not local session-file management. Use this when surfacing in-flight request/session state from CLIProxyAPI.
  - Data ownership starts in the CLIProxyAPI fork. Add an in-memory runtime tracker and a read-only management endpoint first; then expose it through `internal/wailsapp`, root `main.App`, generated `frontend/wailsjs`, and finally the React feature.
  - Keep the UI read-only. Do not add request cancel, replay, forced WebSocket recovery, or full payload display unless a later requirement explicitly scopes the action and safety model.
  - Default list rows should stay low-noise. Show only the operator-facing identity pair requested for the feed: project name plus `account / http|ws`, with the session id as a right-aligned secondary action. Keep status, model, timing, request ids, execution ids, and redacted diagnostics in detail panes.
  - If a feed row exposes session-id copy, make it an independent click target that stops row-selection propagation. A successful click must provide visible feedback such as `已复制` / `Copied` rather than relying on a title change or silent clipboard write.
  - Timeline rows inside the detail pane should still be scan-friendly. Compress each row to one line, prefer short request ids / short clock times, and surface only the core timing metrics first (`total`, `TTFT`, `first token`). Treat secondary gap / stream metrics as secondary-width affordances, not as mandatory first-line content.
  - The detail shell and filter shell are workbench surfaces, not nested cards. Avoid stacking a second `border + shadow` card around the timeline, the filter bar, or the detail root unless a later design system rule explicitly requires that shell.
  - Long live-session detail panes should scroll inside the detail column, not by growing the whole workbench page. On wide layouts, keep the detail column sticky, cap it to the viewport, use `overflow-y-auto`, and set overscroll containment so chart/timeline inspection does not roll the page header away.
  - `projectName` is a display label owned by the CLIProxyAPI live tracker. The sidecar may enrich it from trusted local Codex session metadata (`CODEX_HOME || ~/.codex` session JSONL) before returning the live snapshot; GetTokens should only pass the optional DTO field through Wails/root bindings/frontend model and fall back to an explicit unknown-project label when absent. Do not add Wails/frontend compatibility lookup for old sidecars unless a later requirement explicitly reintroduces compatibility.
  - Account resource surfaces inside live-session details should reuse accounts-domain components such as `QuotaBars` and `BillingBalance`. Add a small adapter from live request `quota` / `billing` DTOs into account display shapes instead of copying quota or balance JSX into live sessions.
  - Never display raw request/response payloads, credentials, bearer tokens, cookies, or unredacted error bodies. Diagnostic copy must be redacted and bounded.
  - When correlating WebSocket and HTTP usage, preserve request ids through context. Usage hooks should update an existing WebSocket request when the request id is known, not create a duplicate HTTP-only session.
  - When trimming live-session memory, distinguish realtime snapshot retention from historical retention. The in-memory tracker may cap session/request maps for RSS control, but historical request data must be written to a disk-backed ledger before it can be trimmed from memory.
  - Snapshot cleanup endpoints such as `DELETE /v0/management/gettokens/live-sessions` clear only realtime memory state by default. Disk history cleanup requires a separately scoped API with explicit filters/retention semantics; do not reuse memory prune to delete history.
  - Live-session history endpoints should be paginated from disk (`limit / offset / window / session_id`) and must not rebuild the old unbounded in-memory details list.
  - Treat Codex upstream HTTP fallback as an observable sticky state. GetTokens may infer and explain the fallback, but must not promise transparent recovery to WebSocket after Codex has already downgraded.
  - The frontend must support browser preview with mock snapshots, while desktop mode polls the real Wails snapshot. Show source state such as `live`, `cache`, or `preview` so stale sidecar state is not mistaken for no sessions.
  - Live-session refresh should use structural snapshot merging instead of replacing the whole React snapshot on every poll. Ignore clock-only changes such as `generatedAt`, preview/cache timestamps, active session duration, and active request streaming duration when the underlying sessions/requests did not change. Reuse unchanged session and request object references so the feed, selection, and detail pane do not flicker during polling.
  - Browser preview/cache detail polling should not rewrite detail state every second just to advance time. Let charts project the current active request through explicit `nowMs` model options, and keep detail/history state updates for real structural changes.
  - Request timing trend charts must be driven by request records, not decorative UI state. Put trend derivation in a pure model under `features/codex-live-sessions/model/`, merge the active request by `requestID`, sort points by `startedAt`, and accept an explicit `nowMs` option so live requests can be projected in tests.
  - For streaming / active / reconnecting requests without `completedAt`, project `totalDurationMs` from `nowMs - startedAt` with a bounded safety cap. Do not mutate the original request or invent first-event / first-token timings.
  - Only the current active request is allowed to use `nowMs - startedAt` projection in the timing trend. Historical request rows that still carry `streaming` / `reconnecting` from cache or stale sidecar state must keep their recorded `timing.totalDurationMs` or `completedAt - startedAt`; otherwise every total-duration point will grow together.
  - Live request `sequence` is a sidecar-owned lifecycle counter inside one Codex conversation/session. Memory retention may cap the retained request map, but pruning must only delete old requests; it must not renumber retained requests back to `1..50`. When a long session keeps only 50 requests, the first retained request may legitimately be `#6` and the newest `#55`.
  - Trend chart x positions should read as request sequence, not timestamp spacing. Keep request records sorted by `startedAt`, then render the visible slice as dense equal-step bars with `#sequence` as the x-axis label; do not stretch sparse requests across real elapsed gaps.
  - Trend chart data window is a fixed count cap, not a fixed time window. Keep only the latest capped request points for the chart model, so new requests push the sequence labels forward (`#50` -> `#51` -> `#52`) while the visible data volume remains bounded.
  - Trend chart viewport should be a fixed, non-scrollable audio waveform chart. The visible request count is width-driven: wider surfaces show more recent request bars, narrower surfaces show fewer, and the latest request stays anchored near the right edge. Do not reintroduce horizontal panning or auto-scroll follow logic.
  - The timing metric picker below the chart summarizes the same trend window. Show average values for `total / TTFT / first token / stream / queue / auth select / connect / gaps / rates` rather than echoing the latest single request; keep latest-request values in the timeline rows and chart footer.
  - The timing metric picker should prefer the sidecar session-level `timingSummary` when present. Treat `timingSummary.window=retained_requests` as the authoritative average window, show `sampleCount` plus `sequenceFrom / sequenceTo`, and mark the UI as `Sidecar summary`. Only use frontend request-window averaging as a fallback for old sidecars or preview data without summary, and label that path as a local estimate.
  - Sidecar `timingSummary` must not let stale historical streaming/reconnecting requests grow on every snapshot. Only the current active request may project `totalDurationMs` from the sidecar summary generation time; first-event and first-token fields must remain absent until observed.
  - Keep the live-session chart visually inside the page section, not as a nested card. Use the existing Swiss-industrial chart tokens, footer summaries below the graph, and live markers such as dashed strokes/rings for in-flight samples.
  - Request timing trend visuals should read like a forward-moving audio waveform, not a finance line, ECG trace, or candlestick chart. Render exactly one centered vertical amplitude bar per request for the selected timing metric; longer durations produce taller bars, and live rings distinguish in-flight samples.
  - Timing trend motion should not redraw the full waveform on every live refresh. Keep bars steady; use a short opacity settle only when switching metrics and a subtle breathing ring on the live sample to indicate activity.
  - The request timeline inside the detail pane is a recent-scan surface, not the full history list. Render only the latest 15 sorted request rows and keep the visible row count aligned with that cap; rely on history/detail data for deeper inspection.
  - Browser preview data for timing charts must include multiple completed requests plus one in-flight request, so `#frame=codex&workspace=live-sessions` exercises curve shape, latest sample footer, and live marker behavior without a Wails runtime. For layout/density bugs, synthesize the edge cardinality that caused the issue, such as 50 retained requests with the latest live request at `#50`; do not accept a 3-5 request preview as proof for long-session chart fixes.
  - Browser preview timing data must behave like real request history, not like a decorative animation. Completed preview requests should derive timings from stable request identity such as `sequence`, not from the current visible-window index, so the same request keeps the same timing values across refreshes and rolling-window shifts.
  - Preview live samples may update only the active/latest request. Keep completed bars stable across consecutive preview refreshes, include occasional completed slow-request spikes to keep the chart scale realistic, and verify in browser/DOM that after a short wait only the live sample geometry changes.
  - Do not let preview live elapsed duration become the chart's moving maximum every second. If live growth changes the global chart scale, all historical waveform bars appear to move, which violates the "steady bars + subtle live ring" contract.
  - Regression coverage for this class should include pure trend model tests, source-structure tests for live refresh / request-sequence bar x-axis, preview multi-sample or edge-cardinality assertions, `typecheck`, `build`, focused `model.test.mjs`, and at least one browser/DevTools DOM or screenshot check that the chart renders nonblank and has no label overflow, x-axis label overlap, or live-ring clipping.
- **Account Route Guard & WebSocket Hot Switch**:
  - Route selection is not payload shaping. For same-schema upstream requests, preserve client payload fields by default and only apply narrowly necessary mutations such as resolved model normalization, auth/connection headers, internal transport flags, explicit payload config rules, or cross-account transcript replay cleanup. Strategy routing must answer "which account handles this request", not silently remove fields like `previous_response_id`, `prompt_cache_retention`, `safety_identifier`, `stream_options`, `metadata`, or unknown future Responses fields.
  - Treat manual disable and automatic rate-limit blocking as the same routing-domain condition: an account must not participate in new candidate selection.
  - Use `AccountRouteGuardStore` source aggregation for guard state. Keep sources independent, such as `manual-disabled` and `rate-limit`, so automatic recovery never clears a user manual disable.
  - Rate-limit rule writes are account-card scoped. New rules must use `acct_*` `account_key`; legacy keys such as `auth-file:*`, `codex-api-key:*`, and `openai-compatible:*` are migration/history inputs, not new rate-limit binding keys.
  - Rate-limit management writes must not return success until runtime guard evaluation has completed. If the post-write evaluation fails and no explicit degraded/stale DTO is designed, roll back the just-written DB change and return a visible error rather than leaving hidden side effects.
  - Serialize full and account-scoped rate-limit evaluations. A periodic reconcile must not race with a usage-triggered account refresh and later write stale `rate-limit` guard state back over newer decisions.
  - Keep SQLite event persistence out of evaluator state locks. Refresh in-memory evaluator state and route guard first, then persist block events so route/status reads are not blocked by event I/O.
  - Request-window rate-limit is an admission problem, not a Gin middleware problem. Reserve only after a single auth has been selected and before executing the request; if reservation fails, deny that auth for the current request and let selector/retry fallback.
  - Request-window reservation usage must count both completed usage events and active `pending / committed` reservations. Success commits the reservation until usage attribution releases it by `request_id + account_key`; failure/cancel releases it, and reconcile expires orphan reservations.
  - When moving admission later than selection, preserve retry loop semantics: auths with no executable model still must be marked `tried`, otherwise alias/model-pool fallbacks can repeatedly select the same unusable auth.
  - Codex API key manual disable must survive every layer: GetTokens local store -> management `codex-api-key` config payload -> CLIProxyAPI `config.CodexKey.Disabled` -> synthesized runtime auth `Disabled=true` / `StatusDisabled` -> `manual-disabled` route guard. If changing Codex order appears to fix a disabled account, suspect the disabled flag was dropped before runtime auth synthesis.
  - Enforce guard state through `RoutePolicy` deny decisions on the hot path. Do not add Gin middleware that returns 429 in the middle of a request when selector fallback can route to another account.
  - Route-policy explain must include active guard source details, not only a generic account-route-guard reason. A filtered route trace should let operators distinguish `manual-disabled`, `rate-limit`, `auth-error`, `upstream-rate-limit`, and `upstream-error`.
  - For Codex WebSocket, candidate filtering alone is insufficient because downstream sessions may hold `pinnedAuthID` and an upstream connection. Add WebSocket-specific session control at request boundaries.
  - P0 behavior may close affected upstream sessions immediately when an auth is disabled. P2 behavior should preserve the downstream WebSocket and switch at the next downstream request boundary.
  - At the P2 boundary, check whether the current pinned auth is guarded before request normalization. If guarded, release the pin, close the old execution session upstream resource, force full transcript replay, and let AuthManager select again.
  - WebSocket request-boundary releases must stay explainable: return or log the active guard `source` and `reason`, and write the guard release into the websocket timeline/request trace so `rate-limit` and `manual-disabled` releases are distinguishable after the fact.
  - For pinned Codex WebSocket 401/402/403/429 errors before any downstream payload has been written, suppress the error event, release the pin, close the execution session, rebuild the request as full transcript replay, and retry the same downstream request so the user-visible turn can switch accounts. Once any payload was written, keep the no-mid-response-migration boundary.
  - The Codex WebSocket executor must not reuse a session connection across different `authID` or `wsURL`. When either changes, close the old upstream connection with an explicit reason such as `auth_rotated` and re-handshake.
  - Do not promise mid-response account migration. Switching during an actively streaming response is a cancel/replay feature and needs a separate safety design.
  - Rate-limit status DTOs should expose sidecar-owned explain fields through every bridge layer: active sources, rule id, strategy/window, current usage, limit, window start/end, next reset, last evaluated time, stale, and degraded reason. The frontend may render these fields but must not recompute blocked state locally.
  - Required tests for this class of change: route guard source independence, route guard active source detail lookup, rate-limit source refresh, management rollback on evaluation failure, evaluator serialization, manual disable service hook, rate-limit status explain DTO, pinned auth release after guard block, pinned auth release source/reason timeline, pre-payload pinned quota failover retries the same request, no stale `previous_response_id` after failover, and same-session upstream re-handshake when auth changes.
- **Browser Support**: New Codex workspace tabs must be usable in a normal browser preview when the interaction is layout/config-flow checkable. Do not let missing `window.go.main.App` make the page blank; provide explicit preview data and visible preview-only save behavior.
- **Frame URL Rule**: Modal/detail layers opened from Codex workspaces should preserve the frame hash, for example `#frame=codex&workspace=<key>&detail=<id>`, when the surrounding feature already follows frame/detail routing. Closing a modal should remove only the detail marker.
- **Wails Binding Boundary**: Any Wails-facing Codex method added under `internal/wailsapp` must also be exposed through root `app.go`, mirrored in root DTOs/mappers when needed, and regenerated into `frontend/wailsjs`. Frontend should import from generated bindings only after the root `main.App` method exists.
- **Raw + Structured Config Editors**:
  - If a page provides both a structured editor and a raw `config.toml` editor, saving either path must reload or resync the other path before showing success.
  - Browser preview raw editors should edit in-memory preview text and label the result as preview-only; desktop editors should read/write the real file through Wails.
  - Raw saves must not bypass structured validation for later structured edits. After raw save, re-read the parsed snapshot and surface TOML errors instead of keeping stale rows.
  - For schema-backed `config.toml` pages, do not leave complex TOML tables permanently read-only just because they lack a fine-grained form. Use a raw TOML textarea for complex paths such as `features.multi_agent_v2`, `notice.model_migrations`, `mcp_servers`, `skills`, `projects`, `profiles`, and provider `auth/http_headers/query_params`.
  - Path-scoped raw TOML writes must validate every `[section]` / `[[section]]` header before saving. The header must match the target path or one of its child paths, for example `skills` may write `[skills...]` / `[[skills...]]`, while `model_providers.gettokens.auth` may write only that provider auth subtree.
  - Raw TOML section replacement must preserve unrelated config, comments, and ordering outside the target path. Do not rewrite the whole file or allow one textarea to replace sibling sections.
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
- **Token Progress Display Boundary**:
  - Quota window token counts are first-class quota telemetry. When an upstream or custom quota response exposes `used / limit / remaining` token counts, preserve them as `usedTokens / limitTokens / remainingTokens` through every layer: accounts domain parser -> `internal/wailsapp` DTO -> root `main.App` DTO/mappers -> generated `frontend/wailsjs` -> `QuotaDisplay`.
  - `remainingPercent` remains the default account-card display and longest-quota filter input. Token progress is an additional display mode, not a replacement for quota remaining semantics.
  - `QuotaBars` may let users click the quota value to toggle percent and token progress when `usedTokens + limitTokens` are available. The toggle target must be an interactive child that stops propagation so whole-card detail entry is not triggered.
  - If token counts are absent, keep the existing percent-only UI. Do not invent token totals from percentage-only ChatGPT quota windows.
  - Regression coverage for this class should include parser-level token count preservation, Wails/root DTO mapping preservation, frontend `QuotaDisplay` normalization, and account-card interaction structure.
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
- **CPA Auto-Convert**:
  - When importing or uploading ChatGPT Web session, 9router Codex OAuth, or other session-like Codex OAuth payloads, put detection and conversion in `internal/accounts.NormalizeAuthFileForSidecar`.
  - Upload, paste/import, and detail normalize paths must share the backend normalize entrypoint. Do not duplicate access-token/session-token/id-token conversion in frontend model code.
  - Convert supported session-like payloads to CPA / sidecar-compatible `type: "codex"` JSON before posting to CLIProxyAPI auth-files.
  - If the source lacks a real `id_token` but has enough account identity, generate a synthetic JWT with `https://api.openai.com/auth` claims so downstream profile/quota parsers can still infer `chatgpt_account_id` and `chatgpt_plan_type`.
  - Unknown JSON must not be force-converted. Preserve existing upload behavior unless the payload has an OAuth access token plus account identity signal such as email, account id, or user id.
  - Regression tests for this class must cover ChatGPT Web session, 9router OAuth, existing CPA/Codex auth JSON, unknown JSON, and the Wails upload multipart path.
- **Minimal Fields**:
  - `type`
  - `access_token`
  - `id_token`
  - `refresh_token`
  - `session_token`
  - `account_id`
  - `chatgpt_account_id`
  - `email`
  - `plan_type`
  - `chatgpt_plan_type`
  - `expired`
  - `last_refresh`
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
  - Treat `http://127.0.0.1:6006/` as the public foundation Storybook, not the full business design-system surface. Its `frontend/.storybook/main.ts` story globs should stay limited to tokens, primitives, and `frontend/src/components/ui`; do not reintroduce `../src/**/*.stories` or `features/**` there.
  - Business design-system work belongs to the Vite app entry `http://127.0.0.1:5173/#frame=design-system`. Keep `storyCatalog.ts` / `componentManifest.ts` able to list `feature-components` for 5173 even when those stories are excluded from 6006.
  - When verifying this boundary, check both sides: `6006/index.json` must not contain `Design System/业务组件`, `feature-components`, or `frontend/src/features`; the 5173 design-system catalog must still retain `feature-components`.
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
  - Provider and model controls must preserve source casing and source identity. Do not force uppercase through shared controls, labels, badges, or status hints.
  - The Codex provider picker displays the `model_provider` id only. Do not concatenate display name and id with `/` or maintain a separate display-name input for new local provider options unless a later requirement introduces that distinction explicitly.
  - Initial Codex provider/model selection should prefer explicit values from `config.toml`; UI localStorage is secondary. If Codex has no explicit root `model_provider`, the Status page may default to the GetTokens relay provider; if Codex has no explicit root `model`, fall back to `RELAY_CODEX_DEFAULT_MODEL`.
  - Legacy UI-only model fallbacks such as `GT` must be treated as migration inputs, not as active defaults. Filter them from stored model option lists and lock the migration with focused local-state tests.
- **Codex Feature Config UI**: The local Codex `[features]` bool editor is a config list, not a data table. Each feature is one row with feature key as the title, stage as a compact tag before the subtitle, localized description as the subtitle, and the switch as the only bool value expression. Do not add duplicate `default/local/on/off` value labels when the switch already communicates the state. Do not force feature keys or descriptions to uppercase; preserve source and localization casing.
- **Account Cards**: Account cards should support whole-card detail entry, but clicks originating from nested interactive controls (`button`, `input`, etc.) must not trigger the card-level detail action.
- **Account Detail Surfaces**:
  - Use `AccountDetailPrimitives` as the first choice for account-like detail modals.
  - Preferred module flow is `AccountDetailBody -> AccountDetailOverviewGrid(runtime + evidence) -> AccountDetailModuleStack -> AccountDetailSection`.
  - Module headers must use the standardized `AccountDetailSectionHeader` path inside `AccountDetailSection`; do not hand-roll per-module eyebrow/title/meta/action headers in account detail body modules.
  - Header-level module actions such as add-row/add-model belong in `AccountDetailSection` `actions` so they render at the module header's top right. Do not leave primary row-creation actions at the bottom of dense editor sections.
  - Wide detail modals should usually use `AccountDetailModuleStack layout="cards"` for editable modules so sections can occupy multiple columns. Use `cardColumns={1}` when a variant is a dense form/editor surface, such as OpenAI-compatible provider detail, where two-column cards create large empty regions or squeeze row controls.
  - Use `span="wide"` for modules with horizontal data, tables, textareas, rule rows, quota/billing editors, or model catalogs so the card grid does not compress operational controls.
  - Runtime information that already exists on account cards (recent requests, tokens, cached tokens, latency, quota windows, balance) should be shown in details through `AccountRuntimeSnapshotSection`, not by embedding account cards inside the modal. In the runtime section, quota and balance should share the `quota-balance` resource grid so wide modals can compare them side by side.
  - Runtime snapshot and evidence should sit together in `AccountDetailOverviewGrid` near the top of the detail body, instead of sending evidence to a disconnected secondary sidebar. The runtime and evidence sections must stretch to equal height in wide overview rows.
  - Route-row details such as Codex / Claude Code should put route identity, status, priority, requestability, and enablement into an evidence section inside the overview grid, not into a separate field grid before runtime.
  - Do not put cards inside account details just to create section boundaries. Use section density (`standard`, `dense`, `hero`), table/grid rows, and overview evidence modules instead.
  - Save actions for detail-page modules should follow the page/modal footer when the edit affects persistent account configuration. Individual sections may keep local actions such as add row, delete draft row, verify, fetch models, or copy.
  - OpenAI-compatible and Codex route-row details are account detail variants; keep them visually aligned with `UnifiedAccountDetailModal` even when their controller/state logic remains separate.
  - For API-key-like details, keep credential editing and connection verification in one `AccountCredentialVerifySection` when they operate on the same draft. Avoid adjacent `Credentials` / `Verify` cards that force users to scan two modules for one setup task.
  - For explicitly desktop-only account detail drafts, validate desktop density and overflow only. Do not introduce phone-width layout work or 375px screenshot acceptance unless the product requirement reintroduces mobile support.
  - Account creation/configuration modals such as `UnifiedComposeModal` should reuse account detail primitives instead of hand-rolled form shells. Keep configuration flows in named sections, localize visible menu labels and section eyebrows, and preserve the existing submit callbacks while changing layout.
  - OpenAI-compatible provider details should defer runtime/evidence split until very wide viewports and keep model rows responsive: model and alias inputs may split at medium width, but destructive row actions must stay horizontal and only join the row when there is enough width.
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
- **Sidecar Independence Baseline**: Starting with the account/credential SQLite storage version, GetTokens sidecar no longer follows CLIProxyAPI upstream through merge-style sync. Upstream commits and features are reference inputs only; required behavior must be redesigned and implemented inside the GetTokens sidecar boundary with focused tests and a rebuilt sidecar.
- **Management API Boundary**: The sidecar management API may be changed breakingly for GetTokens needs. Do not keep old management endpoints solely for upstream compatibility; retain old endpoints only when a specific GetTokens migration or rollout step explicitly requires them.
- **Historical Upstream**: `router-for-me/CLIProxyAPI` is historical reference material, not the active source of truth for sidecar behavior.
- **Remotes**: `upstream` = `router-for-me/CLIProxyAPI` (reference only), `origin` = `AxApp/CLIProxyAPI` (maintained GetTokens sidecar), `linhay` = legacy fork backup.
- **GitHub Fork Lineage**: As of 2026-05-19, `AxApp/CLIProxyAPI` was rebuilt as a fresh fork of `router-for-me/CLIProxyAPI`; GitHub reports `parent=router-for-me/CLIProxyAPI` and `source=router-for-me/CLIProxyAPI`. This lineage no longer implies ongoing upstream merge compatibility.
- **Legacy Backup**: The previous fork, whose immediate GitHub parent was `linhay/CLIProxyAPI`, was renamed to `AxApp/CLIProxyAPI-legacy-20260519`. Treat it as a backup only, not as the active release/build source.
- **Fork Boundary**: `AxApp/CLIProxyAPI#gettokens/sidecar` carries GetTokens runtime patches and is the source used for release sidecar builds. The older `gettokens/wham-token-fix` branch name was a historical artifact and has been removed from the active fork.
- **Sidecar Autonomy**: Treat the sidecar as the owner of runtime autonomy. Account selection, rate-limit enforcement, route guard state, live-session tracking, usage attribution, system proxy behavior, and Codex WebSocket session switching should be implemented in `CLIProxyAPI#gettokens/sidecar` or its GetTokens hook/routing layers, not simulated by Wails/frontend state after the fact.
- **Upstream Reference Rule**: Upstream PRs or commits are inputs, not automatically accepted product behavior. If an upstream feature is useful, reimplement the reasonable part inside the maintained sidecar boundary, add narrow fork-side regression tests, push `origin/gettokens/sidecar`, rebuild the local sidecar, and only then merge the parent GetTokens changes back to the main branch.
- **Codex Compatibility Ingress**: For OpenAI root-path compatibility needed by Codex-style clients, prefer centralized ingress normalization such as `/models` -> `/v1/models` and `/responses*` -> `/v1/responses*`. Do not scatter duplicate route handlers when a NoRoute rewrite can preserve the existing middleware and handler chain.
- **Responses Tool Conversion**: The generic Responses-to-Chat converter should accept both flat `function` tool payloads and nested `tools[].function` payloads, and skip invalid function tools without a name.
- **Reasoning Content Boundary**: Do not inject `reasoning_content` globally in the generic OpenAI Responses converter. Provider-specific response quirks belong in provider normalizers/executors such as the existing Kimi pattern.
- **Upstream Request Trigger**: When the user asks to "merge upstream branch", "sync upstream", or "daily merge CLIProxyAPI", clarify that GetTokens no longer does merge-style upstream sync. Treat the request as an upstream reference audit unless they explicitly ask for a historical merge.
- **Workflow**: Audit upstream/reference behavior -> redesign inside GetTokens sidecar -> implement on maintenance branch -> rebuild sidecar -> replace binary in `GetTokens.app`.
- **Binary**: Sidecar binary lives at `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`.
- **Fork Commit Order**: When the fork changes, commit inside `docs-linhay/references/CLIProxyAPI` first, then commit the parent repository gitlink and rebuilt sidecar artifacts. Do not leave the parent pointing at an uncommitted fork state.
- **Historical Upstream Merge Loop**: Use this only if the user explicitly asks for a historical merge despite the sidecar independence baseline. The default workflow is reference audit plus sidecar-side reimplementation, not merge sync.
  1. Check status in both layers: parent repo and fork. Protect unrelated parent changes and only stage the merge closure set.
  2. In the fork, fetch `upstream` and `origin`; inspect upstream-only commits with `git log --cherry-pick --right-only --no-merges HEAD...upstream/main` before trusting a broad diff.
  3. Inspect risk with `git diff --stat <old>..upstream/main` and, when useful, `git merge-tree --write-tree HEAD upstream/main` before starting the real merge.
  4. Run focused baseline tests for the touched risk surfaces before merging when the current fork state is expected to be stable.
  5. Merge `upstream/main`, resolve conflicts by preserving GetTokens runtime surfaces, then add narrow regressions for accepted upstream behavior that is not already locked by tests.
  6. Run focused tests, `go test ./...`, and `git diff --check` in the fork; commit and push `origin/gettokens/sidecar`.
  7. Rerun `./scripts/ensure-sidecar.sh darwin arm64` from the parent repo and confirm the sidecar meta records the new fork commit with `dirty=clean`.
  8. Update the parent gitlink plus relevant `space`, dev docs, memory, and qmd index; commit only those relevant parent files.
- **Protected Reference Surfaces**: During upstream reference audits or exceptional historical merges, explicitly re-check `internal/gettokenshooks`, `internal/gettokensrouting`, `sdk/cliproxy/auth`, Codex WebSocket executor, usage / TTFT / reasoning helpers, system proxy behavior, and config diff visibility.
- **Timing and Reasoning Hardening**: If upstream changes telemetry, timing, or reasoning extraction, avoid duplicating parsing or TTFT work across call sites. `SetTranslatedReasoningEffort` must not clear context reasoning effort when the translated payload has no config-derived effort. Keep `ttft_ms` as telemetry unless a consuming feature is explicitly scoped.
- **Codex WebSocket Timing Guard**: When `codex_websockets_executor.go` changes, verify the four timing/live-session events still have a coherent order: `RecordCodexLiveUpstreamConnected`, `RecordCodexLiveFirstEvent`, `StartResponseTTFT`, and `MarkFirstResponseByte`.
- **Subagent Upstream Audit**: When upstream is used as reference material or the user explicitly asks for subagent review, split read-only subagents by risk surface before reimplementation: overall upstream commit intent, WebSocket / route guard / channel routing, and compatibility areas such as Images / Gemini / translator. Treat `HEAD..upstream/main` mass-deletion diffs as a divergence artifact until each upstream commit is audited with `git log --cherry-pick --right-only` and `git show`.
- **Audit-to-Test Rule**: If upstream/reference review finds behavior worth adopting and it is not directly locked by tests, add the narrow sidecar-side regression before closing the reimplementation. Common examples are config diff visibility, payload model selection, `previous_response_id` cleanup, route guard failover, and provider-specific translator boundaries.
- **Rebuild Command**: After fork changes that affect runtime behavior, rebuild the local sidecar with `./scripts/ensure-sidecar.sh darwin arm64` before desktop or Proxyman acceptance.
- **Sidecar Change Closure**: For sidecar changes, finish both repository layers when the fork is tracked by the parent: commit fixes inside the fork, then commit the parent gitlink and memory/docs in GetTokens. If an amend or follow-up fork commit changes the fork HEAD, rerun `./scripts/ensure-sidecar.sh darwin arm64` and update the parent gitlink again.
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
