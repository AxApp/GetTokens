---
name: gettokens-doc-writeback
description: Use when a GetTokens task changes durable docs, memory, or project skills and those updates must stay in sync. Covers doc placement, concise memory write-back, and mandatory qmd update/embed after changes.
---

# GetTokens Doc Writeback

Use this skill when the work produces durable project knowledge that must be written back into docs and memory, not just code.

## Primary paths

- `AGENTS.md`
- `docs-linhay/dev/`
- `docs-linhay/memory/`
- `docs-linhay/spaces/`
- `docs-linhay/README.md`
- `.agents/skills/`

## Placement rules

1. Requirement or scope changes belong in the relevant `docs-linhay/spaces/<space-key>/README.md`.
2. Technical design, workflow notes, and governance explanations belong in `docs-linhay/dev/`.
3. Durable decisions, milestones, risks, and preference changes belong in `docs-linhay/memory/YYYY-MM-DD.md`.
4. Reusable execution patterns belong in `.agents/skills/`, not in `AGENTS.md`.

## Write-back workflow

1. Decide whether the change is requirement, design/governance, memory, or skill knowledge.
2. Update the durable doc first; do not leave the decision only in chat output.
3. If the task added or changed a project-level skill, also update the project skills overview doc when that improves discoverability.
4. Keep memory entries short and decision-oriented. Do not dump volatile debugging logs into memory.
5. After memory write-back, run:
   - `qmd update`
   - `qmd embed`

## Memory guidance

Write memory only for:

- key decisions
- milestones
- durable risks
- preference changes
- action items worth retrieving later

Avoid writing:

- one-off command output
- speculative debugging branches
- temporary formatting preferences

## Acceptance checklist

- Durable knowledge is stored in the correct directory.
- Memory entries are concise and retrievable.
- `qmd update` and `qmd embed` were run after write-back.
- Reusable process knowledge became a project skill instead of bloating `AGENTS.md`.
