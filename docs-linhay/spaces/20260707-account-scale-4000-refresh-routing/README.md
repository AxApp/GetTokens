# 4000 Account Scale Refresh And Routing

## 背景
用户反馈 4000+ 账号场景下批量刷新和路由账号选取存在性能/可解释性问题。历史工作已经处理过 1600+/1652 账号基线：

- 运行态 quota/status 读取已从 N 次单账号刷新改为 sidecar runtime snapshot，并在前端按 `account_keys` 分片读取。
- 用户主动批量刷新已走 sidecar `quota-refresh-batch/jobs`，前端轮询 job。
- `balanced` 路由当前语义是“在过滤后的候选池内按 active sessions / in-flight 最少选择”，不是项目、历史请求数或 token 长期公平。
- route decision ring buffer 已存在，但 4000 大池下还需要更强的候选漏斗、进度与性能预算证据。

## 目标
1. 建立 4000+ 账号刷新与路由选号的可重复测试/benchmark。
2. 优化已证实的热点：批量刷新 job 运行中必须持续可观测；前端 runtime status 分片读取必须有界并发、保持分片大小上限。
3. 给路由选号补 4000 规模 benchmark 与诊断边界，先证明候选池过滤/active-session 语义，再决定是否需要新的公平策略。

## 范围
- sidecar `quota-refresh-batch/jobs`：job 创建、运行中进度、取消、完成状态。
- sidecar quota runtime snapshot：4000 账号全量与目标 key 查询 benchmark。
- frontend accounts runtime sync：`GetQuotaStatuses(accountKeys)` 分片读取的请求数量、并发上限和结果顺序。
- routing/channel selector：4000 账号 `sequential/balanced` 决策 benchmark 与候选过滤计数。

## 非目标
- 不触碰 `/Applications/GetTokens.app` 正式版。
- 不使用真实账号、真实 quota/billing upstream 作为第一验收。
- 不把 `balanced` 直接改成项目公平、请求数公平或 token 公平；若用户确认长期公平诉求，另开策略设计。
- 不在前端伪造 sidecar 已完成的状态。

## 验收标准
### Mock upstream facts
- quota/billing upstream 使用 `httptest` fixture，支持快速成功、慢请求阻塞、取消、部分失败。
- route 账号输入使用 fake account inventory、fake active sessions、fake groups 和 fake tried set。

### Mock downstream / spy outputs
- sidecar batch job snapshot 必须在长任务运行中报告 `succeeded/failed/pending/running/items/errors` 的增量变化。
- frontend runtime sync 必须对 4000 keys 产生 20 个以内 chunk（默认 200），且并发读取上限明确，不回退为 N 次单账号 refresh。
- routing benchmark 必须输出 4000 规模下 `DecideChannelRoute` / manager pick 的耗时与 allocs。

### 性能预算
- job 创建延迟：慢 upstream 下仍应小于 500ms 返回 `job_id`；目标预算为 50ms 量级。
- 首批进度可见：只要第一批账号完成，下一次 job poll 应能看到 `succeeded/failed` 增量，而不是等整批完成。
- runtime status 读取：4000 账号必须继续按有界 chunk 查询，禁止一个超长 query 或每账号一个请求。
- 前端 status sync：chunk 请求并发必须有上限，结果按原 chunk 顺序合并。
- route decision：4000 候选池 benchmark 必须可独立运行，不能依赖真实 sidecar/dev App。

### 回归门禁
- CLIProxyAPI focused tests：quota batch job progress、quota runtime 4000 benchmarks、channel routing 4000 benchmarks。
- frontend focused tests：account runtime sync chunking/concurrency/source guard。
- 文档门禁：`docs-linhay/scripts/check-docs.sh` 与 `git diff --check`。

## 本轮实现证据
### 批量刷新
- `quota-refresh-batch/jobs` 已支持运行中增量进度：首个账号完成后，job snapshot 会更新 `succeeded/items/running/pending`，不再等整批结束才可见。
- batch worker 的账号仍存在复核从完整 `GetAccount` 改为 `AccountExists` 轻量查询，保持“刷新前确认账号未删除”的语义，避免每账号读取完整账号卡片、runtime apply state 和 credential。
- batch job store 只保留最近 `20` 个终态 job；running/pending job 不剪，避免多轮 4000 账号刷新把 completed `items/errors/account_keys` 长期留在 sidecar 内存。
- 4000 mock batch benchmark：
  - 优化前：约 `267ms/op`，`45.3MB/op`，`987k allocs/op`。
  - 优化后：约 `109-117ms/op`，`26.3MB/op`，`465k allocs/op`。

### 路由选号
- `Manager.pickNext` 4000 benchmark 的主热点确认在 scheduler default 诊断 materialize 全候选，而不是 channel routing engine。
- default route decision 现在只保留候选样本和总数，不再为常规无 policy 路径构造 4000 长度候选切片、去重 map 或克隆全量 `Auth`。
- 首次 model shard 构建从每账号 rebuild 改为批量填充后单次 rebuild，避免新 model 首次请求 O(N²) 建索引。
- 4000 benchmark：
  - `BenchmarkManagerPickNext4000`：从约 `2.1ms/op`、`9.7MB/op`、`12k allocs/op` 降到约 `0.25ms/op`、`19KB/op`、`112 allocs/op`。
  - `BenchmarkSchedulerPickSingle4000`：约 `20.7us/op`、`18KB/op`、`111 allocs/op`。
  - `BenchmarkSchedulerBuildModelShard4000`：约 `0.87ms/op`、`800KB/op`、`4074 allocs/op`。
- `BenchmarkDecideChannelRouteBalanced4000Accounts`：约 `0.14ms/op`，不是本轮瓶颈。
- route decision history 原有上限 `200` 不变，但单条 snapshot 从最多 4000 候选收敛为最多 100 候选样本；保留 `CandidateCount` 和 selected auth，避免 route explain ring buffer 长期保留 80 万候选条目级别的数据。

### 前端 runtime status
- `syncCodexQuotaStatuses` 使用 `chunkRuntimeSyncAccountKeys` + `runAccountRuntimeRequestPool`，并发上限固定为 `ACCOUNT_RUNTIME_QUOTA_STATUS_REQUEST_CONCURRENCY = 4`。
- 4000 全量 runtime snapshot benchmark 约 `28-29ms`；200-key chunk 约 `1.3ms`，支持前端按 chunk 有界读取。

### 构建
- 已运行 `./scripts/ensure-sidecar.sh darwin arm64`，本地 dev sidecar 产物更新到 `build/bin/cli-proxy-api`。
- 构建 meta：`5d2bdd27fdf992062ccb21b0fca7e43aba25782d:clean:213eb0f1cfe17c2b4b4b8469bc9aa047e77a0bddc8c6a845668a39f133e4ae82:darwin:arm64`。
- 未触碰 `/Applications/GetTokens.app` 正式版，也未重启或替换正式版进程。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：未创建独立 feature branch；本轮为当天短改，直接在主工作区施工。
- worktree：未创建独立 worktree。

## 相关链接
- `docs-linhay/spaces/20260608-account-pool-scale-optimization/README.md`
- `docs-linhay/spaces/20260608-account-runtime-bulk-sync/README.md`
- `docs-linhay/dev/20260524-account-routing-engine.md`
- `docs-linhay/memory/2026-06-08.md`
- `docs-linhay/memory/2026-06-09.md`
- `docs-linhay/memory/2026-06-16.md`

## 当前状态
- 状态：verified
- 最近更新：2026-07-07
