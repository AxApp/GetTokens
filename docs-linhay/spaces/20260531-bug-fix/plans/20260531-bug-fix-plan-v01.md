# Bug 修复集中处理计划 v01

## 目标
把本轮 bug 修复从“逐条临时处理”收敛为可复现、可测试、可回归、可检索的修复流程。每个缺陷都要有明确输入和关闭条件，避免只凭现象改代码。

## 工作顺序
1. 缺陷收集
   - 在本 space 记录 bug 标题、来源、影响范围、严重程度、复现条件、实际行为、期望行为。
   - 对现象不清的问题先补日志、截图或最小复现，不直接改实现。
2. 复现与定位
   - 本地复现优先；涉及 Wails/sidecar 的问题确认 runtime 状态、进程归属、配置路径和绑定导出。
   - 前端问题先确认是模型、状态流、组件渲染、样式还是 Wails bridge 缺口。
3. 红灯测试
   - 能单测的问题先补失败测试。
   - 无法单测的桌面/runtime 问题，至少补可重复的验收脚本、截图或明确手工验收步骤。
4. 最小修复
   - 修复代码只覆盖根因和必要保护。
   - 避免顺手做功能增强、视觉重设或无关重构。
5. 回归与写回
   - 运行与影响面匹配的测试门禁。
   - 记录修复结论、测试结果、剩余风险和后续行动。
   - 必要时更新项目级 skills 或 dev 文档。

## 初始验收门禁
1. 文档/治理阶段：
   - `docs-linhay/scripts/check-docs.sh`
   - `qmd update`
   - `qmd embed`
2. 前端 bug：
   - 对应 `node --test ...`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`
   - 涉及设计系统组件时补 `storyCatalog` 或 Storybook build。
3. Go / Wails / sidecar bug：
   - 对应 `go test ...`
   - 必要时 `go test ./...`
   - 修改 Wails binding 后通过项目 wrapper 重新生成并验证 frontend imports。
4. 桌面 runtime bug：
   - 启动 Wails 桌面应用。
   - 确认 sidecar `ready` 后验证真实数据流。
   - 截图或日志归档到本 space。

## 当前任务清单
- [x] 建立集中 bug-fix space。
- [x] 写入初始范围、非目标和 BDD 验收标准。
- [ ] 汇总待修 bug 清单。
- [ ] 按严重程度和影响面排序。
- [ ] 逐条补复现、红灯测试和修复计划。
- [ ] 进入代码修复与回归验收。
