---
name: gettokens-cliproxyapi-fork-maintenance
description: Use when a GetTokens task depends on changing CLIProxyAPI behavior, syncing with upstream, or verifying which sidecar binary the desktop app is actually running. Covers fork/upstream remote management, patch carry-forward, app-bundle sidecar replacement, and validation.
---

# GetTokens CLIProxyAPI Fork Maintenance

Use this skill when the task is no longer only “read the reference project”, but actually requires changing the sidecar behavior that GetTokens depends on.

This repo now has a formal fork relationship for CLIProxyAPI:

- local repo: `docs-linhay/references/CLIProxyAPI`
- `origin`: `git@github.com:linhay/CLIProxyAPI.git`
- `upstream`: `https://github.com/router-for-me/CLIProxyAPI`

## When to use

Trigger this skill when any of the following is true:

1. A GetTokens bug turns out to be caused by CLIProxyAPI behavior, not the Wails/UI layer.
2. You need to patch management API behavior such as `/api-call`, auth parsing, or provider config handling.
3. You need to sync CLIProxyAPI to a newer upstream release without losing local fixes.
4. You need to verify whether the running GetTokens app is using the expected sidecar binary.

## Primary paths

- `docs-linhay/references/CLIProxyAPI/`: maintained local fork checkout
- `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`: sidecar binary actually used by the packaged desktop app
- `internal/sidecar/manager.go`: how GetTokens resolves and launches the sidecar
- `~/.config/gettokens/sidecar.log`: runtime sidecar log

## Core rules

1. Separate these three layers explicitly:
   - reference or maintained source checkout
   - GitHub fork/upstream relationship
   - the actual sidecar binary inside the app bundle
2. Never assume editing `docs-linhay/references/CLIProxyAPI` changes the running desktop app.
3. After changing CLIProxyAPI source, rebuild the sidecar binary and replace the one inside `GetTokens.app` if the task needs runtime verification.
4. When the user wants long-term maintenance, prefer a real fork + branch workflow instead of keeping ad-hoc patches only in the local reference directory.

## Recommended workflow

1. Confirm current remotes:
   - `git remote -v`
2. Confirm current branch and local divergence:
   - `git status --short --branch`
   - `git branch -vv`
3. Sync upstream first:
   - `git fetch --all --tags`
   - fast-forward `main` to `upstream/main`
4. Put project-specific fixes on a branch off the latest upstream main.
5. Run focused CLIProxyAPI tests for the touched area before pushing.
6. Push the maintenance branch to `origin`.
7. If GetTokens must use the new behavior immediately:
   - rebuild `./cmd/server`
   - replace `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`
   - relaunch the desktop app

## Verification checklist

When validating a CLIProxyAPI-related fix, check in this order:

1. Does the local CLIProxyAPI source contain the patch?
2. Is the patch committed on a branch in the fork?
3. Was the sidecar binary rebuilt from that patched branch?
4. Did the app bundle sidecar actually get replaced?
5. Is the desktop app currently running that rebuilt sidecar?
6. Does `~/.config/gettokens/sidecar.log` reflect the new runtime behavior?

## Common failure modes

1. Patch applied only in local source, but not committed or pushed to the fork.
2. Fork branch created, but still based on an old upstream tag.
3. App bundle sidecar overwritten by a later `wails build`.
4. GetTokens app relaunched with an old binary or not relaunched at all.
5. Debugging the Wails/UI layer when the real bug lives in CLIProxyAPI token parsing or management API behavior.

## Acceptance checklist

- Fork and upstream remotes are correct.
- The local maintenance branch is based on current `upstream/main`.
- The patch is committed and pushed to `origin`.
- Relevant CLIProxyAPI tests passed.
- If runtime verification matters, the packaged app is running the rebuilt sidecar binary.
