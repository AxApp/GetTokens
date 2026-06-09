# OAuth Model Probe Plan v01

## 结论

推荐方案：为 OAuth/auth-file 账号详情提供“指定账号 Codex relay probe”，优先复用现有 `ProbeCodexAccountRouting` 的 relay 请求和 route header 能力，但前端必须传入当前账号的统一 account id，并关闭 fallback。

不推荐方案：复用 `VerifyOpenAICompatibleProvider`。它需要 API key 和 base URL，会把 OAuth/auth-file 的安全边界打散，也无法证明真实 Codex relay 会命中该 OAuth 账号。

新增约束：legacy/local-only auth-file 业务全部从本路径移除。账号池和模型测试只接受 SQLite account-store 的 unified `acct_...` 账号，不保留 `ListAuthFiles` 派生账号、`auth-file:<name>` 探测 fallback 或迁移提示式兼容。

实施结果：2026-06-09 已按该方案落地。未新增 wrapper binding，直接复用 `ProbeCodexAccountRouting`；前端 accounts 详情页与 Codex account-list 详情页共用 `OAuthModelProbeSection`，并在调用端校验返回 attempt 必须命中当前账号。

## 方案边界

构建内容：
1. OAuth/auth-file 详情页的模型测试入口。
2. 指定账号 probe 的状态模型和 UI。
3. 单账号 allow 约束、fallback=false、命中账号校验。
4. 账号池 legacy `ListAuthFiles` 派生业务删除。
5. focused 回归测试和浏览器/DOM 验收。

不构建内容：
1. OAuth token 前端化。
2. 自动批量模型测试。
3. 新的 OAuth alias 语义。
4. 移动端布局和截图。
5. legacy/local-only auth-file 兼容层。

## 技术方案

### Phase 1：账号池 legacy auth-file 数据路径删除

目标：账号池只使用 account-store unified records，不再把本地 auth-file 文件扫描结果作为业务账号。

执行项：
1. 在 `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 移除 `ListAuthFiles` import、`authFiles` state、`derivedAuthFileRecords` fallback 和 `mapAuthFileToRecord` 派生路径。
2. `loadAccounts` 只调用 `ListAccounts`；`authFileRecords` 由 `mapBackendAccountRecord(account).credentialSource === 'auth-file'` 得到。
3. 移除或收窄 `removeDeletedAuthFile`、`resolveLoadedAuthFileRecords`、`mapAuthFileToRecord` 在账号池主数据流中的使用；如果这些 helper 只剩导入/测试用途，迁到对应导入模型或删除。
4. `patchAccountDisabledChangeLocally`、`patchAccountLocally`、runtime sync、selection filter 全部基于 unified `acct_...` records 更新。
5. Preview data 的 OAuth 账号也调整成 unified account-store 形态，避免测试继续依赖 `auth-file:<name>`。

建议测试：
1. 更新 `frontend/src/features/accounts/tests/accountPresentation.test.mjs`，删除 “ListAccounts auth-file unavailable fallback” 这类 legacy 预期，新增 “auth-file records come from mapped account-store records only”。
2. 更新 `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`，断言账号详情不再依赖 `ListAuthFiles` 主路径。
3. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`

可独立交付状态：账号池不再展示 `ListAuthFiles` 派生的 legacy/local-only OAuth 账号，只展示 account-store unified OAuth 账号。

完成状态：done。`useAccountsPageState.ts` 不再 import/call `ListAuthFiles`，preview OAuth 账号也改为 unified `acct_preview_*` ID。

### Phase 2：后端与领域约束

目标：确保“测试当前 OAuth 账号”在后端语义上可证明。

执行项：
1. 复核 `ProbeCodexAccountRoutingInput.AllowAccountIDs` 对 auth-file 的 route id 映射，覆盖 unified `acct_...` id 到 auth-file source file name 的转换。
2. 若现有 `ProbeCodexAccountRouting` 已足够，新增 focused test 覆盖 `AllowAccountIDs=[authFileAccountID]` 时生成 `X-GetTokens-Route-Allow=<source-file-name>` 且 `X-GetTokens-Route-Fallback=false`。
3. 若现有 API 的返回不方便 UI 判定“命中是否为当前账号”，新增轻量 helper 或 wrapper，例如 `ProbeCodexAccountModel(input { accountID, model })`，内部仍复用 `ProbeCodexAccountRouting`。
4. 结果判定必须同时看请求成功和命中账号：HTTP 2xx 但未命中当前账号不能显示为当前账号测试成功。
5. 不支持非 `acct_...` account id；如果调用方传入 legacy id，前端应根本不渲染测试入口，后端测试不为 legacy id 建兼容。

建议测试：
1. `go test ./internal/wailsapp -run 'TestProbeCodexAccountRouting.*Allow|TestProbeCodexAccountRouting.*AuthFile|TestProbeCodexAccountRoutingRequiresModel'`
2. 如果新增 root binding，补 root `app.go/app_types.go` mapper 测试或至少重新生成 `frontend/wailsjs` 后跑 typecheck。

可独立交付状态：后端能用 unified account id 约束发起 OAuth/auth-file probe，并用测试证明不会 fallback 到其他账号。

完成状态：done。新增 `TestProbeCodexAccountRoutingSendsAuthFileAllowHeaderFromUnifiedAccountID` 覆盖 `acct_auth -> codex-plus-nightly.json` route allow header 与 fallback=false。

### Phase 3：账号池详情页 UI

目标：`#frame=accounts&detail=<oauth-auth-file>` 能看到并使用模型测试。

执行项：
1. 在 `UnifiedAccountDetailModal` 为 `credentialSource === 'auth-file'` 增加 OAuth 模型探测模块，避免塞进 API Key 凭据模块。
2. 模型候选优先使用已有 auth-file models、OAuth alias 映射和本地 Codex model catalog；没有候选时允许手输。
3. 点击测试时使用当前 selected account-store record 的 `id`，不要使用 hash detail 文件名。
4. 只有 `id` 以 `acct_` 开头、`credentialSource === 'auth-file'` 且账号 requestable/ready 时渲染可操作测试入口。
5. UI 状态至少覆盖 idle/loading/success/error/disabled/unready。
6. preview 模式提供 mock 状态，不调用 Wails binding，但 mock id 也必须是 `acct_...`。

建议测试：
1. `node --test frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
2. 新增或扩展账号详情测试，断言 auth-file detail 出现 OAuth probe 模块，API key detail 仍保留原 VerifyConnectionPanel。
3. `npm --prefix frontend run typecheck`

可独立交付状态：账号池 OAuth 详情页能展示入口，调用指定账号 probe，并正确显示结果。

完成状态：done。`UnifiedAccountDetailModal` 的 auth-file module plan 新增 `model-probe`，只对 unified `acct_...` OAuth 账号启用真实 probe。

### Phase 4：Codex Channel Routing 详情页对齐

目标：Codex 请求顺序页的 `codex-auth-file` 详情和总账号池一致。

执行项：
1. 在 `CodexAccountDetailModal` 的 `codex-auth-file` 分支增加相同的单账号 probe 入口，只对 unified `acct_...` row 启用。
2. 与现有 route probe modal 区分：route probe 是工作台级候选队列探测；详情 probe 是单账号模型测试。
3. 单账号 probe 成功后可复用现有 latest probe hit 高亮，但不得改变渠道排序或 requestability 手动确认。

建议测试：
1. `node --test frontend/src/features/codex/codexAccountList.test.mjs`
2. `npm --prefix frontend run typecheck`

可独立交付状态：Codex 详情页能单独验证 OAuth 账号，且不影响全局 route probe。

完成状态：done。`CodexAccountDetailModal` 的 `codex-auth-file` 分支新增同款单账号模型测试，不修改排序或全局 route probe 状态。

## UI 文案建议

模块名：`模型测试`

辅助说明：`通过 Codex relay 发起一次最小请求，并限制只允许当前 OAuth 账号参与；可能消耗少量额度。`

按钮：
1. `测试模型`
2. loading：`测试中...`
3. success：`命中当前账号`
4. error：`测试失败`

## 验收命令

最小验收：
1. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
2. `go test ./internal/wailsapp -run 'TestProbeCodexAccountRouting'`
3. `node --test frontend/src/features/codex/codexAccountList.test.mjs`
4. `npm --prefix frontend run typecheck`

原计划命令保留为扩展验收组合：
1. `go test ./internal/wailsapp -run 'TestProbeCodexAccountRouting'`
2. `node --test frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
3. `npm --prefix frontend run typecheck`

扩展验收：
1. `npm --prefix frontend run test:unit`
2. `npm --prefix frontend run build`
3. 浏览器打开 `http://localhost:5173/#frame=accounts&detail=<acct_...>`，确认 OAuth 详情页出现模型测试入口；旧 `detail=codex-plus-nightly.json` 可作为深链别名解析到同名 unified OAuth account，但 UI 和 probe 必须使用 `acct_...`。
4. 浏览器打开 `http://localhost:5173/#frame=codex&workspace=account-list`，确认 `codex-auth-file` 详情页同样有单账号模型测试入口。

截图归档：
1. `docs-linhay/spaces/20260609-oauth-model-probe/screenshots/20260609/accounts/20260609-accounts-oauth-model-probe-after-v01.png`
2. `docs-linhay/spaces/20260609-oauth-model-probe/screenshots/20260609/codex/20260609-codex-oauth-model-probe-after-v01.png`

## 风险与回滚

风险：
1. 现有 route header 只做候选过滤，但某些 sidecar 路径未严格拒绝 fallback。必须用后端测试先证明。
2. usage delta 可能无法识别命中账号。此时 UI 不能只凭 HTTP 2xx 显示当前账号成功。
3. 模型测试会消耗少量额度，文案必须明确。

回滚：
1. UI 入口可独立移除，不影响现有模型映射。
2. 如果新增 wrapper binding，可保留后端但隐藏前端入口；现有 `ProbeCodexAccountRouting` 不需要回滚。
3. 不涉及数据迁移，回滚不需要改账号 store。

## 待实现前确认

默认按以上三阶段执行。若实现时发现 sidecar 不支持严格单账号 allow/fallback=false，应暂停 UI 开发，先把 route guard 能力补齐并更新本计划。
