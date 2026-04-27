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

## 4. Session Skill Distillation
- **Trigger**: When asked to "整理" or after a pattern-heavy session.
- **Goal**: Extract durable workflows and failure modes into skills. Avoid copying transient guesses or chat fluff.
- **Output**: Create/update skills in `.agents/skills/` and record the decision in project memory.

## 5. Release Governance
- **Scope**: Current release scope is macOS only.
- **Assets**:
  - `GetTokens_darwin_arm64.dmg`
  - `GetTokens_darwin_arm64.tar.gz`
  - `GetTokens_darwin_amd64.dmg`
  - `GetTokens_darwin_amd64.tar.gz`
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
- **CI Hygiene**:
  - Keep GitHub Actions dependencies on Node 24 compatible major versions to avoid Node 20 deprecation warnings.
  - When a release run fails, inspect the exact failed job logs before changing tag strategy or packaging assumptions.

## Acceptance Checklist
- App launches with latest code and reaches `ready` state.
- Space boundaries are clear; screenshots and debate notes follow naming rules.
- Durable knowledge is written to the correct directory and indexed via `qmd`.
- New skills or rules are distilled without bloating governance files.
