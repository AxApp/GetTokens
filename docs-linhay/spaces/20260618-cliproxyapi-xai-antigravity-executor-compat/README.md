# CLIProxyAPI v7.2.16 XAI / Antigravity / Claude executor compat audit

## 背景

CLIProxyAPI upstream v7.2.16 在 executor/runtime 层新增了 XAI、Antigravity 与 Claude 兼容行为。GetTokens 不做上游全量合并，需要按 sidecar 所有权逐项评估：可补窄行为重新实现，涉及新运行态或产品策略的能力先记录证据并延后。

## 目标

- 评估 upstream v7.2.16 executor/runtime 差异。
- 接入边界明确、可用 focused test 证明的 Claude web_search domain sanitizer。
- 将 XAI WebSocket executor、XAI compact/reasoning、Antigravity UA/grounding/signature/home-kv 等混合运行态差异转为后续产品/运行态策略候选。

## 范围

- Fork：`docs-linhay/references/CLIProxyAPI`，branch `gettokens/sidecar`。
- 上游参考：`router-for-me/CLIProxyAPI` v7.2.16。
- 本轮实现候选：Claude executor 对 built-in `web_search_*` tools 的空 `allowed_domains` / `blocked_domains` 清理。
- 本轮审计候选：XAI executor、XAI websocket executor、Antigravity executor、Antigravity version/UA runtime。

## 非目标

- 不 full-merge / cherry-pick 上游大提交。
- 不接入 upstream XAI WebSocket passthrough 或新 executor，避免改变 GetTokens Codex/WebSocket 热路径所有权。
- 不改变账号选择、route guard、rate-limit、live sessions、usage attribution。
- 不触碰 `/Applications/GetTokens.app` 正式版。

## 验收标准

- Claude domain sanitizer 有红灯测试、最小实现、focused/package 测试结果。
- 延后项有来源、当前差异、延后原因与重新进入条件。
- fork commit 后重建 sidecar，`build/bin/cli-proxy-api.meta.json` 指向 clean fork commit。
- 文档与 memory 写回，运行 `docs-linhay/scripts/check-docs.sh` 与 `git diff --check`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260618-cliproxyapi-xai-antigravity-executor-compat`
- worktree：`../GetTokens-worktrees/20260618-cliproxyapi-xai-antigravity-executor-compat/`

## 相关链接

- 实现记录：`plans/claude-web-search-domain-sanitizer-v01.md`
- intake：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md`

## 当前状态
- 状态：implemented-with-deferred-runtime-items
- 最近更新：2026-06-18
