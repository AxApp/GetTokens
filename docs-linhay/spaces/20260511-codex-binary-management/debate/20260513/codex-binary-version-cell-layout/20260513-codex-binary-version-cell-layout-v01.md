# Codex Binary VersionCell 布局讨论

## 辩论背景

用户指出 `src/features/codex-binary/CodexBinaryFeature.tsx:VersionCell:div:268` 内部布局混乱，要求与 Gemini 商量后由 Codex 落地修改。讨论目标是缩减版本 cell 信息噪音，并保留二进制管理的核心业务：下载、激活、更新/回退、变更记录。

## 参与者观点

### Gemini

- 论点：当前交互热区语义模糊。
- 引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:270-297`
- 代码事实：左侧整个 `button` 同时包裹标题、tag、active/rollback 状态、发布/安装日期和进度条，但功能只有展开版本说明。
- 结论：标题、状态、进度和变更记录入口需要拆区，否则用户无法快速判断哪里是信息、哪里是操作。

### Gemini

- 论点：当前网格划分过粗。
- 引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:269`
- 代码事实：外层只有 `minmax(0,1fr)` 与 `auto` 两列，左侧承载全部信息，右侧承载全部按钮。
- 结论：应改为身份区、状态区、操作区三段式结构；桌面固定身份和操作宽度，状态区自适应。

### Codex 裁定

- 采用 Gemini 的三段式布局，但不完全照搬“下载中禁止展开说明”的建议。变更记录是本业务的核心信息，下载时仍允许展开查看，避免用户在等待时丢失版本说明入口。
- 移除当前没有真实能力闭环的灰色 `Reveal` 与 disabled `Cancel` 按钮；后续只有接入 `RevealCodexBinary` / `CancelCodexBinaryDownload` 后才恢复为可操作按钮。

## 结论与行动项

- `VersionCell` 拆为：
  - 左侧身份区：版本号、tag、变更记录入口和展开箭头。
  - 中间状态区：下载/正式版/Alpha/active/rollback 标签，发布时间和安装时间。
  - 右侧操作区：固定宽度主操作，承载下载并激活、激活、回退或静态 active/progress 状态。
  - 进度区：下载任务存在时独立跨列显示阶段和进度条。
  - 变更记录区：展开后使用独立背景与最大高度滚动。
- 默认筛选改为正式版，进入页面优先展示稳定历史版本。
- 已用 Playwright 在 `http://localhost:34115/#frame=codex&workspace=binary-management` 做桌面和窄屏截图验收。

## 二次评审

### Gemini

- 论点：机械栅格导致视觉重心缺失。
- 引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:274`
- 代码事实：固定三列 `lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(11.5rem,13rem)]` 把 cell 等高切成身份、状态、操作三块。
- 截图事实：`20260513-codex-binary-version-cell-weird-before-v01.png` 中间状态区只有少量标签与日期占位，却占据大量空白。
- 结论：应放弃货架式分栏，改为左信息、右操作、底部展开的紧凑行。

### Gemini

- 论点：操作区孤岛化破坏版本行一致性。
- 引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:325`
- 代码事实：右侧操作区使用独立 `bg-[var(--bg-surface)]`，内部居中放主按钮。
- 截图事实：右侧灰底区域像 detached action well，主按钮与版本信息割裂。
- 结论：移除右侧灰底和内部竖向分割，主操作只作为版本行右侧动作存在。

### Codex 二次裁定

- 落地为“工业铭牌”行：
  - 取消 `min-h-[8.25rem]`、内部三栏竖向边框和右侧灰底。
  - 顶部同一行显示版本号、可下载/已下载、正式版/Alpha、active/rollback。
  - 次级信息行显示 tag、可用日期、下载阶段和变更记录按钮；没有日期时不再显示 `--` 占位。
  - 主操作按钮保持在 cell 右侧；窄屏时自然下移并占满当前内容宽度。
- 新截图：
  - 桌面：`20260513-codex-binary-version-cell-layout-after-v04.png`
  - 窄屏：`20260513-codex-binary-version-cell-layout-mobile-after-v03.png`
