---
name: gettokens-ops-governance
description: Core operations and governance for GetTokens. Covers the Wails dev loop (restart rules, readiness), space management in docs-linhay/spaces/, documentation write-back/memory, AGENTS.md sync, and session skill distillation.
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

## Acceptance Checklist
- App launches with latest code and reaches `ready` state.
- Space boundaries are clear; screenshots and debate notes follow naming rules.
- Durable knowledge is written to the correct directory and indexed via `qmd`.
- New skills or rules are distilled without bloating governance files.
