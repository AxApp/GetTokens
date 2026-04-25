---
name: gettokens-session-skill-distill
description: Use when asked to turn a past chat, resume session, debugging transcript, or a vague "整理" request into reusable project-level skills for this repo. Covers transcript discovery, repeated-pattern extraction, skill boundary design, and write-back into `.agents/skills`.
---

# GetTokens Session Skill Distill

Use this skill when the input is not source code alone, but a prior working session that contains repeated problem-solving patterns worth turning into reusable project knowledge.

If the user only says “整理” and the context is clearly a just-finished working session, treat that as a default trigger for this skill. Do not wait for the user to restate “整理 skills / 整理 AGENTS / 整理文档”.

## Goal

Convert one noisy session into a small set of durable project skills without copying one-off fixes, transient guesses, or chat fluff.

## Workflow

1. Locate the session transcript first. Prefer the exact session id or resume token the user gives you.
2. If no explicit transcript id is provided but the user says “整理”, use the current conversation as the source session.
3. Read the user prompts and the assistant's repeated solution patterns; do not summarize every turn.
4. Count or group the recurring themes.
5. Keep only themes that are both:
   - repeated in the session
   - likely to matter again in this repo
6. Create project-local skills under `.agents/skills/<skill-name>/SKILL.md`.
7. If the session also exposed repo-wide durable workflow constraints, hand off that part to `gettokens-agents-governance-sync` instead of bloating the skill.
8. Add a short overview doc in `docs-linhay/dev/` explaining why these skills exist.
9. Write the durable decision to `docs-linhay/memory/YYYY-MM-DD.md`.

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
