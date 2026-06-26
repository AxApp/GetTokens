# Codex Config Tree Editor Implementation Plan

## 执行原则

- 保留树形页。
- checkbox 只表达“本地配置记录是否存在”，不表达 boolean 配置值。
- draft model 是事实源，Tree checkedKeys 只能由 snapshot + draft 派生。
- 先补模型测试，再改实现。

## Phase 1：模型红灯

新增或扩展 codexFeatureConfig 模型测试，覆盖：

1. 原本没有本地记录，用户勾选 leaf 后，即使 draftValue 等于 effectiveValue，也必须 dirty。
2. 原本有本地记录，用户取消 leaf 后，必须生成 removed change。
3. 子节点存在时，parent checked 状态由 descendants 派生。
4. 取消 parent 会把 descendant leaf 全部标记 removed。
5. boolean false 本地记录存在时，记录 checkbox checked，但值编辑器显示 false。

预期红灯命令：

- cd frontend
- node --test src/features/status/tests/codexFeatureConfig.test.mjs

## Phase 2：最小模型实现

建议最小结构：

- CodexFeatureDraft.values: Record string to unknown
- CodexFeatureDraft.removed?: Record string to true
- CodexFeatureDraft.added?: Record string to true

需要新增或调整的纯函数：

- markCodexFeatureDraftPresent
- removeCodexFeatureDraftValue
- selectCodexFeatureRows dirty 判断
- 构建 tree checked / parent checked 的纯函数
- parent subtree descendants 查找辅助函数

不要把 Ant Tree 的 checkedKeys 作为保存事实源。

## Phase 3：树形 UI 接线

1. leaf 勾选：
   - 原来不存在：标记 added，值取 current draftValue / effectiveValue / defaultValue。
   - 原来存在且 previously removed：清掉 removed。
2. leaf 取消：
   - 调用 removeDraftValue。
3. parent 取消：
   - 对所有 descendant leaf 调用 removeDraftValue。
4. parent 勾选：
   - 不批量创建所有 descendant leaf。
   - 若需要交互反馈，优先展开 parent。
5. boolean 行：
   - 记录存在性 checkbox 与 boolean value editor 分开。

## Phase 4：全树保存 / 预览

- 顶部 preview/save 不再固定 features section。
- 使用全量 buildCodexFeatureChangeInput(snapshot, draft)。
- 保存完成后 reload，并从 snapshot 重建树 checked state。

## Phase 5：回归门禁

至少运行：

- cd frontend
- npm run typecheck
- node --test src/features/status/tests/codexFeatureConfig.test.mjs src/features/status/tests/statusTypography.test.mjs

如 UI 布局变化明显，再补无头浏览器 / DOM / screenshot 验收，截图归档到：

- docs-linhay/spaces/20260626-codex-config-tree-editor/screenshots/

## 暂不做

- 不建新依赖。
- 不做移动端。
- 不引入通用 tree state 框架。
- 不为 parent 创建虚假 config record；父级结构由实际 leaf 写入时自然形成。
