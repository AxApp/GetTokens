---
name: "proxyman-api-capture"
description: "Use when dxyer iOS verification, smoke testing, or debugging needs real API traffic evidence through Proxyman CLI: clear sessions, discover proxy host, export HAR/proxymansession logs, inspect request headers, verify DXY-TOD-SESSION user switching, or distinguish API data mismatch from UI/function failure."
---

# Proxyman API Capture

## Scope

Use this skill when a dxyer runtime verification task needs real network evidence from Proxyman, especially:

- real API smoke testing with Mock disabled,
- validating `test/switchUser?userId=<id>` and `DXY-TOD-SESSION` traffic,
- exporting HAR or Proxyman session artifacts for a case,
- checking whether a candidate test user currently matches the expected server-side state,
- separating `Data Mismatch` from functional `Fail`.

This skill complements `tritonkit-runtime`: TritonKit proves UI/runtime state, Proxyman proves the API requests and responses behind that state.

## Prerequisites

- Official install and reference sources:
  - macOS app download: `https://proxyman.com/download`
  - CLI documentation: `https://docs.proxyman.com/command-line`
- Proxyman CLI is bundled with the macOS Proxyman app. The official path is:

```bash
/Applications/Proxyman.app/Contents/MacOS/proxyman-cli
```

- Prefer a shell alias or PATH entry instead of copying the binary:

```bash
alias proxyman-cli=/Applications/Proxyman.app/Contents/MacOS/proxyman-cli
```

- Confirm the CLI is available:

```bash
which proxyman-cli
proxyman-cli --help
```

- Proxyman must be running and configured so the simulator/device traffic is captured.
- For HTTPS response/header inspection, the simulator/device must trust the Proxyman certificate and SSL proxying must cover the target domain.
- Version requirements from the official CLI documentation:
  - `clear-session` is available from Proxyman macOS 4.12.0.
  - `export-log` is available from Proxyman macOS 5.11.0 for ProxymanSession export.
  - `export-log --format har` and `--format raw` are available from Proxyman macOS 5.20.0.
  - `export-log --since <flow_id>` is available from Proxyman macOS 6.2.0.
  - `proxy-host` is available from Proxyman macOS 7.6.0 and returns the current listening IP and port as JSON.
- Before real API smoke testing, disable Mock in the app unless the case explicitly tests Mock:

```text
dxy-dxyer://nativejump/test/setMock?enabled=0
```

## Standard Flow

1. Clear old traffic before each focused case:

```bash
proxyman-cli clear-session
```

2. Confirm local proxy host when simulator/device proxy setup is in doubt:

```bash
proxyman-cli proxy-host
```

3. Prepare app state through Debug routes, then navigate to the target page:

```text
dxy-dxyer://nativejump/test/switchEnv?env=test
dxy-dxyer://nativejump/test/setMock?enabled=0
dxy-dxyer://nativejump/test/switchUser?userId=<userId>
dxy-dxyer://nativejump/switchTab?tab=myCenter
```

Use `env=dev` only when the current task or test plan explicitly targets dev data.

4. Execute exactly one logical case or one small case group.

5. Export network evidence:

```bash
proxyman-cli export-log \
  --mode domains \
  --domains <api-domain> \
  --format har \
  --output docs-linhay/screenshots/<YYYYMMDD>/<module>/<case-id>-<userId>.har
```

Use `--format proxymansession` when a reviewer needs to reopen the full session in Proxyman. Use `--format raw` only when raw files are easier to diff or inspect.

## Domain Selection

Export the narrowest useful domain set. For dxyer BBS and user switching checks, start with the actual hosts observed in the current run, commonly including:

```bash
--domains bbsapi-dev.dxy.net
--domains bbsapi-test.dxy.net
```

Do not include schemes, ports, or paths in `--domains`; Proxyman CLI only accepts domain names.

If the target host is uncertain, export all logs for the first diagnostic pass, inspect the HAR, then rerun the case with domain filtering:

```bash
proxyman-cli export-log --format har --output /tmp/dxyer-proxyman-diagnostic.har
```

## User Switching Checks

For `test/switchUser?userId=<userId>` verification, inspect exported traffic for:

- `DXY-TOD-SESSION: <userId>` on target API requests,
- absence of higher-priority identity headers such as `DXY-AUTH-TOKEN`,
- absence of stale identity cookies when the debug switch flow is expected to clear them,
- `users/info?userId=<userId>` success when the flow depends on local user hydration,
- response data that explains the UI state under verification.

If a request still carries formal token/cookie identity, do not trust the candidate user state until the identity setup is corrected.

## Smoke Result Semantics

Use these statuses consistently:

| Status | Meaning |
|--------|---------|
| `Pass` | API data matches the expected precondition, and the UI/behavior matches product rules. |
| `Data Mismatch` | The candidate user no longer has the expected server state. Record the actual API/UI state and do not count it as a functional failure. |
| `Fail` | API data matches the expected precondition, but UI display, entry visibility, button state, popup, routing, or state transition is wrong. |
| `Blocked` | Proxyman capture, app login/user switch, target page entry, environment, or required API response is unavailable. |

Mock self-test results are UI and priority baselines only. They do not replace Proxyman evidence for real API smoke conclusions.

## Evidence Naming

Place exported artifacts under the same verification evidence folder as screenshots and AX dumps:

```text
docs-linhay/screenshots/<YYYYMMDD>/<module>/
```

Recommended HAR naming:

```text
<case-id>-<userId>-api.har
<case-id>-<userId>-api.proxymansession
```

Avoid Chinese names, spaces, `latest`, and `final`.

## Handoff

Report:

- exact `proxyman-cli` commands that ran,
- exported artifact paths,
- domains included,
- key request/response facts used for the status,
- whether higher-priority identity headers/cookies were absent,
- remaining risk if Proxyman could not decrypt or export the needed traffic.
