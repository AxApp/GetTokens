# Sidecar System Proxy and Proxyman Verification

## Background

This session fixed and verified a GetTokens sidecar egress issue: `cli-proxy-api` is a local child process, but its outbound traffic is not automatically captured by Proxyman unless the sidecar explicitly follows the macOS system proxy or a request-specific proxy route. The Settings page now exposes a `use-system-proxy` switch, and the sidecar applies it through `config.yaml` plus the management API.

## Runtime Boundary

Proxy priority is:

1. Account-level `proxy-url`
2. Global `proxy-url`
3. Request/context roundtripper
4. `use-system-proxy`
5. Direct connection

An explicit `direct` route remains a hard opt-out and must bypass the system proxy.

`use-system-proxy` must cover all sidecar egress paths that can reach upstream services:

- Standard HTTP requests
- Management `api-call`
- Codex upstream WebSocket connections
- Claude/uTLS-specific transports

## Startup Apply Semantics

Settings may be changed while the sidecar is still starting. The expected behavior is:

1. Write the latest value to the local sidecar `config.yaml`.
2. If the sidecar is not `ready`, mark the management apply as pending.
3. When the sidecar becomes `ready`, push the latest config with `PUT /v0/management/config.yaml`.
4. Clear the pending marker only after the management API returns success.
5. Keep the pending marker after failure so the next ready callback can retry.

This avoids a startup race where users toggle the setting during app launch but the running sidecar keeps the old behavior until the next restart.

## Proxyman A/B Verification

Use this flow for real capture verification.

1. Confirm Proxyman proxy details:

```bash
proxyman-cli proxy-host
scutil --proxy
```

Expected local testing shape: Proxyman reports port `9090`, and `scutil --proxy` shows HTTP/HTTPS proxy enabled for `127.0.0.1:9090`.

2. Clear existing capture state:

```bash
proxyman-cli clear-session
```

3. Apply `use-system-proxy: false`, then send a real sidecar HTTPS probe:

```bash
curl -sS -X POST \
  -H 'Authorization: Bearer gettokens-local-management-key' \
  -H 'Content-Type: application/json' \
  --data '{"method":"GET","url":"https://www.example.com/?gettokens_proxy_probe=off"}' \
  http://127.0.0.1:18317/v0/management/api-call
```

4. Export filtered HAR:

```bash
proxyman-cli export-log --mode domains --domains www.example.com --format har --output /tmp/gettokens-proxyman-system-proxy-off.har
```

The OFF run should not contain a sidecar `CONNECT` entry for `www.example.com`.

5. Apply `use-system-proxy: true`, clear session again, and repeat the probe:

```bash
proxyman-cli clear-session
curl -sS -X POST \
  -H 'Authorization: Bearer gettokens-local-management-key' \
  -H 'Content-Type: application/json' \
  --data '{"method":"GET","url":"https://www.example.com/?gettokens_proxy_probe=on"}' \
  http://127.0.0.1:18317/v0/management/api-call
proxyman-cli export-log --mode domains --domains www.example.com --format har --output /tmp/gettokens-proxyman-system-proxy-on.har
```

The ON run must contain a `CONNECT` entry with:

- `_clientName`: `cli-proxy-api`
- `method`: `CONNECT`
- `status`: `200`
- `_clientBundlePath`: the current GetTokens sidecar binary path, such as `build/bin/cli-proxy-api`

## Fork Maintenance Notes

When this behavior requires CLIProxyAPI fork changes:

1. Commit changes inside `docs-linhay/references/CLIProxyAPI` first.
2. Rebuild the local sidecar with:

```bash
./scripts/ensure-sidecar.sh darwin arm64
```

3. Commit the parent repository gitlink and any rebuilt runtime artifacts afterward.

This keeps the parent repository from pointing at an uncommitted fork state and makes release CI reproduce the same sidecar behavior.

