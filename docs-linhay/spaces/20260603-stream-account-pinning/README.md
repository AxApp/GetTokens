# Stream Account Pinning / 流式请求账号冻结

## 背景

用户在 Codex CLI 流式请求中遇到：

```text
stream disconnected before completion: stream closed before response.completed
```

排查发现同一个下游 `/v1/responses` 请求在上游流建立失败/认证失败阶段可能连续尝试多个 Codex 账号；其中候选包含失效 OAuth 账号与 `migration-backups/**` 旧凭证，导致错误表现为 stream 在 `response.completed` 前断开。

本 space 约束本轮修复：**流式请求只能在 stream commit 前进行跨账号 retry；一旦流已向下游提交任何事件/字节，当前请求的账号必须冻结，不能拼接另一个账号继续输出。**

## 目标

1. 为流式执行建立明确的 commit barrier。
2. 同一个下游流式请求在 pre-commit 失败时仍可换账号重试。
3. 一旦 stream committed，后续失败必须结束当前请求，不得在同一个请求内切换账号。
4. runtime 路由不得把 `migration-backups/**` 中的旧 auth 文件纳入候选。
5. OAuth refresh 失效应尽快从候选池排除或返回明确需要重新登录的错误。

## 非目标

1. 不修改 `/Applications/GetTokens.app` 正式版。
2. 不在已输出部分内容的 SSE/WebSocket 流上做跨账号拼接续写。
3. 不做移动端适配或截图验收。
4. 不依赖真实账号、真实 OpenAI/ChatGPT 网络进行回归验证；本轮测试使用 mock 上下游。

## 验收场景（BDD）

### 场景 1：pre-commit 认证失败可以切账号

Given 第一个 Codex OAuth 账号在 `prepareRequestAuth` / refresh 阶段返回 401
And 该请求尚未向下游写出任何 stream 事件
When 同一个下游 stream 请求继续执行
Then sidecar 可以选择第二个可用账号
And 下游只看到第二个账号产生的完整 stream
And 第一个账号被标记为失败/不可用候选

### 场景 2：post-commit 断流不允许切账号

Given 第一个账号已经向下游输出 `response.created` 或 `response.output_text.delta`
When 上游在 `response.completed` 前断开
Then sidecar 不得在同一个 request id 内选择第二个账号继续输出
And 当前流以失败事件/错误结束
And live session / usage attribution 中 committed auth 保持为第一个账号

### 场景 3：migration backup 不参与 runtime routing

Given `auth-dir/migration-backups/accounts-v1-*/foo.json` 存在旧 OAuth 文件
When sidecar 加载 runtime auth 候选
Then 该备份文件不应成为 route auth selected 候选
And 只允许 SQLite active accounts 或明确 runtime source 中的有效账号参与路由

### 场景 4：同一 request 的 committed auth 不可变

Given 一个 request id 已经进入 committed 状态
When 后续发生 upstream closed / EOF / 401 / 429 / 5xx
Then 请求日志、live session 与 usage attribution 都不得把同一 committed request 改绑到另一个 auth id

## 技术计划

1. 在 sidecar streaming conductor / executor 边界补充 pre-commit vs post-commit 错误语义。
2. 优先以结构化错误或 `StreamResult` committed 标记让 `executeStreamMixedOnce` 判断是否还可 retry。
3. WebSocket / SSE 转发层在首次可转发事件或首次下游写出后设置 committed。
4. auth-dir 扫描或 SQLite runtime source 过滤 `migration-backups/**`。
5. 补 mock 单测覆盖 pre-commit 可 retry、post-commit 不 retry、backup auth 不入候选。

## 验收命令

- `go test ./sdk/cliproxy/auth ./internal/watcher ./internal/runtime/executor`（在 `docs-linhay/references/CLIProxyAPI` 内，按实际改动收敛）
- `bash docs-linhay/scripts/check-docs.sh`

## 状态

- 2026-06-03：space 创建，完成 sidecar fork 第一轮实现：post-commit 不 fallback 回归测试、migration-backups runtime 过滤与测试；待后续按需补充 OAuth invalid 快速排除。

## 追加需求：会话级账号粘性与激活集变更

用户补充两个关键约束：

1. 同一个 Codex 会话在同一个账号上失败固定次数后才切到下一个账号；因为 Codex 存在“最后一个会话的最后一个任务”即使额度/用量信息归 0 仍可继续完成的行为，不能只根据本地 quota=0 立即切走。
2. 当只激活一个账号且该账号用量耗尽后，用户激活另一个账号，后续请求必须感知 active account set 变化并切到新可用账号；不得被旧 session/account pin 卡住。

新的设计方向：废弃单纯 request-level retry 视角，改为 session-level account lease + failure budget + account pool epoch。quota=0 作为软信号，不直接驱逐当前会话；真实 upstream terminal failure 才累计失败预算。账号启停、重新登录、route 策略或账号池变更必须推进 epoch，使下一次选择重新评估候选。

## 追加现象：账号激活需重启才参与路由

当前实际问题：只激活账号 A 时，A 用完后再激活账号 B，后续请求仍不切到 B；只有重启 App / sidecar 后，B 才进入候选并被选择。

初步判断：账号启用/禁用变更没有即时推进 runtime auth scheduler / account pool epoch，只有 sidecar 重启后重新 synthesize account store，新的 active set 才生效。本轮修复必须让 account status mutation 触发 runtime apply 或直接 dispatch auth update，并推进 session lease revalidation epoch。

## 追加修复：启用账号即时进入候选

根因：`SetRouteDisabled(false)` 只清除了手动 disabled 标记，没有清理该 runtime auth 之前遗留的 `Unavailable / NextRetryAfter / ModelStates`。因此账号 B 即使被用户启用，scheduler 仍可能认为它处于旧 cooldown/blocked 状态；重启后这些内存态消失，才表现为“重启才会切”。

修复：用户启用账号被视为明确恢复路由意图，`SetRouteDisabled(false)` 同步清空 transient route block 并 upsert scheduler，使账号无需重启即可参与后续候选。

回归：`TestManager_SetRouteDisabled_EnableClearsStaleModelBlocksAndSchedulerPicks`。
