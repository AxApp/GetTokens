# 账号池

## 背景
账号池相关需求、设计、计划、截图和辩论记录统一沉淀在本 space 下，避免散落到仓库级目录。

## 目标
为账号池能力提供单一工作入口，承载后续的需求澄清、实现计划、验证记录与回归资料。

## 范围
- 账号池需求背景、边界和验收标准维护
- 账号池开发计划归档到 `plans/`
- 账号池截图归档到 `screenshots/`
- 账号池多 agent 讨论归档到 `debate/`
- `nolon/chatgpt(codex)` OAuth 登录与账号过期恢复集成

## 非目标
- 在本次操作中直接定义账号池的详细产品方案或技术实现
- 在仓库级 `dev/` 或其他 space 中重复维护同一份账号池范围说明
- 为整个桌面应用引入独立的全局登录页或 Web 管理后台式会话系统

## 当前需求

### 目标

在当前账号池中，为 `nolon/chatgpt(codex)` 账号补齐两条闭环：

1. 应用内发起 OAuth 登录，替代纯手工导入 `auth.json`
2. 当账号过期或失效时，用户可以直接从失败卡片触发重新登录，而不是只看到失败原因

### 已知边界

1. 当前 GetTokens 已能把 `nolon chatgptAccount` 类 auth 文件识别为 `codex`
2. 当前导入链路已能把 legacy `codex/nolon` auth 清洗成 sidecar 真正消费的最小字段结构
3. 当前失败原因已能从 sidecar `statusMessage` 透传到账号卡片
4. 当前前端入口仍以“上传文件 / 粘贴 JSON / API Key 录入”为主，没有 OAuth bridge
5. 当前桌面应用不是单一全局登录应用，不能把单个账号失效等同于整个应用登出

### BDD 场景

#### 场景 1：新增 ChatGPT 账号

- Given sidecar 已就绪，账号池页面可操作
- When 用户点击 `ChatGPT 登录`
- Then 应用调用 sidecar OAuth 起始接口并弹出登录确认框
- And 确认框展示登录 URL，并提供 `复制`、`在浏览器中打开`、`关闭`
- And 前端显示登录进行中状态
- When sidecar OAuth 流程完成
- Then 账号池刷新并出现新的 `codex` 账号记录

#### 场景 2：过期账号重新登录

- Given 账号池中已有一个 `codex` auth-file 账号，状态异常且存在失败原因
- When 用户点击该卡片上的 `重新登录`
- Then 应用发起新的 OAuth 流程
- When OAuth 成功且检测到新的 `codex` auth 文件
- Then 应用将新 auth 内容回填到原账号资产
- And 刷新后原账号 ID 仍以原文件名存在
- And 临时生成的新 auth 文件不会作为重复账号残留

#### 场景 3：OAuth 失败或超时

- Given 用户已发起 `ChatGPT 登录` 或 `重新登录`
- When sidecar 返回 `error` 状态或超时
- Then 前端保留错误提示
- And 不修改现有账号内容
- And 用户可以再次触发登录

#### 场景 4：登录 URL 手动操作

- Given 用户已发起 `ChatGPT 登录` 或 `重新登录`
- When 前端展示登录确认框
- Then 用户可以复制登录 URL
- And 用户可以手动打开浏览器继续登录
- And 用户可以关闭确认框而不影响后续列表刷新

#### 场景 5：账号失效后的可恢复性

- Given `codex` auth-file 账号状态不是 `ACTIVE / CONFIGURED / DISABLED / LOCAL`
- When 用户查看账号卡片
- Then 卡片除失败原因外，还应暴露 `重新登录` 动作
- And 该动作只作用于当前账号，不影响其他账号和应用整体路由

## 验收标准
- 已存在 `docs-linhay/spaces/account-pool/README.md`
- 已存在 `docs-linhay/spaces/account-pool/plans/`
- 已存在 `docs-linhay/spaces/account-pool/screenshots/`
- 已存在 `docs-linhay/spaces/account-pool/debate/`
- 后续账号池相关文档默认优先落到该 space
- 已定义 `codex` OAuth 登录与过期恢复的验收场景
- 实现后至少覆盖后端 bridge 测试与前端账号动作测试
- 过期 `codex` 账号不再只是显示失败原因，而是可直接触发重新登录
- 成功重登后默认回填原账号资产，不新增重复账号
- 登录入口改为手动确认框，不再无提示直接拉起系统浏览器

## 相关链接
- [docs-linhay 文档入口](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/README.md)
- [spaces 结构治理](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260424-spaces-structure-governance.md)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-26
- 最近变更：启动 `nolon/chatgpt(codex)` OAuth 登录与过期恢复集成，先收敛为账号池内局部动作，不引入全局登录页。
