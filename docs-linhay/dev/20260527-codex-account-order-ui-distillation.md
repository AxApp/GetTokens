# Codex Account Order UI Distillation

Date: 2026-05-27
Space: `docs-linhay/spaces/20260511-codex-account-list-tab/`

## Pattern

Codex request-order cards should reuse the account pool `AccountCard` directly. The Codex page may add page-specific metadata through opt-in props, but it should not maintain a second card layout that only resembles the account pool card.

Stable page-specific props:
- `extraBadges` for `ORDER xx` and source labels.
- `eyebrowPrefix` for the request-order prefix such as `#1`.
- `showDeleteAction=false` and `showFooterActions=false` when the Codex page should defer actions to the account menu or the surrounding order workflow.

## UX Rules

- Non-list mode sorts by dragging the whole card.
- Activate / disable continues to use the shared account-card menu.
- Same grid row cards stay equal height.
- Browser preview should visually match desktop mode unless a preview-only state is the point of the test.
- Toolbar actions expand inline when they fit, wrap when the row can still hold them, and collapse to `More` only when space is genuinely insufficient.

## Not Promoted

This is a Codex account-list domain rule, not a repo-wide governance rule. It was added to `.agents/skills/gettokens-codex-account-list/SKILL.md`; `AGENTS.md` does not need a new global constraint.
