---
name: gettokens-frontend-debug
description: Use when debugging GetTokens frontend interactions, tracing which Svelte component owns a UI element, or restoring dev-only inspection tools such as LocatorJS, Svelte Inspector, and explicit runtime logging.
---

# GetTokens Frontend Debug

Use this skill when the task is not the business feature itself, but proving what code is running and why a specific interaction fails.

## Primary files

- `frontend/src/main.js`: dev-only debug injection point
- `frontend/vite.config.js`: Svelte Inspector setup
- `frontend/src/App.svelte`: shell mount boundary
- `frontend/src/pages/SettingsPage.svelte`: current source-mapping hints exposed in UI

## Preferred tools

1. Keep debug helpers development-only.
2. LocatorJS belongs in `frontend/src/main.js`, guarded by `import.meta.env.MODE === 'development'`.
3. Svelte Inspector stays in `frontend/vite.config.js`; current shortcut is `alt-x`.
4. Use stable `data-collaboration-id` markers on major containers when it helps agent collaboration.

## Debug workflow

1. First prove whether the click or mount handler fired.
2. Then prove whether the Wails bridge call fired.
3. Then prove whether the backend returned success or failure.
4. Remove or minimize temporary logs after the bug is fixed.

## Known project-specific traps

- A copied path pointing to `App.svelte` does not automatically mean the real bug is in `App.svelte`; it may reflect shell ownership, stale bundle state, or a debug overlay boundary.
- Heavy runtime debug helpers can break Wails webview startup. If the app stops mounting after adding one, revert the helper before deeper speculation.
- When a user says "clicking does nothing", treat it as an instrumentation task first, not a styling task.

## Acceptance checklist

- You can identify the real component or page that owns the target UI.
- You can tell whether the failure is mount, click, bridge, or backend.
- Debug helpers do not break desktop startup.
- Temporary instrumentation is either removed or clearly guarded for dev only.
