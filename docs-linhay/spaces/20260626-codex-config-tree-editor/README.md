# Codex Config Tree Editor

## 背景

Codex 配置编辑页需要收敛为树形页。用户明确确认：

- 树形页是目标形态，不回退到旧的四个独立配置区块。
- checkbox 表示配置文件里是否存在这条本地记录，不表示功能开关值。
- 子节点存在时，父节点也必须表现为存在；不允许出现“孤立子节点存在、父节点未勾选”的 UI 状态。

本 space 用于承接当前未提交前端改动的收口：先固定需求语义、证据门禁和验收标准，再进入实现。

## 目标

1. 保留 Codex 配置树形页，覆盖 root、model_providers、features、notice 等配置 section。
2. 将 Tree checkbox 定义为“本地配置记录存在性”：
   - 勾选：本地 config 中应存在该记录。
   - 取消：本地 config 中应删除该记录，回退到默认值 / 上游有效值。
3. 支持父子存在性联动：
   - 任意子节点存在时，祖先节点视觉上必须勾选。
   - 取消父节点时，应删除其所有后代 leaf 配置记录。
   - 勾选父节点不应默认批量创建所有后代记录，避免写入用户未明确选择的配置。
4. 顶部预览 / 保存必须覆盖全树 dirty changes，不得只保存 features section。
5. 保留并明确“删除本地配置”入口，不能只允许覆盖值。

## 范围

### 前端模型

- 扩展 Codex 配置 draft 模型，区分“值变化”和“本地记录存在性变化”。
- 新增类似 added / present 的 draft 状态，用于表达“原本没有本地记录，但用户勾选要求写入记录”。
- dirty 判断必须覆盖：
  - value changed
  - local record added
  - local record removed

### 树形 UI

- Tree leaf checkbox 对应真实配置记录存在性。
- Parent checkbox 主要由 descendants 派生，用于表达结构存在性。
- Parent 取消勾选删除整棵子树的 leaf 本地记录。
- Boolean 配置值仍由值编辑器控制，不与“记录存在性 checkbox”混淆。

### 保存 / 预览

- 预览和保存应使用全量 dirty input，不再固定 sectionFilter: features。
- 保存后 reload 应重建树形存在性状态，验证已写入 / 已删除记录。

### 测试与验收

- 补模型测试覆盖 added / removed / parent derived checked。
- 修复或更新现有 statusTypography 约束测试。
- 前端最低门禁：npm run typecheck。
- 相关单测：node --test src/features/status/tests/codexFeatureConfig.test.mjs src/features/status/tests/statusTypography.test.mjs。

## 非目标

- 不做移动端适配。
- 不触碰正式版 /Applications/GetTokens.app。
- 不新增前端依赖。
- 不重做 Codex 配置后端协议，除非现有保存 API 无法表达“新增同 effective 值的本地记录”。
- 不在本轮引入复杂权限、批量模板或配置推荐系统。

## 证据门禁

| 项目 | 当前证据 |
| --- | --- |
| 问题来源 | 用户确认树形页为目标，并定义 checkbox 为“配置记录存在性”。 |
| 代码事实位置 | frontend/src/features/codex/CodexFeature.tsx 当前 Tree onCheck 只更新 checkedKeys，未写入 draft。 |
| 代码事实位置 | frontend/src/features/codex/CodexFeature.tsx 顶部预览 / 保存仍固定调用 previewChanges(features) / saveChanges(features)。 |
| 代码事实位置 | frontend/src/features/status/model/codexValueEditor.tsx 当前 resetButton = null，删除本地配置入口不可达。 |
| 当前现象 | UI 可显示并勾选树节点，但勾选语义不一定进入 preview/save；非 features section dirty 可能无法保存。 |
| 预期验收 | 勾选 leaf 后 preview/save 写入本地记录；取消 leaf 后 preview/save 删除本地记录；子节点存在时父节点显示已勾选。 |
| 反证条件 | 若后端保存 API 不能创建父级 table/object 或不能保存“值等于 effective 的新增本地记录”，实现前必须先调整技术方案。 |

## 行为场景（BDD）

### 场景 1：新增本地记录，即使值等于 effective

Given 某配置项当前没有本地记录，effective value 来自默认值或上游配置
When 用户勾选该 leaf checkbox，但不修改值
Then 该 leaf 进入 dirty 状态
And preview 显示新增本地记录
And save 后 config 中存在该记录

### 场景 2：删除已有本地记录

Given 某配置项当前有本地记录
When 用户取消该 leaf checkbox
Then 该 leaf 进入 removed dirty 状态
And preview 显示删除记录
And save 后 config 中不再存在该记录

### 场景 3：子节点存在时父节点必须勾选

Given 一个 parent 下至少有一个 leaf 本地记录存在
When 页面加载或用户勾选任意 child leaf
Then 该 leaf 的所有 ancestor 节点视觉上显示勾选
And 不出现 child checked 但 parent unchecked 的状态

### 场景 4：取消父节点删除整棵子树

Given 一个 parent 下存在多个本地 leaf 记录
When 用户取消该 parent checkbox
Then 所有 descendant leaf 都进入 removed dirty 状态
And preview/save 删除这些本地记录

### 场景 5：boolean 值与记录存在性分离

Given 某 boolean 配置项本地记录存在且值为 false
When 页面渲染该配置项
Then 记录存在性 checkbox 应保持勾选
And boolean 值编辑器显示 false
And 用户能分别控制“记录是否存在”和“值是 true/false”

## 验收标准

1. 树形页保留，并覆盖当前 Codex 配置所有 section。
2. Tree checkbox 的事实源来自 draft / snapshot，不使用独立 UI state 作为保存事实。
3. checked / parent checked 状态可从 snapshot + draft 纯函数重建。
4. 新增本地记录、删除本地记录、值变化三类 dirty 都会进入 preview/save。
5. 顶部保存覆盖全树 dirty changes。
6. resetButton 或等价删除本地配置入口存在且可用。
7. 相关单测和 typecheck 通过。
8. 若涉及可见 UI 布局变更，使用无头浏览器或 DOM 断言补充截图 / 结构验收，不打开用户当前激活显示器上的可见浏览器窗口。

## 设计稿入口

- 本期设计稿：未产出
- 约束：单期只保留一个 HTML 文件；若后续需要设计预览，落在本 space 根目录，例如 codex-config-tree-editor-design-v01.html。

## Worktree 映射

- branch：feat/20260626-codex-config-tree-editor
- worktree：../GetTokens-worktrees/20260626-codex-config-tree-editor/
- 当前状态：只建 space，不建 worktree；当前主工作区已有用户未提交前端改动，本轮不移动、不清理。

## 相关链接

- 代码入口：frontend/src/features/codex/CodexFeature.tsx
- 模型入口：frontend/src/features/status/model/codexFeatureConfig.ts
- 编辑器入口：frontend/src/features/status/model/codexValueEditor.tsx
- 测试入口：frontend/src/features/status/tests/codexFeatureConfig.test.mjs
- 测试入口：frontend/src/features/status/tests/statusTypography.test.mjs

## 当前状态

- 状态：implemented
- 最近更新：2026-06-26

## 实施结果

- 已实现 draft added 状态，用于表达“原本没有本地记录，但用户勾选要求写入记录”。
- 已将 Tree checkbox 接入记录存在性：leaf 勾选新增/恢复本地记录，leaf 取消删除本地记录，parent 取消删除 descendant leaf 本地记录。
- 已将 parent checked 改为由 descendant localRecordPresent 派生，避免子节点孤立存在。
- 已将顶部预览 / 保存改为全树 dirty changes，不再固定 features section。
- 已恢复删除本地配置入口，并保持 boolean 值与记录存在性分离。

## 验证结果

- cd frontend && node --test src/features/status/tests/codexFeatureConfig.test.mjs src/features/status/tests/statusTypography.test.mjs：通过。
- cd frontend && npm run test:unit：通过，1157 passed。
- cd frontend && npm run typecheck：通过。
- cd frontend && npm run build：通过；保留既有 chunk size warning。
- antd lint frontend/src --format json：退出码 0；仅报告既有 deprecated warnings，未指向本轮修改文件。
- docs-linhay/scripts/check-docs.sh：通过。
- git diff --check：通过。
