# Session Management

## 背景

会话管理页用于在桌面工作台中按项目查看 Codex / Claude 会话，支持搜索、项目切换、状态过滤、刷新和详情查看。

## 本轮目标

2026-06-02 使用 Open Design 对 `http://127.0.0.1:34115/#frame=claude&workspace=session-management` 做视觉评价，并基于评价落地小步视觉修正。

## 调整范围

- 强化页头标题尺度，保持 industrial / brutalist 工作台风格。
- 将搜索区改为更安静的 utility rail，避免与主容器粗边框抢层级。
- 降低项目列表与会话列表之间的分隔强度。
- 将会话摘要限制为适合扫读的一行宽度。
- 将 provider、消息数、文件和更新时间收敛到虚线 footer rail。

## 验收标准

- 会话页在桌面视口下仍保持左导航、项目列表、会话列表的三栏关系。
- 搜索框、过滤按钮、刷新按钮不再压过会话内容层级。
- 会话行标题、摘要、元信息分别形成清晰的三段阅读节奏。
- 相关源码级视觉回归测试通过。

## 证据

- 修改前截图：`screenshots/20260602/open-design/20260602-open-design-session-before-v01.png`
- 修改后截图：`screenshots/20260602/open-design/20260602-open-design-session-after-v01.png`

## 2026-06-12 标题生成策略

### 问题来源

用户在 `#frame=codex&workspace=session-management` 标注会话列表，指出多条会话标题都以 `# AGENTS.MD INSTRUCTIONS FOR <...` 开头，列表扫读价值低。

### 决策

- `AGENTS.md`、权限/环境/skills/plugin 上下文、浏览器 evidence 包装文本属于低信号 preamble，即使以 `user` 角色进入 session，也不能作为列表标题。
- 会话列表使用派生 `displayTitle`，优先级为：显式 thread/custom title -> 第一条真实用户需求 -> 最近真实用户需求 -> 助手结果 -> 最近 outcome -> 低优先级消息 -> 文件名。
- 继续保留原始消息内容与搜索能力；本轮只降噪展示标题，不删除原始会话记录。
- DTO 增加 `displayTitle`、`titleSource`、`titleConfidence`、`primaryIntent`、`lastOutcome`、`hasInstructionPreamble`，用于解释标题来源和后续 UI 调试。
- 旧 snapshot cache 读取时也按同一规则归一化，避免历史 `AGENTS.MD` 标题在未全量刷新前继续污染列表。
- 会话列表卡片只展示一个标题文本块，使用两行截断；不再在标题下重复渲染同源 summary。

### 验收

- Codex/Claude Code parser、Wails root DTO、frontend model、localhost dev bridge 必须同步字段。
- 前端会话列表与详情弹窗主标题优先读 `displayTitle`，旧缓存或静态 preview 缺字段时回退 `title/fileLabel`。
- 列表卡片标题可读两行，状态与 metadata rail 保持原扫描位置；卡片内不得出现同文案标题 + summary 重复。
- 回归测试覆盖 `# AGENTS.MD INSTRUCTIONS FOR` 不抢标题，真实用户需求成为 `displayTitle`。

## 2026-06-20 工作台新风格主视图收敛

### 问题来源

用户要求按账号池/代理池已经形成的新节奏和风格继续改完剩余界面。扫描真实运行页面后，`SessionManagementView.tsx` 是旧 `btn-swiss`、粗边框、反色 active 和大写重字重信号最集中的 workspace 之一。

### 本轮范围

- 会话管理页主壳层切换到 `--gt-surface-*` / `--gt-border-*` quiet workspace token。
- 页头摘要进入 `WorkspacePageHeader.meta`，分析与刷新动作改为 40px 图标按钮，保留 `aria-label` / `title`。
- 搜索 rail、项目列、会话列统一为轻描边、低背景噪声、内部滚动的两列工作台结构。
- 会话行保留两行标题与 metadata rail，但将旧粗左边线、uppercase、heavy weight 和反色状态 pill 降级为更安静的列表样式。
- 追加收敛 4 个 modal：分析范围选择、分析结果详情、Provider 归并、会话详情，统一使用轻描边 `--gt-*` modal shell 和新按钮样式。

### 验收

- `data-session-management-workbench`、`data-session-management-project-panel`、`data-session-management-session-panel` 固定主壳层与两列结构。
- 主 workbench 高度不得被项目/会话列表内容撑爆；浏览器 bounding rect 应接近可视工作区高度，项目列和会话列内部滚动。
- 页头分析/刷新按钮只显示图标，按钮尺寸 40x40，图标 20x20，且不使用旧 `btn-swiss`。
- 4 个 modal 固定 `data-session-management-modal`，不再使用旧 `btn-swiss` 或 `border-4` 粗描边外壳。
- 聚焦测试、typecheck、diff check 通过；浏览器只读 DOM/计算样式复核无可见旧粗框壳层。
