---
name: gettokens-agents-governance-sync
description: Use when a task affects AGENTS-level working rules, project documentation conventions, memory write-back, or other durable process constraints in GetTokens. Covers AGENTS-first reading, docs-linhay placement, memory logging, qmd indexing, and gitignore alignment.
---

# GetTokens AGENTS Governance Sync

This skill exists for tasks that change repo-wide working rules, not just a single `space` or a one-off doc update.

## Primary files

- `AGENTS.md`
- `.gitignore`
- `docs-linhay/dev/`
- `docs-linhay/memory/`

## Workflow

1. Read `AGENTS.md` before deciding where process knowledge should live.
2. Update `AGENTS.md` only when the rule is repo-wide and durable.
3. Decide whether the change belongs in:
   - `.agents/skills/` for reusable task-class workflows
   - `docs-linhay/spaces/<space-key>/README.md` for requirement changes
   - `docs-linhay/dev/` for implementation or workflow guidance
   - `docs-linhay/memory/YYYY-MM-DD.md` for durable decisions, milestones, risks, or preferences
4. If the repo ignores `docs-linhay/`, fix `.gitignore` so governance docs can actually be tracked.
5. If the change is about `space` operations or doc write-back mechanics, prefer `gettokens-space-governance` or `gettokens-doc-writeback` instead of expanding `AGENTS.md`.
6. After memory write-back, run `qmd update` and `qmd embed`.

## Retrieval and write-back rules

1. For historical lookup, follow AGENTS retrieval order: `qmd query`, then `qmd get`, then direct file reads only if needed.
2. Do not dump volatile details into memory. Keep memory stable and decision-oriented.
3. AGENTS should contain durable project rules, not session debris.

## When to update AGENTS

Update `AGENTS.md` only when the rule is:

- repo-wide
- durable across tasks
- not better expressed as a single skill

If the rule is mainly an execution pattern for a task class, prefer adding or updating a skill instead.

## Acceptance checklist

- Process knowledge is stored in the right place.
- `docs-linhay/` content is not accidentally ignored by Git.
- Memory has been written back and indexed.
- AGENTS stays concise and durable instead of accumulating task-specific noise.
