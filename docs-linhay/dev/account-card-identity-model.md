# 账号卡身份模型

## 结论

GetTokens 不引入用户实体。业务归属实体只有账号卡，账号卡 ID 即 `account_key` / `account_id`，用于 usage attribution、rate-limit、route guard、账号详情和配置编辑的稳定关联。

## 身份边界

- `account_key`：唯一业务身份，代表一张账号卡。
- `auth-id` / `auth-index` / `source_hash` / provider / OAuth subject / email / API key hash：运行态证据，只用于诊断、关联和迁移辅助。
- `attribution_key`：usage evidence，不允许作为 rate-limit 配置匹配键。

## 创建与更新语义

- 账号登录、新增 API key、导入、复制：创建新账号卡，分配新的 `account_key`。
- 重新登录、编辑当前卡凭证：更新当前账号卡的凭证和 runtime evidence，保留原 `account_key`。
- 两张账号卡即使凭证内容完全相同，也必须拥有不同 `account_key`。

## 当前实现映射

- Codex API key：GetTokens 本地 store 生成并持久化 `local-id`，sidecar runtime `Auth.AccountKey` 使用该值。
- Standalone sidecar Codex API key：缺失 `local-id` 时生成 `codex-api-key:legacy-*` 并写回 `config.yaml`。
- auth-file：`Auth.AccountKey = auth-file:<file-name>`。
- OpenAI-compatible provider：`Auth.AccountKey = openai-compatible:<provider-name>`。

## Rate-limit 规则

Rate-limit 是账号卡资产级策略：

- `rate_limit_rules` 只存 `account_key`。
- `rate_limit_events` 只存 `account_key`。
- evaluator 查询 usage 只允许 `account_key = ?`。
- `match_key` 已破坏性移除，不做旧版本兼容。

## UI 规则

账号详情中的限流规则默认显示单行摘要。点击编辑进入配置态，配置态以可换行表单行展示，不使用横向滚动宽表。保存成功后回到单行摘要。

## 前端运行边界

账号详情组件不直接绑定 Wails rate-limit CRUD。`RateLimitRulesAPI` 由页面 shell 注入：desktop 注入真实 Wails 方法，browser preview 注入 `undefined` 并使用状态快照只做展示和布局验收。这样 preview 不会因为缺少 `window.go.main.App` 而崩溃，也能防止组件绕过账号卡身份模型直接调用旧接口。
