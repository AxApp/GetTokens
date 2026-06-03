# Codex 模型目录账号关联缓存

## 背景

用户安装最新正式版后，本地 DeepSeek 账号与 `~/.codex/gettokens-model-catalog.json` 实际已包含 `deepseek-v4-flash` / `deepseek-v4-pro`，但已打开或刚启动的 Codex 选择器仍可能看不到 DeepSeek。现有链路依赖启动后从账号/远端 provider 聚合模型，再写入 Codex model catalog；如果 sidecar 尚未 ready、远端模型拉取较慢或 Codex 会话已先启动，会出现“账号有模型但模型列表展示滞后”的体验问题。

## 目标

1. 模型列表与账号卡建立本地关联缓存：每个账号可沉淀最近一次可用于 Codex-facing catalog 的模型快照。
2. GetTokens 下次启动时先读取本地缓存，立即写入 `model_catalog_json`，保证 Codex 尽早看到上次可用模型。
3. sidecar ready 后继续按现有账号/远端 provider 聚合最新模型，并用最新结果覆盖缓存与 catalog。
4. 缓存不应暴露无账号支撑的 sidecar-only 模型，也不应让已禁用账号继续贡献模型。

## 范围

- Wails/root 启动链路中的 Codex model catalog projection。
- `internal/wailsapp` 模型目录聚合、缓存读写、测试。
- 与账号卡关联的本地缓存文件/结构设计。
- 文档与记忆写回。

## 非目标

- 不改 DeepSeek 默认模型命名策略；正式版仍使用 `deepseek-v4-flash` / `deepseek-v4-pro`。
- 不做移动端适配或截图。
- 不引入前端伪造模型列表；热路径状态仍以 sidecar/账号存储为准。
- 不改变 Codex CLI 本身读取 `model_catalog_json` 的时机。

## 验收标准

1. Given 本地存在账号关联模型缓存，When GetTokens 启动且 sidecar/远端 provider 尚未 ready，Then `EnableGetTokensCodexModelCatalogProjection` 能用缓存模型先写入 `~/.codex/gettokens-model-catalog.json`。
2. Given 后台账号/远端 provider 聚合拿到最新模型，When 同步完成，Then catalog 与缓存更新为最新模型集合。
3. Given 某账号被禁用或删除，When 重新聚合模型，Then 该账号关联缓存不再贡献 catalog 模型。
4. Given sidecar static definitions 含 DeepSeek 但没有任何启用账号支撑，When 构建 catalog，Then 不展示 sidecar-only DeepSeek。
5. 单元测试覆盖缓存读写、禁用账号过滤、缓存优先启动写入和最新模型覆盖缓存。

## 设计稿入口

- 本期设计稿：`（无 UI 设计稿；后端/启动链路改造）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260603-model-catalog-account-cache`
- worktree：`../GetTokens-worktrees/20260603-model-catalog-account-cache/`
- 当前执行：短改动，直接在主工作区执行，不创建 worktree。

## 相关链接

- `docs-linhay/dev/20260602-codex-model-catalog-projection-plan.md`
- `internal/wailsapp/relay_model_catalog.go`
- `internal/wailsapp/codex_model_catalog_projection.go`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-03
