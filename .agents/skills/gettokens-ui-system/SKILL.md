---
name: gettokens-ui-system
description: Use when changing GetTokens appearance, theme switching, settings UI, or localization. Preserves the project's Swiss-industrial black/white/gray aesthetic and the light, dark, system, zh, and en behavior established in this repo.
---

# GetTokens UI System

This repo already chose a visual direction. Do not drift into generic SaaS styling.

## Visual thesis

- Swiss-industrial black, white, gray
- Thick borders and hard shadows
- Tiny or zero radius
- Monospace-heavy typography
- Contrast created by weight, spacing, border, and surface separation rather than bright accent colors

## Primary files

- `frontend/src/style.css`: global tokens and shared swiss-style primitives
- `frontend/src/pages/SettingsPage.svelte`: theme and language controls
- `frontend/src/lib/stores.js`: persisted theme mode
- `frontend/src/lib/i18n.js`: locale store and translation lookup
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`

## Theme rules

1. Support `system`, `light`, and `dark`.
2. `system` must follow `prefers-color-scheme`.
3. Do not let dark mode collapse into unreadable pure-black-on-pure-black surfaces. Keep `--bg-main` and `--bg-surface` visually distinct.
4. If you change theme behavior, verify both the shell and the empty states.

## Localization rules

1. Any new user-facing copy must be added to both `zh.json` and `en.json`.
2. Keep the translation key structure stable; prefer extending existing namespaces such as `common`, `accounts`, and `settings`.
3. Default locale is currently Chinese unless a saved locale exists in localStorage.

## Settings-page rules

1. Theme and language are first-class configuration items and belong in Settings, not hidden in ad hoc controls.
2. Use the existing segmented-control pattern for discrete choices.
3. If you expose source-mapping or debug hints in UI, keep them secondary and clearly labeled.

## Acceptance checklist

- Light and dark are both legible.
- System mode follows the OS.
- New copy appears in both Chinese and English.
- The screen still feels like the same product after the change.
