# 第 2 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 2 轮：评估 + 修复**。
- 基线：延续第 1 轮评估报告中列出的下一轮候选，不回退主控或其他 subagent 的改动。
- 环境边界：仅修改仓库 dev 代码与本 space 文档；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

## 候选复核与选择

### 本轮选中

1. **MCP args 从空白 split 改为逐行数组编辑**
   - 原因：当前 `parseMcpArgs` 会把 `/Users/me/My Project`、JSON 字符串等带空格参数拆坏，属于结构化编辑保存后破坏配置的低风险逻辑 bug。
   - 验证方式：先补模型测试，断言带空格路径和 JSON 参数往返不被拆分。

2. **Live Sessions “清空会话”改为“清空实时视图”并增加确认**
   - 原因：当前按钮文案容易让用户误以为会删除历史或取消请求；只改前端文案和确认链路，不改变 sidecar 清空实时 snapshot 的契约。
   - 验证方式：补源码/locale 断言，确认按钮走确认文案，文案明确“不删除磁盘历史、不取消正在进行的请求”。

### 本轮未选

- raw `config.toml` 保存前 TOML 预检与备份提示：需要后端 TOML parser、备份路径返回、保存失败语义和 Wails 测试，仍是高价值候选，但比本轮两个前端状态修复更重。
- 账号池筛选空态拆分：需要读完 `AccountsToolbar`、筛选状态摘要、reset/clear action 与页面测试组织；适合下一轮单独做。

## 红灯测试

本轮先补测试并确认失败：

- `frontend/src/features/codex-extensions/model.test.mjs`
  - 新增断言：`parseMcpArgs('--path\n/Users/me/My Project\n--json\n{"root": "/My Project"}')` 必须保留带空格参数。
  - 红灯表现：旧实现按空白拆分，实际变为 `'/Users/me/My'`、`'Project'`、`'{"root":'` 等碎片。
- `frontend/src/features/codex-live-sessions/model.test.mjs`
  - 新增断言：workbench 存在 `confirmClearSessions`、调用确认文案，中文 locale 使用 `清空实时视图` 且明确不删除磁盘历史、不取消请求。
  - 红灯表现：旧实现直接调用 `onClearSessions`，文案仍是 `清空` / `清空当前运行会话列表`。

## 本轮修复清单

### 1. MCP args 逐行编辑

- `serializeMcpArgs` 从空格 join 改为换行 join。
- `parseMcpArgs` 从空白 split 改为按行 split，trim 后保留每一行作为一个 argv。
- MCP server editor 中 `args` 字段从单行 `Field` 改为 `TextareaField`，让用户按“一行一个参数”编辑。
- 当前 TOML preview 仍基于 `server.args` 数组生成 `args = [...]`，不会把换行文本直接写入 raw TOML。

### 2. Live Sessions 清空实时视图确认

- 按钮文案从 `清空` 改为 `清空实时视图` / `Clear Live View`。
- title 说明清楚：只清空当前实时视图，不删除磁盘历史，不停止或取消请求。
- 点击按钮先执行 `window.confirm(t('codex_live_sessions.clear_sessions_confirm'))`，用户确认后才清空选中状态并调用 `onClearSessions`。
- 未改变 `ClearCodexLiveSessions` 的 Wails/sidecar 调用边界，不引入历史清理或请求取消能力。

## 变更文件

- `frontend/src/features/codex-extensions/model.ts`
- `frontend/src/features/codex-extensions/McpModals.tsx`
- `frontend/src/features/codex-extensions/model.test.mjs`
- `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx`
- `frontend/src/features/codex-live-sessions/model.test.mjs`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes-round-2.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
cd frontend && node --test src/features/codex-extensions/model.test.mjs src/features/codex-extensions/adapters.test.mjs
cd frontend && node --test src/features/codex-live-sessions/model.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
```

说明：

- 未启动 Wails dev app 做桌面点击验收。本轮改动是前端模型、modal 输入形态、Live Sessions 按钮确认与 i18n 文案，已用 focused node tests 和 typecheck 覆盖。
- 未运行全量 `npm run test:unit`，沿用第 1 轮说明：该脚本此前会触发无关账号卡片既有断言失败，本轮只运行匹配修复面的 focused tests。

## 下一轮候选判断

仍有可继续修改的下一轮候选：

1. raw `config.toml` 保存前 TOML 预检与备份提示。
2. 账号池筛选空态拆分：区分真实无账号与当前搜索/筛选无结果。
3. MCP raw/结构化 editor dirty arbitration：避免两个编辑器互相覆盖。
4. MCP env/header 行级校验：避免非法 key 被 preview 或保存链路静默丢弃。

仍不建议直接进入的候选：route probe sidecar endpoint、usage reconciliation、SQLite busy 治理、request diagnostics index。这些属于较大技术方案，应先定接口边界和失败测试。
