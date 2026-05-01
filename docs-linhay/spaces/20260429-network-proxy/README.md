# 20260429 Network Proxy

## 背景
本次整理的主题是参考项目中的“网络代理”实现，不是多 agent 代理。
当前仓库的参考来源主要是 `docs-linhay/references/CLIProxyAPI`。该项目把网络代理做成了一个跨配置、HTTP transport、SOCKS dialer、WebSocket 连接和管理 API 的统一能力，适合作为 GetTokens 后续代理设置设计的直接参考。

## 目标
1. 明确参考项目里网络代理配置的入口和优先级。
2. 梳理代理能力在 HTTP、SOCKS、uTLS、WebSocket 等不同调用链上的接入方式。
3. 归纳对 GetTokens 的可复用设计点，避免后续只在 UI 层加开关而没有真正打通 sidecar 行为。

## 范围
1. `docs-linhay/references/CLIProxyAPI/config.example.yaml`
2. `docs-linhay/references/CLIProxyAPI/sdk/proxyutil/`
3. `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/rtprovider.go`
4. `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/`
5. `docs-linhay/references/CLIProxyAPI/internal/auth/`
6. `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/`

## 非目标
1. 不评审参考项目的账号池、quota、provider 路由策略。
2. 不在本次 space 内直接产出 GetTokens 的实现代码。
3. 不覆盖 Cherry Studio 一类“应用层代理设置 UI”的完整分析，本次只聚焦 CLIProxyAPI 的网络代理链路。

## 验收标准
1. 能回答“代理配置写在哪里、谁消费、优先级如何”。
2. 能区分 HTTP 请求、SOCKS 连接、uTLS/HTTP2、Codex WebSocket 各自如何接入代理。
3. 能给出 GetTokens 如果要复用这套模式，最少需要打通的边界。

## 参考实现摘要

### 1. 配置模型
- 全局入口是 `config.example.yaml` 顶层的 `proxy-url`。
- 单个凭证条目也可以设置 `proxy-url`，例如 Gemini / Codex / Claude 的每个 key。
- 代理值支持三类语义：
  - 空字符串：继承环境代理或上层默认行为。
  - `direct` / `none`：显式直连，绕过全局代理和环境代理。
  - `http://` / `https://` / `socks5://` / `socks5h://`：显式代理。

### 2. 统一解析层
- `sdk/proxyutil/proxy.go` 是核心抽象。
- `Parse(raw)` 把原始字符串标准化为 `ModeInherit`、`ModeDirect`、`ModeProxy`、`ModeInvalid`。
- `BuildHTTPTransport(raw)` 面向 HTTP 客户端：
  - `inherit` 返回 `nil`，让调用方沿用默认 transport。
  - `direct` 克隆默认 transport 并把 `Proxy` 置空。
  - `http/https` 设置 `transport.Proxy = http.ProxyURL(...)`。
  - `socks5/socks5h` 创建 SOCKS dialer，再挂到 `DialContext`。
- `BuildDialer(raw)` 面向连接层，主要给 uTLS 或 WebSocket 这类不能只靠 `http.Transport.Proxy` 的场景复用。

### 3. 运行时注入点

#### 3.1 标准 HTTP 请求
- `sdk/cliproxy/rtprovider.go` 提供 `defaultRoundTripperProvider`。
- 它按 `auth.ProxyURL` 做 transport 缓存，一个代理串复用一个 `RoundTripper`。
- 这说明参考项目不是把代理逻辑散在 provider 里，而是给 runtime 一个“按 auth 取 transport”的能力。

#### 3.2 管理 API 发出的探测/转发请求
- `internal/api/handlers/management/api_tools.go` 的注释写明代理优先级：
  1. 当前选中 credential 的 `proxy_url`
  2. 全局 `proxy-url`
  3. 直连，并且不使用环境代理
- 这里很关键，因为它把“后台诊断请求”与“真实业务请求”统一到了同一条代理语义上。

#### 3.3 Gemini OAuth / 常规 HTTP client
- `internal/auth/gemini/gemini_auth.go` 在 OAuth client 初始化前先构造代理 transport。
- 如果有代理，就把代理 client 塞进 `oauth2.HTTPClient` 上下文里，后续 token 交换和用户信息请求都会走代理。
- `internal/util/proxy.go` 还提供了一个更薄的 `SetProxy` 辅助函数，用于普通 SDK client。

#### 3.4 Claude / Anthropic 的 uTLS + HTTP/2
- `internal/auth/claude/utls_transport.go` 和 `internal/runtime/executor/helps/utls_client.go` 都没有直接依赖 `http.Transport.Proxy`。
- 它们改走 `BuildDialer(proxyURL)`，把代理放到更底层的 TCP 拨号阶段，再做 uTLS 握手和 HTTP/2 连接复用。
- 这是参考项目里最值得借鉴的一点：只做 HTTP 代理开关不够，特殊协议栈必须走 dialer 级接入。

#### 3.5 Codex WebSocket
- `internal/runtime/executor/codex_websockets_executor.go` 单独处理 WebSocket 代理。
- `direct` 时把 `dialer.Proxy = nil`。
- `http/https` 时设置 `dialer.Proxy = http.ProxyURL(...)`。
- `socks5/socks5h` 时自己构造 SOCKS dialer，并覆盖 `NetDialContext`。
- 也就是说，参考项目没有强行拿一个通用 HTTP client 去包 WebSocket，而是按 WebSocket 握手模型单独实现了一层。

### 4. 数据模型上的承载方式
- `sdk/cliproxy/auth/types.go` 的 `Auth` 结构带有 `ProxyURL string`。
- 这意味着“代理”被视为 credential 级别的运行时属性，而不是纯全局配置。
- `Auth.indexSeed()` 还把 `proxyURL` 纳入稳定索引种子的一部分，说明同 provider + 同 baseURL + 不同代理的 credential，在引用身份上被视作不同对象。

### 5. 管理面能力
- `internal/api/server.go` 暴露了 `/v0/management/proxy-url` 的 GET/PUT/PATCH/DELETE。
- `internal/api/handlers/management/config_basic.go` 负责直接读写 `cfg.ProxyURL`。
- 这套管理面说明参考项目支持“运行时修改全局代理配置”，而不是只能改 yaml 重启。

## 对 GetTokens 的直接启发
1. 代理不能只存在于前端设置页，必须落到 sidecar 可消费的数据模型里，至少要覆盖全局代理和账号级代理两个层次。
2. 不能只封装 `http.Transport.Proxy`。如果后续我们支持 WebSocket、uTLS 或其他自定义执行器，必须保留 dialer 级代理能力。
3. “显式直连”必须是独立语义，不能拿空字符串代替。空字符串代表继承，`direct/none` 才代表明确绕过。
4. 管理 API 或调试工具发出的请求，也应复用同一套代理优先级，否则 UI 上验证通、真实请求却不通。
5. 如果 GetTokens 要支持按账号切换代理，账户唯一性或缓存键也要考虑把代理信息纳入 identity。

## 对当前仓库的建议边界
1. 先定义 GetTokens 自己的代理配置边界：
   - 全局 `proxyUrl`
   - 账号级 `proxyUrl`
   - 显式直连语义
2. 再明确 sidecar 边界：
   - 哪些值直接透传到 CLIProxyAPI
   - 哪些值只在 GetTokens 本地 UI / 管理请求里消费
3. 最后再做前端体验：
   - 校验代理 URL
   - 展示当前生效来源是“账号覆盖 / 全局 / 继承 / 直连”
   - 为诊断请求提供“按当前生效代理测试连通性”的能力

## 设计稿入口

- 本期设计稿：`design-preview.html`
- 约束：设计稿必须放在当前 space 根目录，保持单 HTML 入口。本期稿件主题已收口为“代理池管理新页面”，是 GetTokens 内的独立页面，不是网络代理配置表单，也不是账号详情弹层。
- 当前边界：这期代理池页面的数据按“纯客户端维护”设计，添加、删除、分组、排序与最近检测结果都先表达为本地状态，不假设后端已经存在代理池实体或代理节点健康接口。

## 相关链接
1. `docs-linhay/spaces/20260429-network-proxy/design-preview.html`
2. `docs-linhay/spaces/20260429-network-proxy/plans/20260429-network-proxy-deep-dive-v01.md`
3. `docs-linhay/references/CLIProxyAPI/config.example.yaml`
4. `docs-linhay/references/CLIProxyAPI/sdk/proxyutil/proxy.go`
5. `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/rtprovider.go`
6. `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/utls_client.go`
7. `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
8. `docs-linhay/references/CLIProxyAPI/internal/auth/gemini/gemini_auth.go`
9. `docs-linhay/references/CLIProxyAPI/internal/auth/claude/utls_transport.go`
10. `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/api_tools.go`
11. `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/config_basic.go`

## 当前状态
- 状态：implemented-in-frontend
- 最近更新：2026-04-30

## 实施落地（2026-04-30）
- `代理池` 已接入真实前端，作为与 `账号池` 同级的一级导航页进入应用。
- 页面主体为纯客户端维护的表格工作区，数据通过浏览器 `localStorage` 持久化，不依赖后端代理池实体。
- 当前已接通的基础能力包括：本地节点列表初始化、筛选、搜索、批量复测、单行复测、移组、删除，以及本地持久化恢复。
- 第二轮交互已补齐：`新增代理`、`编辑`、`导入列表`、`导出` 都已具备真实前端行为，其中导入支持粘贴或读取本地 JSON，导出会生成本地 JSON 文件。
- 第三轮交互继续补齐：表格支持多选、全选当前筛选、清空选择、导出选中、批量删除；导入同时支持逐行 `scheme://host:port` / `host:port` 的纯文本格式。
- 第四轮把表格提升到更像真实工作台：新增分组筛选、排序方式切换，以及“复测选中 / 选中移到观察组”这类选中项批量动作。
- 第五轮继续收紧表格工作流：排序已改成列头点击切换升降序，选中项移组也从固定“移到观察组”改成可选目标分组的批量移组。
- 第六轮补齐大列表承载：主表格新增分页、每页条数切换和“全选当前页”，避免节点变多后所有操作都堆在一屏。
- 第七轮开始接真实数据：`复测` 相关动作已改成真实代理探测，不再只做本地模拟；后续产品方向又收口，已移除“导入环境代理”入口，不再从当前进程环境变量注入节点。
- 第八轮清理历史假数据：页面不再用内置种子节点做默认首屏；如果本地 `localStorage` 里仍保留旧版本写入的那批演示节点，也会在加载时自动识别并丢弃。
- 第九轮按主流 Wails 规范收尾：代理池新接口已补到根层 `main.App` 绑定包装，前端恢复为直接使用 `frontend/wailsjs/go/main/App` 的生成绑定，不再保留动态 `window.go` 兜底。
- 第十轮修复节点去重键：代理池节点身份已纳入 `protocol + host + port`，同一 IP 和端口下的 `http` / `socks5` 不会再互相覆盖；浏览器实测已验证两条可同时展示。
- 第十一轮开始接“订阅管理”基础能力：后端新增 `FetchProxySubscription`，前端新增“导入订阅”弹层，支持从纯文本订阅链接拉取代理列表，并把 `sourceLabel / sourceURL` 写入每条节点；表格也新增“来源”列展示这些标签。
- 第十二轮把“订阅”从一次性导入补成可维护对象：前端会把订阅源本地持久化，记录 `url / label / lastSyncedAt / lastImportCount / lastError`，并提供“订阅源”管理弹层，支持单源刷新、全部刷新、仅删订阅源、删订阅源并清理对应节点。
- 第十三轮收紧表格工具条：主区顶部不再同时摆放一排导入/订阅/导出/复测按钮，改成“新增代理 + 更多操作”两级结构；批量动作只在选中节点后展开，避免常态信息噪音过高。
- 第十四轮补齐测速配置：搜索轨道下新增“测速网址”输入，支持指定 `http/https` 测速站点；已配置并使用过的网址会进入本地历史，默认只保留最近 5 条，后续单条测速和批量测速都复用这份配置。
- 第十五轮重构代理表格单行：默认隐藏选择列，只在显式进入“批量选择”模式后显示；`IP + 端口` 合并为单列地址，`状态 + 可用率` 合并为状态胶囊，检测时间改为 `x天前 / xh xm 前 / xs 前` 的相对格式，行内操作收口为“测速 + 三点菜单”。
- 本轮生成链已确认修正方向正确：`FetchProxySubscription / ProbeProxyNode` 已进入 `frontend/wailsjs/go/main/App` 生成绑定；已移除的环境变量导入链路不再保留在当前代理池产品范围内。
- 当前仍有一条与代理池无关的仓库基线阻塞未在本轮处理：
  - `npm --prefix frontend run test:unit` 仍有 `src/utils/pagePersistence.test.mjs` 针对 `vendor-status` 的 4 条既有失败，不是本轮代理池改动引入。
- 本轮实现刻意收口在 GetTokens 的 APP 层：代理池、订阅源、导入刷新、来源标签与本地持久化都由应用层负责，不假设存在独立“服务端代理池”，也不假设节点可用性、延迟、分组来自后端实时监控。
