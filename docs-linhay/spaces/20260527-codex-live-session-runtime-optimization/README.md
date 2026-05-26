# Codex Live Session Runtime Optimization

## 背景

2026-05-27 排查 `cli-proxy-api` RSS 偏高与 `sidecar.log` 快速增长时，确认 `GET /v0/management/gettokens/live-sessions` 被高频轮询。该接口当前返回 live tracker 的完整实时快照：`sessions[]` 下包含 `requests[]`，每个 request 又包含 `timeline[]`。同时，缺失 `projectName` 的 session 会触发 `.codex/sessions` 与 `.codex/archived_sessions` JSONL 扫描缓存刷新，TTL 只有 10 秒。

这不是“未写数据库”的问题。`usage-observed-v1.sqlite` 与 `usage-attribution-v1.sqlite` 仍在更新；真正的问题是 realtime observability 的列表接口、轮询节奏、项目名补全、日志记录和内存留存边界混在一起，导致 CPU、RSS、磁盘日志和接口响应体一起放大。

## 目标

1. 将 live-session 列表轮询降为低成本、低日志、低响应体的 runtime row feed。
2. 将 request/timeline 详情改为按 session/detail 场景懒加载，并与已存在的历史 SQLite 分页语义对齐。
3. 避免 snapshot 热路径触发 `.codex` 全量 JSONL 扫描。
4. 保持 live-session UI 只读观测能力，不引入取消、重放、强制恢复等操作型能力。
5. 在不丢失历史诊断价值的前提下，压缩 realtime 内存留存。

## 范围

1. CLIProxyAPI fork：live-session management endpoints、runtime tracker、project name enrichment、gin access log 降噪。
2. GetTokens Wails bridge：必要时补充 root App DTO/method 映射与生成绑定。
3. Frontend live sessions workspace：轮询策略、列表/详情数据源拆分、页面隐藏暂停、浏览器 preview fallback。
4. 测试：tracker 纯模型/endpoint tests、Wails binding tests、frontend model/source tests、至少一轮本地 runtime smoke。
5. 文档：本 space、必要的 dev 技术说明、memory 写回。

## 非目标

1. 不展示原始 request/response payload、credentials、bearer token、cookie 或未脱敏错误体。
2. 不新增 request cancel、replay、强制 WebSocket 恢复。
3. 不删除 live-session 历史库；realtime prune 与 disk history cleanup 必须分离。
4. 不把浏览器 preview 当成 Wails/sidecar runtime 的完整替代验收。

## 验收标准

### 场景 1：列表轮询轻量化

Given Codex live sessions 页面打开并处于前台，When 前端轮询 live-session 列表，Then 列表接口只返回 summary 与 session row 字段，不包含 `requests[]` 和 request `timeline[]`。

### 场景 2：详情懒加载

Given 用户点击某个 live session 行，When 详情面板打开，Then 才按 `session_id` 拉取 request/timeline 详情，并支持 `limit / offset / window` 分页或等价约束。

### 场景 3：页面不可见暂停

Given live sessions workspace 不可见、窗口隐藏或用户切到其他 workspace，When 没有显式详情刷新需求，Then 前端停止轮询或降到低频，不继续刷 `sidecar.log`。

### 场景 4：项目名补全不阻塞 snapshot

Given 某些 session 缺失 `projectName`，When 调用列表 snapshot，Then snapshot 不同步全盘扫描 `.codex` JSONL；项目名通过请求时携带、精准查找或后台缓存刷新补齐。

### 场景 5：实时内存可控且历史不丢

Given 有大量 Codex requests 通过 sidecar，When 请求完成并超过 realtime 留存窗口，Then 内存 tracker 只保留必要摘要或被 prune；历史详情仍可从 disk-backed history endpoint 分页查询。

### 场景 6：日志降噪

Given live sessions 列表接口稳定 2xx 且响应未变，When 前端持续观测，Then sidecar access log 不再为每次成功轮询写完整 info 行，或至少对该路径采样/降级/慢请求记录。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-codex-live-session-runtime-optimization`
- worktree：`../GetTokens-worktrees/20260527-codex-live-session-runtime-optimization/`

## 相关链接

- 技术计划：`plans/runtime-optimization-plan-v01.md`
- 领域规则：`.agents/skills/gettokens-domain-engineering/SKILL.md` 的 `Codex Live Sessions`
- 已有关联 space：
  - `docs-linhay/spaces/20260521-codex-live-session-detail/README.md`
  - `docs-linhay/spaces/20260523-codex-live-session-current-account/README.md`
  - `docs-linhay/spaces/20260525-codex-live-session-request-info/README.md`

## 当前状态
- 状态：implemented-browser-smoked
- 最近更新：2026-05-27
- 已实现：
  1. sidecar live-session 列表改成 row feed，默认不再返回 `requests[]` / request `timeline[]`
  2. GetTokens 新增 live-session history Wails/root binding，前端详情改为按 `session_id` 懒加载
  3. 前端轮询按页面可见性与 active session 数调频，详情刷新独立于列表
  4. projectName 补全移出 snapshot 同步热路径，改为后台缓存刷新
  5. `/gettokens/live-sessions` 成功且快速的 2xx 管理轮询 access log 默认降噪
  6. 浏览器 preview 冒烟已完成，截图产物：`output/playwright/20260527-codex-live-sessions-runtime-optimization-smoke.png`
- 待补：
  1. 真实 Wails 桌面窗口 smoke / screenshot 尚未执行；当前只完成 browser preview 验收
