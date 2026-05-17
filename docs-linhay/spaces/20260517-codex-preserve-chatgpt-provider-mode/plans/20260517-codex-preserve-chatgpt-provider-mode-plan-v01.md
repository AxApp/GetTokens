# 20260517 Codex Preserve ChatGPT Provider Mode Plan V01

## 目标
把“应用到本地 Codex”从单一 API Key 覆盖模式，扩展为双模式工作流，并保持默认行为不破坏现有用户。

## 里程碑
### M1 方案定稿
1. space README 完成需求边界、场景与验收。
2. `docs-linhay/dev/` 完成前后端设计。

### M2 后端
1. 新增本地 auth 状态读取接口。
2. 新增 object-based preview/apply 接口。
3. preserve 模式完成预检与写入。
4. Go 测试补齐。

### M3 前端
1. 状态页新增模式切换器。
2. diff 预览支持 preserved auth.json 语义。
3. 对 `openai` provider 与缺失 ChatGPT auth 做阻断态。
4. 前端单测补齐。

### M4 验收
1. 旧模式回归通过。
2. 新模式 happy path / error path 通过。
3. 文档、memory、qmd 完成写回。

## 风险
1. `auth.json` 是高风险文件，任何“看似无害”的重写都可能影响 token 刷新链路。
2. 如果前端继续允许用户选择 `openai`，会形成“配置成功但上游不生效”的假阳性。
3. positional Wails API 继续扩字段会使维护成本快速上升。

## 当前建议
1. 新能力按增量设计落地，不重写状态页整体结构。
2. preserve 模式先做严格校验，不做隐式兜底。
3. 旧 API 兼容保留，但新能力只走新 DTO。
