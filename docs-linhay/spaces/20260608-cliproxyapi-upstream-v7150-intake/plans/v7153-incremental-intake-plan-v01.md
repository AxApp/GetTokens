# CLIProxyAPI v7.1.53 Incremental Intake Plan v01

## Scope

This plan covers the upstream delta after the previous `v7.1.50` intake:

- canonical upstream: `https://github.com/router-for-me/CLIProxyAPI.git`
- verified latest upstream tag: `v7.1.53@d55f215c`
- checked absent: `v7.1.54` is not present in the canonical GitHub remote at this check time
- reviewed range: `v7.1.50..v7.1.53`
- post-tag main: `6f38e848 docs: add RunAPI sponsorship details to README files`
- local fork baseline: `docs-linhay/references/CLIProxyAPI#gettokens/sidecar@649d00d3`

The third-party release index may mention `v7.1.54`, but canonical `git ls-remote` and a fresh temporary clone only show tags through `v7.1.53`; use the canonical remote as source of truth.

## Upstream Delta

### Tags

- `v7.1.51@ec672446`: `feat(translator): implement signature delta handling and enhance chunk processing in Gemini and Antigravity translators`
- `v7.1.52@69d937a8`: `chore(build): add Linux-specific release workflows and update release notes handling`
- `v7.1.53@d55f215c`: `chore(build): include ca-certificates in Docker image for improved HTTPS support`

### Untagged Main After v7.1.53

- `6f38e848`: README sponsorship image/text only; no sidecar runtime impact.

## Classification

### Accept: Gemini / Antigravity Claude Signature Hardening

Accept as a GetTokens fork reimplementation, not a raw merge.

Upstream changes:

- Gemini -> Claude streaming now treats signature-only parts as `signature_delta` instead of opening an empty text block.
- Gemini -> Claude final events no longer require `candidatesTokenCount`; `thoughtsTokenCount` can still produce `message_delta`.
- Gemini -> Claude avoids double final events with `HasFinalEvents`.
- Antigravity -> Claude accepts `thoughtSignature` / `thought_signature` even when `thought` is missing, as long as the part is not a function call.
- Antigravity non-streaming treats signature-only parts without `thought` as thinking signature carriers.

Fork status:

- `internal/translator/gemini/claude/gemini_claude_response.go` still lacks explicit `signature_delta` emission for signature-only parts.
- `internal/translator/antigravity/claude/antigravity_claude_response.go` supports signature handling only under `thought: true` in the critical stream path.

GetTokens-specific boundary:

- Keep existing fork behavior for tool name restoration, sanitized names, usage mapping, and current thinking signature cache formatting.
- Do not copy unrelated upstream style or large translator rewrites.
- Add focused tests first, then minimally patch the stream/non-stream paths.

Proposed child space:

- `20260608-cliproxyapi-gemini-antigravity-signature-hardening`

Focused tests:

- `go test ./internal/translator/gemini/claude -run 'TestConvertGeminiResponseToClaude_SignatureOnlyPart' -count=1`
- `go test ./internal/translator/antigravity/claude -run 'TestConvertAntigravityResponseToClaude.*SignatureOnly' -count=1`
- Regression: `go test ./internal/translator/gemini/claude ./internal/translator/antigravity/claude`

Acceptance:

- Signature-only chunks do not open empty text blocks.
- Signature-only chunks do not produce `content_block_stop` for unopened indices.
- `message_delta` still appears when finish metadata lacks `candidatesTokenCount` but has `thoughtsTokenCount`.
- `message_stop` remains emitted after final events.
- Antigravity signature cache still stores the signature against the preceding thinking text.

### Accept: Codex Gemini Request `systemInstruction` Fallback

Accept as a tiny companion fix, either inside the same child space or as the first test in it.

Upstream change:

- `internal/translator/codex/gemini/codex_gemini_request.go` reads `systemInstruction.parts` if `system_instruction.parts` is absent.

Fork status:

- Fork currently reads only `system_instruction.parts`.

GetTokens-specific boundary:

- Keep Codex-facing developer-message mapping unchanged.
- Only add camelCase fallback; do not change role strategy, tool mapping, random call id generation, or thinking config mapping.

Focused test:

- `go test ./internal/translator/codex/gemini -run TestConvertGeminiRequestToCodexSystemInstructionCamelCase -count=1`

Acceptance:

- Gemini camelCase `systemInstruction.parts[].text` becomes a Codex `developer` message with `input_text` content.
- Existing snake_case `system_instruction.parts` behavior remains unchanged.

### Reject / Defer: Service Tier Plugin Example

Do not merge now.

Reasoning:

- Upstream adds an example plugin that sets `service_tier=priority` for Codex `gpt-5.5` when plugin config `fast=true`.
- GetTokens has not decided to expose upstream pluginhost as a product/runtime surface.
- GetTokens Codex service-tier behavior should be modeled as first-class sidecar config or route policy if needed, not introduced through an example plugin copy.

Follow-up only if product decision appears:

- Create a separate `service-tier-routing` design space.
- Decide whether service tier is account-level, channel-level, project-level, or request-normalizer-level.
- Add policy tests before any runtime implementation.

### Reject / Defer: Linux Release Workflow and Docker Changes

Do not merge into GetTokens fork now.

Reasoning:

- GetTokens release scope is macOS-first and parent repo owns sidecar build via `scripts/ensure-sidecar.sh` / release packaging.
- Upstream Linux glibc/no-plugin artifacts and Debian Docker base changes do not affect current GetTokens macOS sidecar distribution.
- Pulling release workflow changes into the fork would add CI noise without shipping value.

### Ignore: README Sponsorship Update

Do not merge.

Reasoning:

- `6f38e848` only updates upstream README sponsorship content and adds `assets/runapi.png`.
- No GetTokens sidecar runtime, management API, or build impact.

## Recommended Execution Order

1. Create child space `20260608-cliproxyapi-gemini-antigravity-signature-hardening`.
2. Add failing tests for:
   - Gemini signature-only stream chunk.
   - Gemini finish chunk without `candidatesTokenCount`.
   - Antigravity signature-only chunk without `thought`.
   - Antigravity non-stream signature-only part without `thought`.
   - Codex Gemini camelCase `systemInstruction`.
3. Patch only the touched translator files.
4. Run focused translator tests.
5. Run broader translator regression:
   - `go test ./internal/translator/gemini/claude ./internal/translator/antigravity/claude ./internal/translator/codex/gemini`
6. If green, run CLIProxyAPI full suite if no other fork work is in progress:
   - `go test ./...`
7. Rebuild local sidecar for dev verification:
   - `./scripts/ensure-sidecar.sh darwin arm64`
8. Start GetTokens dev profile and perform real dev App acceptance:
   - `./scripts/wails-cli.sh dev`
   - confirm dev sidecar uses `~/.config/gettokens-dev/config.yaml`
   - confirm `/healthz` on dev port returns 200
   - archive a screenshot under the child space
9. Commit fork first, then parent gitlink + docs/memory.

## Merge Strategy

Do not merge upstream `v7.1.53` directly.

Use reference-port strategy:

- cherry-pick no upstream commit as-is
- read upstream commit for behavior and tests
- reimplement minimal behavior inside `gettokens/sidecar`
- preserve GetTokens account/routing/usage boundaries
- reject workflow, Docker, README, and plugin example changes unless a separate product/release decision explicitly asks for them

## Current Recommendation

Proceed with exactly one implementation slice:

`Gemini / Antigravity signature hardening + Codex Gemini systemInstruction fallback`

Everything else in `v7.1.50..v7.1.53` should stay deferred or ignored for GetTokens.
