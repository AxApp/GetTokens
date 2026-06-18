# Final Completion Wave Extension Local Apply Completion

日期：2026-06-18

## 目标

在 Round26/Round27 temp writer 之上，一次性补齐 staged local apply transaction 的核心 helper、DTO 与测试，使 Extension config apply 从“只会生成 temp preview 文件”推进到可接 UI confirmation 的事务语义：

1. preview：基于 enabled extension 与 caller-supplied `ConfigText` 生成 dry-run operations / patch plan / redacted applied text。
2. confirm：生成 confirmation token，token 绑定 target、operation 和 applied text，提交时必须匹配。
3. backup/temp write：提交前先把 caller-supplied 原文写入 backup，再写 staged temp file。
4. verify：目标写入后执行 readback verify。
5. rollback：target write 失败或 verify 失败时恢复 backup 原文。

## 证据门禁

| 项目 | 内容 |
| --- | --- |
| 问题来源 | Final Completion Wave 指令要求 Extension local apply completion，不再把 staged transaction 留到下轮。 |
| 代码事实位置 | `internal/gettokensextensions/config_apply_preview.go` 已有 temp writer；`internal/wailsapp/gettokens_extensions.go` 和 root `app.go` 只有 dry-run preview 入口，缺少 prepare/apply transaction DTO。 |
| 当前缺口 | 缺少 confirmation token、backup/temp/target write 顺序、verify hook、rollback 语义、write/verify/invalid operation 失败测试，以及 Wails/root DTO 映射。 |
| 预期验收 | 只使用 `ConfigText`、`TempDir` 和 explicit test target；不读取、不写入真实 `~/.codex/config.toml`；成功提交、verify 失败回滚、target write 失败回滚、invalid operation / token mismatch 提前失败均有测试。 |

## BDD 场景

1. Given UI 已展示 dry-run preview 和 diff
   When 用户提交匹配的 confirmation token
   Then helper 写入 backup、staged temp file、explicit target，并通过 verify 后返回 `status=applied`。

2. Given target write 后 verify 失败
   When transaction 捕获 verify error
   Then helper 必须用 backup 原文恢复 target，并返回 `rolledBack=true`、`errorStage=verify`。

3. Given target write 函数返回失败且可能留下部分写入
   When transaction 捕获 write error
   Then helper 必须恢复原文，并保留 backup 作为证据。

4. Given preview operation 指向 unsupported target 或 confirmation token 不匹配
   When apply 被调用
   Then helper 在 backup/write 前失败，target 原文不变。

5. Given target path 等于当前 HOME 下真实 `~/.codex/config.toml`
   When Wails prepare/apply 被调用
   Then Wails 层直接拒绝，不创建、不读取、不写入真实 Codex config。

## 实现摘要

- `internal/gettokensextensions/config_apply_preview.go`
  - 新增 `CodexConfigStagedApplyPlan`、`CodexConfigStagedApplyOptions`、`CodexConfigStagedApplyResult`、`CodexConfigStagedApplyVerifyInput`。
  - 新增 `PrepareCodexConfigStagedApply`：生成 redacted `AppliedText`、operation list、diff preview 与 confirmation token。
  - 新增 `ApplyCodexConfigStagedTransaction`：执行 validate -> confirm -> backup -> temp write -> target write -> verify；target write / verify 失败时按 backup 恢复。
  - 抽出 `buildCodexConfigAppliedText` 复用 temp writer 现有保真逻辑，继续保留 comments、unknown fields、nested mcp tools/oauth、sibling tables、多个 `[[skills.config]]`，并 redaction 敏感字段。
- `internal/wailsapp/gettokens_extensions.go`
  - 新增 `PrepareGetTokensExtensionCodexConfigApply` 与 `ApplyGetTokensExtensionCodexConfigTransaction` DTO / 方法。
  - Wails 层拒绝当前 HOME 下真实 `~/.codex/config.toml`；只接受 explicit test target / caller-supplied `ConfigText`。
- root `main.App`
  - 新增对应 input/result DTO、mapper 与 root method，避免 Wails binding boundary 缺口。
- 测试
  - core 覆盖成功提交、verify 失败 rollback、target write 失败 rollback、invalid operation 提前失败、confirmation token mismatch 提前失败。
  - Wails/root 覆盖 explicit target prepare/apply、真实 Codex config target 拒绝、mapper 字段保留。

## 验收命令

```bash
go test -count=1 ./internal/gettokensextensions
go test -count=1 ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun|Apply|Transaction|Rollback'
go test -count=1 . -run 'GetTokensExtension|PreviewCodexConfigDryRun|Apply|Transaction|Rollback'
bash docs-linhay/scripts/check-docs.sh
git diff --check
```

## 当前结论

Extension local apply completion 已不再是“下轮”事项。当前可交付边界是：staged transaction helper/DTO/tests 已达到可接 UI confirmation 的程度，并且在 temp profile / explicit test target 中证明 rollback 语义。

## 剩余风险

- 当前 writer 仍是字符串级最小 patch，不是正式 TOML AST writer；真实 `~/.codex/config.toml` wiring 必须另开授权切片，并在写入前向用户展示目标文件 diff。
- 为安全保真，`AppliedText` 会 redaction 敏感 RHS；它适合作为安全确认/测试产物，不等价于最终真实 config 保存内容。
- 本轮未运行 Wails generator；root DTO 已补，但 generated `frontend/wailsjs` surface 仍需主控在最终 binding/generator completion 中统一处理。
