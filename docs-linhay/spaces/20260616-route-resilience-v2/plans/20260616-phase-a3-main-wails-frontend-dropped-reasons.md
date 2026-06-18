# Route Resilience v2 Phase A3 Main Wails Frontend Dropped Reasons

日期：2026-06-16

## Phase A3 边界

本阶段只把 A2 sidecar management response 中的 structured `droppedReasons` 从主仓 `internal/cliproxyapi` client 透传到 Wails/root DTO，并进入 frontend channel-routing model。A3 不改变 selector、route guard、probe 语义，不从旧 trace 推导新的 structured truth。

## Evidence Matrix

| 证据项 | 来源 | 当前事实 | A3 处理 | 验收方式 |
|---|---|---|---|---|
| Route Resilience v2 需求 | `docs-linhay/spaces/20260616-route-resilience-v2/README.md` | 验收要求 explain / probe / recent decisions 共享 dropped reasons | A3 先完成 recent decisions 主仓透传 | focused Wails + frontend model tests |
| A2 sidecar schema | `plans/20260616-phase-a2-structured-dropped-reasons.md` | A2 输出 `accountID/authID/source/scope/reason/model/expiresAt/updatedAt/routeBlocking` | 主仓 DTO 保持同名 camelCase JSON 字段 | Wails mapping test |
| 主仓 route decision client | `internal/cliproxyapi/client.go` | 旧 `ChannelRoutingDecisionSnapshot` 只有 candidates/trace，没有 dropped reasons | 新增 `DroppedReasons`，兼容读取 `droppedReasons` 与 `dropped_reasons` | client focused test；如包内并行 quota dirty 阻塞则以 Wails test 覆盖主链路 |
| Wails/root binding 链路 | `internal/wailsapp/channel_routing.go`、`app.go`、`app_types.go` | root Wails DTO 只映射 trace/candidates | 新增 `ChannelRouteDroppedReason` 并一对一拷贝，不推导、不补造 expiry | `go test ./internal/wailsapp -run 'TestListChannelRouteDecisions'` |
| Frontend summary | `frontend/src/features/channel-routing/model/channelRouting.ts` | summary 只从 trace/unavailable fields 生成 detail | `ChannelRouteDecisionSnapshot` 新增 `droppedReasons`，detail 优先显示 `source/scope: reason`，旧 trace fallback 仍保留 | `node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs` |

## 实现说明

1. `internal/cliproxyapi`
   - 新增 `ChannelRoutingDroppedReason`。
   - `ChannelRoutingDecisionSnapshot` 新增 `DroppedReasons`。
   - 自定义 JSON 解码兼容 top-level `droppedReasons` / `dropped_reasons`，nested 字段兼容 camelCase / snake_case。
2. `internal/wailsapp`
   - 新增 Wails-facing `ChannelRouteDroppedReason`。
   - `ListChannelRouteDecisions` 对 sidecar client 返回值做一对一映射。
3. root Wails
   - `app_types.go` 新增 root DTO。
   - `app.go` 从 `internal/wailsapp` 映射到 root DTO。
4. frontend
   - `ChannelRouteDecisionSnapshot` 新增 `droppedReasons`。
   - summary detail 先展示 structured dropped reason，再保留旧 trace fallback。
   - `frontend/wailsjs/go/models.ts` 手工最小对齐类型，不运行 Wails 生成器。

## 验证命令

```bash
go test ./internal/wailsapp -run 'TestListChannelRouteDecisions'
node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs
npm run typecheck
git diff --check
```

## 剩余风险

1. 本阶段只透传 sidecar 已给出的 structured reasons，不从旧 trace 解析补造 `expiresAt` 或 `routeBlocking`。
2. `internal/cliproxyapi` 包内存在并行 quota fact dirty 测试，可能阻塞该包级 focused client test；A3 主链路验收以 Wails mapping 与 frontend model 为准。
3. 由于用户要求不跑 Wails 生成器，`frontend/wailsjs/go/models.ts` 采用最小手工对齐；后续正式 binding 生成时应确认生成结果包含同一 DTO。
