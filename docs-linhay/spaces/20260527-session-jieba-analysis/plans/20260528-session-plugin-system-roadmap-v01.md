# session-management 插件系统路线图

## 目标
把 `session-management` 从单能力页面收敛成会话插件宿主，让分析、复盘、对比、导出、异常提示等能力以统一插件方式挂载。

## 已有基础
- 会话列表与详情读取已稳定。
- 批量 jieba 分析已完成，支持全量、按项目、按指定 sessionID。
- 分析结果已补齐词云和常用句输出，前端详情弹层可直接展示。
- 前端 dev bridge 已能直连本地结果。
- 一期插件宿主已落地，支持当前项目、最近 20 条和全量分析入口。

## 第一阶段
1. 明确宿主协议
2. 收敛插件输入输出结构
3. 让首个插件继续复用现有批量分析实现

## 第二阶段
1. 增加插件注册表
2. 支持插件分组和启停
3. 把分析中、失败、完成等状态统一给前端

## 第三阶段
1. 支持插件结果缓存
2. 支持插件进度和取消
3. 支持时间窗、项目窗、最近 N 条等扩展过滤

## 验收
- 宿主能稳定渲染插件入口
- 插件输出结构统一
- 新插件可按同一协议接入，不需要重写会话列表/详情逻辑
- 一期已完成时，用户可直接运行“当前项目 / 最近 20 条 / 全量”分析并看到结果

## 2026-05-29 接手验证
- `go test ./internal/wailsapp -run 'TestAnalyzeCodexSessions|TestCodexSession'` 通过。
- `npm run test:unit -- src/features/session-management/model.test.mjs src/features/design-system/storyCatalog.test.mjs` 实际触发前端全量单测，613 个用例通过。
- Playwright 无头验收 `http://127.0.0.1:5173/#frame=design-system`：`SessionPluginConsolePanel` 渲染 3 个状态，1440px 与 375px 均无横向溢出。
- 本地 dev bridge `__dev/session-management/analysis?scope=all&limit=1` 返回结构化分析结果，字段覆盖关键词、角色贡献、项目分布和 session 摘要。
- `docs-linhay/scripts/check-docs.sh` 未通过，原因是 repo 内大量历史 space 缺 `plans/` / `screenshots/` / `debate/` 目录；本需求 space 已补齐 `screenshots/` 与 `debate/`。

## 2026-05-29 入口调整验证
- 入口从内嵌 `SessionAnalysisPanel` 改为页头“分析”按钮。
- 分析流程调整为：打开选择器 -> 选择全部 / 最近 20 条 / 项目 / 会话 -> 打开分析详情弹层。
- `node --test src/features/session-management/model.test.mjs` 通过，新增结构测试确保不再渲染内嵌分析面板，并存在选择器与详情弹层。
- `npm run typecheck` 通过。
- `npm run test:unit` 通过，614 个用例全部通过。
- Playwright 无头验收 `http://127.0.0.1:5173/#frame=codex&workspace=session-management`：点击“分析”能打开“选择分析范围”；选择“会话分析”项目后打开“分析详情”；桌面 1280px 与移动 375px 均无横向溢出。

## 2026-05-31 本地 master 合并后验证
- 本地 `master` 已快进合入当前需求分支，冲突集中在 memory、`frontend/package.json.md5` 和 `frontend/wailsjs/go/models.ts`，已处理完毕。
- `docs-linhay/scripts/check-docs.sh` 已通过；本需求 debate 记录按 `YYYYMMDD/module/filename` 规则归档。
- `go test ./internal/wailsapp -run 'TestAnalyzeCodexSessions|TestCodexSession'` 通过。
- `npm run test:unit` 通过，639 个用例全部通过。
- `npm run typecheck` 和 `npm run build` 通过，build 仅有既有 chunk size warning。
- `agent-browser` 无头验收 5173 页面：页头“分析” -> “选择分析范围” -> 选择“会话分析”项目 -> “分析详情” -> “返回选择”链路通过。
- HCI 复测补齐 modal 键盘闭环：选择器初始焦点落到“分析全部”，详情初始焦点落到“返回选择”，Escape 均可关闭，关闭后焦点回到页头“分析”入口。
- 词云/常用句增量：Go 侧新增 `wordCloud` 与 `commonPhrases`，Wails DTO、Vite dev bridge、前端模型和详情弹层同步展示；聚焦 Go/前端模型测试、`go test ./...`、`npm run test:unit`、`npm run typecheck`、`npm run build` 已通过；无头页面验收确认详情弹层含词云与常用句。

## 当前结论
批量 jieba 分析不是终点，它是插件系统的第一个可用插件。
