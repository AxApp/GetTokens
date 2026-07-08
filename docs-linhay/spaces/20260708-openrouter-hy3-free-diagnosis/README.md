# 20260708 OpenRouter hy3 free diagnosis

## 背景

用户反馈正式环境中的 OpenRouter 卡片请求 `tencent/hy3:free` 不通，要求先做事实排查与复现测试。当前轮先定位问题是在 OpenRouter 上游、GetTokens sidecar 路由/协议边界，还是正式环境卡片配置本身。

## 目标

1. 固定正式环境当前 OpenRouter 卡片、路由与本地 Codex 配置事实。
2. 在隔离的 dev repro 环境复现 `tencent/hy3:free` 请求。
3. 给出根因判断与后续修复边界。

## 范围

- 正式环境只读取证：`~/.config/gettokens/`、prod sidecar 进程与日志。
- 允许复制正式环境数据到 dev/repro 环境做大胆测试。
- 允许对 repro sidecar 做请求、状态切换与日志分析。

## 非目标

- 本轮不直接修改正式版 `/Applications/GetTokens.app` 或重启/kill 正式版进程。
- 本轮不先做 UI 或功能修复，除非测试后确认是 GetTokens 自身 bug 且用户继续要求修。

## 验收标准

1. 给出正式环境 OpenRouter 卡片的真实存储形态、模型声明与当前启停状态。
2. 给出至少一条直打上游和一条走 GetTokens sidecar 的复现证据。
3. 明确结论属于：
   - 上游 OpenRouter / 模型可用性问题；
   - GetTokens 配置/路由/协议问题；
   - 账号卡创建类型错误或状态错误；
   - 或上述因素的组合。

## 证据门禁

### 问题来源

- 用户口头反馈：“正式环境的 OpenRouter 卡片为什么请求 `tencent/hy3:free` 不通，你来测试下。”

### 当前代码 / 运行态事实位置

- 正式环境 sidecar：`/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config /Users/linhey/.config/gettokens/config.yaml`
- 正式环境监听端口：`8317`
- 正式环境账号库：`~/.config/gettokens/accounts-v1.sqlite`
- 正式环境日志：`~/.config/gettokens/sidecar.log`
- 本地 Codex provider：`~/.codex/config.toml` 中 `model_providers.gettokens.base_url = "http://127.0.0.1:8317/v1"`

### 当前已确认事实

1. prod sidecar 正在运行，PID `78877`，监听 `*:8317`。
2. prod 账号库中的 OpenRouter 卡片不是 `openai-compatible`，而是：
   - `kind=codex-api-key`
   - `provider=codex`
   - `title=OpenRouter`
   - `base_url=https://openrouter.ai/api`
   - `models_json=[{"name":"tencent/hy3:free","alias":""}]`
3. 同一张卡当前数据库状态为 `disabled=1`；`account_runtime_apply_state` 显示它最近一次仍被注册为 `registered_routeable`，`registered_models_count=8`。
4. 当前 dev 账号库与 prod 不一致：
   - `~/.config/gettokens/accounts-v1.sqlite` 与 `~/.config/gettokens-dev/accounts-v1.sqlite` 哈希不同；
   - dev 中同名 OpenRouter 卡的 `models_json=[]`。

### 预期验收方式

- 用隔离 repro profile 复制 prod 数据后，分别验证：
  - 直接请求 OpenRouter 上游；
  - 通过 repro sidecar 请求 `/v1/responses`。

### 可推翻候选根因的证据

- 若直打 OpenRouter 上游都失败，则优先判定为上游模型/API 兼容边界问题，不先归咎 GetTokens。
- 若直打上游成功、sidecar 失败，则优先判定为 GetTokens 路由或协议实现问题。
- 若 sidecar 成功但正式环境失败，则优先回到 prod 卡片状态、channel routing 或本地 Codex 请求路径差异。

## 2026-07-08 复现结果

### repro 环境

- 采用正式版 sidecar 二进制：`/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api`
- 隔离 profile：`~/.config/gettokens-dev-hy3-repro/`
- 复制 prod 的 `config.yaml`、`accounts-v1.sqlite`、`channel-routing/config.json`
- repro 端口：`18317`

### 请求证据

1. 直打 OpenRouter 上游：
   - 请求：`POST https://openrouter.ai/api/v1/responses`
   - body：`{"model":"tencent/hy3:free","input":"Say OK only."}`
   - 结果：`HTTP 200`
   - 响应模型：`tencent/hy3-20260706:free`
   - 结论：上游当前可用，且接受 `tencent/hy3:free` 作为别名。
2. 走 repro sidecar：
   - 请求：`POST http://127.0.0.1:18317/v1/responses`
   - body：`{"model":"tencent/hy3:free","input":"Say OK only."}`
   - 结果：`HTTP 502`
   - 响应：`unknown provider for model tencent/hy3:free`
   - 日志：`route resolve failed: unknown provider model="tencent/hy3:free"`
3. repro 中将该卡片从 `disabled=true` 切到 `disabled=false` 后：
   - `/v0/management/accounts/...` 显示 `runtime_routeability_status=registered_routeable`
   - 但 `/v1/models` 仍只有 19 个模型，不包含 `tencent/hy3:free`
   - `/v0/management/accounts/.../models` 仅返回 8 个已注册模型，同样不包含 `tencent/hy3:free`

### 代码边界结论

根因不在 OpenRouter 上游，而在 GetTokens/CLIProxyAPI 对这张卡片的 runtime model 注册路径：

1. 这张 prod OpenRouter 卡片是 `kind=codex-api-key`，因此走 `Provider=codex` 的模型注册分支。
2. `synthesizeAccountStoreCodexKey()` 只把 `models_json` 写成 `models_hash` attribute，不把具体模型列表写进 runtime auth。
3. `registerModelsForAuth()` 的 `case "codex"` 分支只注册内置 Codex catalog / config codex models，不读取该卡片的 `models_json`。
4. 因此 `tencent/hy3:free` 从未进入 global model registry，最终 `/v1/responses` 在 provider 解析阶段直接失败为 `unknown provider for model ...`。

### 涉及代码

- `docs-linhay/references/CLIProxyAPI/internal/watcher/synthesizer/config.go`
  - `synthesizeAccountStoreCodexKey()`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/service.go`
  - `registerModelsForAuth()` 的 `case "codex"` 分支

### 当前判断

- 这是 **GetTokens runtime model registration 边界问题**，不是 OpenRouter 上游不可用。
- 同时 prod 这张卡片的类型也不理想：它被存成 `codex-api-key`，而不是 `openai-compatible`。对 OpenRouter 这种第三方模型目录，当前实现更适合走 `openai-compatible` 路径。

## 最终治理实现与验证

### 方案调整

用户已明确：错误类型账号可以删除并重建，不需要长期保留历史兼容路径。因此本轮最终没有采用“把历史 OpenRouter `codex-api-key` 在 runtime 自动升格成 compat auth”的方案，而是改为：

1. 写入边界挡住：已知 `OpenAI-compatible` provider 不能保存为 `codex-api-key`。
2. 存量坏卡审计：管理诊断输出坏卡数量、provider 分布和 remediation。
3. 运行态隔离：存量坏卡不注册 auth、不注册模型、不参与路由，routeability 标记为类型错误并提示删除重建。

### 实现

已在 `docs-linhay/references/CLIProxyAPI` 内落地：

1. `internal/gettokens/accountstore/openai_compat_governance.go`
   - 新增已知 compat provider 识别与误分类审计。
   - 当前已知 provider 覆盖 `openrouter`、`deepseek`、`siliconflow`、`zhipu`、`moonshot`、`dashscope`、`groq`、`together`、`doubao`、`xiaomimimo`。
2. `internal/gettokens/accountstore/accounts.go`
   - `validateCandidate()` 拦截已知 compat provider 以 `codex-api-key` 写入。
   - 新建、批量预览/导入、更新复用同一校验路径。
3. `internal/api/handlers/management/accounts_store.go`
   - `account-store-diagnostics` 增加 `known_openai_compatible_audit`。
4. `internal/watcher/synthesizer/config.go`
   - config 与 account-store 两条来源中的误分类 `codex-api-key` 均跳过 synthesis。
   - 不做隐式 provider 升格。
5. `sdk/cliproxy/service.go` 与 management routeability
   - 存量坏卡标记为 `degraded` / `misclassified_openai_compatible_provider`。
   - reason 带 `delete and recreate this account as openai-compatible`。

### 自动化验证

通过以下测试：

```bash
go test ./internal/gettokens/accountstore ./internal/watcher/synthesizer ./internal/api/handlers/management ./sdk/cliproxy -count=1
```

覆盖结论：

- OpenRouter 这类已知 compat provider 不能再以 `codex-api-key` 写入。
- 未知 `base_url` 的合法 `codex-api-key` 不受影响。
- 批量 preview/create 会暴露同一类错误。
- 存量坏卡能被审计命中。
- 存量坏卡不会被 synthesizer 注册到 runtime。
- service routeability 会显示明确 degraded 分类和 remediation。

### dev smoke

使用重建后的 sidecar：

- 二进制：`build/bin/cli-proxy-api`
- BuiltAt：`2026-07-08T09:39:34Z`
- profile：`/Users/linhey/.config/gettokens-dev-hy3-repro/config.yaml`
- port：`18317`
- management 临时 key：`MANAGEMENT_PASSWORD=gt-dev-diagnostics`

验证结果：

1. `GET /v0/management/gettokens/account-store-diagnostics`
   - `total_codex_api_key=3`
   - `misclassified_known_openai_compatible=1`
   - `by_provider.openrouter=1`
   - 命中卡片：`OpenRouter`
   - remediation：`delete and recreate this account as openai-compatible`
2. `GET /v1/models`
   - 返回模型数量：`19`
   - `tencent/hy3:free` 不存在。
3. `POST /v1/responses`
   - body：`{"model":"tencent/hy3:free","input":"ping"}`
   - 返回：`HTTP 502`
   - 错误：`unknown provider for model tencent/hy3:free`
   - 结论：坏卡未参与 runtime route，符合 fail-closed 预期。
4. 临时复制 profile 中按 remediation 新建正确 `openai-compatible` OpenRouter 卡片：
   - 新卡 `runtime_routeability_status=registered_routeable`
   - `GET /v1/models` 返回模型数量从 `19` 变为 `20`，包含 `tencent/hy3:free`
   - `POST /v1/responses` body：`{"model":"tencent/hy3:free","input":"Say OK only."}`
   - 返回：`HTTP 200`，输出 `"OK"`

### 最终结论

- 原始根因仍是：OpenRouter 被错误保存为 `codex-api-key`，导致模型声明没有进入正确的 OpenAI-compatible runtime 注册链路。
- 最终治理不是“兼容这个错误形态”，而是把它作为错误数据处理：新写入挡住，旧数据审计并隔离，用户删除后按 `openai-compatible` 重建。
- 当前证据只证明 OpenRouter 存在历史坏卡；其他模板是否有同类问题由审计器统一发现，不先做无证据专项修复。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260708-openrouter-hy3-free-diagnosis`
- worktree：`../GetTokens-worktrees/20260708-openrouter-hy3-free-diagnosis/`

## 相关链接

- [Codex model catalog projection plan](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260602-codex-model-catalog-projection-plan.md)
- [20260531 bug fix README](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260531-bug-fix/README.md)
- [Canonical OpenAI-Compatible Governance Plan v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260708-openrouter-hy3-free-diagnosis/plans/canonical-openai-compatible-governance-plan-v01.md)

## 方案裁决

- 用户已明确：这类错误账号可以删除并重建，因此方案不以长期兼容历史坏形态为目标。
- 使用外部顾问 `GitHub Copilot CLI` 做了两轮裁决，最终选择：
  - 收紧产品边界；
  - 审计并隔离存量坏卡；
  - 用显式 remediation 替代长期 runtime bridge。
- 详细方案见：
  - [canonical-openai-compatible-governance-plan-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260708-openrouter-hy3-free-diagnosis/plans/canonical-openai-compatible-governance-plan-v01.md)

## 当前状态
- 状态：completed
- 最近更新：2026-07-08
