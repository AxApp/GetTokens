# 20260429 GetTokens Proxy Spec v01

## 背景
参考项目 `CLIProxyAPI` 已经具备统一的网络代理语义，但 GetTokens 侧目前仍处于“字段存在、边界未定、产品语义未封口”的状态。

本规格文档的目标不是直接改代码，而是先固定：
1. GetTokens 领域模型应该怎么表达代理
2. 哪些字段直接透传 sidecar
3. 哪些能力属于 UI / 本地工作台层

## 结论

### 1. 支持协议
GetTokens 对外应明确声明与 sidecar 对齐的支持矩阵：
1. 支持 `socks5://`
2. 支持 `socks5h://`
3. 支持 `http://`
4. 支持 `https://`
5. 不支持 `socks4://`

### 2. 代理模式
GetTokens 内部建议统一成三态模型：
1. `inherit`
2. `direct`
3. `custom`

语义如下：
1. `inherit`
   - 不设置显式 `proxy-url`
   - 交由 sidecar 或调用环境继承默认代理行为
2. `direct`
   - 明确写入 `direct`
   - 显式绕过环境代理
3. `custom`
   - 必须同时携带 `proxyUrl`
   - `proxyUrl` 必须是受支持的 scheme

### 3. 字段边界

#### 3.1 APP / H5 对外模型
建议统一保留：
1. `proxyMode`
2. `proxyUrl`

约束：
1. 当 `proxyMode == inherit` 时，`proxyUrl` 必须为空
2. 当 `proxyMode == direct` 时，`proxyUrl` 必须为空，sidecar 写入固定值 `direct`
3. 当 `proxyMode == custom` 时，`proxyUrl` 必须非空且可解析

#### 3.2 Sidecar 透传模型
sidecar 仍沿用 `CLIProxyAPI` 的原生字段：
1. `proxy-url: ""`
2. `proxy-url: "direct"`
3. `proxy-url: "<scheme>://..."`

也就是说：
1. GetTokens 自己持有 `proxyMode`
2. sidecar 只认最终落地后的 `proxy-url`

## 现有代码映射

### 1. 已存在字段
1. `app.go`
   - `CreateCodexAPIKeyInput.ProxyURL`
2. `internal/wailsapp/accounts.go`
   - `CreateCodexAPIKeyInput.ProxyURL`
   - 创建 `CodexAPIKeyInput` 时会 trim 后透传
3. `internal/cliproxyapi/types.go`
   - `CodexAPIKey.ProxyURL`
   - `CodexAPIKeyInput.ProxyURL`
   - `CodexAPIKeyPatch.ProxyURL`
   - `OpenAICompatibleAPIKeyEntry.ProxyURL`

### 2. 当前缺口
当前代码层面还没有统一的：
1. `proxyMode`
2. `supported scheme` 校验
3. `inherit/direct/custom` 的前端展示语义
4. “当前实际生效代理来源”的解释层

## 领域规则

### 1. 优先级
如果后续同时支持全局代理和账号代理，固定优先级应为：
1. 账号级 `proxyUrl`
2. 全局代理
3. 继承环境 / 默认行为

如果某账号显式选择 `direct`，则它必须覆盖全局代理。

### 2. 身份边界
当账号配置把代理作为运行时差异时，代理信息不应被忽略。

最小要求：
1. 如果两个账号仅 `proxyUrl` 不同，产品层要把它们视为不同配置态
2. 后续若出现缓存键、去重键、诊断快照键，需要确认是否把代理纳入 identity

### 3. 诊断边界
调试或探测请求不应绕开当前生效代理。

最小要求：
1. “测试连通性”必须基于当前账号 / 当前全局设置推导出的最终代理
2. UI 不能只验证 URL 格式，还应能验证“该代理下是否能通”

## UI 规格

### 1. 输入形态
建议使用：
1. 一个 `proxyMode` 选择器
2. 一个仅在 `custom` 模式显示的 `proxyUrl` 输入框

### 2. 模式文案
建议固定三类：
1. `继承默认`
2. `直连`
3. `自定义代理`

### 3. 错误文案
至少覆盖：
1. 不支持的协议，例如 `socks4://`
2. URL 缺少 scheme 或 host
3. `custom` 模式下值为空

## Sidecar 管理面建议

### 1. 是否暴露全局代理设置
建议后续明确区分：
1. 账号级代理：跟随账号配置存储
2. 全局代理：如要开放，应明确它操作的是 sidecar 顶层 `proxy-url`

### 2. 是否直接开放 management API
不建议让前端自由拼 management API 写任意字符串。

建议路径：
1. 前端只提交结构化的 `proxyMode + proxyUrl`
2. APP 层负责归一化
3. `internal/cliproxyapi` 再写到 sidecar 原生字段

## 实施顺序

### 第一步
在文档层固定产品语义：
1. 支持协议
2. 模式
3. 优先级

### 第二步
在 APP/H5 模型中引入 `proxyMode`，但暂不大改全部 provider。

### 第三步
先从 `codex-api-key` 与 `openai-compatible` 两类配置打通代理模式。

### 第四步
补“测试连通性”与“生效来源展示”。

## 非目标
1. 本文档不定义系统级代理切换。
2. 本文档不覆盖 macOS 全局网络代理。
3. 本文档不直接要求本轮实现 GUI。
