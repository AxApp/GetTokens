# 账号导入统一 Modal 实施计划 v01

## 体验方向

视觉上沿用 GetTokens 当前账号页的 Swiss utility 风格：强边框、硬阴影、单页工作台密度、无装饰背景。Modal 内按“输入源 -> 候选队列 -> 提交结果”组织，用户不需要在上传和粘贴之间切换页面。

## 范围拆分

1. 文档和设计稿
   - 新增本 space 的 `design-preview.html`。
   - 固定统一 modal 的默认态、文件队列态和粘贴数组态。
2. 解析模型
   - 扩展账户导入解析，支持顶层 JSON 数组。
   - 数组元素逐项识别：复制的账号卡 payload 走现有 `parseAccountCardImportPayload`，普通 JSON 对象按 auth-file 内容进入上传链路。
3. 账户页 UI
   - 页头菜单把“导入文件”和“粘贴内容”收敛为一个导入入口。
   - 新增统一导入 modal，支持多文件添加、粘贴内容添加、候选项移除。
4. 提交流程
   - 文件候选和 auth-file 粘贴候选批量调用 `UploadAuthFiles`。
   - API Key / OpenAI-compatible 复制 payload 继续走现有创建逻辑。
   - 提交成功后关闭 modal、清空草稿并刷新账户列表。
5. 验证
   - 单元测试覆盖单对象、JSON 数组、普通 auth-file JSON、复制账号卡 payload。
   - 前端类型检查和相关测试通过。

## 验收场景

1. Given 用户打开账户页菜单，When 点击导入账号，Then 只出现一个统一导入 modal。
2. Given 用户在 modal 内一次选择多个文件，When 点击导入，Then 所有文件进入 `UploadAuthFiles` 且继续复用后端 CPA 自动转换。
3. Given 用户粘贴 JSON 数组，When 点击添加到队列，Then 数组元素拆成多个候选项。
4. Given 队列里有不想导入的候选项，When 用户点击移除，Then 该项不会参与提交。
5. Given 用户粘贴复制的 API Key / OpenAI-compatible 账号卡 payload，When 提交，Then 继续创建对应账号类型，不退化成 auth-file。

## 风险和边界

1. 后端 `UploadAuthFiles` 仍是 CPA 自动转换的唯一执行点，前端不复制 ChatGPT session / 9router OAuth 的字段映射。
2. 粘贴内容仍要求是有效 JSON；不支持任意自由文本解析。
3. 文件内容在前端只作为待上传队列保存，真正识别、转换和重名处理仍交给现有后端路径。
