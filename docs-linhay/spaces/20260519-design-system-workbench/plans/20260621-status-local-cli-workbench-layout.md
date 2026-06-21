# 状态页本地 CLI 工作台布局改造

## 背景

用户在状态页 #frame=status 选中 StatusApplyLocalSection 后反馈：当前 Codex / Claude Code 本地 CLI 配置区与新的设计系统不够贴合，并明确允许修改布局和显示逻辑。

## 证据门禁

| 项目 | 事实 |
| --- | --- |
| 问题来源 | 浏览器评论选中状态页本地 CLI 配置区，用户要求提供并落地更好的方案。 |
| 当前代码位置 | frontend/src/features/status/components/StatusPanels.tsx 的 StatusApplyLocalSection。 |
| 当前现象 | 目标切换器、Relay key、Endpoint、Provider/Model、能力开关和 diff 预览平铺在同一表单流中；关键 preflight 与 apply 阻塞原因分散，用户需要读完整表单才能判断“能不能写入”和“会写什么”。 |
| 预期验收 | 新布局应呈现为“本地 CLI 工作台”：顶部目标/状态 summary，左侧配置输入，右侧写入计划与 diff；裸露技术开关改为能力行；缺 key、服务未 ready、auth 问题优先在 preflight 区展示。 |
| 反证条件 | 如果新布局仍需要用户在表单中部寻找阻塞原因，或 supports_websockets / sync_model_catalog 仍以裸字段名作为主要展示，则本轮不算完成。 |

## 目标

1. 将本地 CLI 区块从“表单堆叠”改成“配置输入 + 写入计划”的工作台布局。
2. 在 Codex 与 Claude Code 两个目标下复用同一套外壳、summary 和 plan rail。
3. 保留当前数据权威：Relay key、endpoint、provider、model、auth 状态和 diff 仍来自现有 StatusFeature/sidecar/Wails 投影，不新增前端伪状态。
4. 用源码测试固定结构，浏览器截图只作为布局/密度验收。

## 非目标

1. 不改变 sidecar、Wails binding、配置写入协议或本地文件路径。
2. 不新增主题切换、暗色模式或移动端适配。
3. 不重写账号卡本地 CLI apply 确认页；本轮只改状态页工作台。

## 验收标准

1. StatusApplyLocalSection 根节点保留 data-status-local-cli-panel，并新增可测试的 workbench summary、config rail、plan rail。
2. Codex / Claude Code 切换器进入 panel header，并作为“目标客户端”语义呈现。
3. Codex 分支显示“运行前检查”与写入计划；codexLocalApplyGuidance 出现在 plan rail，不再散落在左侧配置表单。
4. supports_websockets 与 sync_model_catalog 使用能力行展示，包含标题、副文案和开关；模型目录预览是能力行内的次级动作。
5. Claude 分支也复用工作台外壳，写入按钮和 diff 位于 plan rail。
6. 运行 npm --prefix frontend exec -- node --test src/features/status/tests/statusTypography.test.mjs。
7. 用无头浏览器保存状态页截图到本 space 的 screenshots 目录。

## 实施结果

完成时间：2026-06-21

改动结果：

1. 状态页本地 CLI 区块已改为顶部 summary、左侧配置输入 rail、右侧写入计划 rail。
2. Codex 与 Claude Code 两个目标复用同一套 workbench shell。
3. Codex preflight、恢复动作和 diff 已集中到右侧写入计划；左侧只保留输入配置与即时消息。
4. WebSocket 转发和模型目录同步已改为能力行，包含标题、副文案、预览动作和 toggle。
5. 新增源码测试固定 summary / config rail / plan rail / preflight 结构及中英文文案。

验证结果：

1. node --test src/features/status/tests/statusTypography.test.mjs：通过。
2. npm --prefix frontend run typecheck：通过。
3. node --test src/features/status/tests/*.test.mjs：89 个测试通过。
4. 无头浏览器 DOM 断言：summary/config rail/plan rail/preflight 均为 1 个。
5. 截图：screenshots/20260621/status-local-cli-workbench/20260621-status-local-cli-workbench-after-v01.png。

已知说明：

- 浏览器预览控制台仍会出现缺少 Wails runtime 的 window.go.main 相关错误，以及 favicon 404；这属于当前 Vite browser preview 既有边界，不是本轮布局改造引入。
