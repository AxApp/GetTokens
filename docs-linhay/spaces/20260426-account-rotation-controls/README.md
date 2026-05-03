# 20260426 Account Rotation Controls

## 背景

当前 GetTokens 只能观察 relay sidecar 的生效轮动配置，不能在产品内直接修改轮动策略；账号池里的 `codex api key` 也没有暴露优先级编辑能力，因此用户无法明确控制“谁先轮动”“额度耗尽后怎么切”。

## 目标

1. 支持为账号资产设置优先级，用于表达统一轮动顺序。
2. 支持在产品内直接修改 relay 轮动配置，并提供账号池主入口。
3. 把“额度”落到已有 sidecar 模型里的 `quota-exceeded` 与 retry 行为，而不是虚构每账号硬额度上限。

## 范围

1. Go/Wails：账号记录补充 `priority`，新增统一账号优先级写入口，并保持 OAuth 回填时 priority 不丢失。
2. Accounts UI：新增 `api key priority` 输入与展示。
3. Rotation UI：提供账号池下的轮动设置 modal，覆盖 `strategy`、`session-affinity`、`session-affinity-ttl`、`request-retry`、`max-retry-credentials`、`max-retry-interval`、`quota-exceeded.*`，并支持 OAuth 账号与 API key 统一拖动排序。
4. 测试：覆盖账号排序、routing config 解析/序列化。

## 非目标

1. 主账号列表不改为拖动排序；统一排序只在轮动设置 modal 内处理。
2. 不新增每账号额度上限、每日配额或 token budget 模型。
3. 不改 sidecar 原生路由算法语义，只消费已有配置项。

## 验收标准

1. 新建或编辑 `codex api key` 时可设置优先级；轮动设置 modal 可统一调整 OAuth 账号与 API key 的参与顺序。
2. 账号池中的轮动设置 modal 可保存轮动配置，保存后重新读取并显示最新生效值。
3. `strategy` 至少支持 `round-robin` 与 `fill-first`。
4. 自动化测试覆盖排序与 routing config 的真实写回链路。
5. 已禁用的 auth-file 账号仍保留在轮动顺序中；调整优先级后禁用状态不丢失，且 sidecar 仍将其排除在实际轮动候选之外。

## 相关链接

- `internal/accounts/account_records.go`
- `internal/wailsapp/accounts.go`
- `internal/wailsapp/routing_config.go`
- `frontend/src/features/accounts/`
- `frontend/src/features/status/StatusFeature.tsx`

## 当前状态
- 状态：implemented
- 最近更新：2026-04-28
- 结果：账号池已支持 `codex api key priority`、轮动设置 modal、modal 内 OAuth 账号、Codex API Key 与 OpenAI-Compatible Provider 统一拖动排序；状态页轮动区已退回只读展示。额外修复了 `auth-file` 调整优先级时会因“删后重传”丢失 `disabled` 状态的问题，确保禁用账号可以保留排序位置但不重新参与轮动；轮动弹窗现也会直接给禁用资产打上 `disabled` 标记，并显示“保留当前位置但不参与轮动”。同时，轮动卡片右侧现已统一接到 `SetAccountDisabled`：`auth-file / codex-api-key / openai-compatible` 三类账号都可直接在 modal 内启用或禁用。`openai-compatible` 独立工作区卡片也已补齐相同的 `disabled` badge、说明文案和启用/禁用按钮，避免“聚合轮动弹窗能切状态，但 provider 自己的工作区看不见也不能改”的分叉体验。
- 验证：`go test ./...`、`npm run test:unit`、`npm run typecheck`、`docs-linhay/scripts/check-docs.sh`
