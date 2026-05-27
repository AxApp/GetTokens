# Codex Live Session Controls Assessment v01

## 结论

重新评估后的第一结论：用户截图中选中的 `ws_sess_7a91` 不是当前 dev sidecar 的真实活跃会话，而是 browser preview/cache 数据。该页面运行在 `localhost:5173`，显示 `VERSION BROWSER` 与 `来源 CACHE`，且无 Wails binding；dev sidecar `18317` 当前真实 snapshot 为 0 active sessions。

因此，本需求不是“立刻 kill 截图里那行”，而是要设计未来在真实 desktop/runtime 模式下可用的控制能力。正式 App / `8317` sidecar 不进入本需求的 stop/kill 验证范围。

控制能力仍然分两条链路：

1. `账号指定切换`：本质上是“后续请求的选账号/路由偏好”。
2. `kill 活跃请求/连接`：本质上是“sidecar runtime 的会话管理能力”。

## 评估结果

### 0. 当前页面与真实运行态

- `localhost:5173/#frame=codex&workspace=live-sessions` 当前是 browser preview/cache，不是 Wails runtime。
- 页面上的示例行只适合做布局、交互和文案评估，不能作为真实请求控制对象。
- dev sidecar `18317` 的 live-session snapshot 当前为空。
- production sidecar `8317` 只可在明确授权下只读观察，不可作为本需求的止血对象。

### 1. 账号指定切换

推荐落点：

- 不直接改 live session 已经发出去的请求。
- 只影响后续请求的账号选择。
- 入口优先放在 session detail 的账号卡或请求工具栏里。

可选实现：

1. 前端跳转到账号列表/账号详情，并把该会话关联账号设为优先或 pinned。
2. 增加一个专门的“按会话指定账号”管理 API，把会话 ID 和 auth ID 绑定到路由策略。

### 2. kill 活跃请求/连接

当前判断：

- 现有 `live-sessions` API 中 `DELETE /gettokens/live-sessions` 只能清 tracker，不会真正断开连接。
- `wsrelay.Manager` 现状只有全量 `Stop()`，没有单 session kill 能力。
- 要精准杀单个会话，必须新增 sidecar API 或在 runtime executor 上补 session-level cancel/close hook。
- 进程级 kill 会被桌面 App 生命周期重新拉起，且会误伤正式环境，不应作为产品能力或验收方案。

建议接口草案：

- `POST /v0/management/gettokens/live-sessions/:session_id/terminate`
- 或 `DELETE /v0/management/gettokens/live-sessions/:session_id`

返回至少包含：

- `terminatedRequests`
- `closedDownstream`
- `closedUpstream`
- `reason`

## 验收思路

1. 前端能对指定会话发起账号指定动作。
2. sidecar 能对单个会话返回明确的终止结果。
3. kill 后该 session 不再继续产生活跃请求或连接事件。
4. 清 tracker 与断连接两件事必须分开验收。
5. browser preview/cache 场景只展示 disabled/no-op 控制入口或 mock 行为，不能发真实管理请求。

## 暂缓记录

本需求先作为后续 backlog 记录，不在本轮实现。恢复施工前需要先确认：

1. 验收目标是真实 desktop/runtime 模式，不是 browser preview/cache。
2. dev sidecar 有可复现的真实 active session。
3. 正式 App / `8317` 不作为验证或止血对象。
4. 先补 sidecar 单会话控制测试，再接 Wails/root/frontend 控制入口。
