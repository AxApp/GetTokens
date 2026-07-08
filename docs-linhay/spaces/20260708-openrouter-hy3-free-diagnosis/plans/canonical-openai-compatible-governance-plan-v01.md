# Canonical OpenAI-Compatible Governance Plan v01

## 背景

本轮已确认：

1. `OpenRouter` 历史卡片曾被存成 `codex-api-key`，而不是 `openai-compatible`。
2. 这会带来两层风险：
   - runtime model registration 走错链路；
   - `openai_chat` 等 format endpoint 走错地址。
3. 用户接受删除并重建这类错误账号配置，因此本轮方案不以“永久兼容历史坏形态”为目标。
4. 当前硬证据只命中一张历史坏卡：`OpenRouter`。不能把“所有模板都有问题”当成既成事实。

## 目标

把产品边界收紧到：

- 已知 `OpenAI-compatible` 厂商不能再以 `codex-api-key` 落库；
- 已存在的错误卡片能被审计、隔离、显式修复；
- sidecar 不为错误形态长期背兼容债。

## 非目标

- 不做长期 runtime legacy bridge。
- 不承诺永久承载历史错误持久化形态。
- 不对无证据厂商做泛化修复承诺。
- 不先做全量自动迁移脚本。

## 智者裁决

外部顾问：GitHub Copilot CLI

### 第一轮裁决

- 强制排序：`C > A > D > B`
- 采纳结论：
  - 选择 `C`：收紧产品边界，审计存量坏卡，提供显式 remediation，不引入长期 bridge。
- 拒绝：
  - `B`：generic runtime bridge first, migration later。原因是它违背“可以删建，不背历史包袱”的新前提。
- 推迟：
  - 批量迁移工具、更多厂商专项处理，等出现证据再立项。

### 第二轮裁决

- Stage 0：先做只读审计，拿坏卡基线。
- Stage 1：封死所有写入/导入入口，已知 compat provider 不允许写成 `codex-api-key`。
- Stage 2：运行时对坏卡 fail-closed，给出显式修复路径，不做静默自动兼容。

## 最终方案

### Stage 0：审计基线

实现一个只读审计器，扫描持久化账号卡片，输出：

- `total_codex_api_key`
- `misclassified_known_openai_compatible`
- `by_provider`

判定规则：

- 只使用 sidecar 已有 `base_url -> known compat provider` 归一化规则；
- 不引入新的激进启发式；
- 当前重点验证 `OpenRouter` 是否仍是唯一有证据的历史坏卡。

交付物：

- 管理接口或启动日志中的只读审计结果；
- dev/prod profile 的坏卡基线。

### Stage 1：产品边界硬化

对所有写入路径统一加硬约束：

1. 新建
2. 导入
3. 更新

若 `base_url` 命中已知 `OpenAI-compatible` provider，则：

- 禁止保存为 `codex-api-key`
- 必须保存为 `openai-compatible`

行为要求：

- 返回显式错误；
- 错误文案要带 remediation：删除旧卡并按正确类型重建；
- 不做静默纠正；
- 不允许绕过。

### Stage 2：运行时行为

若历史坏卡仍然存在：

- 不参与路由；
- 不参与鉴权；
- 明确标记为“类型错误（历史数据）”；
- 提供显式修复路径；
- 不做隐式自动升格；
- 不做请求路径内的长期兼容桥。

## 测试与验收

### Positive

1. 新建 `OpenRouter` 这类已知 provider 时，若请求保存为 `codex-api-key` 则被拒绝；按 `openai-compatible` 类型重建才允许保存。
2. 导入已知 provider 且请求写成 `codex-api-key` 时，被拒绝并返回明确错误。
3. 历史坏卡存在时，审计器能命中。
4. 历史坏卡存在时，运行时将其排除在可路由集合之外。
5. 按 remediation 删除并重建后，请求恢复正常。

### Negative

1. 未知 `base_url` 不得被误判为已知 compat provider。
2. 合法的非 compat `codex-api-key` 不得被阻断。
3. 运行时不得对坏卡做静默自动转换并继续请求。
4. 审计器必须只读，不得修改数据。

### Shipping Gates

1. Stage 0 审计结果可复现。
2. Stage 1 覆盖全部写入入口。
3. Stage 2 下坏卡不会进入运行路由。
4. dev 验收可证明：
   - 坏卡会被命中并被隔离；
   - 删除重建后恢复请求。
5. `misclassified_known_openai_compatible` 在观察期内不再增长。

## 失败行为与回滚

- 默认策略：`fail-fast + 明确 remediation`
- 短期回滚只允许从“硬拦截”退回到“强告警不拦截”
- 不回滚到“永久运行时兼容”

## 延后项

- 批量迁移工具
- 自动修复脚本
- 与当前证据无关的厂商专项治理

## 升级触发

只有在以下情况之一出现时，才升级方案：

1. 出现新的、可复现的历史坏卡厂商证据；
2. 业务明确要求不能删建，只能原位迁移；
3. 坏卡数量已经大到手工 remediation 不再可接受。

## 2026-07-08 落地结果

### 已完成

1. Stage 0 审计基线
   - 新增 account-store 只读审计器。
   - `GET /v0/management/gettokens/account-store-diagnostics` 输出 `known_openai_compatible_audit`。
   - dev repro 命中 `OpenRouter` 1 张误分类卡。
2. Stage 1 产品边界硬化
   - `validateCandidate()` 拦截已知 OpenAI-compatible provider 被保存为 `codex-api-key`。
   - 新建、更新、批量 preview/create 复用同一校验路径。
   - 未知 `base_url` 的合法 `codex-api-key` 保持可写。
3. Stage 2 运行时隔离
   - config 与 account-store synthesis 均跳过误分类 `codex-api-key`。
   - management / SDK routeability 标记为 `misclassified_openai_compatible_provider`。
   - 存量坏卡不注册 auth、不注册模型、不参与真实请求。

### dev 验收

使用重建 sidecar `build/bin/cli-proxy-api`，BuiltAt `2026-07-08T09:39:34Z`，隔离 profile `/Users/linhey/.config/gettokens-dev-hy3-repro/config.yaml`：

1. diagnostics：
   - `total_codex_api_key=3`
   - `misclassified_known_openai_compatible=1`
   - `by_provider.openrouter=1`
   - remediation 为 `delete and recreate this account as openai-compatible`
2. `/v1/models`：
   - 返回模型数 `19`
   - 不包含 `tencent/hy3:free`
3. `/v1/responses`：
   - `model=tencent/hy3:free`
   - 返回 `HTTP 502 unknown provider for model tencent/hy3:free`
   - 该失败发生在本地 provider resolve 阶段，证明误分类卡未被转发到 OpenRouter。
4. 正确类型重建：
   - 在临时复制 profile 中新建 `kind=openai-compatible`、`provider=openrouter` 的 OpenRouter 卡片。
   - 新卡 `runtime_routeability_status=registered_routeable`。
   - `/v1/models` 包含 `tencent/hy3:free`。
   - `/v1/responses` 同模型请求返回 `HTTP 200`，输出 `OK`。

### 自动化门禁

已通过：

```bash
go test ./internal/gettokens/accountstore ./internal/watcher/synthesizer ./internal/api/handlers/management ./sdk/cliproxy -count=1
./scripts/ensure-sidecar.sh darwin arm64
```
