# Codex API Key 自定义 Curl 在线额度

## 背景
当前 GetTokens 已支持 `auth-file + codex` 通过在线接口获取额度快照，并将结果归一为 `planType + windows` 展示在账号卡片上。

`codex-api-key` 当前只作为 API key 资产参与配置、路由和真实请求观测统计，没有一条可由用户配置的在线额度查询链路。标准 Codex / 兼容服务的额度接口在不同部署里可能存在差异，例如请求地址、请求头、鉴权 token 和响应字段并不完全固定。

本需求引入“用户填 curl 模板”的方式，让 `codex-api-key` 可以配置自己的在线额度请求，并要求返回内容被归一成与现有 auth-file quota 相同的前端展示格式。

## 目标
1. 在 `codex-api-key` 配置中支持用户填写一段 curl，用作在线额度请求模板。
2. 后端解析 curl，执行请求，并将响应归一为现有 `CodexQuotaResponse` 兼容结构。
3. 前端在 `codex-api-key` 卡片和详情中展示与 auth-file 一致的额度窗口信息。
4. 请求配置、调试信息、错误提示和安全脱敏对后续维护者可理解、可排查。

## 范围
1. `codex-api-key` 新增在线额度配置：
   - 支持保存 curl 文本。
   - 支持启用 / 禁用该额度配置。
   - 支持编辑、测试请求、刷新额度。
2. curl 请求能力：
   - 支持常见 `curl` 参数：URL、method、header、body。
   - 支持 `Authorization` 等敏感头脱敏展示。
   - 支持占位符替换，至少覆盖当前账号 API key，例如 `{{apiKey}}`。
3. 响应归一：
   - 优先支持与 `auth-file` 在线额度一致的 payload：`plan_type`、`rate_limit.primary_window`、`rate_limit.secondary_window`。
   - 输出给前端的结构必须与现有 `CodexQuotaResponse` 对齐：`planType` + `windows[]`。
   - `windows` 至少保留 `id / label / remainingPercent / resetLabel / resetAtUnix`。
4. 前端展示：
   - `codex-api-key` 卡片支持额度加载中、成功、错误、未配置状态。
   - 详情弹窗能查看原始请求配置摘要、最近刷新时间、错误摘要。
   - 与现有 auth-file 额度展示视觉层级一致。
5. 测试与验收：
   - 后端覆盖 curl 解析、占位符替换、响应归一、错误脱敏。
   - 前端覆盖 `codex-api-key` 支持额度后的显示和筛选行为。

## 非目标
1. 不为所有 OpenAI-compatible provider 通用化额度查询，本期只覆盖 `codex-api-key`。
2. 不强行发现或维护所有第三方 Codex 兼容服务的额度接口。
3. 不把真实请求观测统计、local projected usage 与 quota snapshot 合并为同一个模型。
4. 不要求本期支持复杂 shell 语法、管道、重定向、命令替换或多条 curl 串联。
5. 不在前端保存明文调试响应中的敏感字段，调试展示必须脱敏。

## 验收标准
### 场景 1：配置 curl 后显示在线额度
Given 用户已有一个 `codex-api-key`
When 用户在详情或编辑入口填写可执行的额度查询 curl，并点击测试或刷新
Then 后端发起在线请求
And 响应被归一为与 auth-file 相同的 `CodexQuotaResponse`
And 前端卡片显示 `5H / 7D` 或响应中可识别的额度窗口、剩余百分比和重置时间

### 场景 2：响应格式与 auth-file 返回一致
Given 用户配置的 curl 返回：

```json
{
  "plan_type": "pro",
  "rate_limit": {
    "allowed": true,
    "limit_reached": false,
    "primary_window": {
      "used_percent": 11,
      "limit_window_seconds": 18000,
      "reset_at": 1777980010
    },
    "secondary_window": {
      "used_percent": 4,
      "limit_window_seconds": 604800,
      "reset_at": 1778546810
    }
  }
}
```

When 后端解析该响应
Then 输出结构与现有 auth-file quota 展示结构一致
And `remainingPercent` 分别为 `89` 与 `96`

### 场景 3：curl 配置错误可排查
Given 用户填写了无法解析、缺少 URL、或请求失败的 curl
When 用户点击测试或刷新
Then 前端显示明确错误状态
And 不把 API key、Authorization、Cookie 等敏感信息明文展示到调试面板

### 场景 4：未配置 curl 不影响现有账号池
Given `codex-api-key` 没有配置额度 curl
When 账号池加载
Then 该账号显示“未配置额度查询”或等价状态
And auth-file 现有在线额度链路不受影响

### 场景 5：最长额度筛选语义更新
Given `codex-api-key` 已成功加载额度窗口
When 用户开启“仅最长额度可用”筛选
Then auth-file 与已配置 quota 的 codex-api-key 都按最长窗口剩余额度参与筛选
And 未配置、加载失败、无窗口的 codex-api-key 不满足该筛选

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260505-codex-api-key-custom-quota-curl`
- worktree：`../GetTokens-worktrees/20260505-codex-api-key-custom-quota-curl/`

## 相关链接
- 现有 auth-file quota 后端入口：`internal/wailsapp/quota.go`
- 现有 quota 前端状态：`frontend/src/features/accounts/hooks/useAccountsQuotaState.ts`
- 现有 quota 展示模型：`frontend/src/features/accounts/model/accountQuota.ts`
- Codex 参考在线额度协议：`docs-linhay/references/codex/codex-rs/backend-client/src/client.rs`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-05

## 实现记录
- 后端新增 curl 模板解析，不执行 shell，仅支持单条 curl 的 URL、method、header、body，并拒绝管道、重定向、多命令、反引号和 `$()` 等 shell 语法。
- `codex-api-key` 本地存储新增 `quota-curl / quota-enabled`，同步 sidecar 时会剥离这两个 GetTokens 本地字段，避免污染 sidecar 配置。
- `GetCodexQuota` 兼容 `quotaKey = codex-api-key:<id>`，对配置了 quota curl 的 API key 执行在线额度请求，并归一成现有 `CodexQuotaResponse`。
- 前端新增创建 / 详情编辑入口，支持 quota curl 模板、启用开关、自动刷新和账号卡片同款额度展示。
- 修复 Wails 前端模型遗漏 `quotaCurl / quotaEnabled` 导致详情保存时字段被 `createFrom()` 丢弃的问题，并增加回归测试。
- 详情面板新增“测试请求”按钮，直接使用当前草稿调用 `TestCodexAPIKeyQuotaCurl`，不要求先保存即可验证额度 curl。
- 修复 Wails 绑定根层遗漏：Wails 实际绑定的是根包 `main.App`，已在 `app.go / app_types.go / app_mappers.go` 转发 `TestCodexAPIKeyQuotaCurl` 和 quota 字段，避免 `wails dev` 重新生成 bindings 后丢失导出。
- 修复旧半保存数据迁移：若本地 store 已有 `quota-curl` 但缺少 `quota-enabled`，加载时按启用处理；显式写了 `quota-enabled:false` 的配置仍保持禁用。
- curl parser 支持浏览器复制 curl 常见的反斜杠换行格式，避免多行 `curl ... \` + `-H ...` 被解析成错误 URL。

## 验证记录
- `go test ./...`：通过
- `cd frontend && npm run test:unit`：通过，包含生成绑定导出回归
- `cd frontend && npm run typecheck`：通过
- `./scripts/wails-cli.sh dev`：已完成 `Generating bindings` 并输出 Vite `built`，无 `TestCodexAPIKeyQuotaCurl` 导出错误；验证后手动结束常驻 dev 进程
- 真实 quota 接口直连：返回 `plan_type=pro`，primary / secondary window 均有 used/reset 数据
- `docs-linhay/scripts/check-docs.sh`：通过
