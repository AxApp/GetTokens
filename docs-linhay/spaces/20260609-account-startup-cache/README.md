# 账号池启动缓存首屏

## 背景

用户反馈：安装最新包后，多账号环境首次启动进入账号池会长期停在卡片骨架屏，标题显示 `已授权的凭据资产库 / 0 UNITS`。期望行为是先读取上次成功的本地缓存展示账号列表，sidecar / quota / usage 等后续刷新完成后再增量跟上。

## 目标

1. 账号池冷启动时，如果存在上次成功的账号列表快照，先同步展示缓存账号。
2. sidecar ready 后继续调用真实 `ListAccounts()`，成功后覆盖缓存并刷新 runtime 补充信息。
3. 缓存只保存首屏展示必要字段，不落 `apiKey`、`apiKeys`、`headers`、`platformCookie`、`curlVariables`、`modelFetchApiKey`、`rawAuthFile` 等敏感或大字段。

## 范围

- `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 的账号列表首屏加载链路。
- 新增账号列表本地快照缓存模型与单元测试。
- 不改 sidecar management API，不改正式版 App。

## 非目标

- 不把缓存作为账号真实状态来源；它只负责首屏兜底。
- 不在缓存阶段主动刷新上游 quota / billing。
- 不改变账号增删改的真实提交路径。

## 验收标准

1. Given localStorage 中已有账号快照，When 账号池页面首次 mount 且真实 `ListAccounts()` 尚未返回，Then 页面状态已有账号记录且不显示整页 skeleton。
2. Given sidecar ready 后 `ListAccounts()` 成功，When 返回最新账号列表，Then 前端覆盖缓存状态并写入新的本地快照。
3. Given 账号记录包含敏感字段，When 写入缓存，Then 缓存 JSON 不包含明文 API key、cookie、raw auth、headers 或管理专用 key。
4. 聚焦单元测试通过。

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | 用户截图与描述：多账号首次启动卡在账号池骨架屏，要求“先读缓存显示，更新后续跟上”。 |
| 当前代码事实 | `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 只有 `ListAccounts()` 返回后才设置 `authFileRecords/apiKeyRecords/accountsLoaded`；`frontend/src/features/accounts/model/accountSnapshot.ts` 在 `loaded=false && accountCount=0` 时显示整页 skeleton。 |
| 当前缺失 | `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts` 已读取 quota cache，但账号列表本身没有持久快照缓存，无法在 `ListAccounts()` 慢/卡时恢复首屏。 |
| 筛选排查 | 最近筛选改动会影响 `filteredAccounts`，但 `AccountsFeature` 用 `accountCount=accounts.length` 与 `filteredAccountCount=filteredAccounts.length` 区分真实空态和筛选空态；筛选为 0 应显示 filtered empty，不会渲染整页 skeleton。 |
| 预期验收方式 | 新增 `accountListCache` 单元测试；更新 `accountSnapshot`/hook 相关测试；运行聚焦 frontend tests。 |
| 反证条件 | 如果账号列表已经存在持久缓存且 hook 首屏会读取，则本修复方向无效；当前代码检索未发现该能力。 |

## 实现记录

- 新增 `frontend/src/features/accounts/model/accountListCache.ts`，用 `gettokens.accounts.list-cache` 保存账号列表首屏快照。
- `useAccountsPageState` 初始化时先同步读取快照并填充 auth-file / api-key records；`ListAccounts()` 成功后再覆盖 UI 状态并写回新快照。
- `accountSnapshot.shouldShowAccountSkeletons` 改为只有 `accountCount=0` 且未 ready/未 loaded 时显示整页 skeleton；已有缓存账号时不再被 `ready=false` 遮住。
- 快照缓存只保留显示字段，剔除 API key、headers、cookie、raw auth、quota/billing curl 和管理专用密钥。

## 验收记录

- `cd frontend && node --test src/features/accounts/tests/accountListCache.test.mjs src/features/accounts/tests/accountSnapshot.test.mjs`：通过。
- `cd frontend && node --test src/features/accounts/tests/accountListCache.test.mjs src/features/accounts/tests/accountSnapshot.test.mjs src/features/accounts/tests/accountFilters.test.mjs src/features/accounts/tests/accountSelectors.test.mjs`：通过，覆盖筛选空态不走 skeleton。
- `cd frontend && npm run typecheck`：通过。
- `cd frontend && npm run test:unit -- src/features/accounts/tests/accountListCache.test.mjs`：通过，实际脚本运行完整 unit suite，`801` 项通过。
- `cd frontend && npm run build`：通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260609-account-startup-cache`
- worktree：`../GetTokens-worktrees/20260609-account-startup-cache/`

## 相关链接

- 相关规则：`.agents/skills/gettokens-domain-engineering/SKILL.md` 中 “Account groups should render available local data first”。

## 当前状态
- 状态：done
- 最近更新：2026-06-09
