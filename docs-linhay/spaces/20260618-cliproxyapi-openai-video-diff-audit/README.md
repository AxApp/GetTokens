# 20260618-cliproxyapi-openai-video-diff-audit

## 背景

本 space 承接 CLIProxyAPI v7.2.16 intake 的 Phase 4：OpenAI video support diff audit。

GetTokens fork 已有 `sdk/api/handlers/openai/openai_videos_handlers.go` 与基础 XAI video tests，且历史 space `20260601-cliproxyapi-amp-model-registry` 已记录 `grok-imagine-video-1.5-preview` 支持。但 v7.2.16 upstream 又新增了一批更重的 video 能力：OpenAI Sora model 映射、video retrieve/content URL 归一化、selected auth 绑定、proxy 下载与 TTL cache。

这些能力不只是 translator 小修，而是 video proxy 产品能力与账号/代理绑定策略。按 intake 规则，只有当 GetTokens 产品确认要支持 video proxy 用户场景时才进入实现；当前轮没有用户可见 video proxy 需求或验收入口，因此只做差异审计，不改 fork。

## 目标

1. 对比 v7.2.16 upstream 与当前 fork 的 video handler/test 差异。
2. 明确哪些 upstream tests 缺失、对应能力是什么。
3. 判断本轮是否具备进入 TDD 实现的证据门禁。
4. 若证据不足，把候选转为后续产品条件需求，而不是直接照搬 upstream。

## 范围

- upstream 文件：
  - `/private/tmp/cliproxyapi-v7216-impl.C8sRC1/upstream/sdk/api/handlers/openai/openai_videos_handlers.go`
  - `/private/tmp/cliproxyapi-v7216-impl.C8sRC1/upstream/sdk/api/handlers/openai/openai_videos_handlers_test.go`
- fork 文件：
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_videos_handlers.go`
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_videos_handlers_test.go`
- 子计划：
  - `plans/openai-video-diff-audit-v01.md`

## 非目标

- 本轮不实现 Sora -> XAI backend 映射。
- 本轮不实现 video retrieve/content URL 下载代理。
- 本轮不实现 selected auth binding / TTL store。
- 本轮不改 model catalog、账号能力、Wails/前端 video UI 或 GetTokens 产品入口。
- 不触碰正式版 `/Applications/GetTokens.app`。

## 验收标准

### BDD 场景

1. 给定 upstream 新增 video tests，当审计 fork 时，必须列出 fork 缺失的 tests 和能力族。
2. 给定候选能力涉及视频文件下载、代理和账号绑定，当没有 GetTokens 产品需求和 fake upstream 验证入口时，必须 defer，不进入实现。
3. 给定后续产品确认要做 video proxy，必须先建立独立 evidence gate：fake upstream、auth binding、proxy、retrieve error normalization、model catalog 与用户入口验收。

### 当前审计结论

结论：`defer-product-scenario-no-port`。

fork 已有基础 XAI video handler，但缺 upstream v7.2.16 以下新增 tests / 能力：

- `TestBuildXAIVideosCreateRequestMapsSoraModelToXAIBackend`
- `TestBuildVideosRetrieveAPIResponseFromXAINormalizesTopLevelError`
- `TestBuildVideosRetrieveAPIResponseFromXAINormalizesNestedError`
- `TestXAIVideoContentURLFromPayload`
- `TestWriteVideoContentFromURL`
- `TestWriteVideoContentFromURLUsesPinnedAuthProxy`
- `TestWriteVideoContentFromURLFallsBackToGlobalProxy`
- `TestVideosContentUsesSelectedAuthProxyForDownload`
- `TestVideosCreateBindsRetrieveToSelectedAuth`
- `TestXAIVideosNativeCreateBindsRetrieveToSelectedAuth`
- `TestVideoAuthBindingTTLUsesConfig`
- `TestVideoAuthBindingStoreExpiresEntries`

缺失能力归类：

| 能力族 | upstream 行为 | 本轮结论 |
| --- | --- | --- |
| Sora compatibility | 接受 `sora-2*`，向 XAI backend canonicalize | defer，需要 model catalog / 账号能力产品判断 |
| Retrieve response normalization | XAI retrieve error / success 转 OpenAI video resource | defer，需要 video proxy API 验收入口 |
| Content URL download | 从 XAI payload 抽取 content URL，并用 HTTP/proxy 下载 | defer，涉及网络下载、代理、文件流 |
| Selected auth binding | create 后 retrieve/content 绑定同一 auth 与 proxy | defer，涉及账号选择与代理策略 |
| TTL cache | video id -> auth id 绑定 TTL | defer，需要与 GetTokens sidecar runtime state 边界对齐 |

本轮没有红灯实现，因为缺的是产品场景和验收入口，不是已确认的 GetTokens sidecar bug。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260618-cliproxyapi-openai-video-diff-audit`
- worktree：`../GetTokens-worktrees/20260618-cliproxyapi-openai-video-diff-audit/`

## 相关链接

- Parent intake：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md`
- Parent plan：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/plans/v7216-intake-plan-v01.md`
- Historical video model space：`docs-linhay/spaces/20260601-cliproxyapi-amp-model-registry/README.md`

## 当前状态
- 状态：deferred-product-scenario-no-port
- 最近更新：2026-06-18
