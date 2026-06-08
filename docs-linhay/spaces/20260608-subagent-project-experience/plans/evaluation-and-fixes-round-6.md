# 第 6 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 6 轮：评估 + 修复**。
- 基线：延续第 5 轮报告列出的下一轮候选，基于当前工作树继续，不回退第 1/2/3/4/5 轮或其他 subagent 改动。
- 环境边界：仅修改仓库 dev 代码、前端 Wails UI 和本 space 文档；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

## 候选复核与选择

### 本轮选中

1. **raw `config.toml` 保存前后端预检与后端备份提示**
   - 原因：raw editor 直接覆盖 `~/.codex/config.toml`，缺少保存前保护；第 5 轮已明确不能只做前端提示后声称已有后端备份。
   - 低风险边界：实现真实后端备份；预检明确限定为“轻量 TOML 结构预检”，覆盖 section/header、字符串和括号不闭合等明显破坏性错误，不声称完整 TOML AST 校验。

2. **MCP tool approval 前端结构化编辑入口强化**
   - 原因：第 5 轮后端已支持保存 `server.Tools`，但前端结构化 editor 仍没有对应入口，用户无法从 UI 修改 `[mcp_servers.<id>.tools.<tool>]`。
   - 低风险边界：复用现有 textarea 编辑模式和 `tool=approval_mode` 行格式，不引入复杂行级表格。

### 本轮未选

- Skills 启停规则来源解释：需要扩展 Skill DTO、规则命中来源和前端展示，仍是可继续的低风险候选，但本轮优先完成 raw 保存保护与 tool approval UI 闭环。
- MCP raw TOML 多行 AST patch：仍不建议本轮做。第 5 轮已补 warning；完整 AST patch 需要更大技术方案或引入 TOML parser 后重新设计保存边界。

## 红灯测试

本轮先补测试并确认失败：

- `TestSaveCodexConfigTomlCreatesBackupForExistingFile`
  - 保存已有 `config.toml` 时要求返回 `BackupPath`，备份文件包含原内容，新文件包含新内容。
  - 红灯表现：`SaveCodexConfigTomlResult` 没有 `BackupPath` 字段。
- `TestSaveCodexConfigTomlDoesNotCreateBackupWhenMissing`
  - 无原文件时允许保存，但不返回备份路径。
  - 红灯表现：旧实现没有备份语义。
- `TestSaveCodexConfigTomlRejectsInvalidContentBeforeBackup`
  - 输入明显未闭合字符串时要求保存失败、原文件不变、且不生成备份。
  - 红灯表现：旧实现会直接覆盖。
- `mcp tool approval helpers preserve structured tool approval rows`
  - 要求 `parseMcpTools` 能解析 `search=approve`、`create issue=prompt`、`empty_mode`，并能序列化回 textarea。
  - 红灯表现：模型层没有 `parseMcpTools`。
- `buildMcpChangePreview reports only modified server fields`
  - 变更 `tools` 时要求 change preview 出现 `tools` 变更。
  - 红灯表现：旧 preview 不包含 tool approval 变更。

## 本轮修复清单

### 1. raw `config.toml` 后端预检与备份

- `SaveCodexConfigToml` 保存前执行 `validateCodexConfigTomlPreflight`。
- 预检范围：
  - 顶层 section header 形态。
  - 单行字符串是否闭合。
  - `[]` / `{}` 是否提前闭合或最终未闭合。
  - 支持多行数组/map 的括号跨行闭合；不做完整 TOML AST 解析。
- 预检失败时：
  - 返回 `config.toml preflight failed: ...`。
  - 不覆盖原文件。
  - 不创建备份。
- 原文件存在时，保存前在同目录创建 `config.toml.gettokens-backup-<timestamp>`，并通过 `SaveCodexConfigTomlResult.backupPath` 返回。
- 原文件不存在时正常保存，不返回 `backupPath`，避免误导用户。
- 前端保存成功后，如果后端返回 `backupPath`，提示中展示真实备份路径。

### 2. MCP tool approval 前端结构化入口

- 新增 `parseMcpTools`，复用 `tool=approval_mode` 的逐行格式。
- `buildMcpChangePreview` 纳入 `tools` 变更。
- MCP server editor 的工具范围区域新增 `tool approval modes` textarea。
- 继续复用第 5 轮后端保存链路，保存后写入 `.tools.*` sections。

## 变更文件

- `internal/wailsapp/codex_extensions.go`
- `internal/wailsapp/codex_extensions_types.go`
- `internal/wailsapp/codex_extensions_test.go`
- `frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx`
- `frontend/src/features/codex-extensions/McpModals.tsx`
- `frontend/src/features/codex-extensions/model.ts`
- `frontend/src/features/codex-extensions/model.test.mjs`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `frontend/wailsjs/go/models.ts`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes-round-6.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
go test ./internal/wailsapp -run 'TestCodexConfigTomlDocumentReadsAndSavesRawContent|TestSaveCodexConfigTomlCreatesBackupForExistingFile|TestSaveCodexConfigTomlDoesNotCreateBackupWhenMissing|TestSaveCodexConfigTomlRejectsInvalidContentBeforeBackup|TestSaveCodexMcpServerPatchesToolApprovalSections'
cd frontend && node --test src/features/codex-extensions/model.test.mjs src/features/codex-extensions/adapters.test.mjs src/features/codex-extensions/featureSource.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
```

说明：

- 未启动 Wails dev app 做桌面点击验收；本轮行为由 Go focused tests、Node model/source tests 和 typecheck 覆盖。
- raw `config.toml` 预检是轻量结构预检，不是完整 TOML parser；复杂 TOML 语义错误仍建议下一轮独立评估是否引入 TOML AST parser。

## 下一轮候选判断

仍有可继续修改的下一轮候选：

1. Skills 启停规则来源解释。建议扩展 Skill DTO，展示 enabled 状态来自 path rule、name rule、默认启用，还是 enable 后移除 override。
2. raw `config.toml` 完整 TOML AST 预检或 parser 化保存。当前只有轻量预检；若要完整支持，需要引入 parser 并补更完整的 Go 测试。
3. MCP tool approval 行级校验。当前 UI 使用 textarea，后续可校验 approval mode 是否属于 `auto` / `prompt` / `approve`，并提示空 approval mode 表示只写 section 不写 `approval_mode`。

仍不建议直接进入的候选：route probe sidecar endpoint、usage reconciliation、SQLite busy 治理、request diagnostics index。这些属于较大技术方案，应先定接口边界和失败测试。
