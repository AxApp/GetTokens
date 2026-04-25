# 2026-04-26 Relay Service Config Boundary

## 背景

本轮会话围绕 `StatusPage` 的“后端中转服务配置”反复收敛，最终明确了一条之前容易混淆的边界：

1. 聚合服务对客户端暴露的 key
2. 聚合服务内部使用的上游供应商 key

这两者不是同一种资产，也不应该共用同一套页面取数逻辑。

## 结论

### 1. relay service key 的事实源

`StatusPage` 上展示给用户复制的 `auth.json` 中 `OPENAI_API_KEY`，事实源必须是 sidecar 顶层 `api-keys`。

原因：

1. 顶层 `api-keys` 才是客户端访问聚合服务时携带的鉴权 key
2. `codex-api-key` / `gemini-api-key` / `claude-api-key` 等是聚合服务内部路由到上游供应商时使用的凭据池
3. 把上游供应商 key 直接外露给客户端，会破坏“聚合服务作为统一入口”的职责边界

因此：

- 状态页不能再从账号池 `api-key` 资产推导 relay key
- relay key 的读写必须走 sidecar management API：`/v0/management/api-keys`

### 2. 账号池 API Key 与 relay key 的关系

账号池中的 `api-key` 资产，当前继续表示“上游供应商资产”。

例如：

- `codex-api-key`
- `openai-compatibility`
- 其他 provider 对应的兼容配置

这些资产用于：

1. 供应商配置工作台预览
2. sidecar 上游路由
3. provider 级配置复制

这些资产不用于：

1. 状态页的客户端接入 key
2. 局域网客户端访问聚合服务的统一入口配置

### 3. relay key 允许多值

sidecar 顶层 `api-keys` 原生支持列表，因此状态页不能再只建模为单个字符串。

当前规则：

1. 状态页以“每行一个 key”的方式维护 relay key 列表
2. 保存时做 trim
3. 保存时去重，但保持输入顺序
4. 预览配置时允许选择其中任意一条 key

### 4. 局域网访问的 host 边界

如果状态页要给出局域网客户端可直接使用的配置，仅展示 `127.0.0.1` 是不够的。

当前规则：

1. sidecar bind host 不再限制为 `127.0.0.1`
2. 状态页同时展示三类可访问地址：
   - `localhost`
   - 主机名
   - 局域网 IP
3. 配置预览时允许在这些地址之间切换

注意：

1. management API 仍然通过 management key 保护
2. 本轮没有把 `remote-management.allow-remote` 打开给外部设备管理使用
3. 本轮目标是让业务入口可被局域网访问，不是开放远程管理面板

## 实现落点

- sidecar 配置写入：`internal/sidecar/manager.go`
- relay service 读写聚合：`internal/wailsapp/relay_service.go`
- management API client：`internal/cliproxyapi/client.go`
- 状态页配置 UI：`frontend/src/pages/StatusPage.tsx`

## 后续建议

1. 如果后续需要按团队或终端分发不同 client key，可以继续沿用顶层 `api-keys` 多值模型
2. 如果需要更强的客户端接入治理，再考虑补“key 标签 / 备注 / 启停状态”，而不是回退到复用上游 provider 资产
3. 如果局域网访问成为正式能力，建议后续补一条真实桌面端验收：另一台设备使用主机名或内网 IP 连通 `/v1`
