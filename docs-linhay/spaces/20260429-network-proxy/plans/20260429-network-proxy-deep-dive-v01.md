# 20260429 Network Proxy Deep Dive v01

## 背景
这份文档是 `20260429-network-proxy` space 的深度附录，目标不是重复 README 的概览，而是把“支持什么、不支持什么、在哪里生效、为什么这样设计、GetTokens 现在接到了哪里”一次讲透。

## 1. 出口代理支持矩阵

| 协议 | 支持情况 | 证据 | 备注 |
|------|----------|------|------|
| `socks4://` | 不支持 | `sdk/proxyutil/proxy.go` 的 scheme 白名单只有 `socks5` / `socks5h` / `http` / `https` | 传入会走 `unsupported proxy scheme` |
| `socks5://` | 支持 | `proxyutil.Parse` + `BuildHTTPTransport` + `BuildDialer` | HTTP 请求和连接层都可用 |
| `socks5h://` | 支持 | 同上 | 适合把 DNS 解析也交给代理端 |
| `http://` | 支持 | `transport.Proxy = http.ProxyURL(...)` | 标准 HTTP CONNECT / 代理模式 |
| `https://` | 支持 | `transport.Proxy = http.ProxyURL(...)` | 作为上游代理 URL 被接受 |
| `direct` / `none` | 支持 | `ModeDirect` | 显式直连，绕过环境代理 |
| 空字符串 | 支持 | `ModeInherit` | 继承默认行为或调用方环境 |

### 关键结论
1. 参考实现支持 `SOCKS5`、`SOCKS5H`、`HTTP`、`HTTPS` 出口代理。
2. `SOCKS4` 当前不在白名单内，因此不支持。
3. `direct` / `none` 不是“无值”，而是有语义的“显式不走代理”。

## 2. 代理语义矩阵

| 输入值 | 解释 | 对调用方的影响 |
|--------|------|----------------|
| `""` | `inherit` | 不构建 transport / dialer，由调用方继续使用默认行为 |
| `direct` / `none` | `direct` | 显式清空 `Proxy` 或返回 `proxy.Direct` |
| `socks5://...` | `proxy` | 构造 SOCKS5 dialer |
| `socks5h://...` | `proxy` | 构造 SOCKS5H dialer |
| `http://...` | `proxy` | 标准 HTTP proxy |
| `https://...` | `proxy` | 标准 HTTPS proxy |
| 其他 scheme | `invalid` | 返回错误并记录日志 |

## 3. 优先级与配置边界

### 3.1 配置入口
1. 全局配置：顶层 `proxy-url`
2. 凭证配置：各 provider / api key entry 自己的 `proxy-url`
3. 运行时管理面：`/v0/management/proxy-url`

### 3.2 生效优先级
管理 API `api-call` 注释把优先级写得很清楚：
1. 选中的 credential `proxy_url`
2. 全局 `proxy-url`
3. 直连，并且不使用环境代理

这说明参考实现把代理当成“账号覆盖全局”的能力，而不是单纯的全局设置。

## 4. 运行时注入点矩阵

| 调用链 | 接入点 | 用的是哪层抽象 | 说明 |
|--------|--------|----------------|------|
| 普通 HTTP 请求 | `sdk/cliproxy/rtprovider.go` | `BuildHTTPTransport` | 给不同 auth 提供 per-auth transport |
| Gemini OAuth | `internal/auth/gemini/gemini_auth.go` | `BuildHTTPTransport` | OAuth token 交换也走代理 |
| Claude uTLS | `internal/auth/claude/utls_transport.go` | `BuildDialer` | 先代理拨号，再做 uTLS/HTTP2 |
| Claude runtime fallback | `internal/runtime/executor/helps/utls_client.go` | `BuildDialer` + `buildProxyTransport` | Anthropic 走 uTLS，其它流量走 fallback transport |
| Codex WebSocket | `internal/runtime/executor/codex_websockets_executor.go` | `Parse` + 定制 `websocket.Dialer` | SOCKS 场景覆盖 `NetDialContext` |
| 管理 API 探测 | `internal/api/handlers/management/api_tools.go` | `apiCallTransport` | 后台诊断请求复用同一代理优先级 |

### 关键结论
1. 这套实现不是“只有一个 HTTP client 设置代理”。
2. 它至少覆盖了：
   - 标准 HTTP transport
   - 连接层 dialer
   - uTLS/HTTP2
   - WebSocket
   - management API 诊断链路
3. 因此它更像“统一代理语义 + 多协议接入器”，而不是单点配置。

## 5. 证据矩阵

| 结论 | 代码证据 |
|------|----------|
| 只支持 `socks5/socks5h/http/https` | `docs-linhay/references/CLIProxyAPI/sdk/proxyutil/proxy.go` |
| `SOCKS4` 不支持 | 同文件的 `default: unsupported proxy scheme` 分支 |
| 显式直连支持 `direct/none` | `proxy.go` 中 `strings.EqualFold(trimmed, "direct") || strings.EqualFold(trimmed, "none")` |
| 管理 API 有全局代理读写入口 | `internal/api/handlers/management/config_basic.go` 的 `GetProxyURL / PutProxyURL / DeleteProxyURL` |
| 管理 API 请求优先走账号代理 | `internal/api/handlers/management/api_tools.go` 注释中的 priority 说明 |
| auth 级别覆盖全局代理 | `sdk/cliproxy/auth/types.go`：`ProxyURL overrides the global proxy setting` |
| 普通 HTTP transport 按 auth 缓存 | `sdk/cliproxy/rtprovider.go` 的 `RoundTripperFor` |
| uTLS 使用 dialer 级代理 | `internal/auth/claude/utls_transport.go` 与 `internal/runtime/executor/helps/utls_client.go` |
| WebSocket 单独适配 SOCKS / HTTP 代理 | `internal/runtime/executor/codex_websockets_executor.go` |

## 6. GetTokens 当前映射

### 6.1 已经存在的字段承载
1. `app.go` 里对外模型已有 `proxyUrl`
2. `internal/wailsapp/accounts.go` 里账号输入已接收 `proxyUrl`
3. `internal/cliproxyapi/types.go` 里与 sidecar 配置交换时已经存在 `proxy-url`
4. `frontend/wailsjs/go/models.ts` 已有 `proxyUrl` 生成字段

### 6.2 这说明什么
1. GetTokens 并不是完全没有代理字段。
2. 但当前还缺少一份清晰的产品/技术边界文档，说明：
   - 全局代理由谁持有
   - 账号级代理如何覆盖
   - UI 上怎么表达 `inherit` / `direct` / `proxy`
   - sidecar 的 management API 是否也要跟着复用

## 7. GetTokens 待实现边界

### 7.1 配置边界
建议最少明确三层：
1. `globalProxyUrl`
2. `account.proxyUrl`
3. `proxyMode`
   - `inherit`
   - `direct`
   - `custom`

### 7.2 协议边界
建议至少显式声明：
1. 支持 `socks5://`
2. 支持 `socks5h://`
3. 支持 `http://`
4. 支持 `https://`
5. 明确 `socks4://` 不支持

### 7.3 产品边界
1. UI 需要展示当前生效来源：
   - 账号覆盖
   - 全局代理
   - 继承
   - 直连
2. 调试工具需要能按“当前生效代理”做一次探测请求。
3. 账号详情页若允许配置代理，必须同步提示协议支持矩阵，不要让用户误填 `socks4://`。

## 8. 实施建议

### 第一步
先补一份 GetTokens 自己的代理规格文档，固定：
1. 字段名
2. 支持协议
3. 优先级
4. `inherit/direct/custom` 三种模式

### 第二步
收口 sidecar 边界：
1. 哪些代理字段直接透传给 CLIProxyAPI
2. 哪些只在 GetTokens 本地管理请求里使用

### 第三步
补 UI 与验证：
1. URL 格式校验
2. 生效来源展示
3. 一键连通性测试

## 8.1 下一步实施清单
1. 新建 GetTokens 项目内的代理规格文档，明确字段、模式和支持协议。
2. 盘点 `app.go`、`internal/wailsapp/accounts.go`、`internal/cliproxyapi/types.go` 的现有透传边界，补一张字段流向图。
3. 确认 sidecar management API 的代理设置是否需要在 GetTokens 内直接暴露。
4. 若进入实现阶段，先从 `proxyMode + proxyUrl` 的领域模型收口开始，再做 UI。

当前已落地第 1 步：`docs-linhay/dev/20260429-gettokens-proxy-spec-v01.md`

## 9. 本次整理的结论
1. 参考项目的出口代理支持 `SOCKS5`、`SOCKS5H`、`HTTP`、`HTTPS`，不支持 `SOCKS4`。
2. 代理设计的核心不是一个输入框，而是统一语义 + 多协议注入点。
3. GetTokens 当前已经有字段基础，但还缺“产品边界 + sidecar 边界 + UI 语义”的完整闭环。
