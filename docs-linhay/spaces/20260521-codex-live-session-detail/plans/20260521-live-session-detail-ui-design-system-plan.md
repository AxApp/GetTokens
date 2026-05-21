# Codex 运行会话 UI 与设计系统方案

## 设计定位

Visual thesis：GetTokens Codex 运行会话是 Swiss-industrial 运维控制台，黑白灰硬边界、单面板投影、紧凑状态巷道，用传输链路而不是装饰图形形成视觉记忆点。

Content plan：首屏先定向当前运行态，再给可过滤会话列表，右侧或下方显示请求级 timeline、transport lane、账号命中和脱敏诊断，不做 hero。

Interaction thesis：点击会话行锁定详情；transport lane 随状态变更做短促高亮；复制诊断摘要只反馈复制状态，不改变布局高度。

## 用户与场景

用户是 GetTokens 的维护者、重度 Codex 用户和排障人员。典型使用场景：

- Codex 正在跑但用户不知道是否卡住。
- WebSocket 下游断开或上游断开，需要判断是等待 retry、已经失败，还是已降级 HTTP。
- 用户拿到 request id，需要快速定位命中账号、模型、transport、错误。
- 需要复制一段脱敏诊断摘要给维护者排查。

该页面是工作台，不是宣传页。首屏必须直接可用，信息密度优先于说明文案。

## 进入位置

- 一级 frame：`#frame=codex`
- workspace：`live-sessions`
- 中文导航：`运行会话`
- 建议位置：Codex 子菜单中 `账号列表` 后、`会话管理` 前。

原因：

- `account-list` 管账号和路由顺序。
- `live-sessions` 看当前请求运行态。
- `session-management` 看本地历史 session 文件。

## 首屏布局

桌面布局：

- 顶部：`WorkspacePageHeader`
  - title：`Codex 运行会话`
  - eyebrow/source：`Sidecar live / cache / preview`
  - right actions：刷新、复制当前选中诊断摘要。
- Summary strip：横向紧凑指标
  - active
  - reconnecting
  - degraded_http
  - failed
  - websocket sessions
  - last event age
- Toolbar：搜索与筛选
  - `SearchInput`：request id / session id / auth / model
  - `SegmentedControl`：全部、运行中、重连、已降级、失败、已完成
  - transport filter：全部、WebSocket、HTTP
- Body：单列表工作台
  - 每个 session 是一条横向密集行，桌面固定为 `Status / Session / request / Route / Latency / Open` 五列。
  - 移动端按 `Status / Session / Route / Latency` 分块堆叠，每个块都有显式标签，避免信息混在一起。
  - 行内只保留状态、session id、request id、模型、账号、transport、TTFT、first token、output rate。
  - 点击行后在同一列表流内展开该 session 的详情，不使用右侧独立详情栏。
  - 展开态不改变其他行的基础行高；详情区域作为该行下方的附属内容，保留 transport lane、timing、metadata、timeline、diagnostic。
  - 展开详情内的 timing 使用轻量键值表，不再使用 12 张小卡片；transport lane 使用低权重边框，避免页面变成卡片堆叠。

窄屏布局：

- Summary strip 变为 2 列网格。
- session list 单列堆叠，选中详情在对应行下方展开。
- transport lane 横向滚动，但高度固定。
- 长 id 使用 middle truncate，点击复制完整 id。

## 信息层级

### Session row

每行必须一眼显示：

- 状态 badge：active / reconnecting / degraded_http / failed / completed。
- 主标识：短 session id 或 request id。
- transport pair：`downstream ws -> upstream ws/http`。
- model。
- auth label / auth id。
- duration 与 last event age。
- fallback 推断标记。

行内禁止塞完整错误长文。错误只展示 code/status，详情区展示摘要。

### Detail panel

详情区分五段：

1. Request header
   - session id、request ids、model、status、duration。
2. Transport lane
   - downstream lane：connected、request received、client disconnect。
   - sidecar lane：auth selected、normalized、forwarding、completed/failed。
   - upstream lane：dial、handshake、send、first event、completed/read error。
   - fallback lane：只有推断时显示。
3. Rate / time measurements
   - queue、auth、connect、TTFT、first token。
   - stream duration、total duration。
   - output tokens/s、total tokens/s。
   - average event gap、max event gap、reconnect count。
   - 行内 compact summary 与卡片网格使用同一 formatter，复制诊断摘要保持同一口径。
4. Request timeline
   - 时间排序、固定图标宽度、状态色但不依赖颜色表达。
5. Diagnostic summary
   - 脱敏 key-value。
   - copy action。
   - 显示 redaction count，例如 `已隐藏 5 个敏感字段`。

## 组件拆分

建议新增 feature：

- `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx`
- `frontend/src/features/codex-live-sessions/components/`
- `frontend/src/features/codex-live-sessions/hooks/`
- `frontend/src/features/codex-live-sessions/model/`
- `frontend/src/features/codex-live-sessions/tests/`

设计系统候选组件：

| 组件 | 职责 | 设计系统决策 | 匹配现有模式 |
| --- | --- | --- | --- |
| `CodexLiveSessionsWorkbench` | 整个 live-sessions 工作台纯展示层 | admitted，Storybook mock 覆盖全页状态 | `WorkspacePageHeader`、Usage Desk panels、DebugPanel list |
| `CodexLiveSessionSummaryStrip` | 顶部运行态指标条 | admitted | usage summary strip / status metric |
| `CodexLiveSessionList` | 会话列表和空态 | admitted | `SearchInput`、DebugPanel EntryCard、virtual list pattern |
| `CodexLiveSessionRow` | 单会话行 | admitted | `CodexAccountOrderRow` 的密集行信息结构 |
| `CodexLiveSessionDetailPanel` | 右侧详情容器 | admitted | DebugPanel details、SnippetPre |
| `CodexLiveRequestTimeline` | 请求生命周期 timeline | admitted | DebugPanel log table |
| `CodexTransportLane` | 下游/sidecar/上游/fallback 状态巷道 | admitted，新业务组件 | 无现成等价组件，作为本页视觉锚点 |
| `CodexLiveTimingMetrics` | 请求级速率/耗时测量区，当前内聚在 workbench | admitted | usage summary strip / status metric |
| `CodexLiveSessionDiagnosticSummary` | 脱敏诊断摘要与复制 | admitted | `SnippetPre`、copy action |
| `CodexLiveSessionFilterBar` | 搜索和筛选组合 | candidate，可先内聚在 workbench | `SearchInput`、`SegmentedControl` |

如果实现时拆出更多 `components/**/*.tsx`，必须同步到 `componentManifest.ts`，状态只能是 `admitted`、`candidate`、`deferred` 或 `excluded`，不能沉默缺席。

## 设计系统登记计划

新增 story 文件：

- `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsComponents.stories.tsx`

Storybook title：

- `Design System/业务组件/Codex 运行会话`

`storyCatalog.ts` 需要加入 `feature-components`：

- id：`codex-live-sessions-components`
- title：`Codex 运行会话`
- path：`frontend/src/features/codex-live-sessions/components/CodexLiveSessionsComponents.stories.tsx`

`componentManifest.ts` 需要新增常量：

- `codexLiveSessionsStoryPath`
- `codexLiveSessionsStorybookTitle`

并为每个新组件记录：

- `ownerFeature: 'codex-live-sessions'`
- `status`
- `tier: 'feature-component'`
- `matchedPatterns`
- `storyPath`
- `storybookTitle`
- `catalogGroupId: 'feature-components'`
- `requiredStates`
- `mockDataSources`

运行时 admitted 组件根节点必须带：

- `data-design-system-component="true"`
- `data-design-system-component-name="<ComponentName>"`

Storybook 内用 `DesignSystemStoryFrame` 包裹 admitted 组件，使用 mock 数据，不调用 Wails 或 sidecar。

## Story 状态矩阵

必须覆盖：

- `Overview`
  - 同屏展示 active websocket、reconnecting、degraded_http、failed、empty 摘要。
- `ActiveWebsocket`
  - downstream/upstream 都是 websocket，正在 streaming，展示 queue、TTFT、first token、token/s 和 event gap。
- `Reconnecting`
  - upstream read error 后 sidecar 正在等待 Codex retry 或已重建 upstream，reconnect count 与 longest gap 可见。
- `DegradedHttp`
  - 同 window 先 WebSocket 后 HTTP，badge 文案包含“推断”，HTTP fallback 后的 stream/total/token rate 可见。
- `Failed`
  - 上游错误，error code/status 可见，敏感字段不可见，first token/token rate 显示为 unavailable。
- `SidecarNotReady`
  - 显示 cache/不可读取状态，不展示成“没有会话”。
- `Empty`
  - sidecar ready 但无活动与最近会话。
- `HighVolume`
  - 200 条会话 mock，验证列表不会撑爆布局。
- `RedactedDiagnostic`
  - 诊断摘要展示 redaction count，无 token/API key/cookie。
- `Mobile`
  - 375px 宽度，summary、list、detail 不溢出。

## 视觉规则

- 使用现有 CSS variables 和 GetTokens 设计系统色彩，不新增独立品牌色。
- 主色仍为黑白灰；状态色仅作为小面积辅助：
  - active：绿色点/左 rail。
  - reconnecting：amber。
  - degraded_http：橙红或 warning。
  - failed：red。
  - completed：neutral。
- 边框沿用 `border-2 border-[var(--border-color)]`。
- 主面板使用单层 hard shadow，不做卡片套卡片。
- Row hover 可以用背景 step 和 `active:scale-95`，不得改变行高。
- id 使用 monospace，middle truncate。
- 事件 lane 的尺寸固定，状态变化不能造成布局跳动。

## 文案规则

中文默认，英文同步到 `en.json`。

关键文案：

- `Codex 运行会话`
- `Sidecar 未就绪，无法读取实时会话`
- `推断已降级到 HTTP`
- `本会话内可能不会自动恢复 WebSocket`
- `复制诊断摘要`
- `已隐藏敏感字段`
- `没有正在运行的 Codex 会话`

禁止文案：

- 不写“已读取 Codex disable_websockets”。
- 不写“GetTokens 已自动恢复 WebSocket”。
- 不写“安全展示完整请求内容”。

## 交互细节

- 点击 session row：
  - 选中并加载 detail。
  - URL 可选追加 `&detail=<sessionID>`，关闭详情只移除 detail。
- 搜索：
  - 支持 request id、client request id、upstream request id、session id、auth id、model。
  - 命中 id 使用高亮，但不改变布局。
- 复制：
  - 复制按钮使用 icon + tooltip。
  - 成功状态 1.5 秒后恢复。
- 刷新：
  - 手动刷新不打断自动轮询。
  - sidecar not ready 时保留最近 cache。

## Preview 数据

新增 mock data：

- `codexLiveSessionsActivePreview`
- `codexLiveSessionsReconnectingPreview`
- `codexLiveSessionsDegradedPreview`
- `codexLiveSessionsFailedPreview`
- `codexLiveSessionsEmptyPreview`
- `codexLiveSessionsSidecarNotReadyPreview`
- `codexLiveSessionsHighVolumePreview`
- `codexLiveSessionsRedactedDiagnosticPreview`

mock data 必须与前端 DTO 同类型，避免 Storybook 与真实接口漂移。

## 验收门禁

实现 UI 时需要验证：

- `node --test frontend/src/features/codex-live-sessions/*.test.mjs` 或对应测试路径。
- `node --test frontend/src/features/design-system/storyCatalog.test.mjs`。
- `npm --prefix frontend run typecheck`。
- `npm --prefix frontend run build-storybook` 或至少能启动 Storybook 并渲染该 story。
- 无头浏览器截图：
  - desktop：`#frame=codex&workspace=live-sessions`
  - mobile：375px。
- 截图归档到：
  - `docs-linhay/spaces/20260521-codex-live-session-detail/screenshots/<YYYYMMDD>/codex-live-sessions/`

## 第一版不做

- 不做拓扑大图。
- 不做实时动画流光。
- 不做完整 payload inspector。
- 不做请求控制按钮。
- 不把 `session-management` 的历史 session 文件能力塞进本页。
