# GetTokens Domain Glossary

日期：2026-06-16
状态：初版，可随重复术语冲突继续增补

## 使用规则

1. 代码、测试、space、dev docs、memory 和 agent prompt 中出现同一概念时，优先使用本文 canonical term。
2. 如果用户、上游或第三方文档使用不同名称，文档中可以保留原词，但第一次出现时映射到 canonical term。
3. 新增术语需要写清权威事实源和验收证据，避免只沉淀口头别名。
4. 术语如果只服务单个 feature 草稿，先放对应 `space`；跨多个任务重复后再提升到本文。

## Runtime / Sidecar

| Canonical term | 中文语义 | 权威边界 | 验收证据 |
| --- | --- | --- | --- |
| sidecar | GetTokens 运行态自治层，承接账号选择、route guard、usage、proxy、management API 等热路径 | `CLIProxyAPI#gettokens/sidecar` 与本仓 bundled sidecar | sidecar API response、sidecar log、process path、dev/prod config path |
| management API | Wails / frontend 读取或修改 sidecar 运行态的本地 API | sidecar HTTP API，不由前端伪造成功状态 | curl/API response、Wails client tests |
| ready state | sidecar 已可用且账号数据链路可读写的状态 | sidecar readiness，不等同 UI mount | management API status、dev App ready log |
| authority fact | 由 sidecar 或后端权威源生成的事实，不在前端二次推导 | sidecar / backend DTO | DTO 字段透传、frontend fallback 只在无 fact 时生效 |
| dev profile | `GETTOKENS_APP_PROFILE=dev` 对应的隔离运行态 | `~/.config/gettokens-dev/` | config path、lsof、sidecar log |
| production profile | 正式版运行态与用户真实配置 | `/Users/linhey/.config/gettokens/` | 只读证据；未经授权不得修改正式版 |

## Routing / Accounts

| Canonical term | 中文语义 | 权威边界 | 验收证据 |
| --- | --- | --- | --- |
| account store | 账号与凭证 SQLite 统一事实源 | sidecar SQLite / Wails DTO | SQLite fixture、migration tests、Wails account DTO |
| channel routing | Codex / Claude 等 channel 的账号选择策略 | sidecar route engine | route decision、routing config、focused route tests |
| route guard | 在请求发出前阻止不可路由账号或模型的保护层 | sidecar guard / filter | droppedReasons、guard reason、dry-run diagnostics |
| route decision | 一次请求选择账号、过滤候选、落到最终 provider 的结构化决策记录 | sidecar route trace | route decision ledger、candidateCount、selected account |
| balanced mode | 在当前可路由候选池里做均衡的路由模式 | sidecar routing policy | routeMode、decision trace；不默认等于项目/请求/token 公平 |
| candidate pool | 某次请求经过 provider、model support、health、quota、guard 过滤后的候选账号集合 | sidecar route engine | candidateCount、droppedReasons |
| quota fact | quota 当前状态的权威事实表达 | sidecar quota runtime | `QuotaRuntimeState.fact`、Wails/root/frontend 透传 |
| requestability | 账号对某个模型或请求是否可用 | sidecar/provider metadata | model support、guard reason、route dry-run |

## Sessions / Usage

| Canonical term | 中文语义 | 权威边界 | 验收证据 |
| --- | --- | --- | --- |
| live sessions | 正在发生或近期仍活跃的 Codex/Claude 会话观测 | sidecar / usage projection | live sessions API、bounded snapshot |
| usage attribution | 将请求、token、成本或 session 归因到账号、项目、模型或 channel 的规则 | sidecar / usage projection | attribution tests、usage records、privacy boundary |
| bounded snapshot | 有明确数量、时间或隐私边界的运行态快照 | sidecar / Wails DTO | limit 参数、redaction、snapshot timestamp |
| decision ledger | 可复盘路由选择和 guard 过滤的记录 | sidecar route observability | structured log/API artifact |

## Wails / Frontend

| Canonical term | 中文语义 | 权威边界 | 验收证据 |
| --- | --- | --- | --- |
| Wails App binding | Wails 实际绑定的 `main.App` 方法与 DTO | `cmd/gettokens/app.go` / `cmd/gettokens/app_types.go` / `cmd/gettokens/app_mappers.go` | generated `frontend/wailsjs` exports |
| Wails core app | `internal/wailsapp.App` 内部实现层 | Go internal package | root mapper tests、core tests |
| generated bindings | Wails 生成的 frontend 调用层 | `frontend/wailsjs` | `scripts/wails-cli.sh`、typecheck |
| dev bridge | 浏览器 preview 或 dev server 访问本地 runtime 数据的显式桥 | `vite.config.js` / docs scripts | DOM assertions、source label、no hidden Wails shim |
| preview mode | 不依赖真实 Wails runtime 的可复现浏览器预览状态 | frontend route/query/hash | `source=preview`、headless screenshot |
| frame hash | GetTokens app 内页面 frame 的 hash 路由 | frontend router | `#frame=<name>` preservation tests |
| modal hash | modal/detail 可恢复路由参数 | frontend router canonicalizer | `detail=<id>` / `modal=<route>` retained on close/open |

## Documentation / Agent Governance

| Canonical term | 中文语义 | 权威边界 | 验收证据 |
| --- | --- | --- | --- |
| space | 单个需求或 topic 的长期文档资产 | `docs-linhay/spaces/<space-key>/` | README、plans、screenshots |
| worktree | feature 的临时代码执行环境 | `../GetTokens-worktrees/<space-key>/` | `git worktree list` |
| evidence gate | 进入修复前必须写清的问题来源、事实位置、现象和验收方式 | space README / plan | evidence matrix、acceptance path |
| session distillation | 长会话或重要修复后沉淀可复用模式 | `.agents/skills` / dev docs / memory | updated files、check-docs、diff check |
| skill admission gate | 判断是否新增或扩展项目 skill 的门禁 | `docs-linhay/dev/20260616-agent-skill-operating-model.md` | repeated pattern、trigger、steps、validation |
| tracer bullet | 先打通一条窄的端到端行为链再扩展 | tests / runtime evidence | failing test -> minimal fix -> regression check |

## 待观察术语

以下术语先保留观察，不立即提升为 canonical term：

1. `OmniRoute`：当前是多 space 产品线/能力集合名，具体功能仍以 Route Resilience、Quota Intelligence、Doctor Workbench、Extension Contract、Protocol Bridge 分别记录。
2. `Doctor Workbench`：当前作为具体 space 和页面能力存在，后续若拆成多个 runtime 诊断子域，再补充更细术语。
3. `Protocol Bridge`：当前仍在 contract / manifest 阶段，runtime adapter 术语等实现稳定后再收敛。
