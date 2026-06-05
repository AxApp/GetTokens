# Codex 运行会话项目聚合

## 背景

`Codex -> 运行会话` 当前以运行态 session / request 为主线展示 sidecar 热路径状态，适合排查单个请求的账号路由、WebSocket/HTTP transport、fallback、timing 与错误。但当用户同时在多个项目、多个 Codex 窗口或多个仓库中运行任务时，仅靠扁平会话列表不利于回答这些问题：

1. 当前哪些项目正在跑 Codex？
2. 每个项目下有多少 active / degraded / failed / completed 会话？
3. 某个项目最近是否集中出现 fallback、失败、同一账号拥塞或请求异常？
4. 在 Header 从会话维度切到项目维度或选中项目行查看汇总时，能否保留搜索、筛选、选中详情和可复制诊断路径？

因此本需求不在页面主体里新增项目列表，而是在 Codex 工作区导航区增加“会话维度切换”：用户可在导航层选择按“会话”或按“项目”查看运行态数据。主体仍保持现有运行会话列表与详情节奏，避免额外占用内容区空间。

## 目标

1. 在 `Codex -> 运行会话` 的导航区支持切换数据维度：`会话维度` / `项目维度`。
2. `会话维度` 保持现有会话列表体验；`项目维度` 在同一主体列表中展示项目聚合行。
3. 点击项目聚合行后，不进入下级列表；右侧直接显示该项目的汇总、耗时趋势与请求列表。
4. 聚合字段由 sidecar 运行态真实数据或 Wails DTO 显式派生，不在前端用不稳定字符串临时猜测。
5. 保留原有状态/transport/关键字筛选能力，并让筛选逻辑适配两个维度。
6. 为后续按项目归因 usage、导出诊断摘要、项目级告警打基础。

## 范围

### 信息架构

目标页面仍为：

- 路由：`#frame=codex&workspace=live-sessions`
- 一级模块：Codex
- 二级工作区：运行会话
- 维度参数建议：`view=session | project`，可落在 hash query 或工作区内状态；若需要可恢复，建议写入 hash，例如 `#frame=codex&workspace=live-sessions&view=project`。

本期不采用左 / 中 / 右三栏，也不在主体内容区增加横向 project rail。运行会话页面本身信息密度已经很高，项目维度应放到已有导航区中完成切换：

1. 运行会话页面 Header 区域：在 `运行会话` 入口下提供维度切换，例如 `会话` / `项目`。
2. 顶部总览：继续展示全局 active requests、active sessions、degraded、errors、项目数、最近更新时间；总览随维度补充不同主指标。
3. 主体单一列表：
   - `会话维度`：展示现有 session rows。
   - `项目维度`：展示 project aggregation rows，每行代表一个项目的运行态健康摘要。
4. 项目汇总选择：点击某个项目行后，左侧仍保持项目聚合列表；右侧汇总、耗时趋势和请求列表切换为该项目范围。
5. 详情复用：沿用现有 session/request detail 区域或覆盖层；小窗口下优先覆盖层/抽屉，不额外常驻第三栏。

### 项目聚合字段

每个项目聚合至少包含：

- `projectID`：稳定 ID，优先来自 sidecar / Codex runtime 识别到的 workspace/project 标识；否则由脱敏 project label 归一化生成。
- `projectName`：展示名，禁止暴露未经脱敏的本地绝对路径；默认 basename 或已脱敏 workspace label。
- `projectPathLabel`：可选，脱敏路径标签，用于区分同名项目。
- `sessionCount`：保留窗口内会话数。
- `activeSessionCount`：active / streaming / reconnecting / upstream_disconnected 的会话数。
- `requestCount`：保留窗口内请求数。
- `activeRequestCount`：当前未完成请求数。
- `degradedSessionCount`：`degraded_http` 或 fallback inferred 的会话数。
- `failedSessionCount`：failed / cancelled 会话数。
- `completedSessionCount`：completed 会话数。
- `websocketSessionCount` / `httpSessionCount`：按主 upstream/downstream transport 粗聚合。
- `providerCounts`、`modelCounts`：用于扫读项目主要流量来源。
- `lastModel`、`lastAuthLabel`、`lastRequestID`：最近活动摘要，敏感字段遵循现有脱敏规则。
- `startedAt`、`lastEventAt`、`durationMs`：项目活动窗口摘要。
- `health`：`active | warning | error | idle`，由 active/degraded/failed/fallback 聚合派生。
- `sessions`：该项目下 session id 列表或内嵌摘要；最终 DTO 形态由实现阶段按 sidecar/Wails 边界决定。

### 会话列表行为

1. 默认维度为 `会话`，保持现有运行会话列表，列表行显示短项目 tag。
2. 用户在导航区切换到 `项目` 维度后，主体列表展示项目聚合行，而不是展示会话行。
3. 项目聚合行展示项目名、active/degraded/failed、请求数、最近模型/账号、最近活动时间。
4. 点击项目聚合行后，左侧项目列表不切换为下级列表；右侧直接显示该项目的汇总信息、耗时趋势和请求列表。
5. 搜索关键字同时匹配项目名、脱敏路径标签、session id、request id、模型、账号 label、provider。
6. 状态筛选和 transport 筛选在 `会话维度` 下作用于会话行，在 `项目维度` 下作用于项目内匹配会话并影响项目行命中状态。
7. 当某项目下没有匹配会话时，在主列表内展示项目空态，不自动跳回全部项目。
8. 当当前选中 session 因维度切换、项目选择或筛选消失时，详情面板进入“未选中/当前筛选无结果”状态，不保留幽灵详情。

### 运行态数据边界

1. sidecar 仍是运行态数据源。账号选择、route guard、live sessions、usage attribution 等热路径状态优先在 `CLIProxyAPI#gettokens/sidecar` 内闭环。
2. 前端可以做纯展示排序和筛选，但不得为了聚合项目而伪造 sidecar 未提供的状态。
3. 若 sidecar 当前无法识别 project，应在 Wails/sidecar DTO 中明确返回 `unknown` project，而不是前端从 request 文本、prompt 或本地绝对路径中猜测。
4. 项目路径和 prompt 内容都属于敏感信息，项目聚合只展示脱敏 label。

## 非目标

1. 不改 Codex CLI 自身 project/session 协议。
2. 不替代 `session-management` 历史会话管理，也不扫描 JSONL 历史文件来补运行态列表。
3. 不在本期做项目级请求取消、强制切账号、重放请求等控制操作。
4. 不展示完整 prompt、完整 tool input、完整本地绝对路径或敏感 header。
5. 不要求跨 sidecar 重启恢复完整运行事件；沿用运行会话当前 retention 语义。
6. 不做移动端适配；验收以 macOS/Wails 桌面视口为准。

## BDD 验收场景

### 场景 1：默认进入运行会话总览

Given sidecar 已 ready 且存在多个项目的 Codex 运行会话
When 用户进入 `Codex -> 运行会话`
Then 页面展示顶部全局摘要、单一会话列表和详情占位
And 导航区维度默认为 `会话`
And 会话列表包含所有项目的会话，每行显示短项目 tag。

### 场景 2：在导航区切换到项目维度

Given 项目 A 和项目 B 都存在运行会话
When 用户在导航区将运行会话维度从 `会话` 切换为 `项目`
Then 主体列表展示项目 A、项目 B 的项目聚合行
And 每个项目行展示 active/degraded/failed/request 聚合摘要
And 页面不出现额外常驻项目侧栏。

### 场景 3：选择项目后显示项目汇总

Given 用户处于 `项目` 维度
When 用户点击项目 A 聚合行
Then 左侧仍保持项目聚合列表并高亮项目 A
And 右侧汇总卡片、耗时趋势和请求列表切换为项目 A 范围
And 页面不展示“返回项目列表”或任何下级会话列表。

### 场景 4：项目健康聚合

Given 项目 A 有 1 个 streaming session、1 个 degraded_http session 和 1 个 failed request
When 快照刷新
Then 项目 A 的项目行展示 active、degraded、failed 的聚合计数
And 项目 A 的 health 为 warning 或 error，具体映射在模型测试中固定。

### 场景 5：搜索同时命中项目与会话

Given 用户输入关键字 `gpt-5.4` 或某个账号 label
When 项目维度列表和会话维度列表刷新筛选结果
Then 项目维度列表能展示包含匹配会话的项目
And 会话列表只展示匹配 session
And 清空搜索后恢复原维度与项目选择状态。

### 场景 6：筛选导致当前详情消失

Given 用户已打开项目 A 下 session S 的详情
When 用户切换维度、选择项目 B 或应用筛选导致 session S 不可见
Then 详情面板关闭或显示可恢复的空态
And hash / detail 参数不得残留到不属于当前项目的 session。

### 场景 7：未知项目安全展示

Given 某些运行会话没有 project 信息
When 用户切换到 `项目` 维度
Then 这些会话被聚合到 `未知项目`
And 不展示本地绝对路径、prompt 文本或其他敏感内容。

### 场景 8：刷新与 retention

Given 页面处于 `项目` 维度并已选中项目 A
When sidecar snapshot 轮询返回新数据
Then 项目 A 的聚合数字和会话列表在 2 秒内更新
And 如果项目 A 暂时没有新 active 会话，但 retention 中仍有最近完成会话，项目行仍可见直到 retention 窗口结束。

## TDD / 测试计划

### 后端 / Wails DTO

1. 为 live sessions snapshot 增加或派生 `projects` 聚合结构的 Go 单元测试。
2. 覆盖多项目、多状态、多 transport、多 provider/model 的聚合计数。
3. 覆盖 unknown project fallback 与路径脱敏。
4. 覆盖 root Wails DTO 映射，避免 `internal/wailsapp` 类型已变但 `app_types.go` / `app.go` / `frontend/wailsjs/go/models.ts` 未同步。

### 前端模型

1. 为 selector 增加 `buildCodexLiveProjectSummaries` 或同等函数测试。
2. 覆盖默认 `会话` 维度、`项目` 维度、项目选择、搜索、状态筛选、transport 筛选组合。
3. 覆盖当前 selected session 在筛选后不可见时的选择修正。
4. 覆盖项目 health 映射优先级：error > warning/degraded > active > idle。

### UI / 浏览器验收

1. 增加或更新运行会话 preview/mock data，包含至少 3 个项目：active、degraded、unknown。
2. 增加无头浏览器 DOM 断言：导航区维度切换存在、项目维度列表存在、项目选择后会话列表变更、未知项目不暴露绝对路径。
3. 保存桌面视口截图到本 space：`docs-linhay/spaces/20260604-codex-session-project-aggregation/screenshots/<date>/`。
4. 如涉及真实 Wails 绑定或 sidecar 数据，则完成 Wails dev 环境验收；未触碰正式版 `/Applications/GetTokens.app`。

## 交互与视觉要求

1. 保持 GetTokens 桌面工作台的 industrial / brutalist 视觉语言：粗边框、utility rail、紧凑密度、清晰状态 chip。
2. 项目维度切换放在导航区，不在主体区域新增 project rail、项目侧栏或文件树。
3. `项目` 维度下的项目聚合行优先展示：项目名、active 数、degraded/failed 标记、请求数、最近模型；不展示长路径。
4. `会话` / `项目` 维度切换状态要明确，可恢复，且不挤压列表内容密度。
5. 同名项目通过短路径标签或 hash 后缀区分，路径默认脱敏。
6. 项目行和会话行选中态要明显；遵循近期运行会话列表选中态加重规则。
7. 详情类 modal 如后续改为覆盖层，必须遵循 AGENTS 中全视口遮罩与 hash 路由规则。

## 数据契约草案

首选 DTO 方向：在 live sessions snapshot 中新增项目聚合，同时保留原有 `sessions` 扁平列表，降低前端迁移风险。

```ts
interface CodexLiveProjectSummary {
  projectID: string;
  projectName: string;
  projectPathLabel?: string;
  health: 'active' | 'warning' | 'error' | 'idle';
  sessionCount: number;
  activeSessionCount: number;
  completedSessionCount: number;
  degradedSessionCount: number;
  failedSessionCount: number;
  requestCount: number;
  activeRequestCount: number;
  websocketSessionCount: number;
  httpSessionCount: number;
  providerCounts: Record<string, number>;
  modelCounts: Record<string, number>;
  lastModel?: string;
  lastAuthLabel?: string;
  lastRequestID?: string;
  startedAt?: string;
  lastEventAt?: string;
  durationMs?: number;
  sessionIDs: string[];
}

interface CodexLiveSessionSnapshot {
  // existing fields...
  projectSummary?: {
    projectCount: number;
    activeProjectCount: number;
    degradedProjectCount: number;
    failedProjectCount: number;
  };
  projects?: CodexLiveProjectSummary[];
  sessions: CodexLiveSession[];
}
```

备选 DTO 方向：如果 sidecar management API 已能返回 project grouping，则 Wails 只做透传与 root DTO 映射；如果 sidecar 暂未返回，则 `internal/wailsapp` 可以在快照层做稳定派生，但必须写测试并保持脱敏。

## 实施计划

1. **需求固化**：确认 project ID 来源、unknown project 规则、聚合字段是否由 sidecar 返回还是 Wails 派生。
2. **红灯测试**：补后端聚合/DTO 映射测试、前端 selector 测试、preview DOM 断言。
3. **最小实现**：补 DTO、聚合 selector、导航区维度切换、项目维度列表、项目选择状态。
4. **回归与重构**：清理重复筛选逻辑，确保现有 live sessions 详情、复制诊断、清空 retention 不回退。
5. **验收产物**：运行 Go/前端测试、无头浏览器截图、Wails dev 验收（如触碰绑定/sidecar）。
6. **文档与记忆**：更新本 space、必要 dev 文档和 memory。

## 设计稿入口

- 本期设计稿：`（未产出；若进入视觉设计，单期只保留一个 HTML 文件，例如 codex-live-session-project-aggregation-v01.html）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260604-codex-session-project-aggregation`
- worktree：`../GetTokens-worktrees/20260604-codex-session-project-aggregation/`
- 当前建议：本需求涉及 sidecar/Wails DTO、前端列表和桌面验收，若开始实现且预计与其他需求并行，使用独立 worktree。

## 相关链接

- 现有运行会话需求：`docs-linhay/spaces/20260521-codex-live-session-detail/README.md`
- 运行会话账号身份：`docs-linhay/spaces/20260603-codex-live-session-account-identity/README.md`
- 运行会话 retention/清理：`docs-linhay/spaces/20260603-live-sessions-retention-clear/README.md`
- 历史会话管理：`docs-linhay/spaces/session-management/README.md`

## 当前状态

- 状态：implemented / pending visual and Wails smoke
- 最近更新：2026-06-04


## 实施摘要（2026-06-04）

- 已按最终方案把项目维度切换放入 运行会话页面 Header 区域：`会话` / `项目`。
- 主体区域保持单一列表：`会话` 维度显示 session rows，`项目` 维度显示 project aggregation rows。
- 点击项目聚合行后，左侧仍保持项目聚合列表并高亮该项目，右侧显示该项目汇总、耗时趋势和请求列表。
- `view=project` 支持 hash 恢复；默认仍为 `view=session`。
- 首版项目聚合基于现有 `CodexLiveSession.projectName` 在前端 selector 显式派生，未改 sidecar / Wails DTO。
