# WebView Memory Footprint

## 背景

用户反馈正式版 GetTokens 的 PID `90119` 显示占用约 `5.75GB` 内存，并要求判断是否属于 GetTokens 问题以及完成调查、优化和处理。

初步只读调查确认：

- `90119` 是 `/Applications/GetTokens.app` 关联的 `com.apple.WebKit.WebContent` 进程，不是 sidecar 主体。
- 正式版 GetTokens 主进程为 `90114`，sidecar `cli-proxy-api` 为 `90122`。
- `vmmap -summary 90119` 在 2026-07-07 12:54 显示 `Physical footprint: 2.8G`、`Physical footprint (peak): 9.2G`，`WebKit Malloc` 约 `11.5G` virtual / `2.5G` allocated swapped。
- `~/Library/WebKit/com.wails.GetTokens/WebsiteData/LocalStorage` 与 `IndexedDB` 为 `0B`，`~/Library/Caches/com.wails.GetTokens` 约 `772K`，排除“持久化 WebKit cache/localStorage 本身很大”作为主因。
- 本机 `~/.codex/sessions` 约 `3.5G`、`~/.codex/archived_sessions` 约 `9.7G`、会话相关文件约 `5947` 个；会话管理页面属于高风险入口。

## 目标

1. 明确 GetTokens WebView 内存高占用的可证实责任边界。
2. 优先消除 session-management 前端无界持有会话消息和 RAW JSON 的风险。
3. 增加回归测试，防止详情页加载大量消息后长期保留过多对象。
4. 保留正式版只读证据，不修改 `/Applications/GetTokens.app` 正式版二进制或配置。

## 范围

- 前端 `session-management` 详情状态、消息分页保留策略、RAW JSON 缓存策略。
- 前端 `codex-live-sessions` overview/detail 历史加载 state 的保留策略。
- Wails `AnalyzeCodexSessions` 批量会话分析的瞬时内存峰值路径。
- 只读运行态证据：`ps`、`vmmap`、WebKit 站点数据目录大小、本机会话数据规模。
- 自动化验证：focused frontend unit/source tests、typecheck/build 或匹配风险的较窄验证。

## 非目标

- 不重启、kill 或替换正式版 GetTokens。
- 不删除用户的 Codex / Claude 会话历史。
- 不在本轮重写 sidecar 会话扫描器或磁盘索引格式。
- 不重写 Codex live sessions 轮询结构比较或 sidecar 历史 ledger；本轮只收敛前端历史加载保留窗口。

## 证据门禁

| 项 | 当前证据 | 进入实现条件 | 反证 |
| --- | --- | --- | --- |
| 问题来源 | 用户指出 PID `90119` 约 `5.75GB` | 已满足 | 该 PID 不属于 GetTokens WebView |
| 事实位置 | `ps` 显示 `90119` 为 `com.apple.WebKit.WebContent`，GetTokens 主进程 `90114`，sidecar `90122` | 已满足 | WebContent 不归属 GetTokens |
| 当前现象 | `vmmap` 显示 WebContent peak `9.2G`，当前 footprint `2.8G`，WebKit Malloc allocated/swap 约 `2.5G` | 已满足 | 只有虚拟地址预留，没有物理/swap footprint |
| 排除项 | WebKit LocalStorage / IndexedDB 为 `0B`，Cache 约 `772K` | 已满足 | WebKit 持久化站点数据本身巨大 |
| 高风险入口 | 本机会话文件总量约 `13.2G`，session-management 当前代码按页追加消息且 RAW JSON 按消息缓存 | 需要测试锁定上限 | 前端已有明确消息/RAW JSON 保留上限 |
| 相邻风险入口 | `codex-live-sessions` overview/detail 的历史 `load more` 会把分页请求对象继续 merge 到 React state | 需要测试锁定前端保留窗口 | 手动加载历史已明确有前端 request 上限 |
| Wails 分析峰值 | `AnalyzeCodexSessions` 旧实现会对每个目标调用 `parseSessionFile(..., true)`，先构造完整 `Messages` 再分析 | 需要改成逐文件流式聚合并补测试 | 已经是流式读取，不构造 full detail messages |
| 验收方式 | focused test 证明消息窗口和 RAW JSON cache 有上限；运行相关测试和构建/typecheck | 实现后执行 | 测试不能覆盖大消息保留边界 |

## 根因判断

我认为本轮可证实的根因切片是：`session-management` 详情 hook 在 `frontend/src/features/session-management/useSessionManagementDetail.ts` 中对分页消息使用 `messages: [...previous.detail.messages, ...page.messages]` 无界追加，并用 `rawJSONByMessageID` 按消息无界缓存 RAW JSON；在本机 `~/.codex/sessions + archived_sessions` 超过 `13G` 的输入规模下，这会让 WebKit WebContent 长期保留大量 JS/React/DOM 相关对象。

这解释了以下症状：

- 高占用发生在 GetTokens 的 `com.apple.WebKit.WebContent`，不是 sidecar。
- `vmmap` 大头是 `WebKit Malloc`，不是磁盘 cache 或 LocalStorage。
- `LocalStorage / IndexedDB / WebKit Cache` 本身很小，说明主要压力来自运行中对象。
- 详情页消息与 RAW JSON 都是用户显式交互后进入 WebView state 的大对象，旧实现没有保留上限。

## 实施记录

- 新增 `frontend/src/features/session-management/sessionMemory.ts`。
- `SESSION_DETAIL_MAX_RETAINED_MESSAGES = 300`：详情页只保留最近 300 条已加载消息。
- `SESSION_DETAIL_RAW_JSON_CACHE_LIMIT = 20`：RAW JSON 展开缓存只保留最近 20 条。
- `useSessionManagementDetail` 初始详情、加载更多消息、RAW JSON 写入均接入 bounded helpers。
- 新增 `frontend/src/features/session-management/sessionMemory.test.mjs`，并纳入 `frontend/package.json` 的 `test:unit`；同步 `frontend/package.json.md5`。
- 新增 `frontend/src/features/codex-live-sessions/model/historyMemory.ts`。
- `codexLiveOverviewHistoryMaxRetainedRequests = 400`，`codexLiveDetailHistoryMaxRetainedRequests = 250`：实时会话 overview/detail 的手动历史加载只保留固定请求窗口，到上限后关闭前端 load-more。
- `CodexLiveSessionsFeature` 的 overview/detail refresh 与 load-more 路径均接入 bounded helpers，移除旧的无界 `mergeCodexLiveHistoryRequests` / `mergeCodexLiveHistoryRefresh`。
- `internal/wailsapp/session_analysis.go` 的 `AnalyzeCodexSessions` 不再为批量分析调用 `parseSessionFile(..., true)`，改为先读取 metadata，再用 `analyzeCodexSessionFile` 逐行扫描 JSONL 并累计关键词、短语、角色贡献。
- `internal/wailsapp/session_management_test.go` 增加源码守护，防止 `AnalyzeCodexSessions` 重新构造完整 detail message slice。
- 沉淀到 `.agents/skills/gettokens-domain-engineering/SKILL.md`：`Session Management Local Files` 的详情/RAW JSON state 必须显式有界；`Codex Live Sessions` 的前端历史 state 也必须有固定 request 窗口。

## Scope Blast 结论

| 区域 | 结论 | 处理 |
| --- | --- | --- |
| `session-management` detail messages / RAW JSON | 同类且高风险：会话文件可达多 GB，旧实现无界追加与无界 RAW JSON cache | 已修，消息 300 条、RAW JSON 20 条 |
| `codex-live-sessions` overview/detail history | 相邻风险：默认轮询快照有界，但用户手动历史加载旧实现可继续累积 request 对象 | 已修，overview 400 条、detail 250 条 |
| `AnalyzeCodexSessions` Wails 批量分析 | 相邻风险：不会常驻 WebKit，但旧实现会在 Wails 进程内为每个目标构造完整消息切片，容易形成多 GB session 输入下的瞬时峰值 | 已修，逐文件流式聚合，不保留 full detail messages |
| `codex-live-sessions` structural merge `JSON.stringify` | 只证明存在轮询 transient allocation/CPU 候选，未证明长期持有大对象 | 本轮不改，保留为后续性能候选 |
| `session-management` snapshot localStorage cache | 当前只缓存 summary，且正式版 WebKit LocalStorage/IndexedDB 为 `0B` | 不改 |
| accounts / status / settings 等页面的 localStorage 与复制 JSON | 多为小型偏好、导入/导出或用户显式复制文本；账号列表已有窗口化验收 | 不改 |

## 验证记录

- 红灯：`node --test src/features/session-management/sessionMemory.test.mjs` 先因缺少 `sessionMemory.ts` 失败。
- 绿灯 focused：`node --test src/features/session-management/sessionMemory.test.mjs`，4 pass。
- session-management 相关：`node --test src/features/session-management/model.test.mjs src/features/session-management/cache.test.mjs src/features/session-management/sessionMemory.test.mjs src/features/session-management/sessionPluginConsolePanel.test.mjs`，37 pass。
- codex-live-sessions focused：`node --test src/features/codex-live-sessions/model.test.mjs`，73 pass。
- 前端全集：`npm run test:unit`，1091 pass。
- 类型检查：`npm run typecheck` 通过。
- 生产构建：`npm run build` 通过，仅保留既有 Vite chunk-size warning。
- Wails focused：`go test ./internal/wailsapp -run 'TestAnalyzeCodexSessions' -count=1` 通过。
- Wails 回归：`go test ./internal/wailsapp -count=1` 通过。
- Go 全量：`go test ./... -count=1` 首次在 `internal/codexbinary` 偶发版本检测超时后，单包复测 `go test ./internal/codexbinary -count=1 -v` 通过，随后 `go test ./... -count=1` 通过。
- 桌面构建：`./scripts/wails-cli.sh build` 通过，产物位于仓库内 `build/bin/GetTokens.app`，未安装或替换 `/Applications/GetTokens.app`。
- 文档与空白：`docs-linhay/scripts/check-docs.sh`、`git diff --check` 通过。

## 剩余风险

- 本轮没有触碰正式版 `/Applications/GetTokens.app`，修复需要进入下一次 dev/build/release 后才会影响正式版。
- Codex live sessions 的轮询结构比较仍可能产生 transient allocation/CPU 峰值，但本轮证据尚不足以认定它是 PID `90119` 这次内存峰值的主因，先记录为后续候选。
- 300 条消息 / 20 条 RAW JSON 是前端当前保留上限；如未来支持“全量会话连续浏览”，需要虚拟化消息列表或后端只读流式窗口，而不是取消上限。
- 实时会话页手动历史加载现在是 dashboard 级保留窗口，不再承诺在前端一次性浏览完整磁盘历史；若未来需要深度历史浏览，应做独立虚拟化/检索页面。
- `AnalyzeCodexSessions` 仍会线性读取目标 JSONL 并维护关键词/短语统计 map；它已经不再保留完整消息正文，但如果未来要做“全量语义内容分析”，需要单独设计窗口、预算或后台任务。

## 验收标准

1. `session-management` 详情状态有明确的前端消息保留上限；超过上限时只保留最近窗口，并保持 `nextMessageOffset / hasMoreMessages` 语义可继续分页。
2. RAW JSON 展开缓存有明确条目上限，不会随点击次数无界增长。
3. `AnalyzeCodexSessions` 不再构造 full detail message slice，批量分析按文件流式聚合。
4. 新增测试先能在旧实现下失败，并在修复后通过。
5. 运行 focused frontend tests；若影响类型或构建，运行 `npm run typecheck` / `npm run build`。
6. 文档和 memory 写回本轮判断、修复范围与剩余风险。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`master` 上短改；暂不创建独立 feature worktree
- worktree：`（未创建）`

## 相关链接

- 相关代码：`frontend/src/features/session-management/useSessionManagementDetail.ts`
- 相关代码：`frontend/src/features/session-management/SessionManagementView.tsx`
- 相邻历史：`docs-linhay/spaces/20260429-nolon-session-management/`
- 相邻历史：`docs-linhay/spaces/20260527-codex-live-session-runtime-optimization/`

## 当前状态
- 状态：implemented
- 最近更新：2026-07-07
