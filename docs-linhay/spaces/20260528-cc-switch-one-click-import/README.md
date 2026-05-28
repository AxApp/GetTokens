# cc-switch 一键导入功能调研

## 背景

GetTokens 已有账号池、Codex / Claude 配置写回和 CLIProxyAPI 管理能力，但“从外部站点或文档一键带入供应商配置”的入口还没有形成明确方案。

cc-switch v3.15.0 提供 `ccswitch://` 深度链接协议，用于一键导入 provider、MCP、prompt、skill。本 space 用于调研其协议、实现链路、安全边界，并评估 GetTokens 是否需要复用类似能力。

## 目标

1. 梳理 cc-switch 一键导入的用户入口、URL 协议、后端解析、前端确认与实际写入流程。
2. 明确 provider 导入字段如何映射到 Claude / Codex / Gemini / OpenCode / OpenClaw / Hermes。
3. 识别可借鉴点、不可直接照搬点，以及 GetTokens 后续设计的最小可行边界。
4. 给出后续是否进入产品方案和技术设计的判断依据。
5. 设计 GetTokens deep link 直接导入账号和 Codex 本地配置的协议、确认流、服务边界与验收标准。

## 范围

1. 深度链接协议：`ccswitch://v1/import?resource=...`
2. provider 一键导入：endpoint、apiKey、homepage、model、icon、notes、usage script、inline config。
3. MCP / prompt / skill 的统一导入入口，只做横向对比，不深入实现细节。
4. 安全与确认：敏感信息展示、导入前确认、格式校验、协议注册。
5. 与 GetTokens 账号导入、Provider 创建、CLIProxyAPI Management API 的关系。

## 非目标

1. 本期不实现 GetTokens 的一键导入功能。
2. 不做 cc-switch 完整功能复刻。
3. 不调研代理热切换、failover、usage 查询模板以外的独立产品能力。
4. 不创建 feature worktree；本期只做调研文档。

## 验收标准

### 场景 1：完成 space 初始化

Given 用户要求新开 space 调研 cc-switch 一键导入
When 调研启动
Then 创建 `docs-linhay/spaces/20260528-cc-switch-one-click-import/`
And 包含 `README.md`、`plans/`、`screenshots/`、`debate/`

### 场景 2：协议与实现链路清晰

Given 维护者阅读本 space
When 查看调研文档
Then 能知道 cc-switch 的一键导入协议格式、支持资源类型、核心参数和调用链路
And 能定位到对应源码与用户手册出处

### 场景 3：GetTokens 借鉴边界明确

Given 后续需要设计 GetTokens 一键导入
When 复用本调研
Then 能区分“可直接借鉴的协议/确认/解析模式”和“需要按 GetTokens 账号池/CLIProxyAPI 重设的部分”
And 能看到最小可行实现建议与主要风险

### 场景 4：GetTokens deep link 设计完整

Given 维护者准备实现 GetTokens deep link
When 阅读本 space 的设计文档
Then 能看到账号导入、Codex 配置导入、组合导入三种能力的协议草案
And 能明确每种导入最终调用的现有服务层入口
And 能明确哪些字段只允许确认预览、哪些字段允许写入

## 设计稿入口

- 本期设计稿：[deep-link-import-modal-design.html](./deep-link-import-modal-design.html)
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260528-cc-switch-one-click-import`
- worktree：`../GetTokens-worktrees/20260528-cc-switch-one-click-import/`

## 相关链接

- 调研文档：`plans/20260528-cc-switch-one-click-import-research.md`
- GetTokens 设计文档：`plans/20260528-gettokens-deeplink-account-codex-config-design.md`
- 本地参考项目：`docs-linhay/references/cc-switch/`
- cc-switch 深度链接用户手册：`docs-linhay/references/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md`
- cc-switch 解析实现：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/parser.rs`
- cc-switch provider 导入实现：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs`

## 当前状态
- 状态：backend-and-desktop-entry-implemented
- 最近更新：2026-05-28

## 实施记录

- 2026-05-28：前端先落 thin adapter 边界，新增 `DeepLinkCodexApplyAdapter`，复用 `AccountLocalCliApplyConfirm` 作为 deep link Codex 配置确认页。
- 2026-05-28：`AccountLocalCliApplyConfirm` 增加可选 `deepLinkContext` 和 `onImportAccountOnly`，只补外部来源、resource、providerScope、providerRewriteMode、账号草稿摘要和“只导入账号”动作。
- 2026-05-28：后端新增 `gettokens://v1/import` parser / preview / apply，支持 `resource=account`、`resource=codex-config`、`resource=codex-setup`，拒绝 `configUrl`、`usageScript`、headers 和非 `channel=codex`。
- 2026-05-28：Codex config preview / apply 编译为既有 `RelayLocalApplyInput`，继续走 `ApplyRelayServiceConfigToLocalV2`；当用户已有显式 `model_provider` 时沿用当前激活 provider，只 patch 当前 provider section，没有显式值时才创建 deep link 的 provider。
- 2026-05-28：桌面入口已在 `wails.json` 注册 `gettokens` URL scheme，并通过 Wails `SingleInstanceLock` 把初始启动和二次启动参数中的 deep link 转发到前端 `deeplink:import` 事件；前端消费后复用“应用模板到 Codex”确认页。
- 2026-05-28：Codex config patch 改为统一 presence 语义：`auth.json` 和 `config.toml` 的每个受控字段只有在 query、`codexConfig` 或 `documents[]` 中显式出现时才覆盖；字段缺失时保留用户现有值。手动“应用模板到 Codex”继续把表单值作为显式字段写入。
- 2026-05-28：验证通过：`go test ./internal/wailsapp -run 'TestPreviewDeepLinkImport|TestApplyRelayServiceConfigToLocalV2' -count=1`、`go test ./...`、`node --test frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs`、`node --test frontend/src/features/status/tests/relayLocalState.test.mjs`、`npm --prefix frontend run typecheck`、`./scripts/wails-cli.sh build`。
