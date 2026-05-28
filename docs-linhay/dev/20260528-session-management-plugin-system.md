# session-management 插件系统设计

## 背景
`session-management` 现有能力已经不只是“查看历史会话”，还开始承载批量分析、复盘和后续派生能力。继续把新功能硬塞进一个页面分支，会让入口、状态和结果渲染越来越散，因此需要把它抽象成插件宿主。

## 设计目标
1. 宿主负责会话列表、详情、权限、执行入口和状态调度。
2. 插件负责具体分析逻辑，不直接碰宿主 UI 结构。
3. 插件输入输出必须结构化，方便前端统一渲染。
4. 本地 dev bridge 与 Wails runtime 都能走同一套插件契约。

## 插件契约
### 输入
- `scope`: `all | project | selected`
- `projectID`: 可选
- `sessionIDs`: 可选
- `limit`: 可选

### 输出
- `scope`
- `generatedAt`
- `requestedSessionCount`
- `analyzedSessionCount`
- `skippedSessionCount`
- `totalMessages`
- `totalTerms`
- `keywords`
- `roleContributions`
- `projects`
- `sessions`

## 当前实现
- 首个插件：批量 jieba 分析。
- 后端：`internal/wailsapp/session_analysis.go`
- Wails 暴露：`AnalyzeCodexSessions`
- 前端：`frontend/src/features/session-management/api.ts`
- dev bridge：`frontend/vite.config.js` + `frontend/dev/sessionManagementDevData.js`
- 一期宿主：当前项目、最近 20 条、全量分析入口。

## 设计系统收编
- 会话插件控制台已进入设计系统，组件为 `frontend/src/features/session-management/components/SessionPluginConsolePanel.tsx`。
- Storybook 入口为 `frontend/src/features/session-management/components/SessionPluginConsolePanel.stories.tsx`，标题为 `Design System/业务组件/会话插件控制台`。
- 组件覆盖 `ready / running / done` 三种执行态，并把插件注册表、作用域选择、执行状态、会话选择、执行队列和插件输出作为同一业务组件约束。
- space HTML 设计稿保留为源草图，后续实现应优先对齐设计系统组件，而不是继续扩展独立 HTML。

## 执行约束
- 批量分析是长任务，不能按普通详情请求的超时处理。
- 全量分析需要允许并发读取和并发分词。
- 前端应把“当前项目”放在默认入口，“全量”放到次级入口或高级操作。

## 后续演进
1. 插件注册表
2. 插件分组与启停
3. 结果缓存
4. 进度与取消
5. 时间窗 / 最近 N 条 / 对比分析插件

## 结论
`session-management` 的正确抽象不是“增加一块分析面板”，而是“建立一个会话插件宿主”，jieba 分析只是第一个插件。
