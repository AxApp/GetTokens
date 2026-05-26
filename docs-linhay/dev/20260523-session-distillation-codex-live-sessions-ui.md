# Codex Live Sessions UI 会话沉淀

## 背景

本轮围绕 `#frame=codex&workspace=live-sessions` 做了两类收敛：

1. 会话列表行从模型、状态、时长等运行指标收窄为用户指定的低噪声信息。
2. 详情页账号区的额度与余额展示改为复用账号卡片组件。

这属于 Codex runtime observability 的 UI 边界沉淀，不是新的 repo-wide 治理规则。

## 沉淀模式

### 1. 列表只承载操作者识别信息

Live sessions 的 feed 不是完整诊断表。默认行只展示：

- `sessionID / projectName`
- `account / http|ws`

状态、模型、请求数、持续时间、TTFT、request id、execution id 和诊断摘要继续放在详情区。这样列表用于快速识别会话，详情用于排障。

### 2. `projectName` 必须端到端可选传递

项目名不是 sidecar runtime tracker 的必备真实源。当前应作为可选显示字段贯穿：

- `internal/wailsapp.CodexLiveSession`
- root `main.CodexLiveSession`
- `frontend/wailsjs/go/models.ts`
- `frontend/src/features/codex-live-sessions/model/types.ts`
- backend adapter

当字段不存在时，前端显示明确的未知项目文案，不从 session id 或 window id 伪造项目名。

### 3. 账号资源展示复用账号域组件

Live session detail 的账号区如果展示 quota / billing，不再复制私有 JSX。统一做法：

1. 把 live request 的 `quota` 转成 accounts 域 `QuotaDisplay`。
2. 把 live request 的 `billing` 转成全局 `BillingDisplay`。
3. 直接复用 `QuotaBars` 和 `BillingBalance`。

这能保持账号卡片、账号详情和运行会话详情在额度/余额上的视觉与语义一致。

### 4. 映射层要用纯函数测试锁住

新增或调整这类展示适配时，优先补纯函数测试：

- feed row summary 不应回显模型、状态、持续时间等噪声字段。
- quota adapter 应保留 label、remainingPercent、resetLabel / resetAtUnix。
- billing adapter 应保留 total / granted / topped-up 与 currency。

### 5. 时间线指标要按排障优先级露出首 token

请求时间线不是纯装饰条，而是可快速扫读的排障行。当前更合适的做法是：

1. 默认优先展示 `total`、`TTFT`、`first token` 这三枚主指标。
2. `stream`、`gap` 这类次级指标继续保留在更宽视口或详情区。
3. 视图断点应以“还能不能看清三枚主指标”为准，而不是按固定 `lg/xl` 机械隐藏。

这次改动只是在 timeline 行上把 `firstTokenLabel` 露出来，不代表要把所有次级耗时都前置到列表层。

### 6. 时间线行与详情壳层要避免“卡中卡”

Live sessions 的 detail 面板和筛选区本质上是工作台容器，不是再包一层大卡的内容块。当前更稳的做法是：

1. 筛选条、时间线列表、详情根容器保持同一视觉平面，不额外叠加一层 `border + shadow`。
2. 时间线 row 采用单行扫描式布局，`#序号 · model / request id / time range / 核心指标` 一行读完。
3. 诊断类长文本只留在 detail 内部的次级区块，不再默认显式渲染成底部独立大块。

这条边界适合继续放在 `gettokens-domain-engineering` 的 live sessions 小节里，不上升到 `AGENTS.md`。

### 7. 请求耗时趋势只投影当前 active request

请求耗时趋势图的数据应从请求记录推导，不能让视觉刷新本身成为数据来源。

稳定边界：

1. 已完成请求优先使用 `timing.totalDurationMs`；缺失时才回退到 `completedAt - startedAt`。
2. 当前 active request 可以用 `nowMs - startedAt` 做实时投影，用于显示正在增长的 live 样本。
3. 历史请求即使因为 cache 或 sidecar 残留仍带着 `streaming/reconnecting` 且没有 `completedAt`，也不能继续按 `nowMs` 投影；否则图上所有总耗时点会一起增长。
4. 图表只展示固定最近窗口内的请求点，默认窗口为 5 分钟；窗口外请求既不参与曲线，也不参与 y 轴最大值。
5. x 轴域固定为 `latestStartedAt - windowMs` 到 `latestStartedAt`，不能再用当前样本 min/max 自动撑满，否则稀疏请求会被视觉上拉成等距。
6. 回归测试必须覆盖“stale streaming request + active request”并存时，只有 active request 增长，并覆盖窗口外旧请求被过滤。

这类问题不要先调 CSS 或动画。先检查纯模型输出：`points[].values.totalDurationMs` 与 `points[].isLive` 是否已经错误增长；如果模型输出错，修模型，不修图表。

## 不纳入

- 不新增独立 `gettokens-codex-live-sessions` skill；当前规则继续归入 `gettokens-domain-engineering` 的 Codex Live Sessions 小节。
- 不把这次视觉顺序、间距和具体 Tailwind class 升级为 AGENTS 规则。
- 不承诺 GetTokens 能从 Codex HTTP fallback 透明恢复到 WebSocket。

## 后续入口

- Codex live sessions / runtime observability：`.agents/skills/gettokens-domain-engineering`
- 文档与 memory 写回：`.agents/skills/gettokens-ops-governance`
- 会话沉淀：`.agents/skills/gettokens-session-skill-distill`

## 验证记录

本轮已通过：

- `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

Go focused test 曾被当前工作区其他变更阻塞过：`internal/accounts/auth_file_normalize.go` 缺少 `convertSessionLikePayloadToCPA`。后续提交 live sessions 改动时，应重新确认当前工作区是否已经恢复可编译。
