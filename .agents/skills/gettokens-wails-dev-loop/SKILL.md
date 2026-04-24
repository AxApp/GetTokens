---
name: gettokens-wails-dev-loop
description: Use when running, restarting, or verifying the GetTokens desktop app after code changes. Covers the Wails + Vite dev loop, stale bundle detection, sidecar readiness, and when to force a full restart instead of trusting HMR.
---

# GetTokens Wails Dev Loop

This repo is a Wails desktop app with a Svelte frontend and a sidecar-backed Go backend. The most common failure during iteration is assuming the app loaded new code when it actually did not.

## Primary files

- `wails.json`: frontend dev watcher and server URL mode
- `main.go`, `app.go`, `app_accounts.go`: Go app surface
- `frontend/src/main.js`: frontend entry and dev-only instrumentation
- `frontend/src/App.svelte`: shell mount and sidecar event wiring

## Restart rules

1. If you change `.go` files, Wails bindings, or sidecar-facing logic, do a full app restart.
2. If you change only Svelte or CSS, HMR may work, but this project has already shown stale bundle cases. If behavior matters, restart anyway.
3. Do not claim a fix is live until the actual desktop app reflects it.

## Readiness model

1. Frontend mount success is separate from sidecar readiness.
2. `App.svelte` listens for `sidecar:status`; account data should not load before `ready`.
3. A visible shell with empty content can still mean data flow is broken.

## Failure triage

When the UI looks wrong, clicks do nothing, or the window turns effectively all black, check in this order:

1. Is the current bundle actually loaded, or are you seeing stale output?
2. Did `main.js` run at all?
3. Did `App.svelte` mount?
4. Is `sidecarStatus` stuck before `ready`?
5. Did a newly added dev dependency break the embedded webview?

## Practical debugging heuristics

- Use obvious temporary log markers such as `!!!` around mount, click handlers, and Wails bridge calls.
- If adding a dev helper causes the app not to mount, remove the newest runtime dependency first.
- Compile success is not enough; always verify the loaded desktop window and the target interaction.
- If HMR claims success but the UI disagrees, trust the UI and restart.

## Acceptance checklist

- Window launches with the latest code.
- Shell renders correctly in the desktop app, not just in a browser tab.
- Sidecar transitions to `ready` and affected pages react to that transition.
- The user-facing interaction you changed has been exercised end-to-end.
