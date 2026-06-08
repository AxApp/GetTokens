# CLIProxyAPI Codex WebSocket Referenced Call Dedupe

## 背景

CLIProxyAPI upstream `e7f4dd47 fix(openai): keep referenced tool call when deduping websocket input IDs` 修复了 Responses WebSocket input item 按 `id` 去重时误删仍被 `function_call_output` 引用的 tool call 的问题。

GetTokens fork 当前 `dedupeResponsesWebsocketInputRaw` 对同 `id` item 只保留最后一个。若 compaction / replay 后同一个 function call `id` 出现新旧两份，而后续 output 仍引用旧 `call_id`，当前逻辑会保留最后的新 call、删除旧 call，导致 upstream 收到 output 但找不到对应 tool call。

## 目标

在不引入 upstream 其他 WebSocket executor 改动的前提下，让 input dedupe 保留仍被 output 引用的 tool call。

## 范围

- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`
- 本 space README、memory、必要验证记录

## 非目标

- 不移植 upstream Codex reasoning replay cache。
- 不改 pinned auth failover、full transcript replay、previous_response_id 清理或 route guard。
- 不调整 GetTokens live sessions、usage attribution、account routing。

## 验收标准

### BDD 场景

1. 给定 Responses WebSocket input 中两个 item 使用相同 `id`，且后面的 `function_call_output` 引用第一个 item 的 `call_id`，当 dedupe 执行时，保留被引用的第一个 function call，删除未被引用的新 item。
2. 给定重复 `id` 的普通 message item，当没有 output 引用时，仍保持现有“保留最后一个”的行为。
3. 给定 item 没有 `id`，dedupe 不删除它。
4. 该修复不改变 full transcript replacement、incremental input、tool call repair 的既有边界。

### 验证命令

- 红灯：`go test ./sdk/api/handlers/openai -run TestNormalizeSubsequentRequestKeepsReferencedToolCallWhenDedupingInputIDs -count=1`
- 绿灯：同上
- 回归：`go test ./sdk/api/handlers/openai -run 'Test(NormalizeSubsequentRequest|RepairResponsesWebsocketToolCalls)' -count=1`
- 收敛：`go test ./sdk/api/handlers/openai`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- 建议 branch：`feat/20260608-cliproxyapi-codex-websocket-dedupe-referenced-call`
- 建议 worktree：`../GetTokens-worktrees/20260608-cliproxyapi-codex-websocket-dedupe-referenced-call/`
- 本次执行：短修复，直接在 `docs-linhay/references/CLIProxyAPI#gettokens/sidecar` 子仓处理，未创建独立 worktree。

## 相关链接

- 总控 intake：`docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/README.md`
- 实现级 review：`docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/plans/implementation-review-v01.md`

## 当前状态
- 状态：done
- 最近更新：2026-06-08

## 实现记录

- 新增红灯测试 `TestNormalizeSubsequentRequestKeepsReferencedToolCallWhenDedupingInputIDs`，覆盖 `function_call_output.call_id` 仍引用旧 tool call 时，重复 `id` 去重不能保留未引用的新 call。
- `dedupeResponsesWebsocketInputRaw` 先解析 item `type/id/call_id`，收集 `function_call_output` / `custom_tool_call_output` 引用的 `call_id`，重复 `id` 时优先保留被 output 引用的 item；没有引用时继续保持既有“保留最后一个”行为。
- 未引入 upstream reasoning replay cache、executor 重构或其他 Codex WebSocket 行为改动。

## 验证记录

- 红灯已确认：修复前新增测试失败，表现为去重保留 `call-stale`，期望 `call-referenced`。
- `go test ./sdk/api/handlers/openai -run TestNormalizeSubsequentRequestKeepsReferencedToolCallWhenDedupingInputIDs -count=1`
- `go test ./sdk/api/handlers/openai -run 'Test(NormalizeSubsequentRequest|RepairResponsesWebsocketToolCalls)' -count=1`
- `go test ./sdk/api/handlers/openai`
- `go test ./sdk/api/handlers/openai ./internal/runtime/executor ./sdk/cliproxy/auth`
- `git diff --check -- sdk/api/handlers/openai/openai_responses_websocket.go sdk/api/handlers/openai/openai_responses_websocket_test.go`
- `go test ./...`

## 真实 dev App 手点验收

- 启动方式：`./scripts/wails-cli.sh dev`，脚本自动设置 `GETTOKENS_APP_PROFILE=dev`。
- 正式版未触碰确认：启动前已有 `/Applications/GetTokens.app/Contents/MacOS/GetTokens` 与 prod sidecar `~/.config/gettokens/config.yaml` 在运行；验收过程中未 kill、重启、替换正式版进程或正式版 sidecar。
- dev App 进程：`build/bin/GetTokens.app/Contents/MacOS/GetTokens`。
- dev sidecar 进程：`build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`。
- dev sidecar 端口：`18317`，与 prod sidecar `8317` 分离。
- sidecar 构建指纹：`29f4f577:dirty:622a9428446eb85e21f7fce025a26a0f48f3e823c3771afe82273ac0d959fb87:darwin:arm64`。
- sidecar 日志确认：`CLIProxyAPI Version: v7.1.28-95-g29f4f577-dirty`，`API server started successfully on: :18317`。
- 健康检查：`curl -I http://127.0.0.1:18317/healthz` 返回 `HTTP/1.1 200 OK`。
- 手点/可见窗口：真实 Wails dev 窗口已出现并显示账号池页面；因当前终端无辅助功能权限，未用脚本切换页面，截图做了上半屏裁剪以避免归档账号邮箱明细。
- 截图：`screenshots/20260608/dev-app/20260608-dev-app-sidecar-ready-after-v01.png`。
- 观察到的 dev 数据噪声：sidecar 日志存在旧 OAuth refresh token `refresh_token_reused` 警告，属于 dev 账号数据状态，不影响本次 WebSocket input 去重修复验收。
