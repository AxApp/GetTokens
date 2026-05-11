# 请求编排设计稿与 space 审查

**日期**：20260504
**模式**：合作型 code review
**参与者**：Codex（主持与复现）、Planck（旁路体验意见，因无代码引用不计入有效结论）
**总轮次**：1 / 60
**结束原因**：主持人完成代码事实核验、复现与修复；外部候选未能形成有效代码引用意见

## 执行元数据

- 候选参与者：Gemini CLI、Claude Code、Planck subagent、Codex 主持
- 首轮实际启用：Codex 主持；Planck 返回旧版体验意见
- 后续 active participants：Codex
- 淘汰参与者：
  - Gemini CLI：首轮长 prompt 超时且无有效输出，已终止进程
  - Claude Code：默认模型 `claude-opus-4-6` 不可用，首轮未产出
  - Planck：返回内容指向旧版三栏结构，且没有 `文件:行号` 代码引用，按 debate 规则不纳入裁定
- 不可用原因：外部参与者未能提供带代码引用的有效论点

## 辩论背景

用户要求结合代码审查当前 `请求编排` 设计稿和对应 space。审查对象为：

- `docs-linhay/spaces/20260502-request-orchestration-menu/request-orchestration-design-v01.html`
- `docs-linhay/spaces/20260502-request-orchestration-menu/README.md`

## 确认的代码事实

| # | 事实 | 来源 |
|---|------|------|
| 1 | 账号是否可参与由 `computeAccount` 汇总入口、模型映射、禁用状态和代理可用性，最终落到 `active`。 | `request-orchestration-design-v01.html:844`、`request-orchestration-design-v01.html:857` |
| 2 | 修复前 `compatibleAccountsFor` 的 ready 计数没有复用完整 `active` 口径，存在计数与实际出站条件不一致风险；现已改为只统计 `account.active`。 | `request-orchestration-design-v01.html:873` |
| 3 | 第 `04 结果与测试` 卡当前实现是垂直时间轴，不是可出站账号列表。 | `request-orchestration-design-v01.html:1183`、`request-orchestration-design-v01.html:1211` |
| 4 | README 已同步为“上方使用垂直时间轴展示当前链路”。 | `README.md:94` |
| 5 | 测试状态现在通过 `testState` 统一表达 `待测试 / 测试通过 / 测试未通过`，避免把失败链路显示成通过。 | `request-orchestration-design-v01.html:942` |
| 6 | 应用当前组时会校验当前账号是否 active，不可出站链路不允许标记为已应用。 | `request-orchestration-design-v01.html:1370` |
| 7 | 测试当前流程组时会校验当前账号是否 active；不可参与账号返回 `status: blocked` 与具体原因。 | `request-orchestration-design-v01.html:1385` |
| 8 | 选择出口时会拦截不存在或已禁用的代理，避免 disabled 代理被写入当前链路。 | `request-orchestration-design-v01.html:1356` |

## 各轮观点记录

### 第 1 轮

**[Codex - 主持复现]**

论点：设计稿和 README 存在第 `04` 卡语义不一致。
引用：`README.md:94`、`request-orchestration-design-v01.html:1183`
代码事实：HTML 已渲染 `.timeline`，README 原描述仍指向“可出站账号列表”。
结论：README 必须跟随当前设计稿修正，否则 space 会误导后续实现。

论点：不可参与账号不能被测试为通过，也不能应用为有效链路。
引用：`request-orchestration-design-v01.html:857`、`request-orchestration-design-v01.html:1385`
代码事实：`active` 已包含完整出站条件；测试按钮现在按 `account.active` 分流，失败链路写入 `status: blocked`。
结论：第 `04` 卡可以展示失败原因，但不能把灰态账号显示成测试通过。

论点：账号组 ready 计数必须和最终 active 出站口径一致。
引用：`request-orchestration-design-v01.html:873`
代码事实：`compatibleAccountsFor` 已改为过滤 `account.active`。
结论：`02 账号组与代理` 的 ready 数不再和 `03/04` 的可出站判断分叉。

## 修复与验收

- 修复 README 第 `04` 卡描述，和垂直时间轴实现保持一致。
- 修复 ready 计数口径，完整复用 `active` 判定。
- 修复不可参与账号测试：复现 `claude-code -> Codex 生产组 -> codex-prod-01` 后点击测试，结果显示 `测试未通过 / CLI 不兼容`。
- 修复不可参与链路应用：当前账号非 active 时不允许标记为 `已应用`。
- 修复 disabled 代理出口：点击禁用代理不会写入当前账号出口。

验收产物：

- 语法校验：`node new Function(<script>)` 通过。
- 浏览器复现截图：`docs-linhay/spaces/20260502-request-orchestration-menu/screenshots/20260504/request-orchestration/20260504-request-orchestration-debate-fix-after-v24.png`

## 最终结论与行动项

### 裁定结论

当前四卡横向流程与 `header + main` space 约束基本成立；本轮发现的问题不是要推翻 UI，而是代码口径和文档口径未完全收敛。已完成修正。

### 后续行动项

| # | 行动 | 负责方 | 状态 |
|---|------|--------|------|
| 1 | 后续进入真实 APP 实现时，把 `account.active` 对应的业务规则拆成领域 selector，避免 UI 内重复推导。 | Codex | 待实现 |
| 2 | 代理池管理能力进入正式需求时，再补 `新增 / 删除 / 搜索 / 禁用 / 启用` 的数据契约。 | Codex | 待需求确认 |

### 未解问题

- 本设计稿仍是静态 HTML，尚未接入真实 Wails/sidecar 数据；正式实现时需要补 APP 层状态模型与 E2E。
