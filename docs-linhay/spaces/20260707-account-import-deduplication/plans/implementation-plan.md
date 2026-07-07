# Account Import Deduplication Implementation Plan

## 2026-07-07 执行状态
已完成 core slice：
1. Phase 0 红灯测试：accountstore、management API、Wails、前端 source test。
2. Phase 1 sidecar 身份计算：归一化 auth JSON 后计算 hashed dedupe identity。
3. Phase 2 accountstore 批量去重：批内重复与已有 DB identity 跳过。
4. Phase 3 management API 与 Go client：响应携带 `skipped/skipped_count`。
5. Phase 4 Wails 上传结果：返回新增/跳过/失败摘要，并保留旧 sidecar fallback。
6. Phase 5 preflight preview：新增 sidecar/Wails 精确预检查，前端提交前先 preview；全重复 auth-file 直接跳过实际 upload。
7. Phase 6 测试包 smoke：真实 ZIP 在临时 SQLite 中第二次 preview 为全跳过，实际重复导入新增 0。

后续增强：
1. idle modal 内实时 DB preview 暂未做；当前是提交前 preflight，已经能阻断重复写入。
2. 历史重复资产清理暂未做；保持非目标。

## Phase 0: 红灯测试
1. sidecar accountstore：新增 `TestCreateAccountsSkipsDuplicateAuthFileIdentityInBatch`。
2. sidecar accountstore：新增 `TestCreateAccountsSkipsExistingAuthFileIdentity`。
3. sidecar accountstore：新增 `TestCreateAccountsDoesNotDeduplicateByAccountIDOnly`。
4. management API：新增批量创建响应包含 `skipped` 与 `skipped_count`。
5. Wails：新增 `UploadAuthFiles` 返回导入摘要，重复跳过不报错。
6. 前端：新增导入 preflight/result 的计数测试。

先提交失败断言，确认现有行为会创建重复账号或缺少响应字段。

## Phase 1: sidecar 身份计算
1. 在 `accountstore` 增加 auth-file dedupe key 计算函数。
2. 使用归一化后的 `AuthFileCredential.AuthJSON` 解析 token/email/account_id。
3. 返回结构包含 `key`、`kind`、`strength`、`warnings`。
4. 覆盖字段缺失、非 JSON、token 变化、account_id 复用场景。

## Phase 2: accountstore 批量去重
1. 扩展 `AccountBatchCreateError` 旁路新增 `AccountBatchCreateSkipped`。
2. 将 `CreateAccounts` 返回值升级为 `created, skipped, failures, err`。
3. 事务内维护 `seenDedupeKeys`，先处理批内重复。
4. 查询 `account_runtime_identities` 处理库内重复。
5. 新增账号时严格插入 `auth-dedupe-key` identity。
6. 并发冲突时回滚当前候选，返回 `existing_account`。

## Phase 3: management API 与 Go client
1. 扩展 `/v0/management/accounts/batch-create` request/response DTO。
2. `internal/cliproxyapi` 同步新增 `Skipped`、`SkippedCount`。
3. 保持旧字段 `accounts/errors/succeeded/failed` 兼容。
4. API 测试断言跳过项不触发 runtime apply。

## Phase 4: Wails 上传结果
1. `UploadAuthFiles` 改为返回 `AuthFileUploadResult`。
2. 对旧前端兼容：结果为空或旧 JS binding 时仍不破坏导入。
3. fallback 单条创建路径保留，但返回摘要中标记 `FallbackUsed`。
4. 更新 Wails 生成绑定与前端调用类型。

## Phase 5: 前端预览与结果
1. sidecar 新增 `PreviewCreateAccounts`，与 `CreateAccounts` 复用同一批去重规划逻辑。
2. management 新增 `/v0/management/accounts/batch-preview`，只返回预期创建、跳过、失败，不触发 apply。
3. Wails 新增 `PreviewAuthFileUploads`，旧 sidecar 返回 `supported=false`，实际导入继续 fallback。
4. 前端点击导入后先执行 preflight；若 auth-file 全部重复，则跳过 `UploadAuthFiles`。
5. 导入完成 reload 时使用既有轻量刷新路径，不触发逐项刷新。

## Phase 6: 测试包 smoke
1. 不提交测试 ZIP，只在本地读取 `/Users/linhey/Documents/芜湖/cpa-2026-07-06_23-33-06.zip`。
2. 将 dev 原数据库备份后，使用临时 gettokens-dev 配置或临时 SQLite。
3. 第一次导入记录新增数。
4. 第二次导入断言新增 0、跳过数等于第一次成功创建数。
5. 验证账号列表总数不增长，刷新不触发逐项 storm。
6. 验收结束恢复 dev 数据库备份。

## 风险与回退
| 风险 | 处理 |
| --- | --- |
| 误合并不同账号 | 不用 account_id 单独去重；弱身份只提示 |
| 旧 sidecar 不支持新响应 | Wails client 保持字段默认值与 fallback |
| 历史重复仍存在 | 本期不处理，后续迁移清理 |
| token 刷新导致去重键变化 | 优先 refresh_token；无 refresh_token 时只阻止完全相同 token 再导入 |
| 并发导入重复 | `identity_key` 主键兜底 |

## 预计改动文件
1. `docs-linhay/references/CLIProxyAPI/internal/gettokens/accountstore/accounts.go`
2. `docs-linhay/references/CLIProxyAPI/internal/gettokens/accountstore/store.go`
3. `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/accounts_store.go`
4. `internal/cliproxyapi/client.go`
5. `internal/cliproxyapi/types.go`
6. `internal/wailsapp/auth_files.go`
7. `frontend/src/features/accounts/model/accountTransfer.ts`
8. `frontend/src/features/accounts/components/AccountImportModal.tsx`
9. 对应测试文件
