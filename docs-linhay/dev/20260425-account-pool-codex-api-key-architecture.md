# 2026-04-25 账号池 Codex API Key 架构整理

## 背景

本轮会话把账号池从“只投影 auth file”推进到“统一承载 auth file + codex api key”。

同时暴露出三个容易反复踩坑的边界：

1. `CLIProxyAPI` 是 sidecar 行为源，不只是参考代码。
2. `codex api key` 不能简单伪装成 `auth file`。
3. 账号池页面的列表、额度、调试三条链路已经不是一个单文件能描述清楚的前端问题。

## 当前边界

### 统一账号模型

前端不再直接绑定 `AuthFileItem`，而是消费统一 `AccountRecord`。

字段职责：

- `provider`：供应商语义，例如 `codex`
- `credentialSource`：凭证来源，当前为 `auth-file` / `api-key`
- `displayName`：卡片主标题
- `quotaKey`：仅在支持额度的记录上存在

结论：

- `provider` 和 `credentialSource` 必须拆开
- 不允许把 `CODEX + API KEY` 压成一个枚举值

### 事实源

两类账号的事实源不同：

- `auth-file`
  - 事实源：sidecar 管理接口 + `auth-dir`
- `codex api key`
  - 事实源：本地持久化目录 `~/.config/gettokens-data/codex-api-keys/`
  - sidecar 启动后由 Wails 回灌同步

这样做的原因是：

1. 避免 sidecar `config.yaml` 被运行时覆盖时丢失 API key
2. 保持 API key 像资产一样可独立管理
3. 避免把 API key 文件误放进 `auth-dir` 后被扫成伪 auth 账号

### 唯一性

账号池唯一性按“凭证资产”而不是“人”判定：

- `auth-file:<name>`
- `codex-api-key:<fingerprint>@<normalized-base-url>#<prefix>`

不做跨来源合并，不按邮箱、provider 或套餐判重。

## 额度链路

Codex 额度不再由 app 直接拼 bearer 请求外网，而是走：

1. 前端调用 `GetCodexQuota(name)`
2. Wails 根据 auth file 提取 `auth_index` 和 `chatgpt-account-id`
3. Wails 调 `POST /v0/management/api-call`
4. `CLIProxyAPI` 根据 `auth_index` 注入 token
5. sidecar 中转到 `GET https://chatgpt.com/backend-api/wham/usage`

这样做的价值：

1. token 解析逻辑统一留在 sidecar
2. 调试时可以同时核对账户映射和真实外部响应
3. 修复点能明确归属到 Wails 或 `CLIProxyAPI`

## 调试链路

调试面板目前至少承接两类记录：

1. Wails 方法调用
2. 额度查询相关的外部 HTTP 记录

最近一次会话确认的经验是：

- 看到 `GET https://chatgpt.com/backend-api/wham/usage` 的日志，不代表 app 绕过了 sidecar
- 这条日志是“最终目标请求”的业务视图
- 真正执行仍然可能是 `app -> /api-call -> sidecar -> wham/usage`

后续如果需要更细的排障，应补“内部桥接请求”和“外部目标请求”双层展示。

## 维护建议

1. 账号池相关任务优先走 `gettokens-accounts-domain`
2. 涉及 `CLIProxyAPI` 行为修复、上游同步、sidecar 替换时走 `gettokens-cliproxyapi-fork-maintenance`
3. 不要再把 `internal/wailsapp` 退回到“大一统 app.go”
