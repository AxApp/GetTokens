# OpenAI quota reset credit implementation plan v01

## 规划结论

建议实现，但必须做成 sidecar-native action。

该功能有真实外部副作用：consume 会消耗用户的 OpenAI reset credit。实现时必须先有 fake upstream 红灯测试，再接 sidecar management API，最后由 Wails 和前端透传展示。不能把它做成前端直连、用户自填 curl 或 Wails-only 临时补偿。

## 2026-06-18 实现闭环

本计划已按 sidecar-native 路径完成第一版：

- Sidecar：新增 query/consume management API，fake upstream 覆盖 Codex headers、0 credits 不消费、consume success + refreshed usage。fork commit 为 `f2910e97 feat: add openai quota reset management api`。
- Parent client/Wails：新增 `GetOpenAIQuotaResetCredit`、`ConsumeOpenAIQuotaResetCredit`，并同步 root DTO 与 generated bindings。
- Frontend：auth-file 账号详情加入 quota reset 区；“重置额度窗口”必须先查询且 availableCount > 0 才可点击；二次确认 modal 在确认后原地显示 loading、success、error。
- Sidecar rebuild：reset commit 初始产物 fingerprint 为 `f2910e9714b704ccb3b3f4cb3dc0dd517562cd61:clean:c411b48ac789834bd583cba4fcebccaa41db13fee7b0ef9a9da6c224d1c584d3:darwin:arm64`。当前本地 sidecar HEAD 还包含后续 translator commit `803ab64c`，build meta 为 `803ab64c1407d35957e032910468d40499cbb484:clean:bae625d209e5004d93648d013cfe82d6ccadeb414bb2925cb46392ed0b4e670f:darwin:arm64`，该 commit 包含本 reset 功能。

已通过的验证：

1. `cd docs-linhay/references/CLIProxyAPI && go test ./internal/api/handlers/management -run 'TestOpenAIQuotaReset|TestQuotaRefresh' -count=1`
2. `cd docs-linhay/references/CLIProxyAPI && go test ./... -count=1`
3. `go test ./internal/cliproxyapi ./internal/wailsapp -run 'TestOpenAIQuotaResetCreditClientEndpoints|TestOpenAIQuotaResetCreditBridgeUsesManagementAPI' -count=1`
4. `go test ./... -count=1`
5. `node --test frontend/src/features/accounts/tests/openAIQuotaResetDetail.test.mjs`
6. `npm --prefix frontend run typecheck`
7. `npm --prefix frontend run build`
8. `bash scripts/wails-cli.sh build`
9. `node docs-linhay/scripts/check-wails-generated-drift.mjs`
10. `git diff --check`

未执行真实 OpenAI reset consume；该动作会消耗真实 reset credit，需要用户明确授权后单独做 dev 环境验收。

## 最脆弱假设

本计划假设 chatgpt.com 的 wham/usage 和 wham/rate-limit-reset-credits/consume 仍接受 Codex Desktop header + OAuth access token + chatgpt-account-id 的调用方式。

如果该假设不成立，功能应降级为：

1. 保留 sidecar API 与 UI 入口的“不可用/需要重新验证”状态。
2. 不暴露 consume 按钮。
3. 不把失败写成 quota-empty 或 route guard 阻断。

## Phase 1：sidecar service + management API

目标：在 CLIProxyAPI gettokens sidecar 内实现 query/consume，不接 UI。

文件范围：

- docs-linhay/references/CLIProxyAPI/internal/api/server.go
- docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/
- docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/ 或等价 GetTokens hook/service 包
- docs-linhay/references/CLIProxyAPI/sdk/cliproxy/account store / auth runtime 读取路径

设计：

1. 从 account_key 解析目标账号，只允许 OpenAI OAuth / Codex auth-file 类账号。
2. 获取 access token 和 chatgpt-account-id。
3. query 调 wham/usage，解析 available_count 与窗口摘要。
4. consume 先要求 available_count 大于 0；如果调用方未提供 redeem_request_id，由 sidecar 生成 uuid-v4-like id。
5. consume 成功后调用或返回可调用现有 quota-refresh 的结果策略。推荐 sidecar 内部直接刷新一次 quota-status，失败时返回 consume 成功 + quota refresh degraded。
6. 错误映射保持稳定 code：
   - reset_account_not_found
   - reset_account_unsupported
   - reset_account_id_missing
   - reset_token_unavailable
   - reset_credit_unavailable
   - reset_upstream_unauthorized
   - reset_upstream_rate_limited
   - reset_upstream_unavailable

红灯测试：

1. query sends required Codex Desktop headers.
2. query falls back from chatgpt_account_id to organization_id.
3. consume with available_count 0 returns reset_credit_unavailable and does not call upstream consume.
4. consume success returns windows_reset and redeemed credit metadata.
5. consume success triggers quota refresh or returns refresh degraded result without hiding consume success.
6. 401/403 maps to reauth-required class.
7. 429 maps to upstream-rate-limited and does not create quota-empty block.
8. unsupported account kind is rejected.

验证命令：

- cd docs-linhay/references/CLIProxyAPI && go test ./internal/api/handlers/management ./internal/gettokenshooks -run 'OpenAIQuotaReset|QuotaReset' -count=1

## Phase 2：parent management client + Wails binding

目标：GetTokens 主仓能调用 sidecar API，但仍不接 UI。

文件范围：

- internal/cliproxyapi/client.go
- internal/cliproxyapi/types.go
- internal/cliproxyapi/client_test.go
- internal/wailsapp/quota.go 或新增 quota_reset.go
- internal/wailsapp/types.go
- app.go
- app_types.go
- frontend/wailsjs 生成产物

设计：

1. cliproxyapi client 新增 QueryOpenAIQuotaResetCredit / ConsumeOpenAIQuotaResetCredit。
2. internal/wailsapp 只做 management client 透传与 DTO 规整。
3. root main.App 暴露 Wails 方法，避免生成绑定丢失。
4. DTO 边界接受 sidecar snake_case，并输出前端一致 camelCase。

测试：

1. client_test 覆盖 GET/POST path 与 payload。
2. wailsapp test 覆盖 DTO 映射、错误透传、accountKey trim。
3. generated binding surface gate 覆盖新方法存在。

验证命令：

- go test -count=1 ./internal/cliproxyapi ./internal/wailsapp
- node docs-linhay/scripts/check-wails-binding-surface.mjs

## Phase 3：frontend account detail quota action

目标：在账号详情 quota 区提供安全交互。

文件范围：

- frontend/src/features/accounts/components/
- frontend/src/features/accounts/model/
- frontend/src/features/accounts/tests/
- frontend/wailsjs/go/main/App.d.ts
- frontend/wailsjs/go/models.ts

设计：

1. 只对支持 reset 的账号显示 reset 区；不支持时不显示危险动作。
2. reset 区位于账号详情页 quota / billing 区域，和现有“刷新额度”同一业务上下文，不新开独立页面。
3. 二次确认使用参考截图样式：居中 modal、顶部视觉区、右上关闭、标题、说明、单个主操作按钮。
4. 默认 idle 状态只显示“查询重置次数”；未查询到 availableCount 前不显示可点击 consume。
5. query 成功后显示 availableCount、fetchedAt、窗口摘要、脱敏上游账号识别。
6. availableCount 为 0 时禁用 consume，并显示“无可用重置次数”。
7. availableCount 大于 0 时显示 danger / warning 样式的“重置额度窗口”按钮。
8. 点击“重置额度窗口”必须先进入二次确认 modal 或确认对话框，不得直接发 consume 请求。
9. 二次确认文案必须明确“将消耗 1 次 OpenAI reset credit”“操作不可撤销”“成功后会刷新当前账号额度状态”。
10. 二次确认主按钮文案为“确认消耗 1 次重置”，取消按钮为“取消”。
11. 用户确认后 modal 不关闭，在同一 modal 内进入 consuming 状态，禁用关闭以外的重复提交入口。
12. consume 成功后同一 modal 切换成功态，显示 windowsReset、redeemedAt、credit status、剩余次数刷新结果和 quota refresh 是否成功。
13. consume 失败后同一 modal 切换失败态，显示稳定错误标题、可读原因和下一步动作；不能只显示 toast 或关闭 modal 后在背景页展示。
14. 失败态区分 retryable 与 reauth required：retryable 可提供“再试一次”，401/403 类 reauth required 提供“去重新登录”或“关闭”。
15. 401/403 显示“需要重新登录”，429 显示“上游限流，稍后再试”，reset_credit_unavailable 显示“无可用重置次数”；这些错误不得写成 quota-empty。

前端状态矩阵：

| 状态 | 展示与交互 |
| --- | --- |
| sidecar-not-ready | 区域显示不可用提示，全部按钮禁用。 |
| unsupported-account | 不显示 reset 区，或只显示不支持说明。 |
| idle | 显示查询按钮，隐藏/禁用 consume。 |
| querying | 查询按钮 loading，consume 禁用。 |
| available | 显示次数、查询时间、窗口摘要和重置按钮。 |
| zero-credit | 显示 0 次，重置按钮禁用。 |
| confirming | 打开二次确认，等待用户确认。 |
| consuming | 同一 modal 内显示处理中，确认按钮 loading，禁止重复提交。 |
| consumed | 同一 modal 内显示重置结果并触发 quota-status refresh。 |
| failed-retryable | 同一 modal 内显示失败原因，提供再试一次和关闭。 |
| failed-reauth | 同一 modal 内提示重新登录，提供去重新登录或关闭。 |
| degraded | 显示 sidecar degradedReason，不本地推断。 |

测试：

1. model tests 覆盖支持条件、状态归一化、错误分类。
2. component tests 覆盖按钮显示、0 credits 禁用、二次确认、取消不请求、确认后只请求一次、成功后刷新 quota。
3. component tests 覆盖确认后同一 modal 内的 consuming、success、failed-retryable、failed-reauth 状态。
4. component tests 覆盖 401/403、429、reset_credit_unavailable、sidecar-not-ready 文案。
5. preview data 增加一个有 reset credits 的 OpenAI OAuth 账号、一个 0 credits 账号、一个 consume success 状态和一个 consume failure 状态。
6. 如果实现涉及 modal hash，测试关闭时只移除当前 modal/detail 标记，不破坏账号详情 hash。
7. 截图或 DOM 验收必须证明成功/失败信息显示在同一个确认 modal 内。

验证命令：

- npm --prefix frontend run test -- accountQuotaRuntime accountDetailLayout usageDesk
- npm --prefix frontend run typecheck

## Phase 4：build / sidecar / acceptance closure

目标：证明 dev build 使用的是含 reset feature 的 sidecar。

动作：

1. 在 CLIProxyAPI fork 内提交 sidecar 改动。
2. 父仓运行 ./scripts/ensure-sidecar.sh darwin arm64。
3. 确认 build/bin/cli-proxy-api.meta.json 指向 fork commit 且 clean。
4. 若未授权真实账号，不调用真实 OpenAI reset；只用 fake upstream smoke 和 UI preview。
5. 更新本 space、reference summary、memory。

验证命令：

- cd docs-linhay/references/CLIProxyAPI && go test ./... -count=1
- ./scripts/ensure-sidecar.sh darwin arm64
- docs-linhay/scripts/check-docs.sh
- git diff --check

## Rollback

1. UI 层可隐藏入口，不影响现有 quota-refresh。
2. Wails/client 方法可保留但不调用，或随同 feature flag 回退。
3. sidecar management API 可保留为未暴露能力；如果必须移除，只删除 reset service / routes，不改 quota-status schema。
4. consume 成功后的 quota refresh 失败不能回滚外部 reset credit；因此 UI 必须把 consume 与 refresh 结果分开展示。

## 不进入本期的内容

1. 真实用户账号联调。
2. 自动后台消费 reset credit。
3. 对 openai-compatible 第三方 relay 账号提供 reset。
4. 通过 Proxyman 固定验收真实 chatgpt.com 请求。只有用户授权真实账号验证时再做。

## Handoff

实现前先确认是否进入开发。确认后按 Phase 1 开始，先写 sidecar fake upstream 红灯测试，不要先改前端。
