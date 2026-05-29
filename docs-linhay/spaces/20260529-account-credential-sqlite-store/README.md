# 账号凭证 SQLite 存储

## 背景

当前账号/凭证事实源分散在 sidecar `auth-dir`、GetTokens 本地 Codex API key JSON store、sidecar `config.yaml.openai-compatibility`、以及 `codex-api-key-attribution-identities-v1.json` 辅助映射中。刚完成的账号卡身份迁移已经把 rate-limit、usage attribution、route guard 收敛到 `account_key`，但当前 `account_key` 仍由旧资产 ID 派生，例如 `auth-file:<file>`、`codex-api-key:<local-id>`、`openai-compatible:<provider>`。

本需求调研目标是把账号卡与凭证事实源进一步统一到 sidecar 持有的 `~/.config/gettokens/accounts-v1.sqlite`，由 sidecar 分配新的稳定账号卡 ID，并让旧 ID 仅作为迁移证据和运行态辅助映射。GetTokens 不再管理账号事实源，只通过 sidecar management API 展示和发起账号操作。

从本版本开始，GetTokens sidecar 断开与 CLIProxyAPI 上游的合并式同步。上游功能只作为参考输入；账号相关 management API 以 GetTokens 自有账号模型为准，可以直接破坏性调整。

## 目标

1. 明确 sidecar `accounts-v1.sqlite` 的事实源边界、schema、迁移顺序和风险。
2. 明确 GetTokens Wails、前端账号池、GetTokens sidecar 热路径的切换边界，其中账号 CRUD 归 sidecar。
3. 形成最终方案、BDD 验收场景与测试清单，供后续实现按 TDD 分阶段推进。
4. 固化“断开 CLIProxyAPI 上游合并式同步、sidecar 侧重新实现功能”的治理边界。

## 范围

### 纳入

- Codex OAuth/auth-file 账号。
- Codex API key 账号。
- OpenAI-compatible provider 账号。
- 账号卡主身份 `account_key`、明文凭证配置、runtime identity 映射。
- 旧 JSON store、sidecar `config.yaml` 账号配置的迁移策略。

### 不纳入

- usage/rate-limit/live-session 历史明细整体搬入账号 DB。
- `~/.codex/auth.json`、Claude Code 原生配置。
- 云同步、共享协作、PostgreSQL 同步。
- SQLCipher/Keychain 加密专项。
- rate-limit、usage attribution、route guard、渠道路由和前端详情 hash 的历史状态迁移；这些可以基于新账号卡重新建立。

## 非目标

- 不再新建 feature worktree；当前需求已经在执行 worktree/分支 `账号与凭证统一存储方案` 上推进。
- 本期不设计前端视觉稿。
- 不保留旧文件双写兼容作为长期状态；旧源仅允许作为只读迁移来源或短期临时产物。

## 验收标准

1. Space 已创建并包含 README、plans、screenshots、debate 目录。
2. 目标设计文档可在 `docs-linhay/dev/account-credential-sqlite-store-design.md` 中检索。
3. 最终方案列出当前事实源、目标 schema、API、切换阶段、风险与测试清单。
4. 后续实现可以按“sidecar schema 与导入 -> sidecar runtime 读写 -> GetTokens 直接接入统一账号 API -> 删除旧源”的顺序拆分任务，且只需保迁账号凭证/配置数据。
5. 迁移完成后必须删除旧账号事实源；只停止读取不满足完成定义。
6. 文档结构校验通过；本次纯文档整理不运行代码测试。

## 最终方案

- 执行入口：`plans/20260529-final-sidecar-account-store-plan-v01.md`
- 执行计划：`plans/20260529-execution-plan-v01.md`
- 技术设计：`docs-linhay/dev/account-credential-sqlite-store-design.md`
- 过程材料：
  - `plans/20260529-research-report-v01.md`
  - `plans/20260529-implementation-plan-v01.md`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`账号与凭证统一存储方案`
- worktree：当前工作区 `/Users/linhey/.prowl/repos/GetTokens/账号与凭证统一存储方案`

## 相关链接

- 最终方案：`docs-linhay/spaces/20260529-account-credential-sqlite-store/plans/20260529-final-sidecar-account-store-plan-v01.md`
- 设计文档：`docs-linhay/dev/account-credential-sqlite-store-design.md`
- 账号卡身份模型：`docs-linhay/dev/account-card-identity-model.md`
- 账号卡身份迁移 space：`docs-linhay/spaces/20260529-account-card-identity-migration/`
- 账号云同步方案：`docs-linhay/dev/20260525-account-cloud-sync-architecture.md`
- Codex API key 账号池架构：`docs-linhay/dev/20260425-account-pool-codex-api-key-architecture.md`

## 当前状态
- 状态：finalized
- 最近更新：2026-05-29
