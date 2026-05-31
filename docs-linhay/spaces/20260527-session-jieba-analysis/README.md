# 会话插件系统

## 背景
当前 Codex 会话管理页 `http://localhost:5173/#frame=codex&workspace=session-management` 已能按项目展示历史会话，并在详情弹层中列出消息摘要。现有批量分析能力已经落地，但它本质上不是单一功能点，而是会话管理页可以持续扩展的“插件”方向：宿主负责会话列表、详情、权限与执行调度，插件负责各自的分析/复盘/导出逻辑。

## 目标
1. 将 `session-management` 抽象为插件宿主，统一承载会话类扩展能力。
2. 以批量 jieba 分析作为首个插件，验证宿主/插件输入输出边界。
3. 输出关键词、词云、常用句、项目分布、角色贡献、主题线索和可读的分析摘要。
4. 前端只负责展示结果，分析过程不阻塞原有会话列表和详情阅读。

## 范围
1. 入口：`#frame=codex&workspace=session-management` 的会话管理页面。
2. 数据来源：Codex 会话 JSONL 详情文件。
3. 插件范围：分析、复盘、对比、导出、异常提示等会话类能力。
4. 当前插件：批量 jieba 深度分析，支持全量、按项目、按指定 sessionID。
5. 技术策略：分析逻辑放在 Go 侧，前端通过 Wails runtime 或本地 dev bridge 展示结果。

## 非目标
1. 不新增后端持久化字段。
2. 不修改 Codex / Claude 会话扫描和 provider 归并逻辑。
3. 不上传会话内容到外部服务。
4. 不在本期实现跨项目趋势、语义向量、LLM 总结或插件市场。

## 验收标准
1. Given 用户打开 Codex 会话管理页，When 点击页头“分析”，Then 弹出会话/项目选择器。
2. Given 用户在选择器中选择全部、最近 20 条、指定项目或单条会话，When 分析完成，Then 页面打开独立“分析详情”弹层并展示深度分析结果。
3. Given 会话包含中文技术讨论，When jieba 分词完成，Then 关键词列表应包含经分词后的高频中文词，并排除常见停用词、单字符噪声和纯数字。
4. Given 会话包含 user / assistant / tool 等不同角色消息，When 分析完成，Then 角色贡献应按可分析文本量降序展示。
5. Given 分析正在进行或 dev bridge 需要较长时间，When 用户查看页面，Then 原有会话列表和详情仍可继续查看，页面显示分析中状态。
6. Given 分析结果包含高频词，When 打开分析详情，Then 应生成词云并按词频权重区分字号。
7. Given 相邻分词片段形成重复短语，When 分析完成，Then 应展示常用句/常用短语及出现次数、会话覆盖数。
8. 自动化测试覆盖分析模型的分词聚合、停用词过滤、角色贡献、词云、常用句、批量分析入口和长超时 dev bridge。
9. 插件化路线需要补齐宿主协议、插件注册、执行状态和结果渲染的统一约定。

## 设计稿入口

- 设计系统入口：`http://localhost:5173/#frame=design-system` 的“业务组件预览”
- 设计系统组件：`frontend/src/features/session-management/components/SessionPluginConsolePanel.tsx`
- 5173 业务预览注册：`frontend/src/features/design-system/businessComponentPreviews.tsx`
- 源草图：[session-plugin-console-design-v01.html](session-plugin-console-design-v01.html)
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-session-jieba-analysis`
- worktree：`../GetTokens-worktrees/20260527-session-jieba-analysis/`

## 相关链接
- 目标页面：`http://localhost:5173/#frame=codex&workspace=session-management`
- 既有功能空间：[Codex 实时运行会话详情](../20260521-codex-live-session-detail/README.md)
- 既有功能空间：[Usage Session Drilldown](../20260519-usage-session-drilldown/README.md)
- 技术说明：[session-management 插件系统设计](../../dev/20260528-session-management-plugin-system.md)
- 迭代计划：[session-management 插件系统路线图](plans/20260528-session-plugin-system-roadmap-v01.md)
- 5173 设计系统桌面截图：[20260529-session-plugin-console-5173-design-system-after-v01.png](screenshots/20260529/session-management/20260529-session-plugin-console-5173-design-system-after-v01.png)
- 5173 设计系统窄屏截图：[20260529-session-plugin-console-5173-design-system-mobile-after-v01.png](screenshots/20260529/session-management/20260529-session-plugin-console-5173-design-system-mobile-after-v01.png)

## 当前状态
- 状态：phase-1-mvp-done / design-system-admitted / 20260531-local-master-merged
- 最近更新：2026-05-31

## 2026-05-29 接手校验
- Go 侧 `AnalyzeCodexSessions` 聚合、停用词过滤、角色贡献和 selected session 测试已通过。
- 前端 session-management 模型、长超时 dev bridge 和设计系统 manifest 测试已通过，随 `npm run test:unit` 全量 613 个用例一起回归。
- 5173 设计系统业务组件预览确认存在 3 个 `SessionPluginConsolePanel` 状态，桌面 1440px 和窄屏 375px 均无横向溢出。
- 本地 dev bridge `scope=all&limit=1` 能返回结构化分析结果，包含关键词、角色贡献、项目分布和 session 摘要。

## 2026-05-29 入口调整
- 会话管理页页头“刷新”按钮旁新增“分析”按钮。
- 点击“分析”先打开会话/项目选择器，可选择全部、最近 20 条、指定项目或当前项目内单条会话。
- 选择后进入独立“分析详情”弹层，展示关键词、项目分布、角色贡献和主题线索。
- 已移除原先搜索栏下方的内嵌 `SessionAnalysisPanel`。
- 验收截图：
  - [20260529-session-analysis-detail-web-after-v01.png](screenshots/20260529/session-management/20260529-session-analysis-detail-web-after-v01.png)
  - [20260529-session-analysis-detail-mobile-after-v01.png](screenshots/20260529/session-management/20260529-session-analysis-detail-mobile-after-v01.png)

## 2026-05-31 词云与常用句增量
- Go 侧 `AnalyzeCodexSessions` 新增 `wordCloud` 与 `commonPhrases` 输出；词云复用高频词并归一化权重，常用句由 jieba 精确模式分词后提取 2-3 词相邻片段。
- Wails 根 DTO、mapper 和 `frontend/wailsjs/go/models.ts` 已同步新增 `SessionAnalysisWordCloudItem`、`SessionAnalysisCommonPhrase`。
- 分析详情弹层新增“词云”和“常用句”区域；旧 runtime 缺少 `wordCloud` 时前端会从 `keywords` 生成兜底词云；Vite dev bridge 已同步返回 `wordCloud` / `commonPhrases`。
- 验证：`go test ./internal/wailsapp -run 'TestAnalyzeCodexSessions|TestCodexSession'`、`go test ./...`、`node --test src/features/session-management/model.test.mjs`、`npm run test:unit`、`npm run typecheck`、`npm run build` 已通过。
- 无头验收：`agent-browser` 打开 `http://127.0.0.1:5173/#frame=codex&workspace=session-management`，选择“会话分析”项目后详情弹层显示“词云”和带计数的“常用句”。
- 验收截图：
  - [20260531-session-analysis-wordcloud-phrases-after-v01.png](screenshots/20260531/session-management/20260531-session-analysis-wordcloud-phrases-after-v01.png)

## 2026-05-31 本地 master 合并后验证
- 已从本地 `master` 合并最新代码，并处理 `docs-linhay/memory/2026-05-29.md`、`frontend/package.json.md5`、`frontend/wailsjs/go/models.ts` 冲突。
- `frontend/package.json.md5` 与 `frontend/package.json` 当前 md5 保持一致；`frontend/wailsjs/go/models.ts` 保留主分支账号迁移新增模型。
- `agent-browser` 无头验收 `http://127.0.0.1:5173/#frame=codex&workspace=session-management`：页头“分析”打开“选择分析范围”；选择“会话分析”项目后打开“分析详情”；详情页“返回选择”可回到选择器。
- HCI 审查发现选择器/详情弹层需要完整键盘闭环，已补齐弹层初始焦点、Escape 关闭和关闭后焦点回到页头“分析”按钮；详情加载中“返回选择”改为可聚焦 `aria-disabled`，避免焦点掉到页面 `body`。
- 复测结果：选择器打开时焦点在“分析全部”，Escape 关闭后焦点回到“分析”；详情打开时焦点在“返回选择”，Escape 关闭后焦点回到“分析”。
- 验收截图：
  - [20260531-session-management-analysis-selector-after-v01.png](screenshots/20260531/session-management/20260531-session-management-analysis-selector-after-v01.png)
  - [20260531-session-management-analysis-detail-after-v02.png](screenshots/20260531/session-management/20260531-session-management-analysis-detail-after-v02.png)
