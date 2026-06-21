# Status 页面 AntD 设计规范重制

## 背景

用户要求按当前 Ant Design 设计规范重新制作 \`http://localhost:5173/#frame=status\` 页面，并补充要求尽量使用 \`$antd\` 的组件。当前页面已经清理旧 Swiss / Parchment 视觉原语，但 status 首屏仍更像长表单堆叠：运行状态、目标客户端、配置写入和诊断信息没有形成 AntD 工作台式的清晰层级。

## 范围

- 只改 \`#frame=status\` 运行状态页面的页面结构与视觉层级。
- 不改变 Wails binding、sidecar 状态来源、本地配置写入行为和表单业务逻辑。
- 不新增主题或过渡视觉系统，继续使用 AntD component / gt-* semantic token。

## 设计目标

- 顶部改为紧凑 AntD status header：只保留标题、健康状态、运行状态 Tag 和运行环境 Tag，避免摘要区抢占主任务层级。
- 主体改为工作台布局：左侧为本地 CLI 配置写入主任务，右侧为账号库诊断和 quota evidence。
- 优先使用 AntD Card / Tag / Badge / Typography / Space 搭建页面骨架。
- 降低卡片堆叠感：surface 使用 8px 圆角、细边框、flat-first 层级，避免重阴影。
- 保持 14px body、400/600 字重、AntD palette-only 色彩。

## 验收

- 源码测试固定 \`data-status-hero\`、\`data-status-workbench-grid\`、\`data-status-primary-rail\`、\`data-status-diagnostics-rail\`，并禁止顶部 overview grid / descriptions / card 残留。
- 源码测试确认 StatusFeature 使用 AntD Card / Tag / Badge / Typography / Space。
- 运行态扫描不出现旧字重、大圆角、uppercase / italic / arbitrary tracking。

## 实施记录

- StatusFeature 顶部改为 AntD Card 承载的紧凑 status header，内部只使用 Typography.Title、Badge、Tag、Space 展示必要运行线索；移除重复目标客户端、访问地址和 runtime 的 overview cards。
- StatusFeature 主体改为桌面工作台双 rail：左侧保留本地 CLI 配置写入主任务，右侧放账号库诊断和 quota evidence；桌面宽度从 lg 起进入双栏。
- AccountStoreDiagnosticsPanel 改为 AntD Card + Tag，保留 sidecar 诊断事实来源，不在前端伪造状态。
- StatusApplyLocalSection 的 Codex / Claude Code 目标切换由项目自定义 SegmentedControl 改为 AntD Segmented，并固定到 4px 网格宽度避免文案截断。
- 2026-06-22 复核 StatusApplyLocalSection：将本地 CLI 写入面板内的旧自定义 ActionSelect / SelectField / TextInputField / ToggleSwitch / button 操作替换为 AntD Button / Select / Input / Switch / Space.Compact，并把窄 rail 内字段改为单列，避免控件挤压。
- 2026-06-22 二次复核 StatusApplyLocalSection：将 line 789 附近的超长双 rail div 拆为 AntD Card 栈，Codex 分支按连接与凭证、Provider 与 Model、能力开关、运行前检查、最小 Diff 分块；Claude Code 分支按连接与凭证、Model 映射、运行参数、运行前检查、settings Diff 分块。
- 旧面板阴影 shadow-sm 移除，surface 使用 8px 圆角、细边框和 AntD flat-first 层级。

## 验收证据

- 状态页源码测试：`node --test frontend/src/features/status/tests/statusTypography.test.mjs` 通过，23 pass。
- 类型检查：`npm --prefix frontend run typecheck` 通过。
- AntD 设计语言门禁与 legacy residue：`node --test frontend/src/context/antdColorContract.test.mjs frontend/src/features/design-system/legacyStyleResidue.test.mjs` 通过，5 pass。
- 完整前端单测：`npm --prefix frontend run test:unit` 通过。
- 生产构建：`npm --prefix frontend run build` 通过，仅保留既有 Vite chunk size warning。
- 文档与 diff 校验：`docs-linhay/scripts/check-docs.sh`、`git diff --check` 通过。
- 浏览器验收：`http://localhost:5173/#frame=status` 在 1280×860 无头截图确认 compact hero、双 rail 和 AntD Segmented 均渲染正常；顶部 hero 高度约 84px，overview 残留为 0；截图归档到 `docs-linhay/spaces/20260519-theme-skinning/screenshots/20260621/status-page-antd-redesign/20260621-status-page-antd-header-compact-after-v02.png`。
- 2026-06-22 本地 CLI 面板复核：浏览器度量确认 `data-status-local-cli-panel` 内 native button/select 为 0，AntD Button 10、Select 5、Switch 2、Segmented 2；截图归档到 `docs-linhay/spaces/20260519-theme-skinning/screenshots/20260622/status-local-cli-audit/20260622-status-local-cli-panel-after-v03.png`。
- 控制台验收：warnings 为 0；仍有 Vite browser preview 既有 `favicon.ico` 404 和缺少 Wails runtime 的 `window.go.main` 错误，不是本轮 AntD 改造引入。
- 2026-06-22 本地 CLI 拆卡片复核：浏览器度量确认 Codex 分支渲染 5 张 AntD Card，其中 4 张带 `data-status-local-cli-card` 业务分区；截图归档到 `docs-linhay/spaces/20260519-theme-skinning/screenshots/20260622/status-local-cli-card-split/20260622-status-local-cli-card-split-after-v01.png`。

## Session Skill Distillation

- 候选模式：状态页这种运行态工作台应优先用 AntD Card / Tag / Badge / Typography / Space / Segmented 建立页面骨架，再用 gt-* semantic token 做必要收口。
- 决策：该模式已经被 $antd skill 的 GetTokens AntD design-language contract 和 gettokens-frontend-design-quality 的 AntD-only 边界覆盖，本轮不新增 skill、不更新 AGENTS.md；仅写回本 plan 和 memory。
