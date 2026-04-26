# 2026-04-26 Codex OAuth Bridge Boundary

## 背景

GetTokens 原先在账号池里只支持两种新增凭据方式：

1. 上传 / 粘贴 auth file
2. 新建 Codex API Key

对于 `nolon/chatgpt(codex)` 账号，这意味着用户在 token 过期后只能看到失败原因，无法从当前界面直接恢复。

## 本轮结论

### 1. 登录不是全局会话，而是账号池内的局部动作

GetTokens 是桌面端账号池，不是 Web 管理后台。

因此：

1. 单个 `codex` 账号过期，不等于整个应用需要“退出登录”
2. 不引入独立全局登录页或 `ProtectedRoute` 式路由守卫
3. 登录入口和恢复入口都收敛到账号池自身

### 2. OAuth 只桥接 sidecar 现有能力，不重造协议

当前最小 bridge 使用 sidecar 现有管理接口：

1. `GET /v0/management/codex-auth-url?is_webui=true`
2. `GET /v0/management/get-auth-status?state=...`

前端负责：

1. 调 Wails `StartCodexOAuth`
2. 用 `BrowserOpenURL(...)` 打开系统浏览器
3. 轮询 `GetOAuthStatus`

Wails 负责：

1. 把请求桥接给 sidecar
2. 在成功后执行本地账号资产回填

### 3. “重新登录”默认回填原账号资产，而不是新增重复账号

仅仅发起 sidecar OAuth 会在 `auth-dir` 里新增一个新的 `codex` auth file。

这对桌面账号池不够好，因为会留下：

1. 一个失败的旧账号
2. 一个新登录成功的重复账号

因此本轮规则是：

1. 普通 `ChatGPT 登录` 可以新增账号
2. 从失败卡片触发 `重新登录` 时，成功后要把新 auth 内容回填到原文件名
3. 临时生成的新 auth file 在回填后删除，不保留为重复资产

### 4. 回填过程只使用现有管理接口完成

当前实现不直接依赖 sidecar 内部文件路径，而是复用现有管理 API：

1. 比较 OAuth 前后的 auth file 名单
2. 找到新的 `codex` auth file
3. 下载其内容
4. 删除旧文件
5. 以上传方式用旧文件名重新写回
6. 删除临时新文件

这样做的好处：

1. 不额外引入 sidecar 专用“rename / replace auth file”协议
2. 继续复用现有 normalize 上传链路
3. 桌面端和 sidecar 的职责边界清晰

## 当前边界

### 前端

1. Header 菜单提供 `ChatGPT 登录`
2. 失败态 `codex auth-file` 卡片提供 `重新登录`
3. 轮询 OAuth 状态并显示进行中 / 失败提示

### Wails

1. `StartCodexOAuth`
2. `GetOAuthStatus`
3. `FinalizeCodexOAuth`

### sidecar

1. 继续负责 OAuth 握手、回调接收与 token 落盘
2. 不要求为 GetTokens 新增专门的 replace 接口

## 不照搬的参考做法

参考项目 `Cli-Proxy-API-Management-Center` 的以下能力值得借：

1. `start -> status -> callback` 的 OAuth 三段式接口
2. WebUI 模式下的浏览器回调转发

但以下做法不适合直接照搬到 GetTokens：

1. 全局 `401 -> logout -> ProtectedRoute` 重定向
2. 单独的管理后台登录体系

原因是 GetTokens 的核心对象是“账号资产”，不是“当前操作者会话”。
