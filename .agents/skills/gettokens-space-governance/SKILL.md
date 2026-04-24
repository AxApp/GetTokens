---
name: gettokens-space-governance
description: Use when creating, naming, reorganizing, or documenting a docs-linhay space in GetTokens. Covers space-key selection, README structure, and placement of plans, screenshots, and debate artifacts under docs-linhay/spaces/.
---

# GetTokens Space Governance

Use this skill when the task affects a specific `docs-linhay/spaces/<space-key>/` workspace rather than repo-wide governance.

## Primary paths

- `AGENTS.md`
- `docs-linhay/README.md`
- `docs-linhay/spaces/`
- `docs-linhay/dev/20260424-spaces-structure-governance.md`
- `docs-linhay/scripts/create-space.sh`
- `docs-linhay/scripts/check-docs.sh`

## Workflow

1. Read `AGENTS.md` first and preserve the current `spaces/` layout.
2. Reuse an existing `space` when the work belongs to the same stable feature or milestone; otherwise create a new one.
3. Choose `<space-key>` as an English slug. Prefer `<YYYYMMDD>-<topic>` for short-lived work and a stable feature slug for long-lived work.
4. Ensure the `space` contains:
   - `README.md`
   - `plans/`
   - `screenshots/`
   - `debate/`
5. Prefer `docs-linhay/scripts/create-space.sh <space-key>` to create the structure and initial `README.md`.
6. Put requirement context in `README.md`, not in `docs-linhay/dev/`.
7. Put plans, screenshots, and debate materials under the same `space`; do not scatter them into repo-level doc folders.

## README template

Keep `README.md` concise and structured. Prefer these sections:

1. 背景
2. 目标
3. 范围
4. 非目标
5. 验收标准
6. 相关链接
7. 当前状态

## Screenshot rules

1. Store screenshots at `docs-linhay/spaces/<space-key>/screenshots/<YYYYMMDD>/<module>/`.
2. Use the filename format:
   `<YYYYMMDD>-<module>-<scene>-<status>-v<nn>.png`
3. `status` should be one of: `before`, `after`, `baseline`, `failed`.
4. If the module is unclear, use `misc/` only as a temporary bucket.

## Debate rules

1. Store debate notes at `docs-linhay/spaces/<space-key>/debate/<YYYYMMDD>/<module>/`.
2. Use the filename format:
   `<YYYYMMDD>-<topic>-v<nn>.md`
3. Each debate note should cover:
   - background
   - participant viewpoints
   - round-by-round changes if relevant
   - conclusion and action items

## What belongs elsewhere

- Cross-space technical design: `docs-linhay/dev/`
- Durable decisions and milestones: `docs-linhay/memory/YYYY-MM-DD.md`
- External references: `docs-linhay/references/`

## Acceptance checklist

- The chosen `space` boundary is clear and not duplicated elsewhere.
- The `space` contains the expected subdirectories.
- Requirement content lives in `README.md`.
- Screenshots and debate files follow the naming and placement rules.
- `docs-linhay/scripts/check-docs.sh` passes after structural changes.
