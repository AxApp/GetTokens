---
name: gettokens-performance-governance
description: GetTokens 性能治理：用于排查或预防内存占用、WebView/Wails 卡顿、React 渲染放大、大账号池请求放大、sidecar Go 热路径、日志/SQLite/本地文件膨胀、性能回归、perf budget 或 profiling 验收；当用户说性能、内存、卡顿、占用、峰值、泄漏、慢、回归、治理、budget、pprof、profiling，或改动触及账号池、quota、live sessions、session-management、usage attribution、sidecar management API、Wails bridge、日志热路径时使用。
---

# GetTokens Performance Governance

## 0. Admission Gate

Only enter implementation after the performance candidate has evidence:

1. **Source**: user report, Activity Monitor sample, log growth, test regression, backlog item, or profiling trace.
2. **Surface**: WebView/React, Wails bridge, sidecar Go, SQLite/local files, logs, network/API, or packaging/runtime.
3. **Observed symptom**: current memory/CPU/payload/log/query/DOM/request count, with the command or UI source that produced it.
4. **Acceptance budget**: the limit or regression guard that will prove improvement.
5. **Disproof condition**: what evidence would show this is not the suspected layer.

If any item is missing, stay in research and document the gap. Do not patch from intuition.

## 1. Budget First

Define a small explicit budget before changing code:

- Memory: RSS, physical footprint, heap retained size, cache entries, loaded message/request count.
- Rendering: mounted DOM rows, virtualized window size, render frequency, expensive selector fan-out.
- API/Wails: request count, query length, payload bytes, marshalling size, batch size, p95 duration.
- Sidecar/Go: allocations, goroutine count, SQLite scan count, log line size, hot-path latency.
- Storage: localStorage/sessionStorage keys and bytes, IndexedDB/cache size, log rotation size, session file read scope.

Prefer a budget that fails on the old behavior and passes on the intended fix. For broad work, start with one tracer-bullet path that crosses the real layer boundary.

## 2. WebView, Wails, and React

For Wails WebContent memory or UI latency:

1. Map the macOS process first: Activity Monitor row, `ps`, `lsof`, `vmmap`, and whether it is WebKit WebContent, the Wails app process, or sidecar.
2. Check persistent browser storage under the Wails origin before blaming React heap: localStorage, IndexedDB, Cache, and WAL files.
3. Bound large frontend state:
   - no unbounded session messages, raw JSON, history requests, or account lists in component state;
   - no full snapshot duplication in WebView localStorage when backend/Wails cache already exists;
   - use fixed render windows or virtualization for thousands of sessions/accounts;
   - chunk Wails calls that carry large key lists.
4. Verify with focused unit tests, source guards, DOM/count assertions, typecheck/build, and Wails build when bindings or runtime surfaces change.
5. Use real dev App validation only when the bug depends on native lifecycle, Wails binding visibility, WebKit process ownership, or user explicitly asks for desktop hand-check.

## 3. Accounts, Quota, and Session Scale

Treat large account/session data as hostile input:

- Account list and group actions must avoid N single-account Wails calls when a batch bridge exists or can be added.
- Quota/status reads must cap batch size and avoid oversized GET query strings.
- Account-card usage refresh should reuse the current frontend `AccountRecord[]` snapshot by default. Do not ask Wails/sidecar to rescan the account pool just to resolve usage attribution for cards; request unresolved attribution only when the frontend can join it locally by stable facts such as `accountKey`, `quotaKey`, or `authIndex`, and build a reusable attribution index instead of scanning all usage items once per account. Full Usage Desk and diagnostics surfaces may opt into backend account resolution when they explicitly need cross-account attribution.
- Session-management and live-session views must cap retained detail/history state separately from backend storage.
- Local caches must be write-if-changed, bounded, and disabled in Wails runtime when they duplicate backend cache without clear benefit.
- Logs must summarize repeated ids such as `account_key` / `account_keys`; never expand thousands of account ids into access logs. Runtime performance probes should prefer counts, booleans, and durations (`items`, `unresolved`, `resolve_account_keys`, `*_ms`) over identities or payload excerpts.
- Storage retention budgets must preserve the largest product query window unless the UI/API contract is intentionally changed; for example, do not set usage-attribution retention below an existing `30D` Usage Desk view.
- When adding wall-clock pruning to shared stores, protect tests or helpers that intentionally use simulated clocks; use explicit clock injection, startup-only pruning, or test-only prune disablement rather than breaking rate-limit/window fixtures.

## 4. Sidecar and Go Hot Paths

For sidecar performance or memory:

1. Name mock upstream facts and mock downstream/spy outputs before implementation.
2. Prefer focused Go tests around the decision or IO boundary before broad `go test ./...`.
3. Use pprof or benchmarks when a claim depends on allocations, CPU, or goroutines; otherwise use deterministic counters such as request count, query count, log size, and payload size.
4. Keep sidecar authority in `CLIProxyAPI#gettokens/sidecar` for hot-path runtime state. Do not fake sidecar-completed work in frontend or Wails.
5. For admission, routing, quota, rate-limit, and usage hooks, prove the no-op path before any write, lock, or broad scan. In large account pools, feature-disabled or no-rule cases must return before SQLite writes such as reservation expiry; add a regression that the empty-rule path does not deny admission or mutate the shared store.
6. For large route diagnostics or decision history, store totals plus bounded samples instead of full candidate sets. Preserve the selected auth and candidate count for explainability, but do not materialize or clone thousands of candidates on the request path.
7. For per-account liveness checks inside batch workers, prefer the narrowest query that proves the required fact, such as `SELECT 1` existence checks. Avoid full account/card/credential reads when the worker only needs to know whether the account still exists.
8. In-memory job/result stores must have a terminal-history cap or TTL. Keep active jobs observable, but do not retain completed large `items/errors/account_keys` payloads without a bounded policy.
9. Post-request local accounting must not depend on the client request context after the upstream response completes. Usage attribution, reservation release, and rate-limit refresh should use a bounded background context so client cancellation does not skip local state cleanup or flood logs with `context canceled`.
10. Rebuild or verify the actual sidecar binary used by dev App before claiming runtime acceptance.

## 5. Regression Gates

Pick the narrowest gate that would have caught the issue:

- Source guard: constants, chunk size, cache disable conditions, redaction rules, virtual window size.
- Unit test: bounded helper, selector, cache, route guard, log masking, SQLite query behavior.
- Browser/DOM check: mounted row count, overflow, repeated renders, preview stability.
- Build gate: `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `go test`, `./scripts/wails-cli.sh build`.
- Runtime evidence: Activity Monitor / `vmmap`, `lsof`, sidecar log sample, pprof profile, dev bridge or management API state.

Record both the old failing behavior and the new passing evidence in the relevant space or memory entry.

## 6. External Patterns Worth Borrowing

Use GitHub projects as pattern references, not as rules to install blindly:

- [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci): budget-as-code and regression prevention for browser-like surfaces.
- [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals): user-visible browser responsiveness metrics vocabulary.
- [facebook/memlab](https://github.com/facebook/memlab): scenario-based JavaScript heap leak investigation.
- [grafana/k6](https://github.com/grafana/k6): threshold-driven API/load checks.
- [sitespeedio/sitespeed.io](https://github.com/sitespeedio/sitespeed.io): repeatable synthetic browser performance runs.
- [google/pprof](https://github.com/google/pprof): profiling data visualization and analysis for Go hot paths.

Only promote an external pattern when it maps to a GetTokens evidence source, execution step, and local validation path.
