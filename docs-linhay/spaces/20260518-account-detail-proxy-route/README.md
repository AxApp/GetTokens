# Account Detail Proxy Route

## 背景
账号池已经能承载 `codex-api-key`、`openai-compatible` 等账号资产，代理池页面也已经可以维护本地代理节点并生成 `socks5://host:port`、`http://host:port` 等出口 URL。

当前问题是：用户想给单个账号指定出口时，没有稳定入口。账号详情弹窗里缺少“出口 / 代理”区域，导致账号与代理池之间只能停留在概念上，无法在账号上下文内完成 `继承 / 直连 / 选择代理` 的配置。

底层已有部分承载能力：

1. `codex-api-key` 已有 `proxy-url` 字段，可随账号配置同步到 sidecar。
2. `openai-compatible` 的 `api-key-entries[]` 已有 `proxy-url` 字段。
3. 代理池节点可构造为标准代理 URL。

本 space 聚焦把这些能力串成账号详情里的可用配置闭环。

## 目标
1. 在账号详情弹窗新增“出口 / 代理”区域。
2. 支持账号级代理模式：`继承`、`直连`、`选择代理`。
3. `选择代理` 时从代理池现有节点中选择一个可用出口，并写入账号级 `proxyUrl`。
4. 保存后同步到对应 sidecar 配置，使真实请求按账号级代理优先生效。
5. 在账号卡片或详情摘要中能看到当前出口状态，避免配置后不可见。

## 范围
1. 前端账号详情弹窗：
   - `UnifiedAccountDetailModal` 或其子组件新增出口/代理 section。
   - 展示当前账号出口状态。
   - 提供 `继承 / 直连 / 选择代理` 控件。
2. 账号模型：
   - 前端 `AccountRecord` 补齐 `proxyUrl`。
   - 后端账号 DTO 确保 `proxyUrl` 可从 `ListAccounts` 返回到前端。
3. Codex API Key：
   - 创建 / 编辑账号时保留并保存 `proxyUrl`。
   - `direct` 表示显式直连。
   - 空值表示继承。
4. OpenAI-Compatible Provider：
   - 本期以 provider 资产最小闭环为目标，先支持把 provider 的主 key entry 代理配置暴露到详情区。
   - 多 key entry 的逐 key 代理编辑可作为后续增强，不阻塞本期最小可用。
5. 代理池读取：
   - 复用 `gettokens.proxy-pool.nodes` 本地存储与 `buildProxyURLFromNode()` 语义。
   - 只选择已有节点，不在账号详情里新增、删除、导入代理。
6. 验证：
   - 纯模型测试覆盖代理模式解析、保存 payload、展示摘要。
   - Wails/后端测试覆盖 `proxyUrl` DTO 往返。
   - 浏览器 preview 或 Wails 桌面验证详情弹窗交互。

## 非目标
1. 不重做代理池页面的信息架构。
2. 不在账号详情弹窗里维护代理订阅、批量导入或代理测速。
3. 不在本期实现 auth-file/OAuth 账号的代理配置，除非确认 sidecar 已有可安全写入的 auth-file `proxy-url` 管理入口。
4. 不新增 sidecar 原生路由策略；本期只写账号级 `proxy-url`。
5. 不改变现有请求顺序、禁用账号、限流规则的语义。
6. 不把代理池节点对象直接嵌入账号配置，账号最终只保存生效 `proxyUrl` 或空值。

## 验收标准
### 场景 1：Codex API Key 继承代理
Given 用户打开某个 `codex-api-key:*` 账号详情
When 在“出口 / 代理”区域选择 `继承` 并保存
Then 该账号配置不写显式 `proxyUrl`
And 后续请求按全局代理或默认 sidecar 行为处理。

### 场景 2：Codex API Key 强制直连
Given 用户打开某个 `codex-api-key:*` 账号详情
When 在“出口 / 代理”区域选择 `直连` 并保存
Then 该账号配置写入 `proxyUrl = "direct"`
And sidecar 对该账号请求绕过全局代理。

### 场景 3：Codex API Key 选择代理池节点
Given 代理池已有可用节点 `socks5://127.0.0.1:7890`
When 用户在账号详情里选择该代理并保存
Then 该账号配置写入 `proxyUrl = "socks5://127.0.0.1:7890"`
And 重新打开详情弹窗仍显示同一出口。

### 场景 4：OpenAI-Compatible Provider 最小闭环
Given 用户打开 `openai-compatible:<name>` 详情
When provider 至少有一个 API key entry
Then 出口/代理区域能展示并编辑主 key entry 的 `proxyUrl`
And 保存后不丢失 provider 的模型、headers、prefix 等现有配置。

### 场景 5：没有代理节点时的可用状态
Given 代理池没有节点
When 用户打开账号详情并选择 `选择代理`
Then UI 应提示先去代理池维护节点
And 不允许保存空的 custom 代理。

### 场景 6：不可支持账号的透明提示
Given 账号类型暂不支持账号级代理配置
When 用户打开详情弹窗
Then “出口 / 代理”区域应展示只读原因，而不是隐藏整个能力。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260518-account-detail-proxy-route`
- worktree：`../GetTokens-worktrees/20260518-account-detail-proxy-route/`

## 相关链接
- 历史代理调研：[20260429 Network Proxy](../20260429-network-proxy/README.md)
- 请求编排历史稿：[20260502 Request Orchestration Menu](../20260502-request-orchestration-menu/README.md)
- 技术评估：[Account Detail Proxy Route Technical Evaluation v01](plans/20260518-account-detail-proxy-route-technical-evaluation-v01.md)
- 实施计划：[Account Detail Proxy Route Plan v01](plans/20260518-account-detail-proxy-route-plan-v01.md)
- 代理字段边界：`internal/cliproxyapi/types.go`
- 账号详情入口：`frontend/src/features/accounts/components/UnifiedAccountDetailModal.tsx`
- 代理池模型：`frontend/src/features/proxy-pool/model.ts`

## 实施结果

1. 已新增复用组件 `frontend/src/features/accounts/components/AccountProxyRouteSection.tsx`，统一承载 `继承 / 直连 / 选择代理` 控件。
2. `codex-api-key` 详情已通过 `ApiKeyConfigDraft.proxyUrl` 保存到 `UpdateCodexAPIKeyConfig.proxyUrl`，并同步到 sidecar `proxy-url`。
3. `openai-compatible:*` 账号卡片会进入专用 provider 详情弹窗，主 key entry 的 `proxyUrl` 可在同一“出口 / 代理”区域编辑保存。
4. `auth-file` 详情展示只读原因，不在本期写入账号级代理配置。
5. 前后端 DTO 已补齐 `AccountRecord.proxyUrl`、`OpenAICompatibleProvider.proxyUrl` 与对应 update input。
6. 代理池节点仍只作为 URL 来源，账号配置不保存节点对象或节点 ID。

## 验证记录

1. `node --test frontend/src/features/accounts/tests/accountProxyRoute.test.mjs`
2. `npm --prefix frontend run test:unit`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build`
5. `go test ./internal/accounts ./internal/wailsapp`
6. `go test ./...`
7. 浏览器预览 `http://127.0.0.1:5174/?preview=accounts#frame=accounts`：
   - `codex-api-key:stable-001` 详情展示 `出口 / 代理`、`直连`。
   - `openai-compatible:deepseek` 详情展示 `出口 / 代理`、当前自定义代理 URL。
   - 控制台无新增 error/warning。
8. Proxyman 本地代理读数：
   - `proxyman-cli proxy-host` 返回 `192.168.206.132:9090`。
   - `proxyman-cli clear-session` 后执行 `curl -x http://192.168.206.132:9090 -I http://example.com` 返回 `HTTP/1.1 200 OK`。
   - `proxyman-cli export-log --format har --output docs-linhay/spaces/20260518-account-detail-proxy-route/proxyman/20260518-proxyman-curl-example-after-v01.har` 导出的 HAR 含 `HEAD http://example.com/`，状态 `200`。

## 截图

1. `screenshots/20260518/accounts/20260518-accounts-api-key-proxy-route-after-v01.png`
2. `screenshots/20260518/accounts/20260518-accounts-openai-compatible-proxy-route-after-v01.png`

## Proxyman 证据

1. `proxyman/20260518-proxyman-curl-example-after-v01.har`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-18
