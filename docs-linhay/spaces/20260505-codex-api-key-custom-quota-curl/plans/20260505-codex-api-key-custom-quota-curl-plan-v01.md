# Codex API Key 自定义 Curl 在线额度计划 v01

## 目标
为 `codex-api-key` 增加用户自定义 curl 在线额度查询能力，并复用现有 auth-file quota 展示结构。

## BDD / TDD 顺序
1. 先补后端测试：
   - curl 解析：method、URL、headers、body。
   - 占位符替换：`{{apiKey}}`。
   - 敏感信息脱敏：`Authorization`、`Cookie`、`api-key`。
   - 响应归一：`plan_type + rate_limit.primary_window / secondary_window` 到 `CodexQuotaResponse`。
2. 再补前端模型测试：
   - `codex-api-key` 在配置 quota curl 后 `supportsQuota` 为 true。
   - 未配置 curl 时显示 unsupported / unconfigured 状态。
   - 最长额度筛选只接受成功且最长窗口剩余大于 0 的账号。
3. 实现后端最小闭环：
   - 为 `CodexAPIKeyInput` 增加 quota curl 配置字段。
   - 持久化到本地 `codex-api-keys`。
   - 新增 Wails 方法用于测试 / 刷新单个 codex-api-key quota。
   - 复用现有 quota response builder 或抽出共享 builder。
4. 实现前端最小闭环：
   - 编辑 / 详情入口显示 curl 配置。
   - 卡片展示加载中、成功、错误、未配置状态。
   - 刷新按钮复用现有 quota 状态流。
5. 验证：
   - Go 单元测试。
   - 前端模型测试。
   - Wails 实机或浏览器 preview 截图验证账号卡片和详情弹窗展示。

## 技术边界
1. curl 解析只支持单条 curl 命令的常见参数，不执行 shell。
2. 不支持管道、重定向、命令替换、环境变量展开。
3. 请求默认超时，错误返回可展示摘要但必须脱敏。
4. 响应输出必须保持现有 `CodexQuotaResponse` 兼容，避免前端产生第二套 quota UI。

## 风险
1. 不同服务返回格式不一致，需要先收敛 v1 支持的响应契约。
2. curl 文本可能包含敏感信息，日志、调试事件、前端状态都要统一脱敏。
3. 如果把 curl 当 shell 执行会有安全风险，本期必须解析为结构化 HTTP 请求后再执行。

## 完成记录
- 已完成后端 curl 解析、占位符替换、敏感信息脱敏、在线请求执行和 quota 响应归一。
- 已完成 `codex-api-key` 本地存储字段、账号 DTO 字段和前端配置入口。
- 已完成最长额度筛选对已配置 `codex-api-key` 的支持。
- 已修复详情保存链路中 Wails 模型缺失 quota 字段的问题，并补充模型字段保留回归测试。
- 已新增详情面板额度 curl 草稿测试入口，按钮直接调用 `TestCodexAPIKeyQuotaCurl`。
- 已补齐根包 `main.App` Wails 绑定代理方法和 DTO 字段，避免 `wails dev` 重新生成 bindings 后前端 import 找不到 `TestCodexAPIKeyQuotaCurl`。
- 已完成 Go / 前端模型测试、类型检查；`wails dev` 已重新生成绑定并输出 Vite `built`，验证后手动结束常驻 dev 进程。
- 已修复用户实际 store 中 `quota-curl` 存在但 `quota-enabled` 缺失导致卡片不触发 quota 加载的问题。
- 已支持浏览器复制 curl 的反斜杠换行格式，并用实际 quota endpoint 验证返回包含 `pro` 计划与两段窗口数据。
