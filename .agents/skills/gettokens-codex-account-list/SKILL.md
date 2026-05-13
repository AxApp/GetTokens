---
name: gettokens-codex-account-list
description: GetTokens Codex 账号列表：账号请求顺序、路由探测、模型映射、OAuth 透传语义、openai-compatible 映射保存与浏览器预览。
---

# GetTokens Codex Account List

当任务涉及 `frontend/src/features/codex/CodexAccountListFeature.tsx`、Codex 账号请求顺序、路由探测、模型映射、OAuth/auth-file 映射、openai-compatible provider 映射，或后端 `ProbeCodexAccountRouting` / OAuth model alias 时使用本 skill。

## 1. 业务边界
- Codex 账号列表是请求调试与账号顺序工作台，不是账号创建页。
- 账号来源统一展示，但语义保持分离：
  - `auth-file` / OAuth Codex
  - `codex-api-key`
  - `openai-compatible`
- 禁用账号保留在排序中，但不参与运行时请求候选。
- 请求测试顺序只来自当前可请求账号的拖拽顺序，从上到下执行。
- 不再维护第二套独立策略顺序；允许/排除只过滤候选，不重排候选。

## 2. 前端结构
- `CodexAccountListFeature.tsx` 保持为 controller：
  - Wails/browser 数据加载
  - 顺序保存
  - 路由探测调度
  - modal 打开/关闭与 hash 同步
  - 模型映射保存编排
- UI 组件放在 `frontend/src/features/codex/components/`：
  - `CodexRouteProbeCard.tsx`
  - `CodexAccountOrderRow.tsx`
  - `CodexAccountDetailModal.tsx`
  - `ModelCombobox.tsx`
  - `codexAccountPresentation.ts`
- 纯模型逻辑放在 `frontend/src/features/codex/model/`：
  - `codexAccountList.ts`：账号合并、排序、优先级更新
  - `codexModelMappings.ts`：OAuth/openai-compatible 模型映射归一
  - `codexRoutePolicy.ts`：候选过滤、探测日志、路由状态
- 不新增 catch-all helper 文件；按账号、映射、路由策略拆分。

## 3. 模型映射语义
- openai-compatible 映射方向固定为：真实模型 `models[].name` -> Codex 模型 `models[].alias || name`。
- openai-compatible 保存时按 `name + alias` 去重，允许同一个真实模型映射到多个 Codex alias。
- OAuth/auth-file 默认原样穿透模型名，不展示同名 `model -> model` 映射。
- OAuth/auth-file 只有配置显式 alias 后才关闭默认透传；保存空映射应删除 channel alias。
- OAuth 映射按 provider/channel 生效，同一 `codex` channel 共享映射。
- 模型选择使用项目自定义 combobox，不回退到原生 `datalist`。

## 4. 路由探测语义
- `ProbeCodexAccountRouting` 使用页面传入的候选约束发起最小 relay 请求。
- 前端传给后端的 `orderAccountIDs` 必须是当前拖拽排序后的可请求账号 ID 列表。
- `allowAccountIDs` 表示首选候选；`denyAccountIDs` 表示排除候选；`allowFallback` 只在设置允许账号后决定是否继续尝试其他未排除账号。
- 探测结果需要同时展示：
  - 终端式流输出
  - 当前候选顺序
  - 最新命中账号
  - 对应账号行高亮
- 连续测试应逐次追加结果，避免等待全部完成后才刷新 UI。

## 5. 浏览器预览
- `#frame=codex&workspace=account-list` 必须可在普通浏览器预览。
- 缺少 `window.go.main.App` 时使用 `previewData.ts`，不能让页面空白。
- 浏览器预览中的排序、启停、模型映射保存是本地状态更新，并需要给出 preview-only 提示。
- 视觉或交互调整要优先用浏览器预览快速验证；涉及真实 sidecar、Wails 绑定或账号命中时，再用桌面环境补验。

## 6. UI 规则
- 保持 Swiss-industrial 风格：硬边框、黑白灰、紧凑高密度、monospace 辅助信息。
- 账号行固定为单一请求顺序列表，不再额外渲染重复策略账号列表。
- 账号行主体点击打开详情；嵌套按钮、switch、combobox、策略控件必须阻止冒泡。
- 策略控件常驻行内：默认 / 允许 / 排除。
- 路由探测卡片独立于账号顺序卡片；测试流常驻显示，不使用卡中卡文本模块。

## 7. 后端 / Wails 边界
- 新增 Wails-facing 方法时必须同时检查：
  - `internal/wailsapp`
  - root `app.go`
  - root DTO / mapper
  - `frontend/wailsjs`
- 账号 row id 到 sidecar auth id 的转换必须覆盖：
  - `auth-file:<name>`
  - `codex-api-key:<id>`
  - `openai-compatible:<name>`
- 路由探测用的 loopback header 是调试口子；不要把它和持久化账号配置混在一起。

## 8. 验证
- 前端结构或 UI 调整：
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`
  - 浏览器打开 `#frame=codex&workspace=account-list` 检查账号行、探测卡、详情 modal 和 combobox。
- 后端、Wails 或 sidecar 探测调整：
  - `go test ./internal/wailsapp -run 'TestListOAuthModelAliases|TestUpdateOAuthModelAliases|TestProbeCodexAccountRouting|TestDetectCodexRoutingProbeHit|TestSidecarRelayRequest'`
  - 涉及公共 DTO 或绑定时重新生成 `frontend/wailsjs` 并跑类型检查。
- 视觉截图放到 `docs-linhay/spaces/20260511-codex-account-list-tab/screenshots/<YYYYMMDD>/codex/`。

## 9. 文档
- 需求、验收与截图写入 `docs-linhay/spaces/20260511-codex-account-list-tab/README.md`。
- 技术拆分、沉淀结论写入 `docs-linhay/dev/`。
- 稳定决策和用户偏好写入 `docs-linhay/memory/YYYY-MM-DD.md`。
- 文档或记忆写回后运行 `qmd update` 与 `qmd embed`。
