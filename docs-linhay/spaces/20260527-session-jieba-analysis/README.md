# 会话插件系统

## 背景
当前 Codex 会话管理页 `http://localhost:5173/#frame=codex&workspace=session-management` 已能按项目展示历史会话，并在详情弹层中列出消息摘要。现有批量分析能力已经落地，但它本质上不是单一功能点，而是会话管理页可以持续扩展的“插件”方向：宿主负责会话列表、详情、权限与执行调度，插件负责各自的分析/复盘/导出逻辑。

## 目标
1. 将 `session-management` 抽象为插件宿主，统一承载会话类扩展能力。
2. 以批量 jieba 分析作为首个插件，验证宿主/插件输入输出边界。
3. 输出关键词、项目分布、角色贡献、主题线索和可读的分析摘要。
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
1. Given 用户打开 Codex 会话管理页并点击“分析全部”或“分析当前项目”，When 分析完成，Then 页面可看到深度分析区域。
2. Given 会话包含中文技术讨论，When jieba 分词完成，Then 关键词列表应包含经分词后的高频中文词，并排除常见停用词、单字符噪声和纯数字。
3. Given 会话包含 user / assistant / tool 等不同角色消息，When 分析完成，Then 角色贡献应按可分析文本量降序展示。
4. Given 分析正在进行或 dev bridge 需要较长时间，When 用户查看页面，Then 原有会话列表和详情仍可继续查看，页面显示分析中状态。
5. 自动化测试覆盖分析模型的分词聚合、停用词过滤、角色贡献、批量分析入口和长超时 dev bridge。
6. 插件化路线需要补齐宿主协议、插件注册、执行状态和结果渲染的统一约定。

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
- 验收截图：[20260528-session-plugin-host-web-after-v01.png](screenshots/20260528/session-management/20260528-session-plugin-host-web-after-v01.png)
- 5173 设计系统截图：[20260528-session-plugin-console-5173-design-system-after-v01.png](screenshots/20260528/session-management/20260528-session-plugin-console-5173-design-system-after-v01.png)

## 当前状态
- 状态：phase-1-mvp-done / design-system-admitted
- 最近更新：2026-05-28
