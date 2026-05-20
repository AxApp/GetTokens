# 账号模板映射本地 CLI 配置实施报告

日期：2026-05-20

## 已实现

1. 账号卡右上角菜单支持本地 CLI 应用动作。
   - `AccountCard` 新增 `localCliActions` 禁用态和禁用原因。
   - `AccountGroupSection` 从账号页 controller 接收 resolver 输出，不在卡片内写映射逻辑。
2. 新增纯模型 resolver：`frontend/src/features/accounts/model/accountLocalCliMapping.ts`。
   - 未命中官方/已验证模板不生成动作。
   - DeepSeek P0 只生成 Claude Code 动作。
   - OpenAI API Key 固定生成 Codex API Key 写入草稿。
   - OpenAI OAuth / auth-file 固定生成 Codex preserve ChatGPT auth 草稿。
   - Codex 默认读取并沿用当前 root `model_provider`，不固定 `gettokens`。
3. 新增确认页组件：`frontend/src/features/accounts/components/AccountLocalCliApplyConfirm.tsx`。
   - 文件预览器布局：左侧文件列表，右侧选中文件 diff。
   - 顶部展示来源账号、模板、固定应用模式和当前 Codex provider。
   - preview/browser 环境只返回 `PREVIEW ONLY`，不调用 Wails 写入。
4. 账号页接入真实 local apply。
   - 加载 `GetRelayServiceConfig`、`GetLocalCodexAuthState`、`GetLocalCodexModelProviderStateView`。
   - 确认 Codex 后调用 `ApplyRelayServiceConfigToLocalV2`。
   - 确认 Claude Code 后调用 `ApplyClaudeCodeAPIKeyConfigToLocal`。
   - preserve 模式遇到内置 `openai` 或缺失 ChatGPT auth 时在确认页阻塞。
5. Wails provider state 已补齐。
   - 后端读取 `CODEX_HOME/config.toml` root `model_provider`。
   - 缺失 root provider 时按 Codex 默认语义展示 builtin `openai`。
   - root provider section 缺失时可表达 `CurrentProviderExists=false`。
6. 设计系统 manifest 已收录新增确认页组件。

## 关键文件

- `frontend/src/features/accounts/model/accountLocalCliMapping.ts`
- `frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs`
- `frontend/src/features/accounts/components/AccountLocalCliApplyConfirm.tsx`
- `frontend/src/features/accounts/AccountsFeature.tsx`
- `frontend/src/features/accounts/components/AccountCard.tsx`
- `frontend/src/features/accounts/components/AccountGroupSection.tsx`
- `frontend/src/features/status/model/relayLocalState.ts`
- `internal/wailsapp/local_codex_providers.go`
- `internal/wailsapp/local_codex_providers_test.go`

## 验证结果

自动化：

1. `node --test frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs` 通过。
2. `node --test frontend/src/features/status/tests/relayLocalState.test.mjs frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs` 通过。
3. `npm --prefix frontend run typecheck` 通过。
4. `npm --prefix frontend run test:unit` 通过，362 个测试全部通过。
5. `npm --prefix frontend run build-storybook` 通过。
6. `npm --prefix frontend run build` 通过。
7. `go test ./internal/wailsapp -run 'Test.*LocalCodex.*|TestApplyRelayServiceConfigToLocalV2|TestApplyClaudeCodeAPIKeyConfigToLocal'` 通过。
8. `docs-linhay/scripts/check-docs.sh` 通过。

浏览器验收：

1. Storybook 静态页 `Account Template Apply Menu`：
   - DeepSeek 菜单只展示 `应用到 Claude Code`。
   - OpenAI API Key 确认页展示 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml`。
   - Codex diff 中 `model_provider = "team-codex-relay"` 作为当前 provider 上下文展示，不再作为新增 root key。
   - 390px 视口无页面级横向溢出。
2. 应用静态 preview `#frame=accounts`：
   - DeepSeek 账号菜单只展示 Claude Code 动作。
   - 确认页显示 `PREVIEW ONLY`，diff 写入 `ANTHROPIC_BASE_URL = http://127.0.0.1:8317/v1`，未展示 Codex 确认标题。
   - 390px 视口无页面级横向溢出。

截图：

- `screenshots/20260520/account-card/20260520-account-card-template-implementation-desktop-after-v01.png`
- `screenshots/20260520/account-card/20260520-account-card-template-implementation-mobile-after-v01.png`
- `screenshots/20260520/account-card/20260520-account-card-template-app-preview-mobile-after-v01.png`

## 施工中疑问 / 后续报告

1. 未做真实用户 `CODEX_HOME` / `~/.claude` 写入验收，原因是本轮避免直接改动用户本机 CLI 配置；真实写入由 Go 单测在临时目录覆盖。
2. P0 仍不做 direct upstream 模式，也不把当前账号固定为 relay 候选；如后续要做，需要另开路由策略持久化和回滚设计。
3. `vendorPresets` 还没有新增字段承载 `localCliTemplateTargets`，本轮先在 resolver 内用官方/已验证白名单表达，后续可迁移成模板显式字段。
