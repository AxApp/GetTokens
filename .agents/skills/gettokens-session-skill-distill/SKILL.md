---
name: gettokens-session-skill-distill
description: Use when asked to turn a past chat, resume session, or debugging transcript into reusable project-level skills for this repo. Covers transcript discovery, repeated-pattern extraction, skill boundary design, and write-back into `.agents/skills`.
---

# GetTokens Session Skill Distill

Use this skill when the input is not source code alone, but a prior working session that contains repeated problem-solving patterns worth turning into reusable project knowledge.

## Goal

Convert one noisy session into a small set of durable project skills without copying one-off fixes, transient guesses, or chat fluff.

## Workflow

1. Locate the session transcript first. Prefer the exact session id or resume token the user gives you.
2. Read the user prompts and the assistant's repeated solution patterns; do not summarize every turn.
3. Count or group the recurring themes.
4. Keep only themes that are both:
   - repeated in the session
   - likely to matter again in this repo
5. Create project-local skills under `.agents/skills/<skill-name>/SKILL.md`.
6. Add a short overview doc in `docs-linhay/dev/` explaining why these skills exist.
7. Write the durable decision to `docs-linhay/memory/YYYY-MM-DD.md`.

## What to keep

- stable workflows
- architectural choke points
- repeated failure modes
- validation habits
- repo-specific file ownership and entry points

## What to discard

- individual commit messages
- temporary debugging guesses
- raw sample data from the session
- one-time emotional or stylistic phrasing
- fixes that are already obsolete in current code

## Skill-boundary rules

1. Prefer 3 to 6 skills, not a giant omnibus file.
2. Separate domain skills from process skills.
3. Each skill should have a clear trigger sentence in its description.
4. Mention only the current repo files that actually matter.

## Acceptance checklist

- The new skills can be triggered by future tasks without needing the original session.
- Each skill has a distinct scope.
- The overview doc explains the extraction rationale.
- Memory contains the durable decision, not the whole transcript.
