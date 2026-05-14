# Bug Week Triage Plan v01

## 目标

用一个轻量流程承接 bug 周杂项问题：先确认边界，再补最小验证，再修复闭环。

## 流程

1. Intake：记录问题现象、来源、影响范围和复现方式。
2. Classify：判断留在本空间还是拆独立 `space`。
3. Specify：补充 BDD 场景、验收标准和测试计划。
4. Fix：按 TDD 顺序补测试、确认失败、实现修复。
5. Verify：运行相关测试，必要时补桌面验收和截图。
6. Close：记录验证结果、残留风险、关联提交或后续行动项。

## 问题记录模板

```text
### <bug-title>

- 状态：todo / doing / verified / blocked
- 来源：
- 影响范围：
- 复现步骤：
- 预期结果：
- 实际结果：
- 验收标准：
- 测试计划：
- 验证结果：
- 截图：
- 备注：
```

## 当前队列

### batch-01-app-icon-replaced

- 状态：verified
- 来源：用户反馈应用图标被换掉
- 影响范围：macOS/Wails 应用图标、打包产物图标
- 复现步骤：检查图标资源、Wails 配置、最近 git 历史和构建产物
- 预期结果：应用使用 GetTokens 正确品牌图标
- 实际结果：待确认
- 验收标准：确认根因并修复图标资源或配置；必要时验证构建产物图标
- 测试计划：资源校验、配置校验；如涉及打包脚本则运行相关测试
- 验证结果：已确认 `build/appicon.png` 在提交 `0821d19` 被替换成 Wails 风格 W 图标；已恢复为 `logo-brutalist-key.png` 同款品牌图，两个文件 SHA-256 一致。
- 截图：
- 备注：

### batch-01-session-management-density

- 状态：verified
- 来源：用户标注 SessionManagementView 中 SessionsPanel / ProjectListPanel
- 影响范围：会话管理页面列表密度和窄宽布局
- 复现步骤：打开 Session Management 页面，在普通和窄宽下观察 session 行与 project 行
- 预期结果：固定 meta 文本进入标签轨道；项目行窄宽不溢出，次要元素可降级隐藏
- 实际结果：待确认
- 验收标准：主文本区更干净；标签轨道承接数量、ID、状态等固定信息；项目列表在窄宽可读
- 测试计划：前端 typecheck；浏览器/桌面布局验收
- 验证结果：已通过 `npm run typecheck`、`npm run test:unit`、`npm run build`；Playwright 桌面截图确认项目列表标签换行和会话 meta 轨道正常。
- 截图：`screenshots/20260514/session-management/20260514-session-management-density-after-v03.png`
- 备注：

### batch-01-workspace-header-compact

- 状态：verified
- 来源：用户标注 WorkspacePageHeader 信息过多
- 影响范围：工作区页面标题区域
- 复现步骤：打开有长 subtitle 的 workspace 页面
- 预期结果：标题区信息更精炼，不占用过多横向空间
- 实际结果：待确认
- 验收标准：默认 header 副标题收敛；调用方自定义 className 不被破坏
- 测试计划：前端 typecheck；布局验收
- 验证结果：已精简 Session Management header 副标题，移除 provider 分布长串；`WorkspacePageHeader` 默认副标题限宽并允许 header wrap。已通过 `npm run typecheck`、`npm run test:unit`、`npm run build`。
- 截图：
- 备注：

### batch-01-mcp-editor-raw-details

- 状态：verified
- 来源：用户标注 McpServerEditorModal 详情内容
- 影响范围：Codex Extensions / MCP server editor
- 复现步骤：打开 MCP server editor，查看右侧详情区域
- 预期结果：详情区域像文本编辑器一样显示原始配置字段内容
- 实际结果：待确认
- 验收标准：只显示当前 server 原始字段对应内容；不展示空字段；保存行为不变
- 测试计划：前端 typecheck；浏览器/桌面 modal 验收
- 验证结果：已新增后端 `rawConfig` 字段，MCP editor 右侧优先显示 config.toml 原始 server 段和 nested tools 段；已通过 `go test ./internal/wailsapp -run 'TestGetCodexMcpServers|TestSaveCodexMcpServer'`、`go test ./...`、前端 typecheck/build。
- 截图：`screenshots/20260514/codex-extensions/20260514-codex-extensions-mcp-raw-details-after-v01.png`
- 备注：

### batch-01-usage-desk-chart-and-minute-summary

- 状态：verified
- 来源：用户标注 UsageDeskChart 左右切断与分钟级统计口径
- 影响范围：Usage Desk 图表和 footer 汇总
- 复现步骤：打开 Usage Desk，切换日级/分钟级，观察图表边缘和 footer 汇总
- 预期结果：图表左右点位/标签不被裁切；分钟级汇总统计全天数据
- 实际结果：待确认
- 验收标准：图表边缘有安全留白；分钟级 footer 使用当天聚合而不是单个分钟/局部点
- 测试计划：先补 usageDesk 单测，再运行相关 unit test 和 typecheck
- 验证结果：已补 `usageDesk.test.mjs` 覆盖分钟视图按全天 daily point 汇总；ChartSurface 增加左右绘图安全边距。已通过目标 usageDesk 单测、`npm run test:unit`、`npm run build`。
- 截图：
- 备注：

### batch-02-usage-desk-extreme-value-scale

- 状态：verified
- 来源：用户标注 `UsageDeskChart.tsx:ChartSurface` 极大值导致小数值过于平坦
- 影响范围：Usage Desk 日级/分钟级图表的视觉趋势判断
- 复现步骤：构造同一图表中存在一个极大值、其余点为日常小值的数据序列
- 预期结果：极大值仍显示真实数值，但不应把其他日常点压成贴近基线的平线
- 实际结果：当前纯线性比例使用 `value / maxValue`，单点极大值会压缩所有其他点的 Y 轴高度
- 验收标准：正常数据保持线性比例；出现明显极大值时自动使用压缩比例；图表标签仍显示真实数值
- 测试计划：补 `usageDesk.test.mjs` 覆盖线性场景和极大值压缩场景；运行前端 typecheck/unit/build；补浏览器截图验收
- 验证结果：已补 `buildUsageDeskChartValueScale` 单测覆盖正常线性与极大值压缩场景；`ChartSurface` 改为使用该比例函数计算 Y 坐标。已通过目标 usageDesk 单测、`npm run typecheck`、`npm run test:unit`、`npm run build`；Playwright 注入 120000 token 极大值样本后确认 1200-2200 token 日常点不再贴近基线。
- 截图：`screenshots/20260514/usage-desk/20260514-usage-desk-extreme-value-scale-after-v01.png`
- 备注：

### batch-03-usage-desk-curve-motion

- 状态：verified
- 来源：用户澄清“秒级”不是数据粒度，而是希望曲线有按时间前进的动画；确认分钟级动画效果后，要求天级趋势也使用同样形式
- 影响范围：Usage Desk 图表视觉动效
- 复现步骤：打开 Usage Desk，切换天级趋势和分钟明细，观察曲线进入方式
- 预期结果：天级趋势和分钟明细都使用曲线前进 reveal；不新增秒级数据点，不改变统计口径
- 实际结果：分钟明细已启用 realtime curve motion，天级趋势仍使用 standard 动画
- 验收标准：天级趋势和分钟明细都使用 bounded realtime 动画；点位按曲线推进顺序出现；数据点数量不增加
- 测试计划：运行 usageDesk 单测、typecheck、完整前端单测和 build；浏览器读取 SVG 动画时长并截图归档
- 验证结果：已将 Usage Desk 天级趋势和分钟明细都切到 `curveMotion="realtime"`；Playwright 隔离上下文注入 7 天样本后确认天级趋势仍为 7 个数据点，SVG 曲线动画为 `usage-desk-curve-sweep 1.4s`，点位延迟从 `0s` 到 `0.36s`，没有生成秒级数据点。已通过 usageDesk 目标单测、`npm run typecheck`、`npm run test:unit`、`npm run build`。
- 截图：`screenshots/20260514/usage-desk/20260514-usage-desk-curve-motion-daily-after-v02.png`
- 备注：

### batch-04-session-project-row-density

- 状态：verified
- 来源：用户标注 `SessionManagementView.tsx:ProjectListPanel` 选中态编辑图标不可见、标签文本量仍过大
- 影响范围：Session Management 项目列表
- 复现步骤：打开 Session Management，选中项目行，观察右侧编辑按钮和项目统计标签
- 预期结果：选中行编辑图标仍清晰可见；项目行标签更短、更紧凑
- 实际结果：选中行编辑按钮文字色与按钮背景同为 `bg-main`，图标不可见；标签显示“条会话 / 活跃 / 归档”等较长文本
- 验收标准：选中态编辑按钮保持可见对比；项目标签缩减为短计数；窄宽下 provider/最近时间继续降级隐藏
- 测试计划：运行 session-management 目标单测、typecheck、build；浏览器截图验收选中行
- 验证结果：已将选中态编辑按钮改为白底深色 Pencil 图标；项目统计标签缩短为 `会/活/归` 与 `S/A/R` 计数；520px 以下隐藏标签组并压缩项目行 padding/gap，保留项目名截断和编辑入口。已通过 session-management 目标单测、`npm run typecheck`、`npm run build`；Playwright 桌面和 375px 截图确认选中态编辑图标可见、窄宽不再显示竖排标签。
- 截图：`screenshots/20260514/session-management/20260514-session-management-project-row-density-after-v02.png`、`screenshots/20260514/session-management/20260514-session-management-project-row-density-mobile-after-v04.png`
- 备注：

### batch-05-session-time-layout

- 状态：verified
- 来源：用户标注 `SessionManagementView.tsx:SessionsPanel` 和 `ProjectListPanel` 时间布局
- 影响范围：Session Management 项目列表和会话列表
- 复现步骤：打开 Session Management，观察项目行最近时间和会话行更新时间
- 预期结果：会话正文占满右侧可用宽度并保持两行区域；更新时间单独起一行放右下角，不再使用标签样式；项目最近时间同样单独右下角显示
- 实际结果：会话更新时间混在标签轨道里，会挤占 provider/message/file 标签空间；项目最近时间也作为标签显示
- 验收标准：时间从标签轨道移除；会话 summary 保持两行高度并占满行宽；项目/会话时间均为右下角纯文本
- 测试计划：运行 session-management 目标单测、typecheck、build；浏览器截图验收
- 验证结果：已移除 `projectRecentTag` 标签文案；项目最近时间改为右下角纯文本；会话更新时间从 meta 标签组移到行尾右下角；会话 title 单行截断，summary 使用两行 clamp 区域占满可用宽度。已通过 session-management 目标单测、`npm run typecheck`，并完成 Playwright 截图验收。
- 截图：`screenshots/20260514/session-management/20260514-session-management-session-time-layout-after-v02.png`
- 备注：
