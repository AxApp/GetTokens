# 20260606 执行计划 v01

## 问题定义

- 前端 `requestable` 当前把 `CONFIGURED` 直接视为可请求，导致“等待检测”类账号会进入候选统计与 explain preview。
- 运行时 route engine 还有更多 guard/filter，前端候选列表与真实请求候选并不天然一致。
- 目前“展示状态”和“请求资格”耦合过紧，文案或状态枚举稍有变化就会影响 routing UI。
- usage/quota 只能证明“已经跑通过或资源同步过”，不能覆盖所有可用账号；新导入、低频、openai-compatible 或 quota unsupported 账号可能没有这些证据但仍可请求。
- 还需要用户手动确认通道：用户明确知道账号能用时，应能标记为“手动确认可用”，作为候选资格证据。

## 目标拆分

1. 先锁定“什么叫可请求”：
   - `ACTIVE / LOCAL` 是否可请求；
   - `CONFIGURED` 是否一律不可请求，还是仅特定来源/特定验证完成后可请求；
   - openai-compatible 是否需要独立规则。
2. 再定义“可请求证据”优先级：
   - 显式验证成功，例如创建 / 编辑时 probe 成功；
   - 用户手动确认可用，例如“我知道这个能用”；
   - sidecar / account store 明确 active 或 ready；
   - provider 配置完整且无 runtime guard 阻塞；
   - usage 成功或 quota 成功；
   - 失败证据优先级高于成功证据，例如 manual-disabled、auth-error、quota-empty、cooldown、model-unavailable。
3. 再统一“谁消费这条规则”：
   - 账号列表 summary
   - 请求顺序过滤
   - browser preview explain
   - route probe preview / stream
   - 必要时 Wails explain DTO
4. 最后补回归，防止后续改文案时再次把待检测账号带回候选池，或把“无 usage/quota 但可用”的账号误排除。

## BDD 场景

1. Given 一个显示为“等待检测”的账号
   When 打开 Codex 请求顺序页
   Then 该账号仍显示在顺序列表里，但不计入 `requestable` 数量与候选池。

2. Given 顺序列表里包含 active、waiting-check、disabled 三类账号
   When 运行 explain / preview probe
   Then 只有 active 账号进入 candidates，waiting-check 与 disabled 进入 filtered，并带上可理解原因。

3. Given 账号展示文案从“等待检测”变成别的中文文案
   When route candidate 计算执行
   Then 不依赖文案字符串判断请求资格。

4. Given 一个新导入账号没有 usage / quota 成功记录，但创建或验证 probe 已成功
   When 打开 Codex 请求顺序页
   Then 该账号进入 requestable candidates。

5. Given 一个 openai-compatible 账号配置完整、未禁用、无 runtime guard 阻塞，但尚无 usage 记录
   When 执行 explain / preview probe
   Then 该账号进入 candidates，而不是因为无 usage/quota 被归为待检测。

6. Given 一个账号没有 usage / quota 成功记录，也没有自动验证成功记录
   When 用户手动标记“确认可用”
   Then 该账号进入 requestable candidates。

7. Given 一个账号已被用户手动确认可用，但随后被手动禁用或命中 quota-empty / cooldown / model-unavailable
   When 执行 explain / preview probe
   Then 该账号不进入 candidates，并展示硬阻塞原因。

## 实施阶段

### Phase 1: 红灯测试

- 在 `codexAccountList.test.mjs` 补失败测试：
  - 待检测账号 `requestable=false`
  - 已验证但无 usage/quota 的账号 `requestable=true`
  - 手动确认可用但无 usage/quota 的账号 `requestable=true`
  - 手动确认可用不能绕过 disabled / runtime guard
  - openai-compatible 配置完整但无 usage/quota 仍 `requestable=true`
  - 待检测账号保留排序但进入 filtered
  - explain / probe 候选数不包含待检测账号
- 若当前字段不足以表达 waiting-check，再先写一条描述缺口的测试。

### Phase 2: 领域收敛

- 在 `frontend/src/features/codex/model/` 内新增或收敛共享判定函数，拆分：
  - 展示状态
  - 请求资格
  - 请求资格证据
  - 手动确认可用标记
  - filtered reason
- 评估是否需要把 openai-compatible 与 codex auth-file / api-key 的规则分开建模。
- 确认手动标记落位：优先复用 account store / account attributes；若现有结构不足，再新增最小字段，避免只存在前端本地状态。

### Phase 3: 使用点替换

- 替换 Codex account list、filter summary、Channel Routing preview explain、route probe preview 的候选口径。
- 若前端无法稳定识别 waiting-check，则补 Wails / backend 字段并同步 bindings。

### Phase 4: 验证与写回

- 运行前端 unit test、typecheck，必要时 Go test。
- 更新 README、memory；若形成稳定领域规则，再视情况补 dev 文档。
- 运行 `docs-linhay/scripts/check-docs.sh`。

## 执行记录

### 已完成实现

1. 前端 requestability selector 已收敛：
   - `configured` 且无证据时变成 `waiting-check`。
   - `active / local / ready / ok / verified / manual / usage / quota / configured-provider` 作为请求资格证据。
   - openai-compatible provider 使用 `configured-provider`，不依赖 usage/quota 成功记录。
2. 手动确认可用已落地：
   - `ChannelRoutingConfig.manualRequestableAccountIDs` 保存用户确认的账号 ID。
   - Codex 请求顺序行新增 `我知道能用` / `取消确认` 操作。
   - 保存失败回滚本地 rows/config；browser preview 仅更新本地预览状态。
3. 后端 explain / candidate pool 已对齐：
   - Go `ChannelRoutingConfig` 同步 `manualRequestableAccountIDs`。
   - `configured` 无证据进入 filtered，reason 为 `waiting-check`。
   - 手动确认和 `AccountRecord.requestability` evidence 可进入候选。
   - disabled/runtime guard 仍优先于手动确认。
4. Wails generated model 已同步：
   - `AccountRequestability`
   - `AccountRecord.requestability`
   - `ChannelRoutingConfig.manualRequestableAccountIDs`
5. UI 文案与详情解释已补齐：
   - `待检测` badge。
   - `手动确认` badge。
   - `待检测，未进入请求候选` 详情提示。
   - Channel Routing explain filtered reason 显示为 `待检测`。

### 验证记录

已通过：

- `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`
- `npm --prefix frontend run typecheck`
- `go test ./internal/wailsapp -run 'Test.*ChannelRouting|Test.*Codex.*'`
- `go test ./internal/accounts`
- `docs-linhay/scripts/check-docs.sh`

## 风险与待确认

- `CONFIGURED` 在 Codex 请求顺序里不再直接等于可请求；账号池其他页面不复用该 Codex selector。
- openai-compatible 仍按 provider 配置完整度进入候选；本轮没有新增 openai-compatible 待检测阶段。
- 显式验证成功字段当前以 `AccountRecord.requestability.evidence` 表达，后续账号创建/验证链路可继续写入 `verified / usage / quota` 等证据。
- 手动确认已持久化到 Codex channel routing config，而不是前端 local state。
- 本轮已扩到 Wails DTO / generated bindings / Go explain 测试。

## 当前决策

- 默认目标是“待检测账号显示但不参与请求”，同时保留“已验证但无 usage/quota 的账号可参与请求”。
- 用户手动确认“我知道这个能用”是有效 requestability evidence；该证据只负责加入候选，不覆盖硬阻塞。
- 不能把 usage/quota 作为唯一可用判断；需要引入或复用更稳定的 requestability evidence。
- 手动确认存储在 `ChannelRoutingConfig.manualRequestableAccountIDs`，不写账号凭证本体。
