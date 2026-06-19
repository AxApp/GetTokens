# Parchment Trust Console Component Spec v01

## Purpose
本规范把 `Parchment Trust Console` 从“页面配色”提升为可执行的组件系统。后续 Settings、Design System、Accounts、Account Detail Modal、Codex / Claude 列表迁移必须先复用这里定义的组件和 token，不再靠页面级 CSS 临时拼风格。

## Reference Baseline
- 用户参考图归档：`docs-linhay/spaces/20260519-theme-skinning/screenshots/20260619/theme-skinning/20260619-theme-skinning-reference-baseline-v01.png`
- 参考图关键词：macOS workspace、warm parchment、trust admin、soft elevation、hairline grid、data-first modal。
- 反向结论：当前 Wave 0-2 的 Settings / Design System 页面只是过渡实现，后续需要按本规范抽组件后重做，而不是继续叠加页面 scoped CSS。

## Benchmark Read
1. Linear 类工作台：左侧导航低噪声，主区把列表、筛选、详情入口放在同一条任务流里，强调稳定扫描线。
2. Stripe 类 dashboard：指标卡、账单、额度、趋势图都有清晰的数字层级，卡片只是信息分组，不制造重边框。
3. macOS 原生偏好设置：窗口层级、圆角、阴影和轻量分隔承担质感，控件不需要高对比硬框。

## Design Thesis
- Visual thesis：温暖纸面上的可信运维控制台，使用轻量圆角、柔和阴影、细线网格和低饱和暖橙强调，保持 GetTokens 的高密度工具属性。
- Content plan：先 orient 用户所处区域，再提供搜索/筛选/列表，详情通过大 modal 或 detail panel 展开，底部只保留当前任务的状态和主动作。
- Interaction thesis：hover 只做轻微底色和 1px 位移，press 使用 `scale(0.98)`，tab 只用暖橙下划线，modal 进入使用 opacity + translateY，不做弹跳。

## CSS Strategy
1. 继续使用 `Tailwind static classes + CSS variables + scoped component classes`。
2. 不引入完整 UI 框架，不引入 CSS Modules，不引入 CSS-in-JS。
3. Headless primitive 只允许用于焦点管理和 ARIA，不承担视觉。
4. Parchment 组件样式必须进入共享 component layer 或组件文件，禁止长期保留页面私有大段 CSS。

## Token Roles
### Color
| Token | Initial value | Role |
|---|---:|---|
| `--gt-surface-canvas` | `#f5f1e8` | app 背景，带暖纸面感 |
| `--gt-surface-panel` | `#fbf7ed` | sidebar、toolbar、section 背景 |
| `--gt-surface-raised` | `#fffaf0` | modal、popover、重点卡片 |
| `--gt-surface-muted` | `#eee6d8` | hover、disabled、table header |
| `--gt-ink-primary` | `#201a14` | 主文本 |
| `--gt-ink-secondary` | `#6a5b4b` | 次级文本、说明 |
| `--gt-ink-muted` | `#9a8875` | metadata、placeholder |
| `--gt-border-subtle` | `#eadfce` | card 内部分隔 |
| `--gt-border-default` | `#ddd0bd` | 输入框、表格、section |
| `--gt-border-strong` | `#bca98f` | modal 外框、选中态 |
| `--gt-accent-primary` | `#bf4f24` | 主按钮、active tab、关键 action |
| `--gt-accent-hover` | `#a9431f` | 主按钮 hover |
| `--gt-status-success` | `#4f8a54` | active / healthy |
| `--gt-status-warning` | `#c8861f` | degraded / warning |
| `--gt-status-danger` | `#b94b3b` | error / destructive |
| `--gt-status-info` | `#627f92` | neutral info |

### Typography
| Role | Font | Size | Weight | Notes |
|---|---|---:|---:|---|
| App title / page title | `Avenir Next`, `ui-sans-serif` | 20-28px | 700 | sentence case or concise title, no mono |
| Section title | `Avenir Next`, `ui-sans-serif` | 13-15px | 700 | normal tracking |
| Body | `Avenir Next`, `ui-sans-serif` | 12-14px | 400-500 | reduce uppercase usage |
| Metadata | `JetBrains Mono`, `ui-monospace` | 10-11px | 500-700 | only for IDs, code, timestamps, token names |
| Numbers | `Avenir Next` with tabular nums | 14-22px | 650-750 | `font-variant-numeric: tabular-nums` |

Hard rule：Parchment 不是 mono-first。Mono 只用于 code、IDs、metadata、keyboard hint。中文正文不能用大段 uppercase / mono 伪装“控制台”。

### Radius
| Token | Value | Usage |
|---|---:|---|
| `--gt-radius-xs` | 6px | small pill, icon button |
| `--gt-radius-sm` | 8px | nav item, input, status pill |
| `--gt-radius-md` | 10px | table container, metric tile |
| `--gt-radius-lg` | 14px | modal, popover, major panel |
| `--gt-radius-pill` | 999px | status pill only |

### Elevation
| Level | Shadow | Usage |
|---|---|---|
| `flat` | none, 1px border only | table row, inline field |
| `raised-1` | `0 1px 2px rgb(32 26 20 / 0.05)` | toolbar, filter chip |
| `raised-2` | `0 8px 24px rgb(32 26 20 / 0.10)` | cards, popovers |
| `raised-3` | `0 18px 60px rgb(32 26 20 / 0.22)` | modal |

No heavy offset block shadow. No 2px black brutalist border in Parchment mode.

## Core Components
### 1. App Shell
- Sidebar width：236-248px，background `--gt-surface-panel`。
- Main canvas：`--gt-surface-canvas`，可有极轻纸面噪点，但不能出现强装饰纹理。
- Sidebar item：height 34-38px，radius 8px，active 使用 warm tint + accent text，不用整块深色反白。
- Bottom system status：固定在 sidebar 底部，status dot + title + short meta。
- 验收：active nav、hover nav、collapsed sidebar、system status 四态必须进设计系统或截图 gate。

### 2. Top Toolbar
- 高度 56-64px，左侧 back/title/count，中间 search，右侧 sync/new/view actions。
- Search 是 pill-like input，border 1px，带 command key hint。
- Primary action 使用 `--gt-accent-primary`，radius 7-8px，minimum hit area 40px。
- 次级 action 使用 raised-1，不使用同等视觉重量。

### 3. Filter Bar
- 放在 toolbar 下方或列表上方。
- Filter chip height 32-36px，radius 8px，selected 用 warm tint，不用实心黑。
- 多筛选状态必须有摘要，例如 `All Providers`、`Active only`、`27 total`。

### 4. Data Table / List
- Table container radius 10px，hairline border。
- Header height 34-38px，font 10-11px metadata。
- Row height 50-64px，根据内容密度可变，但同一列表保持稳定节奏。
- Row hover：`--gt-surface-muted` 30-45% mix。
- Selected row：左侧 2px accent 或浅暖底，禁止高饱和整行。
- Status 列使用 pill，Health 列可用 sparkline。
- 列表底部显示 range，例如 `Showing 1-10 of 27`。

### 5. Detail Modal
- 默认宽度 1040-1120px，最大宽度 `calc(100vw - 96px)`。
- radius 14px，shadow raised-3，background `--gt-surface-raised`。
- Header：title row + meta row + close icon，底部 hairline。
- Tabs：underline tab，active 用 accent underline，不能使用重框 segmented。
- Content：2 column grid，主信息左，账单/额度/趋势右；窄窗口改为单列。
- Footer：summary strip + primary action 右侧固定，避免每个卡片重复主动作。
- 仍遵守 GetTokens modal 规则：覆盖整个应用窗口视口，包括 sidebar；hash 参数 `detail=<id>` / `modal=<route>` 不变。

### 6. Section Card
- 用于 Credential Health、Quota & Billing、Recent Events 等。
- Header height 36-44px，图标 14-16px，title 12-13px weight 700。
- Body 默认无内层卡片，只有同类信息需要 row/card 时才嵌套。
- 内部分隔使用 1px `--gt-border-subtle`。
- 禁止卡片套卡片套卡片。

### 7. Metric Tile
- 用于 spend、budget、requests、tokens。
- 结构：label -> primary value -> delta/meta。
- 数字使用 tabular nums，value 16-22px。
- warning/danger delta 只改变小文本和箭头，不改变整卡背景。
- 预算进度用 3-4px horizontal bar。

### 8. Status Pill
- Height 20-24px，radius pill。
- Healthy：green text + pale green fill。
- Degraded：amber text + pale amber fill。
- Error：red text + pale red fill。
- Active/disabled/pending 语义必须和业务状态绑定，不能只按视觉颜色决定。

### 9. Chart / Sparkline
- 大图：细线 1.5px，grid 极淡，legend 右上或图上方。
- Sparkline：row 内 56-80px 宽，不能抢状态 pill 的层级。
- Parchment 下 chart 色应降低饱和，不用霓虹蓝绿。

### 10. Event List
- 左侧 icon / status dot，右侧 event title、scope、time。
- row height 34-44px。
- 链接 action 放 list footer，例如 `View all activity`。

### 11. Form Field / Credential Field
- Label 11-12px，正常字距，不大写中文。
- Input height 34-40px，radius 8px，border 1px。
- Masked secret 使用 mono，但周围说明用 sans。
- Validation message 紧贴字段，不放到卡片底部统一堆。

### 12. Buttons
- Primary：accent fill，white/cream text，radius 8px。
- Secondary：raised-1 surface，ink text，hairline border。
- Ghost：transparent，hover warm tint。
- Destructive：danger fill only for destructive confirmation，不用于普通错误查看。
- active：`transform: scale(0.98)`，motion 120ms ease-out。

## Page Composition Patterns
### List + Detail Modal
适用于 Accounts 和 Account Detail Modal。
1. Background table/list 保持可见，但 modal shadow 让其退后。
2. Modal 是主舞台，列表不需要模糊到不可读。
3. Modal footer 汇总当前健康、routing impact、last check、primary action。

### Settings
Settings 不应使用 modal 级卡片密度。采用：
1. Toolbar / title。
2. Preference group cards。
3. 每个设置项是 field row，不是独立大卡。
4. Runtime/native 类设置保留状态摘要。

### Design System
Design System 先展示 component contract，不先展示 Storybook 命令。
1. Component anatomy grid。
2. Token swatches。
3. State matrix。
4. Browser screenshot gate。
5. Storybook entry 作为辅助入口。

## Do / Don't
### Do
1. 使用 sans-first，mono 只给 metadata 和 code。
2. 用 1px hairline、radius、shadow 建立层级。
3. 保留数据密度，但减少 uppercase 噪声。
4. 让 status pill、metric tile、tabs、modal footer 成为可复用组件。
5. 每个页面迁移前先在 Design System 里补对应组件预览。

### Don't
1. 不使用 2px 黑边框、硬 offset shadow 或 brutalist red outline。
2. 不把每个信息块都包成大卡片。
3. 不用页面 scoped CSS 长期替代组件。
4. 不把 warning、active、accent 都染成同一种橙色。
5. 不为了风格改业务含义、状态来源、保存时机或 hash 行为。

## Acceptance Gates
每个 Parchment 页面迁移必须满足：
1. 组件先进入 Design System 或 Storybook，至少覆盖 default / hover / selected / disabled / error。
2. 页面截图 gate 断言无横向溢出。
3. 普通预览中 `Visible design-system markers: 0`。
4. Parchment 与 Classic 都可渲染，不破坏 `theme-mode`。
5. 若页面含 modal，必须验证全应用遮罩、hash 恢复、关闭恢复。

## Implementation Order Reset
后续实现顺序调整为：
1. 先按本规范建立 Parchment component classes / primitives。
2. 在 Design System Entry 增加 component anatomy 和 state matrix。
3. 重做 Settings，使它消费 SettingsRow / SettingsGroup / StatusSummary 等组件。
4. 再进入 Accounts 列表和 Account Detail Modal。

## Current Wave 0-2 Correction
当前 Wave 0-2 已经完成 theme preset、token、Settings / Design System 首版视觉，但它们仍有明显页面 scoped CSS 痕迹。下一轮不应继续直接改页面，而应先抽：
1. `ParchmentAppShell`
2. `ParchmentToolbar`
3. `ParchmentSectionCard`
4. `ParchmentMetricTile`
5. `ParchmentStatusPill`
6. `ParchmentTabs`
7. `ParchmentDetailModalShell`
8. `ParchmentSettingsRow`

这些名称可以不是最终代码名，但组件职责必须存在。
