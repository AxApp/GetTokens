# Account Import Deduplication

## 背景
2026-07-06 用户在正式环境导入约 800 个账号时耗时很久，随后重复导入同一批测试账号，账号池继续膨胀。当前账号池刷新、额度同步、列表渲染都与账号资产数量相关，重复资产会把后续运行成本继续放大。

本期聚焦“导入时去重”：同一批文件内重复、与数据库已有账号重复，都应在服务端批量创建边界被识别并跳过，不能继续依赖文件名自动改名来制造新资产。

测试账号包：`/Users/linhey/Documents/芜湖/cpa-2026-07-06_23-33-06.zip`。分析时只使用脱敏聚合数据，不在仓库提交真实 token、邮箱明文或原始 JSON。

## 目标
1. 定义账号导入去重身份模型，明确哪些字段可作为强凭据身份，哪些只能作为弱提示。
2. 在 sidecar/accountstore 批量创建边界形成强制去重，确保绕过前端也不会重复落库。
3. Wails 上传链路返回导入摘要，区分新增、批内重复、库内已存在、失败。
4. 前端导入提交前执行 sidecar 精确去重预检查，导入后展示结果摘要。
5. 用测试账号包构造脱敏夹具与自动化测试，覆盖重复导入和批内重复场景。

## 范围
1. `auth-file` / Codex CPA JSON 导入去重。
2. Wails `UploadAuthFiles`、CLIProxyAPI management `/accounts/batch-create`、accountstore SQLite 写入路径。
3. 前端账号导入弹窗的预览与结果摘要。
4. 自动化测试与本地 dev 数据库 smoke。

## 非目标
1. 不修改正式版 `/Applications/GetTokens.app`，不重启正式版 sidecar，不改正式配置目录。
2. 不在本期合并历史重复账号。历史清理另开 space，避免误删仍在使用的资产。
3. 不默认按 `account_id` 合并账号；测试包显示 `account_id` 高度复用，单独使用会误伤。
4. 不默认覆盖已有凭据。默认策略是跳过重复；“替换已有资产”作为后续显式模式设计。

## 证据门禁
### 用户反馈
- 重复导入 800+ 账号后正式环境仍卡住。
- 期望先规划并实现导入去重方案，使用提供的测试账号包验证。

### 测试包脱敏统计
| 指标 | 结果 |
| --- | --- |
| ZIP 大小 | 1,639,854 bytes |
| JSON 文件数 | 875 |
| 可解析 JSON | 875 |
| `type` | `codex`: 875 |
| 邮箱域分布 | `outlook.com`: 675, `gmail.com`: 200 |
| 含 email | 875 |
| 含 account_id | 875 |
| 含 refresh_token | 0 |
| 含 access_token | 875 |
| 含 id_token | 875 |
| 原始内容重复组 | 0 |
| email 唯一数 | 691，重复组 16，重复项 200，最大组 13 |
| account_id 唯一数 | 14，重复组 14，重复项 875，最大组 675 |
| access_token / id_token 唯一数 | 各 875 |

结论：
1. 文件内容、`access_token`、`id_token` 在测试包内都不重复，不能用“原始 JSON 完全相同”覆盖所有重复导入问题。
2. `account_id` 不能作为唯一去重键；它在 K12/组织场景会被大量账号共享。
3. email 可用于“业务身份重复”提示，但不能单独证明凭据完全相同。
4. 重复导入同一个 ZIP 时，稳定的去重键必须由归一化后的可用身份字段计算，并在已有库中持久化。

### 当前代码事实
| 位置 | 事实 | 风险 |
| --- | --- | --- |
| `internal/wailsapp/auth_files.go` | `UploadAuthFiles` 只通过 `uniqueAuthFileUploadName` 解决文件名冲突 | 同一账号再次导入会被改名为新资产 |
| `docs-linhay/references/CLIProxyAPI/internal/gettokens/accountstore/accounts.go` | `CreateAccounts` 每条写入都生成新 `account_key` | 批内重复与库内重复都会落库 |
| `docs-linhay/references/CLIProxyAPI/internal/gettokens/accountstore/store.go` | `auth_file_accounts.auth_fingerprint` 只有普通索引 | 没有 DB 唯一约束 |
| `docs-linhay/references/CLIProxyAPI/internal/gettokens/accountstore/store.go` | `account_runtime_identities.identity_key` 是主键 | 可复用为凭据身份唯一约束 |
| `internal/accounts/auth_file_normalize.go` | 导入前已做 CPA/Codex 归一化 | 去重应发生在归一化之后 |

## 验收标准
### BDD 场景
1. 给定同一个测试 ZIP 连续导入两次，第二次不新增账号，返回 `skipped_existing = 875` 或等价摘要。
2. 给定同一批导入文件内包含重复身份，系统只创建第一条，其余返回 `duplicate_in_batch`，不写入账号表。
3. 给定不同邮箱但共享 `account_id` 的 K12 账号，系统不会因为 `account_id` 相同而误判重复。
4. 给定同一 email 但 token 身份不同的文件，系统标记为 `weak_identity_conflict` 提示人工判断；默认不自动合并。
5. 给定绕过前端直接调用 `/v0/management/accounts/batch-create` 的请求，sidecar 仍能跳过重复并返回摘要。
6. 导入完成后账号列表只做一次轻量 reload，不触发 875 次逐项刷新。

### 交付门禁
1. sidecar accountstore 单元测试覆盖库内重复、批内重复、`account_id` 复用不误伤。
2. management API 测试覆盖批量返回新增/跳过/失败摘要。
3. Wails `UploadAuthFiles` 测试覆盖批量导入结果摘要与旧 sidecar fallback。
4. 前端导入 modal 测试覆盖预览去重计数和结果文案。
5. 使用测试 ZIP 在 dev 配置目录或临时 SQLite 中完成 smoke，不触碰正式环境。
6. `docs-linhay/scripts/check-docs.sh` 与相关测试通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260707-account-import-deduplication`
- worktree：`../GetTokens-worktrees/20260707-account-import-deduplication/`

## 相关链接
- 技术方案：`plans/technical-design.md`
- 实现计划：`plans/implementation-plan.md`
- 测试计划：`plans/test-plan.md`

## 实现记录
### 2026-07-07 Core Dedupe
已完成：
1. sidecar/accountstore `CreateAccounts` 返回 `created/skipped/errors`，对 auth-file 强身份执行批内与库内去重。
2. 去重身份在归一化后的 auth JSON 上计算，优先 `refresh_token`，其次 `id_token` / `access_token`，最后才用 `email + account_id` 复合身份或 normalized JSON；不单独使用 `account_id`。
3. `account_runtime_identities` 持久化 hashed `auth-dedupe-key`，避免重复导入绕过前端落库。
4. management `/v0/management/accounts/batch-create` 返回 `skipped` 与 `skipped_count`。
5. Wails `UploadAuthFiles` 返回导入摘要：新增、已存在跳过、批内重复、失败、fallback。
6. 前端导入完成后展示重复跳过摘要，并继续使用轻量 `loadAccounts({ refreshSupplementalData: false })`。

### 2026-07-07 Preflight Preview
已完成：
1. sidecar/accountstore 新增 `PreviewCreateAccounts`，复用 batch-create 同一套去重规划逻辑，但使用只读事务，不写入 SQLite。
2. management 新增 `POST /v0/management/accounts/batch-preview`，返回 `items/skipped/errors/would_create/skipped_count/failed`。
3. parent Go client 与 Wails 新增 `PreviewAuthFileUploads`，旧 sidecar `404/501` 时返回 `supported=false`，不阻断实际导入。
4. 前端提交导入前先调用 `PreviewAuthFileUploads`；若 auth-file 预检查判断全部已存在，则跳过真正 `UploadAuthFiles`，避免重复导入再次进入写入链路。
5. 若同一批里还有 API Key / Provider，auth-file 全重复只跳过 auth-file 写入，其他资产仍继续导入。

暂未纳入本轮：
1. idle 状态下在 modal 内持续预览 DB 已存在数量；当前实现为点击导入后的提交前 preflight。
2. 历史重复账号合并/清理。仍按非目标处理，后续需要单独备份、引用检查与恢复方案。

### 验证结果
1. 使用 `GETTOKENS_IMPORT_DEDUPE_ZIP=/Users/linhey/Documents/芜湖/cpa-2026-07-06_23-33-06.zip` 跑临时 SQLite smoke：第一次导入 875；第二次 preview 为 `would_create=0/skipped=875`，实际再次导入新增 0、跳过 875。
2. sidecar accountstore 覆盖：批内重复、库内重复、共享 `account_id` 不误杀。
3. management API 覆盖：batch-create 与 batch-preview 响应区分 `created/skipped/errors`，preview 不触发 runtime apply。
4. Wails 覆盖：批量摘要、旧 sidecar fallback、preview supported/unsupported、重复跳过摘要。
5. 前端覆盖：提交前 preview 顺序、全重复跳过 upload、导入完成跳过摘要和轻量 reload source test。

## 当前状态
- 状态：implemented
- 最近更新：2026-07-07
