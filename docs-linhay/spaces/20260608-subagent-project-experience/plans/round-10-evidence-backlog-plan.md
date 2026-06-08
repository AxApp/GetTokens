# 第 10 轮：证据复核与下一批修复计划

## 状态

- 日期：2026-06-08
- 环境：dev / 本仓
- 原则：没有确凿证据不进入修复；每轮修复完成后必须做真实 dev App 手点验收并提交。
- 本轮目标：先校准已修复项，再修复证据足够且范围可控的诊断入口和历史窗口问题。

## 已修复项校准

以下旧 backlog 项已经有第 8/9 轮验收材料，不再进入下一批修复：

| ID | 校准状态 | 证据 |
| --- | --- | --- |
| `P15` | 已修复 | `round-8-first-fix-acceptance.md` 记录账号禁用/启用失败进入独立账号动作通知，不再复用删除错误。 |
| `P16/P17` | 已修复 | `round-8-first-fix-acceptance.md` 记录 usage `error/stale` 状态与 hook/模型测试。 |
| `R2` | 已修复 | `round-8-first-fix-acceptance.md` 记录 route event `filteredReasonCounts` 与前端摘要。 |
| `R3` | 已修复 | `round-8-first-fix-acceptance.md` 记录 legacy rate-limit key 检测与前端提示。 |
| `P13/P14` | 已修复 | `round-9-entry-diagnostics-acceptance.md` 记录真实 dev App 菜单栏手点验收通过，并修复 native callback 崩溃。 |

## Evidence Matrix

| 候选 | 问题来源 | 当前代码/UI 事实 | 观察到的症状或缺失证明 | 预期验收路径 | 可推翻证据 |
| --- | --- | --- | --- | --- | --- |
| `E15` MCP 运行前诊断按钮 | `experience-extension-workbench.md` 第 15 条 | `CodexExtensionsFeature.tsx` 的 MCP actions 只有 `编辑 config.toml` 与刷新；`McpModals.tsx` 的 server modal 只有保存/取消；`internal/wailsapp/codex_extensions.go` 只有 raw `config.toml` 保存前语法 preflight。 | 用户能编辑 command/url/env/cwd/bearer env，但保存成功后仍不知道 Codex 是否能启动该 MCP server；没有只读诊断按钮和结果列表。 | 后端新增只读 preflight 方法，检查 stdio command/cwd/env_vars 与 HTTP url/bearer env；前端 modal 可点击运行诊断并展示 ok/warning/error，不写 `config.toml`、不输出 env 值；自动化测试 + 真实 dev App 打开 MCP modal 手点诊断。 | 发现现有 MCP server modal 已经有等价 runtime preflight 按钮，并覆盖 command/cwd/env/url/bearer env 且不写配置。 |
| `P18` Live Sessions history 固定窗口 | `experience-product-operator.md` 第 18 条 | `CodexLiveSessionsFeature.tsx` overview 固定 `window:'all', limit:80, offset:0`，detail 固定 `limit:50, offset:0`；后端 DTO 已支持 `limit/offset/session_id` 透传。 | dev 历史约 4.1 万条 request，UI 只能看到首个固定窗口，缺少“加载更多”或当前窗口说明。 | 前端维护 overview/detail history metadata，提供加载更多历史；请求 offset 递增，已加载列表合并且保留现有滚动/选择语义；测试覆盖 offset 递增与窗口提示。 | 发现当前 UI 已有加载更多历史入口或后端返回 total/nextOffset 且前端已消费。 |
| `P10` Live Sessions 历史未闭合状态误导 | `experience-product-operator.md` 第 10 条 | 历史请求可从 `/history` 混入 overview/detail；状态仍直接展示 `streaming/active` 等运行态文案。 | 历史里的未完成状态可能被误解为当前仍在运行，影响健康判断。 | 历史请求进入 overview/detail 时标记为历史窗口；未完成历史请求显示“历史未闭合”，不伪装成当前运行；测试覆盖历史 `streaming/active` 展示语义。 | 发现历史请求不会进入当前 overview/detail，或已有历史未闭合标记并且 UI 已展示。 |
| `P7/P6` Usage Desk 分面与数据源文案 | `experience-product-operator.md` 第 6/7 条 | 模型层已经保留 provider/model/accountKey，页面 source 按钮仍是 `真实请求量` / `本地投影用量`，但缺失的是信息架构与可操作分面 UI。 | 当前证据只能证明文案偏内部、分面入口不明显；不能证明数据契约缺失。 | 暂不修复。先补 Usage Desk 信息架构证据：按 provider/account/model 的聚合入口、URL/hash、点击过滤与文案策略。 | 若真实 dev App 发现已有清晰分面入口或用户确认不需要运营分面，则从 backlog 降级。 |
| `P11` Live Sessions 运营摘要 | `experience-product-operator.md` 第 11 条 | 当前已有 `session/project` view、项目聚合 selector 与筛选菜单；缺的是 header 下 compact operational strip。 | 证据说明“缺少今天最该看哪里”的摘要，但需要决定摘要指标和点击过滤策略。 | 暂不修复。待下一轮把 `P11` 与 `P18/P10` 的历史窗口结果一起复核，避免重复设计。 | 若第 10 轮历史窗口修复后已满足运营摘要需求，`P11` 需要重评估或缩小范围。 |

## 本轮修复范围

1. `E15`：MCP server 运行前诊断。
2. `P18/P10`：Live Sessions 历史窗口与历史未闭合语义的最小闭环。

## 非本轮范围

- 不启动 MCP server，不做长期进程探测。
- 不做 HTTP 探测外网 reachability；本轮只验证 URL 格式和 bearer env presence，避免网络副作用。
- 不做 Live Sessions 深层历史索引、account/model/status 查询过滤或 request id 跨页面跳转。
- 不做 Usage Desk 分面 UI 和文案重排。

## 验收计划

自动化：

```bash
cd frontend && node --test src/features/codex-extensions/model.test.mjs src/features/codex-live-sessions/model.test.mjs
go test ./internal/wailsapp -run 'Codex|Mcp|LiveSession'
cd frontend && npm run typecheck
go test ./internal/wailsapp
docs-linhay/scripts/check-docs.sh
git diff --check
./scripts/wails-cli.sh build
```

真实 dev App 手点：

1. `GETTOKENS_APP_PROFILE=dev ./build/bin/GetTokens.app/Contents/MacOS/GetTokens` 启动本仓构建产物。
2. 打开 `Codex -> MCP Servers`，进入一个 MCP server modal，点击运行前诊断，确认结果展示且没有写配置。
3. 打开 `Codex -> Live Sessions`，确认 overview/detail 显示历史窗口提示；如有历史行，未闭合历史状态显示为历史语义。
4. 截图归档到 `screenshots/20260608/round10/`。
