# 多格式自动检测转 CPA 上传

## 背景

需要支持多种输入格式的自动识别、统一转换为 CPA 约定格式，并进入上传流程。本 space 用于固定需求边界、参考项目、转换规则和测试门禁。

## 目标

1. 自动识别常见输入格式，并按格式进入对应转换路径。
2. 将转换结果统一收敛为 CPA 上传所需结构。
3. 形成可复用的校验、报错和上传前检查流程。
4. 以参考项目 `GPTSession2CPAandSub2API` 作为研究起点，梳理可借鉴实现与不可直接复用部分。

## 范围

1. ChatGPT Web session JSON 检测与转换。
2. 9router Codex OAuth JSON 检测与转换。
3. 既有 CPA / Codex auth JSON 的兼容规范化。
4. 上传前转换与 sidecar auth-file 上传入口衔接。
5. 参考项目调研记录与实现约束。

## 非目标

1. 不实现 sub2api、Cockpit、9router 输出格式。
2. 不处理与 CPA 上传无关的外围功能扩展。
3. 不假设所有输入格式都能无损转换，无法识别时不误判为 CPA。

## 验收标准

1. 支持目标输入格式清单和检测优先级被明确写出。
2. CPA 目标结构与转换规则被固定成可执行的方案。
3. 上传前的校验、失败提示和回退策略被定义清楚。
4. 参考项目链接和研究结论有明确落位。
5. ChatGPT session、9router OAuth、已有 Codex auth 和未知 JSON 均有回归测试覆盖。

## 设计稿入口

- 本期设计稿：`不适用`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260523-cpa-auto-detect-upload`
- worktree：`../GetTokens-worktrees/20260523-cpa-auto-detect-upload/`

## 相关链接

- 参考项目：`https://github.com/yynxxxxx/GPTSession2CPAandSub2API`
- 参考索引：`../../references/20260523-gptsession2cpasub2api.md`
- 实施计划：`plans/20260523-cpa-auto-detect-upload-plan-v01.md`

## 当前状态
- 状态：implemented-first-pass
- 最近更新：2026-05-23

## 实施结果

- 域层：`internal/accounts.NormalizeAuthFileForSidecar` 已支持 ChatGPT Web session 与 9router Codex OAuth 自动转换为 CPA / Codex auth JSON。
- 上传入口：`internal/wailsapp.UploadAuthFiles` 继续作为统一入口，上传前自然复用域层转换。
- 验证：`go test ./internal/accounts ./internal/wailsapp`、`go test ./...` 通过。
