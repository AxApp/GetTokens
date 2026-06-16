# Account Codex Local Apply Settings

## 背景
账号池中点击账号卡的“应用模板到 Codex”会打开 `FILE PREVIEW CONFIRM` 弹窗。当前弹窗只展示 `auth.json` / `config.toml` diff，缺少参考运行态中已有的 Codex 本地配置项：

- `Provider`
- `Reasoning Effort`
- `Auth Strategy`
- 本地 auth 状态
- `Model` 名称
- `Wire API`
- `supports_websockets`
- `sync_model_catalog`

用户反馈：“为什么这界面没有配置这些参考的地方，这个是运行状态中有的”，并要求开 space 补全这些设置。

## 目标
补齐账号池 Codex 应用确认弹窗里的 Codex 配置编辑面板，让它能在确认写入前调整运行态已有的关键本地 Codex 配置，并确保最终写入 `ApplyRelayServiceConfigToLocalV2` 的参数与预览 diff 一致。

## 范围
- 账号池入口：`frontend/src/features/accounts/AccountsFeature.tsx`
- 账号池本地 CLI 模板解析：`frontend/src/features/accounts/model/accountLocalCliMapping.ts`
- 确认弹窗：`frontend/src/features/accounts/components/AccountLocalCliApplyConfirm.tsx`
- 相关前端单测：`frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs`
- 必要文档与 memory 写回

## 非目标
- 不重构 Status 页本地 Codex 应用面板。
- 不改变 sidecar route engine、账号选择、模型目录聚合算法。
- 不实现全量 provider catalog 管理器；本期只补齐当前账号应用弹窗需要的编辑能力。
- 不触碰正式版 `/Applications/GetTokens.app` 或正式版配置。

## 验收标准
- 账号池 Codex 应用弹窗出现 Codex 配置区，至少覆盖 provider、reasoning effort、auth strategy、local auth 状态、model、wire API、`supports_websockets`、`sync_model_catalog`。
- 用户修改上述可编辑项后，文件 diff 实时更新。
- 点击“确认并应用”时，写入参数使用用户当前选择，而不是硬编码默认值。
- `sync_model_catalog` 打开时传入 `modelCatalogProjectionMode=gettokens`，关闭时传入 `off`。
- API key / OAuth 两类 Codex 草稿继续保留既有 auth 写入语义。
- `wire_api` 保持 `responses` 只读展示，不误导用户认为可切换协议。
- 单测覆盖 Codex 配置区存在、关键字段可编辑入口、`modelCatalogProjectionMode` 写入链路。
- 文档校验通过。

## 证据门禁

| 问题来源 | 当前代码 / UI 事实位置 | 当前现象 | 预期验收方式 | 可证伪条件 |
|---|---|---|---|---|
| 用户截图和 appshot：账号池弹窗缺少参考运行态配置项 | `AccountLocalCliApplyConfirm.tsx` 只在 `draft.target === 'claude'` 时渲染配置区；Codex 分支只渲染文件列表和 diff | Codex 的 provider / reasoning / model / websocket 等只进入 diff，不可编辑 | 单测断言 Codex 配置区和字段存在；浏览器/DOM 或源码测试验证交互入口 | 若弹窗已有 Codex 配置区且字段可编辑，则本问题不成立 |
| 运行态已有完整配置入口 | `StatusPanels.tsx` 已有 provider、reasoning、auth strategy、model、wire API、supports_websockets、sync_model_catalog | Status 页能配置，账号池入口不能配置，造成入口能力不一致 | 账号池弹窗补齐等价关键字段，不搬运无关 Status 页逻辑 | 若这些字段不属于账号池应用流程，则只展示跳转提示而不补控件 |
| 写入链路支持字段 | `ApplyRelayServiceConfigToLocalV2` DTO 支持 reasoning/provider/wire/websocket/modelCatalogProjectionMode | 账号池调用没有传 `modelCatalogProjectionMode`，并把 reasoning/websocket 初始化为固定值 | 单测断言账号池调用传入 projection mode；diff 与 apply 参数一致 | 若后端 DTO 不支持，则需先补 Wails DTO；当前已支持 |

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-account-codex-local-apply-settings`
- worktree：`../GetTokens-worktrees/20260616-account-codex-local-apply-settings/`

## 相关链接
- 参考运行态入口：Status 页本地 Codex 应用面板
- 相关文档：`docs-linhay/dev/20260602-codex-model-catalog-projection-plan.md`
- 相关文档：`docs-linhay/dev/20260426-relay-service-config-boundary.md`

## 当前状态
- 状态：verified
- 最近更新：2026-06-16

## 实施记录

### 2026-06-16

- 已在账号池 `应用模板到 Codex` 确认弹窗左侧补齐 Codex 配置区：
  - `Provider`
  - `Model 名称`
  - `Reasoning Effort`
  - `Auth Strategy`
  - `本地 auth 状态`
  - `Wire API`
  - `supports_websockets`
  - `sync_model_catalog`
- `sync_model_catalog` 已接入 `AccountCliApplyDraft.codex.modelCatalogProjectionMode`；确认应用时会传给 `ApplyRelayServiceConfigToLocalV2`，由后端负责写入或移除 GetTokens-owned `model_catalog_json` pointer。
- 右侧 `config.toml` diff 会额外展示 `model_catalog_json` 的写入/移除提示，避免开关成为不可见参数。
- 账号池初始化弹窗时会读取 `GetAppRuntimeSettings().codexModelCatalogSyncEnabled`，让开关跟随当前用户期望状态。

## 验证记录

- `npm --prefix frontend run test:unit -- src/features/accounts/tests/accountLocalCliMapping.test.mjs`：通过。该脚本当前会跑完整前端 unit suite，结果 `837 pass / 0 fail`。
- `npm --prefix frontend run typecheck`：通过。
