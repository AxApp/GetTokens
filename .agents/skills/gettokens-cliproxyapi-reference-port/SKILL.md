---
name: gettokens-cliproxyapi-reference-port
description: GetTokens CLIProxyAPI 上游版本 intake / reference-port 工作流：看新 tag、规划合并、拆子 space、在 gettokens/sidecar 内重实现、验证、重建 sidecar、dev App 验收与双仓提交。
---

# GetTokens CLIProxyAPI Reference Port

Use this skill when the user asks to inspect new upstream CLIProxyAPI versions, plan or execute an upstream merge, sync selected upstream behavior, or handle `docs-linhay/references/CLIProxyAPI`.

## 1. Source Of Truth

- Canonical upstream is `https://github.com/router-for-me/CLIProxyAPI.git`.
- GetTokens maintained fork is `docs-linhay/references/CLIProxyAPI` on `gettokens/sidecar`.
- Do not treat `AxApp/CLIProxyAPI` or local tags as canonical upstream when deciding what is new.
- If a third-party index mentions a newer version, verify it with `git ls-remote --tags --refs` or a fresh temporary clone before planning around it.

## 2. Default Merge Policy

- Do not full-merge upstream tags into `gettokens/sidecar`.
- Do not cherry-pick large upstream commits as-is.
- Use upstream commits only as reference input.
- Reimplement accepted behavior narrowly inside GetTokens sidecar boundaries.
- Preserve GetTokens-specific runtime ownership: account selection, route guard, rate-limit, live sessions, usage attribution, system proxy, and Codex WebSocket hot paths remain sidecar-owned.
- Reject or defer upstream build workflow, Docker, README, sponsorship, plugin examples, or release packaging changes unless there is a separate product or release decision.

## 3. Intake Planning

1. Confirm parent and fork state:
   - `git status --short`
   - `git -C docs-linhay/references/CLIProxyAPI status --short`
   - `git -C docs-linhay/references/CLIProxyAPI branch --show-current`
   - `git -C docs-linhay/references/CLIProxyAPI log -1 --oneline`
2. Read canonical upstream tags:
   - `git ls-remote --tags --refs https://github.com/router-for-me/CLIProxyAPI.git 'refs/tags/v*'`
3. Compare from the previous accepted baseline:
   - `git log --oneline --decorate --reverse <old-tag>..<new-tag>`
   - `git diff --stat <old-tag>..<new-tag>`
   - `git diff --name-only <old-tag>..<new-tag>`
4. Create or update an intake space under `docs-linhay/spaces/<YYYYMMDD>-cliproxyapi-upstream-<topic>/`.
5. Classify each upstream delta:
   - accept as reference-port
   - plan only
   - defer pending product/release decision
   - reject or ignore
6. For every accepted implementation slice, create a child `space` with an evidence matrix before editing code.

## 4. Evidence Gate

Before writing code, the child space must record:

- upstream source commit or tag
- current fork code location
- observable missing behavior or failing-state proof
- focused red test command
- expected acceptance path
- explicit non-goals

Do not implement a candidate just because it looks low-risk. Evidence-lacking candidates stay in planning or research.

## 5. Implementation Loop

1. Add focused failing tests in `docs-linhay/references/CLIProxyAPI`.
2. Run the focused tests and confirm red.
3. Patch only the necessary fork files.
4. Run `gofmt` for touched Go files.
5. Re-run focused tests and the directly affected package set.
6. If green, run:
   - `git -C docs-linhay/references/CLIProxyAPI diff --check`
   - `cd docs-linhay/references/CLIProxyAPI && go test ./... -count=1`
7. Commit the fork first:
   - `git -C docs-linhay/references/CLIProxyAPI add <paths>`
   - `git -C docs-linhay/references/CLIProxyAPI commit -m "<message>"`
8. Rebuild local sidecar from the clean fork commit:
   - `./scripts/ensure-sidecar.sh darwin arm64`
9. Confirm `build/bin/cli-proxy-api.meta.json` points to `<fork-commit>:clean`.
10. If the fork worktree has unrelated dirty files that must be preserved, build from a temporary clean detached worktree instead of accepting a dirty fingerprint:
   - `commit="$(git -C docs-linhay/references/CLIProxyAPI rev-parse HEAD)"`
   - `tmp="$(mktemp -d /private/tmp/gettokens-cliproxy-clean.XXXXXX)"`
   - `git -C docs-linhay/references/CLIProxyAPI worktree add --detach "$tmp/src" "$commit"`
   - `CLI_PROXY_SOURCE_DIR="$tmp/src" ./scripts/ensure-sidecar.sh darwin arm64`
   - remove the temporary worktree after the build and confirm meta records `<fork-commit>:clean`.

## 6. Real Dev App Acceptance

Every implementation slice needs real dev App acceptance unless blocked and documented.

- Start dev profile:
  - `GETTOKENS_APP_PROFILE=dev ./scripts/wails-cli.sh dev`
- Confirm process separation:
  - dev App: `build/bin/GetTokens.app/Contents/MacOS/GetTokens`
  - dev sidecar: `build/bin/cli-proxy-api -config ~/.config/gettokens-dev/config.yaml`
  - prod App: `/Applications/GetTokens.app` must not be killed, restarted, or replaced
- Confirm health:
  - `curl http://127.0.0.1:18317/healthz`
- Archive a screenshot under:
  - `docs-linhay/spaces/<space-key>/screenshots/<YYYYMMDD>/<module>/<YYYYMMDD>-<module>-<scene>-(before|after|baseline|failed)-vNN.png`
- Redact account emails, API keys, bearer tokens, cookies, raw payloads, or other credentials before committing screenshots.
- Stop Wails dev after acceptance and confirm dev sidecar is not left running.

## 7. Parent Repo Closure

After the fork commit and dev acceptance:

1. Update child space implementation and acceptance records.
2. Update `docs-linhay/memory/YYYY-MM-DD.md` with the fork commit, tests, sidecar rebuild, dev App result, and prod untouched confirmation.
3. Run `docs-linhay/scripts/check-docs.sh`.
4. Stage only the closure set:
   - `docs-linhay/references/CLIProxyAPI`
   - relevant `docs-linhay/spaces/<space-key>/...`
   - `docs-linhay/memory/YYYY-MM-DD.md`
   - any intentionally committed redacted screenshots
5. Commit the parent repo after verifying staged paths.

## 8. Dirty Worktree Rules

- If the parent repo has unrelated staged or unstaged changes, do not absorb them into a CLIProxyAPI reference-port commit unless the user explicitly asks to commit that staged work.
- If another agent or process commits while you are working, re-check `git status --short` and `git log -1 --oneline` before staging your closure.
- If a required memory file already has unrelated staged changes, prefer committing the existing staged work first or make a separate skill-only commit; do not silently mix unrelated memory edits into a claimed reference-port closure.
- If `ensure-sidecar.sh` reports `dirty` only because the fork contains unrelated local work, do not rewrite or stash that work. Use `CLI_PROXY_SOURCE_DIR` with a temporary clean worktree for the rebuild, then document the clean fingerprint and the intentionally preserved dirty files.

## 8.1 Sidecar Smoke Evidence Boundary

When maintaining `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` and its manifest checker:

- Treat the smoke binary as test-only evidence. It must not be copied into `build/bin/GetTokens.app`, `Contents/MacOS/cli-proxy-api`, `/Applications/GetTokens.app`, release staging, or published assets.
- The manifest must distinguish source state from binary artifact state: `sourceState.classification` records `clean-source` or `dirty-source`, while `sourceState.artifactClass` remains `volatile-test-binary`.
- Dirty primary smoke is acceptable only as source-state evidence. If the same commit can be checked out cleanly, run or record a clean comparison smoke and write `sourceStateComparison.cleanComparisonAvailable=true`, `sameCommit=true`, `cleanManifestPath`, `cleanSourceStateHash`, and `cleanBinarySha256`.
- If clean comparison cannot run, record `sourceStateComparison.cleanComparisonAvailable=false` with a concrete `cleanUnavailableReason`; do not silently promote dirty smoke into release evidence.
- Docs gates must use stable fixture mode and must not rebuild sidecar. Latest-mode tests that temporarily write `/private/tmp` latest manifests must backup and restore any existing latest evidence before exiting.
- Keep `reproducibilityBoundary.binarySha256Volatile=true`, `releaseBoundary.dirtyStatusEvidenceOnly=true`, `testOnly=true`, `notReleaseArtifact=true`, and `releasePipelineEligible=false` locked in checker tests.

## 9. Completion Summary

Final response should include:

- fork commit
- parent commit
- accepted upstream behavior
- rejected/deferred upstream items
- tests run
- sidecar rebuild fingerprint or fork commit from meta
- real dev App acceptance result
- prod untouched confirmation
- any remaining dirty worktree items that were intentionally left alone
