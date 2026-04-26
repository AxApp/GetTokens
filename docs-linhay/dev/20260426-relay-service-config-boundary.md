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
- relay routing 配置读取：`internal/wailsapp/routing_config.go`
- management API client：`internal/cliproxyapi/client.go`
- 状态页配置 UI：`frontend/src/pages/StatusPage.tsx`

## 状态页补充

`StatusPage` 除了展示客户端接入用的 `auth.json` 和 relay service `api-keys` 之外，还应直接显示 sidecar 当前实际生效的轮动配置，避免用户把“支持哪些模式”和“当前正在用什么模式”混为一谈。

当前展示与编辑项包括：

1. `routing.strategy`
2. `routing.session-affinity`
3. `routing.session-affinity-ttl`
4. `request-retry`
5. `max-retry-credentials`
6. `max-retry-interval`
7. `quota-exceeded.switch-project`
8. `quota-exceeded.switch-preview-model`
9. `quota-exceeded.antigravity-credits`

其中：

1. `strategy` 缺省时按 `round-robin` 展示
2. `session-affinity-ttl` 缺省时按 `1h` 展示
3. 状态页当前已经支持轮动策略写入，但写回边界仍然固定在 sidecar 现有 `config.yaml` 能力内

## 当前实现更新（2026-04-26）

1. `StatusFeature` 已支持直接编辑并保存轮动配置。
2. 写回路径不是虚构新的 JSON 管理接口，而是：
   `GET /v0/management/config.yaml` -> 局部修改 `routing / request-retry / quota-exceeded` 节点 -> `PUT /v0/management/config.yaml`
3. 该实现的目标是继续复用 sidecar 既有配置语义，而不是在 GetTokens 前端额外定义一套轮动领域模型。
4. 自动化测试应优先覆盖：
   - 默认值归一化
   - 负数重试值归零
   - YAML 写回时保留无关节点，仅更新轮动相关字段

## 状态页补充边界（2026-04-27）

### 1. 服务事实源与本地偏好必须分层

`StatusFeature` 这轮继续扩展后，已经明确不能把所有“看起来可保存”的东西都混成同一种状态。

当前固定边界：

1. 服务真实状态必须来自后端 / sidecar：
   - relay key 列表
   - endpoint 列表
   - sidecar 启动时间与 uptime
2. 仅影响当前桌面端展示便利性的内容，才允许走本地持久化：
   - relay key 别名
   - “是否展示局域网地址”开关
   - model 名称列表
   - 当前选中的 model 名称

因此：

1. 不能把前端本地计时当成 sidecar uptime
2. 不能把本地 UI 偏好伪装成 sidecar 已保存配置
3. 当用户要求“刷新后仍保留”时，必须先判断他要保留的是服务事实，还是本地偏好

### 2. uptime 的事实源只能来自 sidecar.Status

本轮已经踩过一次坑：状态页原本用 `Date.now()` 在前端本地起表，结果刷新页面后 uptime 归零。

当前规则：

1. `uptime` 必须基于 sidecar 上报的 `startedAtUnix`
2. sidecar 在进程真正 `cmd.Start()` 成功后写入启动时间
3. `starting -> ready -> error` 过程中要保留同一份 `startedAtUnix`
4. 只有进入 `stopped` 状态时才允许清空

这条规则的意义是：

1. 页面刷新不会重置 uptime
2. 前端多个页面看到的是同一份真实运行时长
3. “服务真实运行多久”与“当前页面打开多久”被明确拆开

### 3. model 名称是状态页本地工作台配置，不是 sidecar 配置真相

本轮状态页已经允许用户：

1. 新增 model 名称
2. 删除 model 名称
3. 选择当前用于 snippet 预览的 model 名称

但这里的 `model` 仍然只是：

1. 生成 `auth.json` / `config.toml` 预览片段时的本地辅助输入
2. 供当前桌面端反复复制使用的工作台偏好

它不是：

1. sidecar 运行时模型注册表
2. provider 能力探测结果
3. 一个已经同步到后端的正式领域配置

因此这类状态当前应该持久化到本地，而不是反向发明新的 sidecar 管理接口。

### 4. 局域网开关当前是“暴露控制”，不是 sidecar bind 开关

状态页上的“局域网已开启 / 已关闭”按钮，当前语义是：

1. 是否在状态页显示并允许选择 `kind == lan` 的 endpoint
2. 是否让生成预览默认继续使用局域网地址

它当前不是：

1. sidecar 真实监听地址切换器
2. `config.yaml host` 的正式管理入口
3. 防火墙或 remote-management 的系统级开关

因此：

1. 这个开关允许本地持久化
2. 但交付说明必须明确“只是 UI 暴露层开关，不是服务监听层开关”

## 后续建议

1. 如果后续需要按团队或终端分发不同 client key，可以继续沿用顶层 `api-keys` 多值模型
2. 如果需要更强的客户端接入治理，再考虑补“key 标签 / 备注 / 启停状态”，而不是回退到复用上游 provider 资产
3. 如果局域网访问成为正式能力，建议后续补一条真实桌面端验收：另一台设备使用主机名或内网 IP 连通 `/v1`
