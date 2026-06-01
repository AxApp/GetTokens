# CLIProxyAPI tag reference port session distillation

日期：2026-06-01

## 背景

本轮用户要求查看 `CLIProxyAPI` 上游到最新 tag 的更新内容，并按推荐实现 GetTokens 可接受的部分。根据当前治理规则，GetTokens sidecar 已不再按 upstream merge-style 同步；上游 release tag 只作为参考输入。

执行时没有合并或 cherry-pick 上游 `v7.1.37`，而是按 tag delta 拆成可验收需求，再在 `AxApp/CLIProxyAPI#gettokens/sidecar` 内重实现低风险能力。

## 本轮采用的模式

1. 先做 upstream tag delta 审核，区分低风险能力、需要重新设计的运行态能力、以及暂不采纳的大块改动。
2. 每个可接受能力单独创建 `space`，写清背景、范围、验收和不做事项。
3. 按 GetTokens sidecar 边界重实现，不把 upstream 合并提交直接引入维护分支。
4. 每个能力都补窄测试，避免只靠全量回归证明行为。
5. fork 内先提交并推送 `gettokens/sidecar`，再在父仓提交 gitlink、space、memory 和 qmd 索引。

## 本轮接受的能力

已完成并提交到 `AxApp/CLIProxyAPI#gettokens/sidecar@9c75aa70`：

1. WebSocket fallback 到 HTTP auth 时移除 top-level `generate`。
2. Responses WebSocket `input` 按 `id` 去重，保留最后一条，保留无 id item。
3. Gemini Responses translator 将 `developer` role 并入 `systemInstruction`。
4. OAuth callback 写入文件前创建缺失 auth dir，并避免日志泄漏 redirect secret。
5. AMP response tool casing 恢复请求声明大小写，补 `claude-opus-4-8` 与 `grok-imagine-video-1.5-preview` 模型支持。

## 本轮明确不纳入

以下内容没有进入 GetTokens sidecar：

1. 不做 upstream `v7.1.37` 整包 merge。
2. 不引入 `HomeAppLogForwarder`。
3. 不移植 Codex identity confuse / signature replay blocks。
4. 不触碰 GetTokens 账号 SQLite、quota guard、live sessions、route guard、前端或 Wails runtime。

## 可复用规则

后续当用户要求“看上游最新 tag 有什么能实现”时，默认执行 tag reference port loop：

1. fetch upstream / origin，确认当前维护分支和最新 upstream tag。
2. 用 commit log、diff stat 和风险面审查列出候选功能。
3. 按低风险移植、需要 GetTokens 重新设计、拒绝三类分类。
4. 只对接受项创建 `space` 并进入 BDD/TDD 实现。
5. 对每个接受项补 focused tests，再跑 fork 全量 `go test ./...`。
6. fork 提交在前，父仓 gitlink / docs / memory 提交在后。
7. 若只是源码参考移植且未重建桌面 sidecar，不把它描述为“本地 app 已更新运行时”；需要桌面验收时再执行 `./scripts/ensure-sidecar.sh darwin arm64`。

## 不升级 AGENTS 的原因

该模式只适用于 CLIProxyAPI fork 维护，已有 `gettokens-domain-engineering` 作为领域 skill 承载。它不改变 repo-wide 工作流，也不新增所有需求都必须遵守的通用治理规则，因此不更新 `AGENTS.md`。
