# Account Import Deduplication Technical Design

## 问题定义
账号导入现在只有“资产文件名唯一”规则，没有“凭据身份唯一”规则。重复导入同一个账号包时，Wails 会为重名文件追加序号，sidecar 会生成新的 `account_key`，最终账号池出现重复资产。

本期设计新增一层导入去重身份：资产身份仍由 `account_key` 表达，凭据身份由归一化后的账号内容计算，并在 sidecar/accountstore 写入边界强制执行。

## 身份模型
### 两层身份
| 层级 | 字段 | 用途 |
| --- | --- | --- |
| 资产身份 | `account_key` | 本地资产主键，支持排序、禁用、删除、运行态状态 |
| 凭据身份 | `auth_dedupe_key` | 导入去重与冲突检测，不替代 `account_key` |

### auth-file 去重键优先级
去重键必须在 `NormalizeAuthFileForSidecar` 之后计算，避免 ChatGPT Session、CPA JSON、Codex Auth JSON 的字段形态差异造成漏判。

1. 强凭据身份：存在 `refresh_token` 时，使用 `auth-file:codex:refresh:<sha256(refresh_token)>`。
2. 强 token 身份：没有 refresh token 但存在 `id_token` 或 `access_token` 时，使用 `auth-file:codex:token:<sha256(token)>`。测试包属于此类。
3. 复合业务身份：没有 token 时，使用 `auth-file:codex:principal:<sha256(email + "\\0" + account_id)>`，但只有 email 和 account_id 同时存在时启用。
4. 弱身份提示：只有 email 或只有 account_id 时不作为强去重键，只输出 `weak_identity_conflict` 供前端提示。
5. 最弱兜底：所有身份字段缺失时使用归一化 JSON 指纹 `auth-file:codex:normalized-json:<sha256(canonical_json)>`。

约束：
1. 禁止单独使用 `account_id` 去重。测试包中 875 个账号只有 14 个 `account_id`，最大组 675。
2. 禁止单独使用 email 做强去重。测试包中 email 有 16 个重复组，可能是同一邮箱多 token 或用户重登产生的新凭据。
3. 去重键只保存 hash，不保存 token 明文。

## 数据模型
优先复用 `account_runtime_identities`：

```text
identity_key  = auth-file:codex:<kind>:<hash>
account_key   = acct_xxx
identity_kind = auth-dedupe-key
```

新增查询能力：
1. `LookupRuntimeIdentity(identityKey) -> account_key`
2. `InsertRuntimeIdentityStrict(identityKey, accountKey, identityKind)`，重复时返回已有 `account_key` 而不是静默忽略。

`auth_file_accounts.auth_fingerprint` 继续保留为原始/归一化 JSON 指纹索引，不升级为唯一约束。原因是刷新后的 token、过期时间、last_refresh 变化可能让 JSON 指纹变化，不适合作为唯一主键。

## 批量创建语义
`CreateAccounts` 增加去重报告，推荐结果：

```go
type AccountBatchCreateSkipped struct {
    Index              int    `json:"index"`
    Title              string `json:"title,omitempty"`
    Reason             string `json:"reason"`
    ExistingAccountKey string `json:"existing_account_key,omitempty"`
    DedupeKeyKind      string `json:"dedupe_key_kind,omitempty"`
}
```

管理 API 响应：

```json
{
  "accounts": [],
  "errors": [],
  "skipped": [],
  "succeeded": 0,
  "failed": 0,
  "skipped_count": 0
}
```

预检查 API 响应：

```json
{
  "items": [],
  "skipped": [],
  "errors": [],
  "would_create": 0,
  "skipped_count": 0,
  "failed": 0
}
```

跳过原因：
| reason | 含义 |
| --- | --- |
| `duplicate_in_batch` | 当前请求内前面已有相同强去重键 |
| `existing_account` | DB 中已有相同强去重键 |
| `weak_identity_conflict` | 只有弱身份冲突，默认不跳过，可作为 preview warning |

默认行为：
1. 强去重键命中批内重复：跳过后续项。
2. 强去重键命中已有 DB：跳过当前项。
3. 弱身份冲突：不自动跳过，只在 preview/result 中提示。
4. 校验失败仍进入 `errors`，不混入 skipped。

## 写入流程
1. Wails 解码文件并调用 `NormalizeAuthFileForSidecar`。
2. 构造 `AccountWriteRequest`，保留现有 `source_file_name` 仅作为展示名。
3. sidecar `CreateAccounts` 将 `AccountWrite` 转为 `ImportCandidate`。
4. accountstore 计算 `auth_dedupe_key`。
5. 在同一事务内先查已有 identity，再查本批 seen map。
6. 新增账号时写 `account_cards`、credential row、runtime apply state，再严格插入 `account_runtime_identities`。
7. 返回 created/skipped/errors 摘要。

并发边界：
1. 同一事务内用 `identity_key` 主键兜底，避免两个批量请求同时创建重复身份。
2. 若插入 identity 时发现冲突，需要回滚当前候选写入，并返回 `existing_account`。

## Wails 合约
`UploadAuthFiles` 从 `error` 返回升级为结果 DTO：

```go
type AuthFileUploadResult struct {
    Succeeded       int  `json:"succeeded"`
    Skipped         int  `json:"skipped"`
    SkippedExisting int  `json:"skippedExisting"`
    SkippedInBatch  int  `json:"skippedInBatch"`
    Failed          int  `json:"failed"`
    FallbackUsed    bool `json:"fallbackUsed,omitempty"`
}

type AuthFileUploadPreviewResult struct {
    Supported       bool `json:"supported"`
    WouldCreate     int  `json:"wouldCreate"`
    Skipped         int  `json:"skipped"`
    SkippedExisting int  `json:"skippedExisting"`
    SkippedInBatch  int  `json:"skippedInBatch"`
    Failed          int  `json:"failed"`
}
```

兼容策略：
1. 新 sidecar 支持 `skipped` 时，直接返回摘要。
2. 旧 sidecar 不支持 batch-create 时，保留逐条创建 fallback，但不承诺服务端去重；UI 标注为旧运行态能力受限。
3. 批量结果中 `failed > 0` 时仍返回错误，错误文案追加成功/跳过数量，便于用户判断是否需要重试。

## 前端交互
导入提交分两步：
1. 点击导入后先调用 `PreviewAuthFileUploads`，由 sidecar 按 DB 内 hashed identity 精确预检查：新增、已存在、批内重复、失败。
2. 若 auth-file 全部重复且 preview 无失败，则跳过真正 `UploadAuthFiles`；否则继续导入，并以后端 batch-create 结果为最终事实。

展示要求：
1. 预检查提示显示 `将导入 X / 跳过重复 Y`。
2. 全重复时显示“不重复导入”，并避免进入写入链路。
3. 结果 toast 或 modal footer 显示摘要，不把跳过重复当失败。
4. 只展示文件名与计数，不展示 token。

## 历史重复处理
本期只阻止新增重复。历史数据清理另开需求，原因：
1. 需要判断重复资产是否被项目绑定、运行状态或用户排序引用。
2. 删除/合并历史资产属于破坏性操作。
3. 需要独立备份和恢复方案。

## 安全与隐私
1. 测试夹具只能提交脱敏派生数据或人工构造的小 JSON。
2. 不提交用户提供的 ZIP、真实 token、真实邮箱明文。
3. 日志、错误、preview 只允许显示文件名、计数、短 hash 或脱敏邮箱。
