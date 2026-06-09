---
name: gettokens-ops-governance
description: GetTokens 流程治理：Wails 开发回路、spaces、文档记忆写回与 AGENTS 同步。
---

# GetTokens Operations & Governance

This skill unifies the procedural rules for working on GetTokens, ensuring consistency in development, documentation, and knowledge management.

## 1. Wails Dev Loop & Restart Rules
- **Restart**: Always restart the app if Go files, Wails bindings, or sidecar logic change. Restart for Svelte/CSS if HMR shows stale results.
- **Readiness**: Sidecar `ready` status is required for account data flow. UI mount success does not guarantee data flow.
- **Verification**: Match validation to the risk surface. Native macOS/Wails runtime changes need real dev App validation; ordinary frontend/backend/sidecar fixes may use automated tests, Wails build, browser/DOM checks, dev bridge, or API state evidence.
- **Evidence gate before fixes**: Do not enter implementation from an unverified backlog item or intuition. Before a repair round starts, write an evidence matrix in the matching `space` or plan: issue source, current code/UI location, observed symptom or missing-state proof, expected acceptance path, and what evidence would disprove the candidate. Items without this evidence stay in research/planning and are not patched.
- **Real dev App hand-click acceptance**: Do not make real desktop hand-click a blanket requirement. Use it only for macOS menu bar, window lifecycle, status item, LaunchServices, native runtime, Wails binding visibility, or when the user explicitly requests it in the current round. Avoid low-signal coordinate clicking and desktop focus churn for ordinary repair rounds.
- **Binding Boundary**: Wails binds the root `main.App`, not `internal/wailsapp.App`. Any new Wails-facing method or DTO added under `internal/wailsapp` must also be exposed through root-level `app.go`, `app_types.go`, and mappers as needed before regenerating bindings; otherwise `wails dev` will remove the frontend export.
- **Generated Binding Hygiene**: Run Wails through `scripts/wails-cli.sh`, not raw `wails`, for local dev/build. The wrapper normalizes `frontend/wailsjs` trailing whitespace after generation so `frontend/wailsjs/go/models.ts` does not stay dirty from generator-only formatting drift.
- **Startup Config Apply**: If a setting writes sidecar `config.yaml` while the sidecar is not yet `ready`, persist the local config first and mark the change as pending. The next `ready` callback must apply the latest config through the management API and clear the pending marker only after a successful response; failures should keep the marker for the next ready retry.
- **Sidecar Process Binding**: The App-owned sidecar must be tied to the App lifecycle. On startup, clean orphaned `cli-proxy-api` processes that use the same profile `config.yaml` before choosing a port. On shutdown, send an interrupt, wait for exit, then force-kill if the sidecar ignores the graceful signal. When the UI appears to show stale runtime data after an app update, verify `ps/lsof` ownership and config path before debugging frontend state.
- **Dev Sidecar Freshness**: For sidecar or sidecar-facing fixes, verify the sidecar actually running under `GETTOKENS_APP_PROFILE=dev`, not just the source tree or `build/bin/cli-proxy-api`. Use `scripts/wails-cli.sh` so dev/build installs the freshly built sidecar into the app bundle, then confirm process path, config path, adjacent metadata/hash when relevant, and `~/.config/gettokens-dev/sidecar.log` commit/version before claiming the dev App is exercising the fix.

### 1.1 Browser Preview & Screenshot Loop
- **When to use**:
  - The page is a Wails surface, but most layout or interaction acceptance can be checked in a browser.
  - The page depends on runtime bindings, yet you still need stable screenshots or quick iteration without a live desktop shell.
- **Display discipline**:
  - Browser acceptance for local preview pages must default to headless automation. Do not open or move a visible browser window onto the user's active display for routine screenshots, DOM checks, or interaction verification.
  - Prefer Playwright/agent-browser headless runs, DOM assertions, and saved screenshots over visible `browser_navigate` sessions when checking localhost or preview URLs.
  - If a visible browser is genuinely required, ask first or place it on a non-active external display. Never steal focus from the user's active monitor during normal verification.
- **Default pattern**:
  1. Add an explicit preview entry such as `?preview=<page-key>` or a dedicated frame hash.
  2. In preview mode, avoid hard dependency on `window.go.main.App`; provide stable preview data instead of crashing.
  3. If the page still needs “real-ish” local data in browser dev, add a dev-only HTTP bridge in `vite.config.js` rather than faking Wails runtime globally.
  4. Add a focused browser check script under `docs-linhay/scripts/` that opens the preview URL and writes deterministic screenshots into the matching `space`.
- **Acceptance rule**:
  - Browser screenshots are valid for layout/density review only after preview mode and fallback data are explicit and reproducible.
  - If runtime bindings, sidecar readiness, or desktop-only capabilities are part of the requirement, browser acceptance does not replace the real Wails check.
- **Cache rule**:
  - For external status/data pages, prefer a small local cache plus a visible “live / cache / preview” source label, so repeated page entry does not look like a full refetch every time.
- **Screenshot hygiene**:
  - Keep the screenshot script near docs, not inside ad-hoc shell history.
  - Reuse one stable output path per acceptance baseline instead of scattering `final/latest/temp` files.

### 1.2 macOS Runtime Residency & App Lifecycle Settings
- **When to use**:
  - Settings adds or changes desktop lifecycle capabilities such as login item, close-window behavior, background service residency, status item, or app update entry points.
  - A Wails feature touches both frontend settings state and macOS native runtime behavior.
- **BDD/TDD baseline**:
  1. Write the user-facing scenarios first: login startup on/off, close app quits service, close app keeps service, status item recovery, status item quit, and update action reuse.
  2. Add focused failing tests before implementation. Cover Go runtime settings persistence / LaunchAgent intent / close policy, and frontend layout or state derivation for the settings page.
  3. Keep implementation minimal until those tests pass, then only refactor with tests still green.
- **Residency contract**:
  - If "close window keeps service running" is supported, the app must provide a macOS status item or equivalent native recovery path before the window disappears.
  - The status item must expose at least service status, reopen window, check update when applicable, and quit. A background service without visible recovery or quit control is not an acceptable end state.
  - The quit action must be explicit and must not be confused with closing the main window.
- **Wails binding contract**:
  - Any new runtime settings DTO or method implemented under `internal/wailsapp` must be mirrored through root `app.go` / `app_types.go` before regenerating `frontend/wailsjs`.
  - After binding generation, confirm the frontend imports are real generated exports, not preview-only shims.
- **Preview contract**:
  - Browser preview may be used for settings layout, copy, density, and screenshot review.
  - Preview mode must not hard-crash when Wails runtime is absent; provide explicit fallback data or no-op handlers for preview.
  - Preview screenshots do not replace real desktop validation for login item, close-window behavior, status item, or native updater actions.
- **Acceptance checklist**:
  - Run the relevant Go tests plus `go test ./...` when runtime behavior changes.
  - Run the focused frontend unit tests for settings layout/state, then typecheck/build if bindings or shared frontend types changed.
  - Verify the real macOS desktop app for top menu/status item presence and close/quit behavior.
  - Archive before/after or final screenshots under the matching `space` path, separating browser-preview settings shots from desktop menu/status item shots.
- **Native menu/status item detail rule**:
  - A Wails `menu.AppMenu()` role only produces the default macOS App menu. Custom actions that users expect under the left app menu, such as `GetTokens -> 检查更新...`, may require an AppKit bridge that mutates `NSApp.mainMenu` after startup. Do not assume a custom `Help` menu satisfies an App-menu placement request.
  - For macOS status bar buttons, prefer a template image over text such as `GT`. Keep the PNG resource embedded or otherwise bundled deterministically, call `setTemplate:YES`, use `NSSquareStatusItemLength`, and verify the real desktop status item after build.
  - When passing embedded image bytes from Go to Objective-C, copy the bytes into `NSData` before dispatching onto the main queue, so the Go/C buffer lifetime cannot race the AppKit update.

### 1.3 Feature Panel Extraction & Design-System Admission
- **When to use**:
  - A page section is reused across storybook, preview, and runtime surfaces, especially for settings, status, or account workbench panels.
  - The section starts carrying its own runtime state, build metadata, or dedicated acceptance states.
- **Extraction rule**:
  - Keep business logic in the parent feature and extract the panel into a pure presentational component.
  - If the panel needs build metadata such as version or git hash, source it from build-time env or a small helper with a Node-test-safe fallback.
  - Declare any new `import.meta.env` keys in `frontend/src/vite-env.d.ts` so typecheck and test environments agree.
- **Design-system admission**:
  - Register the component in `componentManifest.ts` and `storyCatalog.ts`.
  - Add a Storybook overview that covers every runtime state the component is expected to render.
  - Keep `data-design-system-component-name` and related test assertions aligned with the extracted component name.
- **Acceptance checklist**:
  - Focused unit tests for the helper and the component states.
  - `typecheck` and `build` after the binding or shared frontend surface changes.
  - `storyCatalog` / manifest tests that prove the component is admitted instead of being a one-off inline block.

### 1.4 macOS Deep Link Scheme & Smoke Loop
- **When to use**:
  - A Wails feature adds, removes, or renames a custom URL scheme.
  - Parser behavior changes for desktop deep links, including dev-only aliases such as `gt-dev://`.
  - The feature depends on macOS LaunchServices handing a URL to GetTokens.
- **Scheme contract**:
  - Parser support is not enough. The scheme must also be registered in `wails.json`, then verified in the built `.app` `Info.plist`.
  - Add or update a root-level test that reads `wails.json` and asserts every supported production and dev scheme is registered.
  - Keep production and dev schemes semantically identical unless the feature explicitly requires a different payload contract.
  - Dev-only schemes are for local isolation and smoke testing. Product docs and external links should continue to use the production scheme.
- **Entry contract**:
  - Initial process arguments and `SingleInstanceLock` second-instance arguments must filter every supported scheme before Wails parses flags.
  - Preserve the original URL string for frontend/event consumption, but normalize only for matching and validation.
- **Smoke contract**:
  - After `./scripts/wails-cli.sh build`, inspect `build/bin/GetTokens.app/Contents/Info.plist` for `CFBundleURLTypes`.
  - If using `open <scheme>://...`, first register the intended `.app` with LaunchServices. If another installed or dev build receives the URL, report that as a LaunchServices registration conflict instead of claiming current-build UI smoke.
  - Use `open -g` when possible so routine smoke does not steal focus.
  - Do not kill existing prod/dev GetTokens processes just to force scheme ownership unless the user explicitly approves that desktop interruption.
- **Acceptance checklist**:
  - Focused parser tests for every supported scheme.
  - Startup/single-instance argument filtering tests.
  - `wails.json` registration test.
  - `./scripts/wails-cli.sh build` and built `Info.plist` inspection.
  - Real desktop URL handoff only counts as complete when the intended build receives the URL.

## 2. Space Governance (`docs-linhay/spaces/`)
- **Structure**: Each space must have `README.md`, `plans/`, and `screenshots/`.
- **Naming**: Use English slugs. Prefer `YYYYMMDD-<topic>` for short tasks or stable feature names for milestones.
- **Content**: Put requirements in the space `README.md`. Use specific naming conventions for screenshots: `<YYYYMMDD>-<module>-<scene>-<status>-v<nn>.png`.

## 3. Doc Write-back & AGENTS Sync
- **Placement**: 
  - Scope/Requirements -> `docs-linhay/spaces/`
  - Design/Workflow -> `docs-linhay/dev/`
  - Decisions/Milestones -> `docs-linhay/memory/`
  - Rules -> `AGENTS.md`
- **Memory**: Keep entries concise and decision-oriented.
- **Governance**: Read `AGENTS.md` first. Update it only for repo-wide, durable rules. Ensure `docs-linhay` is not ignored in `.gitignore`.
- **Automatic distillation audit**: At the end of every significant repair round, subagent delivery, interrupted implementation, or explicit "整理" request, run the session distillation audit automatically. Decide whether each reusable pattern belongs in a domain skill, a `docs-linhay/dev/` workflow, `AGENTS.md`, or memory-only notes. Do not wait for the user to ask "what should be saved".

### 3.1 Interrupted Repair Deferral
- If the user pauses a repair round or says the remaining work should move to the next phase, unfinished implementation is not a deliverable.
- Revert only the half-finished code and generated artifacts from the interrupted round; do not revert unrelated user changes or earlier completed commits.
- Preserve the useful evidence in the matching `space`: issue source, code/UI fact location, observed gap, acceptance path, and disproof condition.
- Convert the unfinished item into a next-phase requirement document under `docs-linhay/spaces/<space-key>/plans/`.
- Update the space README, backlog, and memory so the item is marked as deferred / next-phase rather than fixed.
- For pure deferral docs, run `docs-linhay/scripts/check-docs.sh` and `git diff --check`; do not run frontend/backend tests unless code remains changed.

### 3.2 Cleanup Before Claiming Done
- If a long implementation session leaves tracked files still drifting after the “main” commit, do not stop at the first commit.
- Keep reconciling residual tracked diffs that belong to the same rollout until the remaining worktree noise is clearly limited to:
  - external reference submodules
  - local research scratch files
  - user-owned temporary artifacts that are intentionally not versioned
- If generated screenshots or browser artifacts should not enter git, add or refine ignore rules before claiming cleanup is complete.

## 4. Subagent Delivery Loop
- **Trigger**: Use this loop when a requirement will be implemented by delegated agents or when the user explicitly asks for `subagent` delivery.
- **Controller Role**:
  - The main agent is the controller, not the primary implementer.
  - The controller owns requirement boundaries, acceptance criteria, task decomposition, integration, verification, docs, memory, and final completion judgment.
  - The controller must not stop at “code landed” if screenshots, desktop verification, docs, or other stated acceptance steps are still open.
- **Execution Order**:
  1. Normalize the requirement into a `space` README with scope and acceptance.
  2. Split work into bounded subtasks with disjoint ownership and assign them to subagents.
  3. Keep critical-path integration local; do not delegate the controller’s immediate acceptance judgment.
  4. Review and integrate subagent output continuously instead of waiting until the end to reconcile everything.
  5. Run the full closure loop before stopping:
     - code integration
     - automated validation
     - Wails/desktop verification when applicable
     - screenshots or other acceptance artifacts
     - docs + memory write-back
  6. If something remains blocked, report the exact blocker and why the requirement cannot yet be considered done.
- **Stop Rule**:
  - “Implemented first pass” is not completion.
  - The controller only stops when the user’s requirement is fully closed, the user explicitly pauses, or there is a concrete blocker that cannot be resolved within the current environment.
- **Acceptance Boundaries**:
  - Browser-only verification is not enough for Wails features that depend on runtime bindings.
  - “Remaining screenshots / real-window validation / docs cleanup” are part of the same requirement when they are in the agreed acceptance path, not optional tail work.

## 5. Session Skill Distillation
- **Trigger**: When asked to "整理" or after a pattern-heavy session.
- **Goal**: Extract durable workflows and failure modes into skills. Avoid copying transient guesses or chat fluff.
- **Output**: Create/update skills in `.agents/skills/` and record the decision in project memory.
- **Do Not Over-promote**: Feature-domain verification workflows, such as CLIProxyAPI fork checks or Proxyman capture procedures, should normally live in the relevant domain skill and dev docs. Promote to `AGENTS.md` only when the rule becomes repo-wide governance.
- **Automatic closure rule**: Before the final response of a substantial round, check whether new reusable behavior appeared. If yes, update the right skill/workflow/governance file as part of the round; if no, say it was reviewed and not promoted.

## 6. Release Governance
- **Scope**: Current release scope is macOS only.
- **State Vocabulary**:
  - "CI release published" means the release workflow completed successfully, the tag-backed GitHub Release exists, and the expected assets are attached.
  - "Distributable DMG accepted" means the official GitHub Release assets were downloaded and passed checksum, Gatekeeper, stapler, app signature, architecture, bundle version, and Sparkle feed checks.
  - Do not describe a CI-published release as "not published" just because post-release local DMG acceptance is still running or blocked. Report it as "已发布，分发验收待完成/被阻塞".
- **Assets**:
  - `GetTokens_macOS_AppleSilicon.dmg`
  - `GetTokens_macOS_AppleSilicon.tar.gz`
  - `GetTokens_macOS_Intel.dmg`
  - `GetTokens_macOS_Intel.tar.gz`
  - `checksums.txt`
- **Versioning**:
  - If a release tag has already failed or been consumed, bump to the next patch tag instead of reusing it.
  - Keep `frontend/package.json`, `frontend/package-lock.json`, and `frontend/package.json.md5` in sync with the release version.
  - Post-release docs or memory commits may be pushed to `master` after the release tag. Do not move or recreate the tag just to include those records; the tag should continue to identify the shipped code.
- **Sidecar Build Rule**:
  - Do not fetch sidecar binaries from upstream release assets for GetTokens release builds.
  - Build `CLIProxyAPI` from the maintained fork source first.
  - If `docs-linhay/references/CLIProxyAPI` is missing in CI, auto-clone the fork and checkout the maintained branch before building.
- **macOS Packaging Rule**:
  - Build `arm64` and `amd64` as separate release jobs; do not collapse them back into a universal DMG workflow.
  - After `wails build`, explicitly copy the freshly built sidecar back into `GetTokens.app/Contents/MacOS/cli-proxy-api` before notarization.
  - Sign and notarize the `.app` first, then build/sign/notarize the `.dmg`.
- **Sparkle Rule**:
  - Sparkle feed must stay split by architecture; do not merge `arm64` and `amd64` DMGs into one appcast when bundle versions are equal.
  - `SUFeedURL` must point to the matching per-arch feed: `appcast-arm64.xml` or `appcast-amd64.xml`.
  - When `generate_appcast` is used in CI, write appcast output to an explicit staged file path instead of assuming it rewrites the staged seed file in place.
- **CI Hygiene**:
  - Keep GitHub Actions dependencies on Node 24 compatible major versions to avoid Node 20 deprecation warnings.
  - When a release run fails, inspect the exact failed job logs before changing tag strategy or packaging assumptions.
  - When the working tree already contains unrelated user changes, stage only the release closure set explicitly. Do not widen the commit to absorb unrelated frontend or screenshot diffs just to obtain a clean tree.
- **Distributable DMG Acceptance**:
  - A GitHub Release page or uploaded DMG asset is not enough to claim distribution readiness.
  - Download the official release assets and verify `checksums.txt` with `shasum -a 256 -c`.
  - Run `spctl -a -t open --context context:primary-signature -v` and `xcrun stapler validate` on both Apple Silicon and Intel DMGs.
  - Mount both DMGs and verify the bundled `.app` with `codesign -dv --verbose=4`, executable architecture, `CFBundleShortVersionString`, `CFBundleVersion`, and per-arch `SUFeedURL`.
  - Verify the remote per-architecture Sparkle appcasts contain the shipped version and point to the matching release DMG.
  - Only claim "可分发 DMG 已发布" after the DMG-level Gatekeeper, stapler, app signature, architecture, and bundle metadata checks all pass.

## Acceptance Checklist
- If the change touches native/Wails runtime behavior, the dev App launches with latest code and reaches `ready` state.
- Space boundaries are clear; screenshots follow naming rules.
- Durable knowledge is written to the correct directory.
- New skills or rules are distilled without bloating governance files.
