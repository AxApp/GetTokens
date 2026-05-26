# routing.strategy 完整绕过实施计划 v01

日期：2026-05-26

## 背景

当前 `Channel Routing` 的配置已经独立落在 `~/.config/gettokens-data/channel-routing/config.json`，但 sidecar 仍存在一条旧的 `routing.strategy` 兼容链路。实际表现是：

- channel-routing 显示 `balanced`
- `~/.config/gettokens/config.yaml` 仍保留 `routing.strategy: fill-first`
- 请求侧看起来仍可能被旧策略影响

这说明现在不是“展示问题”，而是路由状态分裂。这个 plan 只处理一件事：把 Codex / Claude 的路由决策完整收口到 `channel-routing`，不再让 `routing.strategy` 参与主路径。

## 目标

1. Codex / Claude 的路由保存只写 `channel-routing`。
2. 请求侧选择只读 `channel-routing` 快照，不再依赖 `routing.strategy`。
3. `routing.strategy` 仅保留给旧 relay / 兼容边界，不参与 Channel Routing 的决策。
4. 补齐回归测试，锁住“写回不串层、读取不串层、展示不误导”。
5. 更新 space、dev 和记忆，确保后续维护者知道这条边界已经被刻意切开。

## 修改顺序

### Phase 0：红灯测试

- 增加测试，证明 Codex / Claude 保存 `channel-routing` 时不会同步改写 `config.yaml` 的 `routing.strategy`。
- 增加测试，证明当 `config.yaml` 仍是 `fill-first`、但 `channel-routing` 为 `balanced` 时，解释与选路结果以 `channel-routing` 为准。
- 增加测试，证明 legacy relay 配置与 channel routing 彼此隔离。

### Phase 1：断开写回

- 找出所有把 Channel Routing 结果写回 `config.yaml` 的路径。
- 取消 `routing.strategy` 的联动写回。
- 如果还需要保留旧 relay 配置入口，就把它限制在旧页面和旧语义里，不再和 Codex / Claude 路由共享状态。

### Phase 2：断开读取

- 把请求侧的主路由决策入口切到 `channel-routing`。
- 对 Codex / Claude 路由来说，`routing.strategy` 只作为遗留字段存在，不再参与候选选择、排序和 fallback。
- 如果仍要展示兼容信息，只做只读提示，不做决策输入。

### Phase 3：回归验收

- Codex / Claude 各自保存、各自解释、各自生效，互不污染。
- 代码里不再出现“channel-routing 改了但请求仍吃 config.yaml”的分裂结果。
- 文档与记忆同步更新，qmd 索引完成重建。

## 验收标准

1. Given 用户修改 Codex / Claude 的 channel routing，When 保存成功，Then 只影响对应渠道配置，不再改写 `routing.strategy`。
2. Given `config.yaml` 仍保留旧值，When 请求进入 channel routing，Then 选路结果仍以 `channel-routing` 为准。
3. Given legacy relay 边界仍存在，When 用户只调整 channel routing，Then relay 侧状态不被连带污染。
4. Given 用户查看路由说明，When 页面展示策略来源，Then 说明的是 `channel-routing`，不是旧的 `routing.strategy` 主路径。

## 首批执行项

1. 先补测试，锁住当前分裂现象。
2. 再拆读写链路，断开 `routing.strategy` 对 channel routing 的影响。
3. 最后补文档、记忆和 qmd 索引。

