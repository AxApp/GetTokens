# CLIProxyAPI Usage Hook Boundary

日期：2026-04-28

## 背景

`ObservedRequestUsage` 需要在 `CLIProxyAPI` 内获得跨重启、多日可恢复的真实请求历史，但当前 upstream `CLIProxyAPI` 的 `/v0/management/usage` 仍然只是内存快照。

同时，本项目后续仍需持续合并 `upstream/main`，因此不能把大改动散落到 `internal/usage/`、management handler、store 体系和 config 体系的多个核心目录里。

## 本次边界裁定

采用“核心仓库提供钩子接入点，具体持久化实现在独立 hook 目录内”的方式：

1. `CLIProxyAPI` 核心只保留一个薄接入点。
2. GetTokens 定制实现集中放在 `internal/gettokenshooks/`。
3. `internal/usage/` 继续保持 upstream 语义：
   - 内存聚合
   - `/usage` 读内存 snapshot
   - `export/import` 仍然可用
4. 不把 `ObservedRequestUsage` 持久化逻辑塞进 PostgreSQL config/auth store。

## 当前实现

### 接入点

- `cmd/server/main.go`
  - 在 `cfg.UsageStatisticsEnabled` 为 `true` 时调用：
  - `gettokenshooks.InstallUsagePersistenceHook(...)`

### Hook 目录

- `internal/gettokenshooks/usage_persistence.go`

职责：

1. 解析本地 SQLite 路径
2. 初始化 `usage_snapshots` 表
3. 启动时读取最近一次 snapshot
4. 调用 `usage.GetRequestStatistics().MergeSnapshot(...)` 回灌到内存
5. 通过 `sdk/cliproxy/usage.RegisterPlugin(...)` 订阅后续 usage record
6. 对当前内存 snapshot 做 debounce 持久化回写
7. 做低频周期 flush，覆盖 `usage/import` 这类“内存变了但没有新 request record”的场景

## SQLite 介质选择

当前首版不是事件明细表，而是单行 snapshot 表：

- 表名：`usage_snapshots`
- 关键字段：
  - `singleton_id`
  - `version`
  - `updated_at`
  - `payload_json`

这样做的原因是：

1. 改动面最小，不需要侵入 `internal/usage` 的 dedup / API key 归一化逻辑
2. `hook` 可以完全在独立目录内自闭环
3. 对后续 merge upstream 更友好

## 已知取舍

1. 当前是 snapshot blob 持久化，不是事件级 ledger。
2. flush 采用 `debounce + 周期 flush`，不保证每个请求完成后立刻落盘。
3. 该实现优先解决：
   - 跨重启保留 observed usage
   - H5 多日趋势恢复
4. 如果后续要继续深挖，可以在 `internal/gettokenshooks/` 内把 snapshot blob 平滑升级成分钟桶或事件表，而不需要回头改 `internal/usage/` 核心。

## 运行态验证

2026-04-28 已完成一轮真实二进制验证：

1. 从 fork 源码构建 `build/bin/cli-proxy-api`
2. 用临时配置启动 sidecar，并开启 `usage-statistics-enabled`
3. 调 `POST /v0/management/usage/import` 导入一条 `2026-04-27T06:20:00Z` 的样本
4. 确认当前 `/usage` 与 SQLite 文件都已反映该样本
5. 停服务后重启
6. 确认启动日志出现 `restored usage snapshot`
7. 再读 `/usage`，历史样本仍然存在

结论：

- 当前 hook 已经能提供 `ObservedRequestUsage` 的跨重启恢复
- 且这条能力没有下沉分钟桶逻辑到 `CLIProxyAPI`

## 结论

后续 GetTokens 对 `CLIProxyAPI` 的大改动，应优先遵守这个模式：

- 先给核心仓库留薄钩子
- 再把定制实现集中到 `internal/gettokenshooks/`

不要再直接把大量 GetTokens 逻辑散落写进上游核心目录。

## 时间级与分钟级分层

这次对 `ObservedRequestUsage` 再补一条实现边界：

1. `CLIProxyAPI`
   - 保持时间级 request history
   - 持久化的是可恢复的 request snapshot
   - 不负责分钟桶投影
2. `APP 层`
   - 基于时间级明细做多日统计与单日分钟级聚合
   - 分钟级图表、分钟明细、点击某日后的日内下钻都属于 `APP 层 / H5` 责任

原因：

1. 这样 `CLIProxyAPI` hook 目录可以继续保持薄实现和低冲突面
2. 分钟级是展示语义，不应反向侵入 sidecar 核心事实源
3. 后续如果分钟聚合规则变化，只改 `APP 层` 即可
