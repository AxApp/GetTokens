# 20260615 Routeability Release / 正式环境复验计划

## 背景

`公司 1` 的 `codex-api-key` routeability 分叉已经在以下层级闭环：

1. reference sidecar fork commit：`688f2972 fix(gettokens): close account store routeability split-brain`
2. 主仓集成 commit：`78da1315 feat(accounts): unify runtime routeability diagnostics`
3. `build/bin/cli-proxy-api.meta.json` 与 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json` 已对齐到 clean commit `688f29726719e01e1206d23db47017dea8028253`
4. 隔离正式数据副本、真实 `gettokens-dev` profile、以及真实 dev App 均已验证

当前剩余缺口不是继续开发，而是 release 后的正式环境复验。

## 目标

1. 确认正式环境 sidecar 已实际升级到包含 `688f2972` 的产品构建。
2. 确认正式环境 `公司 1` 在真实运行态中不再出现：
   - startup split-brain
   - stale transient route-guard 压制
   - `channel-routing/explain` panic
3. 保留一组最小但足够硬的正式环境证据，能回答“修复是否真的到生产”。

## 非目标

1. 本计划不要求在正式环境继续改代码。
2. 不直接替换 `/Applications/GetTokens.app` 二进制，除非进入正式 release 流程。
3. 不为了复验去改动正式账号数据。

## 前置条件

1. 已存在包含主仓 commit `78da1315` 的正式构建产物。
2. 正式版 GetTokens 可正常启动。
3. 用户允许进行正式环境只读复验。

## 正式环境最小证据矩阵

| 项目 | 证据 | 通过标准 |
| --- | --- | --- |
| 正式版 bundle 版本 | `/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json` 或二进制版本头 | commit 不早于 `688f2972` 对应产物 |
| 正式 sidecar 存活 | `lsof -Pan -iTCP:<prod-port> -sTCP:LISTEN`、`/healthz` | 端口可达且进程归因为正式版 |
| 账号 runtime 状态 | `GET /v0/management/accounts` 中 `acct_dd2172ea-9dd9-458a-88bd-590cc55a468c` | `runtime_apply_status=applied`，`runtime_routeability_status=registered_routeable`，`runtime_registered_models_count>0` |
| explain 可解释性 | `POST /v0/management/gettokens/channel-routing/explain` | 返回 `200`，`公司 1` 出现在 `candidates` |
| 模型可见性 | `GET /v0/management/accounts/<公司1>/models` | 至少包含 `gpt-5.4` / `gpt-5.5` |
| 无 panic 回归 | 正式 `sidecar.log` / 控制台日志 | 无 `assignment to entry in nil map`、无 startup `ListAccounts` schema 错误 |

## 建议执行顺序

优先使用只读复验脚本执行同一组证据门禁：

```bash
docs-linhay/scripts/verify-prod-routeability-readonly.sh
```

默认参数：

- `GETTOKENS_VERIFY_BASE_URL=http://127.0.0.1:8317`
- `GETTOKENS_VERIFY_ACCOUNT_KEY=acct_dd2172ea-9dd9-458a-88bd-590cc55a468c`
- `GETTOKENS_VERIFY_MODEL_PRIMARY=gpt-5.4`
- `GETTOKENS_VERIFY_MODEL_SECONDARY=gpt-5.5`
- `GETTOKENS_VERIFY_EXPECTED_COMMIT=688f29726719e01e1206d23db47017dea8028253`
- `GETTOKENS_VERIFY_READY_RETRIES=10`
- `GETTOKENS_VERIFY_RETRY_DELAY_SECONDS=1`

脚本只做只读动作：读取 bundle meta、请求 `/healthz`、查询 management 账号列表、调用 `channel-routing/explain`、查询账号 models、检查最近 sidecar log tail 中是否还有本轮已修复的 panic/schema 签名。它不会替换 `/Applications/GetTokens.app`、不会 kill/restart 正式进程，也不会修改正式配置或账号数据。

脚本退出码判读：

| 退出码 | 含义 | 后续动作 |
| --- | --- | --- |
| `0` | 正式环境已证明 `公司 1` routeable | 写回 README 与 memory，关闭本计划 |
| `20` | 正式 bundle meta 缺失或 commit 不是目标修复 commit | 转 release / 分发问题，不按 routeability 回归处理 |
| 其他非零 | 已是可复验环境，但某项 runtime 证据失败 | 按失败分类继续排查正式数据或真实请求链路 |

如需手工复核，按以下顺序执行：

1. 读取正式版 sidecar 元信息：
   - `cli-proxy-api.meta.json`
   - 如无 meta，再看二进制版本头/commit
2. 确认正式 sidecar 端口和进程归因。
3. 调正式 management API：
   - `/v0/management/accounts`
   - `/v0/management/gettokens/channel-routing/explain`
   - `/v0/management/accounts/<公司1>/models`
4. 抽查正式 sidecar 日志，确认没有 explain panic 或 startup schema 异常。
5. 把正式复验结果写回当前 space README 与 memory。

## 失败分流

### A. 正式版仍是旧 commit

结论：问题不是修复失效，而是发布物未升级。

动作：

1. 记录正式版当前 commit / version
2. 转入 release / 分发链路排查
3. 不把这类结果误判为 routeability 代码回归

### B. 正式版已是新 commit，但 `公司 1` 仍不 routeable

结论：需要重新定位正式环境特有差异。

优先检查：

1. 正式 `channel-routing/config.json.runtimeStates` 是否仍有新的 transient 残留
2. 正式 SQLite `account_runtime_apply_state` 是否已被 schema/repair 正常推进
3. 是否存在正式环境独有的数据污染或端口/进程误归因

### C. explain 200，但真实请求仍 `auth_unavailable`

结论：routeability/explain 与真实请求间仍有新分叉。

优先检查：

1. 当前正式版是否存在额外旧 sidecar 残留进程
2. live route decision / live session 证据是否指向别的账号池快照
3. 产品壳是否仍在使用旧 bundle 内 sidecar

## 完成标准

满足以下任一条件即可把本计划关闭：

1. 正式环境复验证明修复已生效，并已写回 docs/memory；
2. 已证明正式环境仍是旧构建，问题明确转化为 release/分发问题，并已写回 docs/memory。
