# Account Import Deduplication Test Plan

## 2026-07-07 已执行
1. `GETTOKENS_IMPORT_DEDUPE_ZIP='/Users/linhey/Documents/芜湖/cpa-2026-07-06_23-33-06.zip' go test ./internal/gettokens/accountstore -run TestCreateAccountsSkipsRepeatedAuthFileZipWhenEnabled -count=1`
2. `(cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokens/accountstore ./internal/api/handlers/management -count=1)`
3. `go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp ./cmd/gettokens -count=1`
4. `node --test frontend/src/features/accounts/tests/*.test.mjs`
5. `npm --prefix frontend run typecheck`
6. `node docs-linhay/scripts/check-wails-binding-surface.mjs`
7. `docs-linhay/scripts/check-docs.sh`
8. `./scripts/ensure-sidecar.sh darwin arm64`

补充结果：
1. 真实 ZIP smoke 同时覆盖 preflight：第一次创建 875；第二次 preview `would_create=0/skipped=875/failed=0`；第二次实际创建 0、跳过 875。
2. `PreviewCreateAccounts` 单测确认 preview 不写账号表。
3. management `batch-preview` 单测确认 preview 不触发 runtime apply。
4. Wails `PreviewAuthFileUploads` 单测覆盖新 sidecar summary 与旧 sidecar `supported=false`。

## 测试原则
1. 先红灯再实现。
2. 不提交真实账号包、真实 token、真实邮箱明文。
3. 所有真实测试包分析只记录脱敏聚合数据。
4. 服务端去重是硬门禁，前端预览只是体验增强。

## 单元测试
### accountstore
| 场景 | 断言 |
| --- | --- |
| 批内两个 auth-file 有相同强去重键 | 只创建 1 个账号，另 1 个进入 `duplicate_in_batch` |
| DB 已存在相同强去重键 | 新请求创建 0 个账号，返回 `existing_account` |
| 两个账号共享 `account_id` 但 token/email 不同 | 创建 2 个账号 |
| 只有相同 email 无 token | 不自动跳过，返回弱冲突提示或创建并标注 |
| 非 JSON auth_file | 使用 normalized-json 兜底或返回校验失败，行为固定 |
| 并发插入相同 identity | 最终只有一个账号持有 identity |

### management API
| 场景 | 断言 |
| --- | --- |
| batch-create 混合新增/跳过/失败 | 响应 `accounts/skipped/errors` 分离 |
| 全部跳过 | HTTP 200，`succeeded=0`，`skipped_count>0` |
| 有 created 时 | 只对 created 账号执行 runtime apply |
| batch-preview 命中重复 | HTTP 200，`would_create/skipped_count/failed` 正确，且不写库、不 apply |

### Wails
| 场景 | 断言 |
| --- | --- |
| 新 sidecar 返回 skipped | `UploadAuthFiles` 返回摘要，不报错 |
| 新 sidecar preview 返回 skipped | `PreviewAuthFileUploads` 返回 supported 与 wouldCreate/skipped 汇总 |
| preview unsupported | 返回 `supported=false`，不阻塞后续 upload |
| batch-create unsupported | fallback 仍可导入，摘要标记 fallback |
| partial failure | 错误文案包含失败数与已跳过数 |
| 文件名重复但身份不同 | 文件名仍自动改名，身份不同可创建 |

### 前端
| 场景 | 断言 |
| --- | --- |
| 点击导入后 preflight 发现重复 | 先调用 `PreviewAuthFileUploads`，再决定是否调用 `UploadAuthFiles` |
| auth-file 全部已存在 | 跳过实际 upload，显示“不重复导入”摘要 |
| 后端返回全部已存在 | 不显示失败态，显示已跳过摘要 |
| 弱身份冲突 | 显示需要确认，不默认删除勾选 |
| 导入完成 | 触发一次轻量账号列表刷新 |

## 集成测试
### 脱敏派生 fixture
从真实测试包提取字段形态，但人工替换为假 token 与假邮箱：

```json
{
  "type": "codex",
  "access_token": "test-access-a",
  "id_token": "test-id-a",
  "account_id": "shared-account-id",
  "email": "user-a@example.test",
  "expired": "2026-07-16T00:00:00.000Z",
  "last_refresh": "2026-07-06T00:00:00.000Z",
  "plan_type": "k12"
}
```

组合：
1. `same-token-a.json` 与 `same-token-b.json`：相同 `id_token`。
2. `shared-account-a.json` 与 `shared-account-b.json`：相同 `account_id`，不同 token/email。
3. `same-email-new-token.json`：相同 email，不同 token。

### 本地真实 ZIP smoke
命令目标：
1. 临时 SQLite 初始化空账号库。
2. 导入 `/Users/linhey/Documents/芜湖/cpa-2026-07-06_23-33-06.zip`。
3. 再导入同一个 ZIP。
4. 对比账号数与 API 返回摘要。

验收：
1. 第一次导入新增数等于可创建账号数。
2. 第二次导入新增数为 0。
3. 第二次跳过数等于第一次成功创建数。
4. 全程不访问正式配置目录。

## 回归测试命令
计划实现后至少运行：

```bash
go test ./internal/accounts ./internal/wailsapp ./internal/cliproxyapi
(cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokens/accountstore ./internal/api/handlers/management)
node --test frontend/src/features/accounts/tests/*.test.mjs
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/spaces/20260707-account-import-deduplication/README.md docs-linhay/spaces/20260707-account-import-deduplication/plans/technical-design.md docs-linhay/spaces/20260707-account-import-deduplication/plans/implementation-plan.md docs-linhay/spaces/20260707-account-import-deduplication/plans/test-plan.md
```

如果 `docs-linhay/references/CLIProxyAPI` 是独立 module，sidecar 测试在该目录内单独运行对应 package。
