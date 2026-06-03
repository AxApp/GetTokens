# Session Account Affinity & Failure Budget Routing

## 背景

用户报告两个场景：
1. Codex 流式请求报 `stream disconnected before completion: stream closed before response.completed`
2. 只激活一个账号用完后，激活另一个账号不重启不会切换到新账号

排查发现 root cause 是多层问题叠加：OAuth refresh token 失效 + migration-backups 旧凭证参与 routing + 启用账号后 stale transient route block 未清理 + 缺少 session 级账号粘性。

## 设计

废弃"请求失败就池内轮询账号"的 request-level retry 模型，改为 **Session Account Lease + Failure Budget + Pool Epoch**。

### 核心原则

| 原则 | 说明 |
|---|---|
| Session Account Lease | 同一 session 绑定同一账号，不频繁切换 |
| Soft Quota ≠ Eviction | quota=0 是软信号，不驱逐当前 session（Codex 最后任务可能仍可完成）|
| Hard Failure Budget | 真实 upstream terminal error 累计失败次数，达 budget（默认2）后才释放 lease |
| Disabled Immediate Switch | 用户禁用账号立即清除 binding + bump epoch，下一请求走其他账号 |
| Enabled Immediate Entry | 启用账号清 stale route block，不重启即可入候选 |
| Pool Epoch | 账号池变更推进 epoch，session affinity 下次请求感知并重新评估 |
| Post-Commit Freeze | 流已 commit 后不在同请求内拼接另一账号 |
| Pre-Commit Fallback | refresh 失败/握手失败等 pre-commit 错误仍可当前请求换账号 |
| Migration Backups Exclusion | `migration-backups/**` 不入 runtime routing |

### 成功指标

- 同 session 同账号 quota=0 不切
- 同 session 同账号失败 1 次不切
- 同 session 同账号失败 2 次（达 budget）切
- 禁用账号后下一次请求不走原账号
- 启用账号后无需重启即可入选
- 激活新账号后 epoch bump 触发切换

## 实现

在 `docs-linhay/references/CLIProxyAPI` sidecar fork 中实现，分 5 个 Phase：

### Phase 1：post-commit stream 不 fallback
- 新增回归测试 `TestManagerExecuteStream_PostCommitErrorDoesNotFallbackToNextAuth`

### Phase 2：migration-backups 不入 runtime
- `isMigrationBackupAuthFileName` 过滤
- 测试 `TestConfigSynthesizer_SkipsMigrationBackupAuthFilesFromAccountStoreRuntime`

### Phase 3：启用账号即时路由
- `SetRouteDisabled(false)` 清空 stale transient route block
- 测试 `TestManager_SetRouteDisabled_EnableClearsStaleModelBlocksAndSchedulerPicks`

### Phase 4：Session Failure Budget + Pool Epoch
- `SessionCache` 新增 `failureCount/poolEpoch`
- `SessionAffinitySelector` 新增 `FailureBudget/RecordRouteFailure/RecordRouteSuccess/BumpPoolEpoch`
- `Manager` 新增 `BumpSessionAffinityPoolEpoch/recordSessionRouteFailure/Success`
- 所有 Execute/ExecuteStream 路径接续记录
- `wrapStreamResult` 在 stream chunk error 时计入 failure budget
- `applyAccountStoreStatusChange` 调用 `BumpSessionAffinityPoolEpoch`
- 新增 3 个测试

### Phase 5：禁用账号即时切换
- `rewriteRouteCandidates` 缓存失效后主动 invalidate
- `applyAccountStoreStatusChange` 禁用时 `InvalidateAuth + BumpPoolEpoch`
- 测试 `TestSessionAffinityDisabledAccountMustNotStick`

## 验证

```bash
go test ./sdk/cliproxy/auth ./sdk/cliproxy \
  ./internal/watcher/synthesizer \
  ./internal/gettokens/accountstore \
  ./internal/api/handlers/management
# 5 包全部通过
```

## 文件变更

16 files changed, 757 insertions(+), 39 deletions(-) in sidecar fork

## 配置（待暴露到 config.yaml）

```yaml
gettokens:
  routing:
    session_failure_budget: 2
    session_failure_window_seconds: 300
```

## 未完成

- OAuth refresh token used/invalidated 自动标记 `requires_relogin`
- YAML 配置项暴露
- 真实 sidecar 集成验证
