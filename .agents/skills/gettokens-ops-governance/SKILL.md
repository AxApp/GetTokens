---
name: gettokens-ops-governance
description: GetTokens 流程治理：Wails 开发回路、spaces、文档记忆写回与 AGENTS 同步。
---

# GetTokens Operations & Governance

This skill unifies the procedural rules for working on GetTokens, ensuring consistency in development, documentation, and knowledge management.

## 1. Wails Dev Loop & Restart Rules
- **Restart**: Always restart the app if Go files, Wails bindings, or sidecar logic change. Restart for Svelte/CSS if HMR shows stale results.
- **Readiness**: Sidecar `ready` status is required for account data flow. UI mount success does not guarantee data flow.
- **Verification**: Only claim a fix is live after verifying it in the actual desktop app window, not just the browser.

### 1.1 Browser Preview & Screenshot Loop
- **When to use**:
  - The page is a Wails surface, but most layout or interaction acceptance can be checked in a browser.
  - The page depends on runtime bindings, yet you still need stable screenshots or quick iteration without a live desktop shell.
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

## 2. Space Governance (`docs-linhay/spaces/`)
- **Structure**: Each space must have `README.md`, `plans/`, `screenshots/`, and `debate/`.
- **Naming**: Use English slugs. Prefer `YYYYMMDD-<topic>` for short tasks or stable feature names for milestones.
- **Content**: Put requirements in the space `README.md`. Use specific naming conventions for screenshots: `<YYYYMMDD>-<module>-<scene>-<status>-v<nn>.png`.

## 3. Doc Write-back & AGENTS Sync
- **Placement**: 
  - Scope/Requirements -> `docs-linhay/spaces/`
  - Design/Workflow -> `docs-linhay/dev/`
  - Decisions/Milestones -> `docs-linhay/memory/`
  - Rules -> `AGENTS.md`
- **Memory**: Keep entries concise and decision-oriented. Run `qmd update` and `qmd embed` after any write-back.
- **Governance**: Read `AGENTS.md` first. Update it only for repo-wide, durable rules. Ensure `docs-linhay` is not ignored in `.gitignore`.

### 3.1 Cleanup Before Claiming Done
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
     - `qmd update` + `qmd embed`
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

## 6. Release Governance
- **Scope**: Current release scope is macOS only.
- **Assets**:
  - `GetTokens_macOS_AppleSilicon.dmg`
  - `GetTokens_macOS_AppleSilicon.tar.gz`
  - `GetTokens_macOS_Intel.dmg`
  - `GetTokens_macOS_Intel.tar.gz`
  - `checksums.txt`
- **Versioning**:
  - If a release tag has already failed or been consumed, bump to the next patch tag instead of reusing it.
  - Keep `frontend/package.json`, `frontend/package-lock.json`, and `frontend/package.json.md5` in sync with the release version.
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

## Acceptance Checklist
- App launches with latest code and reaches `ready` state.
- Space boundaries are clear; screenshots and debate notes follow naming rules.
- Durable knowledge is written to the correct directory and indexed via `qmd`.
- New skills or rules are distilled without bloating governance files.
