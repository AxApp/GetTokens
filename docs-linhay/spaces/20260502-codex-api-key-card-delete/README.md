# Codex API key 卡片重复与删除修复

## 背景
Codex API key 模式中，添加账号后账号池会同时出现两张卡片；当列表只剩这类重复卡片时，删除动作无法把它们清掉。

初步边界：
- 本地 `codex-api-keys` store 会为 API key 记录生成稳定 `local-id`。
- sidecar 管理接口可能返回同一条 API key 配置，但没有本地 `local-id`。
- 账号池展示与删除都必须把“稳定本地 ID”和“配置派生 ID”视为同一资产。

## 目标
- 添加 Codex API key 后，同一 `apiKey + baseUrl + prefix` 只展示一张账号卡。
- 删除 Codex API key 时，无论前端传入稳定本地 ID 还是配置派生 ID，都能删除对应本地记录并同步 sidecar。
- 保持稳定本地 ID 规则：编辑 `apiKey / baseUrl / prefix` 不改变已有记录 ID。

## 范围
- `internal/wailsapp` 的 Codex API key store、合并、删除与同步逻辑。
- 覆盖上述行为的 Go 单元测试。

## 非目标
- 不调整账号卡视觉样式。
- 不调整 OpenAI-compatible provider 的删除与展示逻辑。
- 不迁移既有用户数据目录结构。

## 验收标准
1. Given 本地 store 已有一条带 `local-id` 的 Codex API key，When sidecar 返回同一 `apiKey + baseUrl + prefix` 但没有 `local-id`，Then `ListAccounts` / 合并结果只产生一条 API key 记录。
2. Given 本地 store 已有一条带 `local-id` 的 Codex API key，When 删除请求传入该配置的派生 ID，Then 本地 store 删除该记录，sidecar 收到空的 Codex API key 列表。
3. Given 本地 store 有多条 Codex API key，When 删除其中一条，Then 其他记录保留并继续同步到 sidecar。
4. 相关 Go 测试通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260502-codex-api-key-card-delete`
- worktree：`../GetTokens-worktrees/20260502-codex-api-key-card-delete/`

## 相关链接
- `docs-linhay/dev/20260425-account-pool-codex-api-key-architecture.md`
- `docs-linhay/dev/20260429-account-rotation-and-api-key-identity-boundary.md`

## 当前状态
- 状态：done
- 最近更新：2026-05-02
