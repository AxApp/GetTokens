# Codex 可请求账号口径对齐

## 背景

用户在 Codex 账号列表中看到“等待检测 / 已配置”的账号时，预期这类账号不应直接进入“请求可用账号列表”。当前实现中，前端 `requestable` 与运行时 route candidate 使用了不同层级的判断：

1. 前端账号列表主要按 `status + disabled` 判断，其中 `ACTIVE / CONFIGURED / LOCAL` 会进入 `requestable=true`。
2. 运行时真实路由除 `status + disabled` 外，还会叠加 route guard、cooldown、quota-empty、model unavailable 等过滤。

这导致“显示上仍在待检测阶段”的账号，可能已经被前端 explain / preview / candidate 统计算入可请求账号，与运行时真实候选口径不一致，也会误导后续页面规则和用户判断。

同时，不能把“没有成功 usage / 成功 quota”简单等同于“不可用”：新导入但已验证成功的账号、低频账号、openai-compatible provider、quota 不支持或尚未产生用量的账号，都可能没有 usage/quota 证据但仍然应该参与请求。需要补齐一层“可路由资格证据”，让 usage/quota 只是证据之一，而不是唯一入口。

用户还需要一个手动版本：当用户明确知道某个账号可用时，可以把它标记为“手动确认可用”，该标记作为 requestability evidence，使账号进入候选；但它不能覆盖手动禁用、runtime guard 阻塞、quota-empty、cooldown、model-unavailable 等硬阻塞。

## 目标

1. 对齐 Codex 账号列表前端 `requestable` 与运行时候选语义，避免“待检测账号”进入可请求候选。
2. 明确“展示状态”和“请求资格”的边界，后续状态文案调整不再反向污染 route candidate 判定。
3. 支持“无 usage / quota 但已具备请求资格”的账号进入候选，避免过度保守导致可用账号被误排除。
4. 支持用户手动确认账号可用，并把该确认纳入候选资格证据。
5. 为 Codex account list / channel routing explain / probe 建立统一回归门禁。

## 范围

1. 梳理并统一 `frontend/src/features/codex/` 下账号行 `requestable` 口径。
2. 收敛 browser preview / explain / probe / candidate count 对候选账号的使用方式。
3. 梳理 requestability evidence：显式验证成功、用户手动确认可用、auth/runtime status、provider 配置完整度、usage/quota 成功证据、runtime guard 阻塞原因。
4. 必要时补充 Wails / sidecar DTO 或 selector 层字段，使“待检测”不再依赖文案推断。
5. 新增或更新对应单元测试、前端集成测试，以及必要的 Go 侧 explain/probe 测试。
6. 写回本次需求文档、执行计划与 memory。

## 非目标

1. 不在本轮直接重做整套 account runtime status machine。
2. 不扩展 Claude Code 账号列表，除非梳理后确认需要同步同类共享逻辑。
3. 不做视觉改版；本轮以语义、状态和验证口径收敛为主。
4. 不默认修改正式版 GetTokens 或正式版 sidecar 配置。

## 验收标准

1. “等待检测 / 待检测”账号继续显示在 Codex 请求顺序列表中，但不进入 `requestable` 候选。
2. 没有成功 usage / 成功 quota 但具备其他有效资格证据的账号，仍可进入 `requestable` 候选。
3. 用户手动确认可用的账号可以进入 `requestable` 候选，但不能绕过禁用、运行态 guard、quota-empty、cooldown、model-unavailable 等硬阻塞。
4. Codex account list 的 candidate count、Channel Routing explain、route probe preview 与真实可请求账号口径一致。
5. 若运行时缺少表达“待检测 / 已验证 / 手动确认可用 / 可路由资格”的稳定字段，本轮需补出稳定字段或统一 selector，不再依赖 UI 文案判断。
6. 至少通过以下门禁：
   - `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`
   - `npm --prefix frontend run typecheck`
   - 若改动涉及 Wails / backend explain DTO，再补对应 `go test ./internal/wailsapp -run 'Test.*Codex.*'`
7. space README、plans、memory 已写回，且 `docs-linhay/scripts/check-docs.sh` 通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`（未单独创建，本轮沿用当前主工作区）`
- worktree：`（未单独创建，本轮沿用当前主工作区）`

## 实现结果

1. 前端 Codex 账号行新增 requestability evidence：
   - `configured` 且无证据时进入 `waiting-check`，继续显示但不进入候选。
   - `active / local / ready / ok / verified / manual / usage / quota / configured-provider` 可作为请求资格证据。
   - openai-compatible provider 默认使用 `configured-provider` 证据，不因缺少 usage/quota 被误判为待检测。
2. Channel Routing config 新增 `manualRequestableAccountIDs`：
   - 用户点击 `我知道能用` 后，账号 ID 写入 Codex channel routing config。
   - 点击 `取消确认` 后，从该列表移除。
   - 该字段属于 Codex channel routing 口径，不写入账号凭证本体。
3. Go explain / route candidate 侧同步同一口径：
   - `configured` 且无证据返回 `waiting-check` filtered reason。
   - `manualRequestableAccountIDs` 与 `AccountRecord.requestability` evidence 都能放行候选。
   - runtime guard、disabled、rate-limit、cooldown、auth-error、model-unavailable 等过滤仍在 requestability 之前生效。
4. 前端 UI 补充：
   - 账号行显示 `待检测` / `手动确认` badge。
   - 账号行提供 `我知道能用` / `取消确认` 操作。
   - 详情弹窗对 `waiting-check` 显示“待检测，未进入请求候选”。
   - browser preview explain 使用 row 的真实 `blockReason`，不再把待检测泛化成 `account-unrequestable`。
5. Wails generated model 已同步：
   - `AccountRecord.requestability`
   - `AccountRequestability`
   - `ChannelRoutingConfig.manualRequestableAccountIDs`

## 验证结果

- `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`
- `npm --prefix frontend run typecheck`
- `go test ./internal/wailsapp -run 'Test.*ChannelRouting|Test.*Codex.*'`
- `go test ./internal/accounts`
- `docs-linhay/scripts/check-docs.sh`

## 相关链接

- 技能边界：[gettokens-codex-account-list](/Users/linhey/Desktop/linhay-open-sources/GetTokens/.agents/skills/gettokens-codex-account-list/SKILL.md)
- 当前前端 requestable 判定：[codexAccountList.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/codex/model/codexAccountList.ts:241)
- 当前浏览器 explain 候选构造：[CodexAccountListFeature.tsx](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/codex/CodexAccountListFeature.tsx:752)
- 相关领域文档：[20260524-account-routing-engine.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260524-account-routing-engine.md:69)
- 相关领域文档：[20260531-account-routing-quota-guard.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260531-account-routing-quota-guard.md:532)

## 当前状态
- 状态：implemented / verified
- 最近更新：2026-06-06
