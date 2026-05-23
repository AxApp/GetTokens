# Claude Usage 本地投影会话沉淀

日期：2026-05-23

## 背景

本轮修复 `#frame=claude&workspace=usage` 无数据时，最初只补了 Claude Code 本地 session JSONL parser 和 Wails binding。后续复核真实本机数据时发现后端已经可以读出 projected rows，但前端 `UsageDeskFeature` 把 `workspace === 'claude'` 硬编码进 observed 分支，导致用户点击“本地文件投影”后仍然渲染真实请求量区块。

因此这轮可复用模式不是“Claude parser 怎么写”，而是 Usage Desk 新增 provider-local projection 时必须端到端校验：本地文件读取、provider 缓存、事件分流、Wails binding、preview 数据、source 分支和真实样本 sanity check。

## 沉淀模式

1. 本地文件投影必须是 provider-specific 数据源。
   - Codex rollout 与 Claude Code session 不能共用同一缓存状态。
   - `usage-local:*` 事件必须带 `provider`，前端必须按当前 workspace 过滤。
   - Wails binding 要覆盖 internal app、root `main.App`、生成的 `frontend/wailsjs` 和前端 hook import。

2. Claude Code session 只能只读投影。
   - 数据源是 `CLAUDE_CONFIG_DIR || ~/.claude` 下的 `projects/**/*.jsonl`。
   - 跳过 `subagents/agent-*` sidechain 文件。
   - 只读取 assistant envelope 的 `timestamp`、`cwd`、`message.id`、`message.model`、`message.stop_reason`、`message.usage`。
   - 不回传 prompt、tool input、message body、token、邮箱或其它敏感正文。

3. 流式 usage 行要按最终 message 去重。
   - 以 `message.id` 为主键。
   - 优先保留 `stop_reason` 非空的最终行。
   - 同类行保留 `output_tokens` 更大的条目。
   - 跳过 `stop_reason` 为空或 `output_tokens=0` 的未完成记录。

4. 前端 source 分支必须由 `source` 控制。
   - `source === 'observed'` 渲染真实请求量。
   - `source === 'projected'` 渲染本地投影。
   - 不要在 observed 分支里增加 `workspace === 'claude'` 这类 workspace override，否则按钮状态和实际数据源会不一致。

## 不纳入范围

- 不做 Claude 原生 session 写入、删除、压缩、重命名。
- 不做 Claude 官方账单 API。
- 不把 Claude 本地 usage 与 relay attribution 混成一个数值真源；两条链路分开展示。
- 不把这条规则升级到 `AGENTS.md`。它属于 Usage Desk / Claude Code 领域交付边界，不是 repo-wide 通用治理规则。

## 可复用入口

- 项目 skill：`.agents/skills/gettokens-domain-engineering/SKILL.md` 的 `Usage Desk Local Projection`。
- 需求计划：`docs-linhay/spaces/20260521-claude-code-codex-alignment/plans/20260521-claude-usage-tab-plan.md`。
- 技术调研：`docs-linhay/spaces/20260521-claude-code-codex-alignment/plans/research-session-usage.md`。
- 实现入口：
  - `internal/wailsapp/usage_local_claude.go`
  - `frontend/src/features/accounts/hooks/useUsageDeskFeature.ts`
  - `frontend/src/features/accounts/UsageDeskFeature.tsx`

## 验证命令

```bash
go test ./...
node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/previewData.test.mjs frontend/src/features/accounts/tests/usageDeskClaudeLocalSource.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
docs-linhay/scripts/check-docs.sh
git diff --check
```

真实本机文件 sanity check 只输出文件数、projected row 数和 token 汇总，不输出 JSONL 正文。
