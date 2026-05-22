# 账号模板本机 CLI 应用会话沉淀

日期：2026-05-21

## 本次沉淀了什么

本轮围绕“账号模板直接应用到 Codex / Claude Code 本机配置”完成了需求收敛、实现、发版和发布后验收。可复用的核心不是某个按钮或样式，而是三类稳定边界：

1. 账号模板映射本机 CLI 配置的业务边界。
2. Codex `auth.json` / `config.toml` 的模式判定与写入语义。
3. macOS release 的发布后分发验收闭环。

## 已写入项目级 skill

### `gettokens-domain-engineering`

新增 `Account Template Local CLI Apply` 小节，后续遇到账号卡、厂商模板、Codex / Claude Code 本机应用时直接复用。

稳定规则：

1. 账号卡动作只是 intent 入口，用户确认前不得写本机 CLI 文件。
2. 只有官方或已验证应用模板目标才展示 Codex / Claude Code 按钮；不能只凭 OpenAI-compatible 能力推导 Codex 按钮。
3. DeepSeek 当前按 Claude Code-only 官方模板处理，不展示 Codex 动作。
4. 映射逻辑必须在 `frontend/src/features/accounts/model/` 的纯模型里完成，不能散落到 `AccountCard`。
5. 单个账号的应用模式由账号来源固定：API key 账号走 API key，OAuth/auth-file 账号走 OAuth，不在确认页内提供模式切换。
6. Codex 默认沿用用户当前 root `model_provider`，避免改变 provider id 导致既有会话迁移。
7. 确认页使用“左文件列表 + 右 diff”的文件预览器布局，切换文件时 modal 高度保持稳定。
8. Codex API key 模式写最小 `auth.json`，OAuth 模式写 nested `tokens`，并按 Codex 源码的 `auth_mode` 优先级判断当前模式。
9. Claude Code 只 patch 受控 `env` 字段，保留 permissions、hooks、statusLine、MCP 和未知字段。
10. 账号分组列表应先渲染已有本地信息，慢速 enrichment 在内部增量更新，不等待全部账号完成后再显示。

### `gettokens-ops-governance`

补充 release 收尾规则：

1. 发布后 docs / memory commit 可以在 tag 之后进入 `master`，不要为了记录发布结果移动或重建 tag。
2. 可分发 DMG 验收需要额外确认远端 per-arch Sparkle appcast 已包含当前版本，并指向对应 release DMG。

## 不纳入 skill 的内容

1. `v1.0.14` 的具体 run id、asset id、checksum digest，只保留在 memory 和 GitHub Release 记录中。
2. 本轮具体 UI 微调位置，例如某个 span 或 div 的删除，只作为实现细节，不提升为长期规则。
3. 临时调试文案和失败提示的中间版本，不进入 skill。
4. 已解决的一次性 Storybook 截图路径，不进入 skill；截图命名规则继续按现有 space / screenshot 规范执行。

## 后续执行入口

1. 账号模板、本机 CLI 应用、Codex/Claude Code 配置写入：先用 `gettokens-domain-engineering`。
2. release / tag / GitHub Release / DMG 分发验收：先用 `gettokens-ops-governance`。
3. 用户再次说“整理”：先用 `gettokens-session-skill-distill`，再判断是否更新 skill、dev 文档、memory 或 AGENTS。

## AGENTS 判断

本次不更新 `AGENTS.md`。原因：新规则属于账号模板和 release 的具体领域执行边界，已落在现有项目级 skills；还没有形成新的 repo-wide 行为规范。

## 2026-05-22 补充沉淀

本轮修正了账号卡片 `应用到 Codex` 的 API key 模式边界：确认页和真实写入不能再使用 GetTokens relay key / relay endpoint 代替当前账号内容。稳定规则补充如下：

1. Codex API key 账号应用到 Codex 时，`AccountCliApplyDraft.codex` 必须携带当前账号资产自身的 `apiKey` 与匹配到的 source format `baseUrl`。
2. 缺少 GetTokens relay key 不应禁用 Codex API key 模式；但 Claude Code local apply 仍依赖 relay key。
3. 后端 `ApplyRelayServiceConfigToLocalV2` 接收账号池 API key 时必须避免更新 relay key metadata，防止把账号资产误记为 relay service key。
4. 旧文档中的“P0 只走 relay”需改成按目标分流：Codex API key 直写当前账号，Codex OAuth 写 auth-file，Claude Code 继续走 relay。

已同步更新 `gettokens-domain-engineering` 的 `Account Template Local CLI Apply` 小节和 `20260520-account-template-cli-mapping` space。该规则仍属于账号模板 / 本机 CLI 应用领域，不升级到 `AGENTS.md`。
