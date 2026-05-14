# Session Management Gemini Handoff v01

## 背景

本交接只覆盖 Session Management 页面中项目列表和会话列表的视觉密度与信息布局，不涉及数据模型、Wails binding、后端接口或会话详情弹层。

当前入口：

- 代码：`frontend/src/features/session-management/SessionManagementView.tsx`
- 文案：`frontend/src/features/session-management/sessionManagementCopy.ts`
- Preview：`http://127.0.0.1:5173/?preview=session-management#frame=session-management`
- 当前截图：`docs-linhay/spaces/20260514-bug-week/screenshots/20260514/session-management/20260514-session-management-current-review-after-v01.png`

## 当前状态

已完成的基础修复：

1. `ProjectListPanel` 选中态编辑按钮已改为白底深色 Pencil 图标，解决选中后图标不可见问题。
2. 项目统计标签已缩短为 `会/活/归` 和 `S/A/R`。
3. 520px 以下项目统计标签组会隐藏，只保留项目名截断和编辑入口。
4. 项目最近时间已从标签轨道移出，放在项目行右下角，以纯文本显示。
5. `SessionsPanel` 会话更新时间已从标签轨道移出，放在会话行右下角，以纯文本显示。
6. 会话标题已单行截断，summary 使用两行 clamp 区域。

相关代码位置：

- `ProjectListPanel` 项目行容器：`SessionManagementView.tsx:241`
- `ProjectListPanel` 项目标签轨道与右下角时间：`SessionManagementView.tsx:253`
- `ProjectListPanel` 编辑按钮：`SessionManagementView.tsx:281`
- `SessionsPanel` 会话行容器：`SessionManagementView.tsx:378`
- `SessionsPanel` title / summary：`SessionManagementView.tsx:384`
- `SessionsPanel` meta 标签轨道与右下角时间：`SessionManagementView.tsx:393`

## 用户仍不满意的点

用户看过当前截图后，希望交给 Gemini 继续打磨这一块。需要重点重新设计，而不是只做微调：

1. 会话行正文虽然技术上使用了两行区域，但视觉上没有“完整吃满右侧”的感觉。
2. 会话 summary 应稳定显示为两行信息区，不应因为 preview 文案短而显得行高/空间关系松散。
3. 项目行和会话行的右下角时间方向是对的，但当前视觉层级可能还不够自然，像是硬放在空白处。
4. 整个区域应继续保持 GetTokens 当前 Swiss / brutalist / dense workspace 风格：黑白、高密度、硬边框、少装饰。

## Gemini 任务目标

请 Gemini 只负责视觉结构与 CSS/JSX 布局落地，目标是让项目列表和会话列表看起来像一个成熟的工作台列表，而不是字段临时堆叠。

必须保留的行为：

1. 点击项目行仍调用 `onSelectProject(project.id, compactLayout)`。
2. 项目编辑按钮仍调用 `onOpenProviderEditor(project.id)`。
3. 点击会话行仍调用 `onSelectSession(session.id)`。
4. 会话筛选、刷新、空状态、错误状态不改变行为。
5. 不改 `model.ts`、preview 数据结构、Wails bridge 或后端。

可调整范围：

1. `ProjectListPanel` 内项目行的 JSX 层级、spacing、对齐、标签布局。
2. `SessionsPanel` 内会话行的 JSX 层级、spacing、对齐、标签布局。
3. `sessionManagementCopy.ts` 中只允许调整短标签文案，不要恢复长文案。
4. 可抽小型局部 helper/component，但不要把本次改动扩大成整页重构。

## 设计要求

项目列表：

1. 项目名是主信息，必须明显。
2. `会/活/归/provider` 是辅助标签，可紧凑排列。
3. 最近时间必须单独起一行，位于项目行右下角，不使用 border 标签样式。
4. 选中行编辑图标必须清晰可见。
5. 窄宽时优先隐藏辅助标签，不要让文本竖排或挤压编辑按钮。

会话列表：

1. 标题单行，summary 两行。
2. summary 区域要占满右侧可用宽度，视觉上不能只贴在左侧一小段。
3. 状态、provider、消息数、文件名仍在标签轨道。
4. 更新时间必须单独起一行，位于会话行右下角，不使用标签样式。
5. 行高允许略微增加，但不要变成松散卡片；这是工作台列表，不是营销卡片。

全局风格：

1. 保持硬边框、黑白、紧凑、工业化的页面气质。
2. 不要引入圆角卡片、渐变、阴影装饰、彩色徽章。
3. 不要新增解释性文案。
4. 不要把页面改成 landing page 或卡片瀑布流。

## 验收标准

桌面宽度 1280x720：

1. 项目列表选中行的 Pencil 图标可见。
2. 项目最近时间在项目行右下角，非标签样式。
3. 会话 summary 有稳定两行信息区，并横向占满列表右侧可用空间。
4. 会话更新时间在会话行右下角，非标签样式。
5. 会话标签轨道不包含更新时间。
6. 文件名标签不能把时间挤掉，也不能溢出行边界。

窄宽 375x780：

1. 项目列表不出现竖排标签。
2. 编辑按钮仍可见。
3. 页面没有明显水平溢出。
4. 信息可以降级隐藏，但不能挤压成不可读状态。

## 建议验证命令

```bash
cd frontend
npm run typecheck
node --test src/features/session-management/model.test.mjs src/features/session-management/cache.test.mjs
npm run build
```

浏览器验收：

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

打开：

```text
http://127.0.0.1:5173/?preview=session-management#frame=session-management
```

截图建议归档：

```text
docs-linhay/spaces/20260514-bug-week/screenshots/20260514/session-management/20260514-session-management-gemini-layout-after-v01.png
docs-linhay/spaces/20260514-bug-week/screenshots/20260514/session-management/20260514-session-management-gemini-layout-mobile-after-v01.png
```

## 当前风险

1. `SessionManagementView.tsx` 已经承载多个局部组件，Gemini 如果大幅抽组件，需要控制 diff，不要引入跨模块重构。
2. `button` 内不能再嵌套 `button`；项目行已通过外层 `div` + 内部两个 button 避免该问题。
3. `line-clamp-2` 依赖当前 Tailwind 能生成对应 CSS；如调整类名，需实际浏览器截图确认两行效果。
4. 截图目录被 git ignore，截图用于验收归档，不会出现在 `git status` 的 tracked diff 中。
