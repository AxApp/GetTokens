# Stabilize Current Rollout

## 背景
当前 `master` 工作区已经积累一组跨域未提交改动，主要集中在：

1. 账号统一新增弹窗与账号详情布局收口。
2. OpenAI-compatible 详情页窄屏/宽屏布局调整。
3. 账号 disabled 状态在 accounts / codex account list 之间同步。
4. auth-file metadata cache，降低普通列表场景重复下载原文。
5. Codex live-session 请求耗时趋势图与 preview 数据。
6. `live-sessions controls`、`auth-file metadata cache` 等 space / dev / memory 写回。

这批改动已经多次验证过，但范围横跨前端 UI、前端状态同步、Wails 后端缓存、文档与生成类型。最稳方案不是继续加功能，而是先把当前 rollout 收敛为可审、可测、可拆提交的状态。

## 目标
1. 明确当前未提交改动的边界，区分“本轮必须保留”、“需要拆分提交”、“应暂存/移出版本控制”的内容。
2. 按风险从低到高完成稳定化：文档与计划、纯前端展示、前端状态同步、后端缓存、运行时/桌面验收。
3. 不扩大产品能力面，不新增会话 kill、账号热切换、跨进程缓存等新能力。
4. 形成可回归验证清单，避免只靠一次全量测试通过就合并。

## 范围
1. 当前工作区中已存在的账号、Codex live-session、auth-file cache、文档/记忆改动。
2. 必要的测试脚本收口，例如把新增测试纳入 `frontend/package.json` 的 `test:unit`。
3. 未跟踪产物治理：确认 `output/`、根目录截图等是否应忽略、迁移到对应 space，或保留为本地 scratch。
4. 文档与 memory 写回，以及 `qmd update` / `qmd embed`。

## 非目标
1. 不实现 live-session 单会话 kill / disconnect。
2. 不实现指定会话切换账号，只保留 controls 评估与接口草案。
3. 不重构账号页整体架构。
4. 不把 auth-file 从文件事实源迁移到数据库。
5. 不清理或回滚用户未明确授权的既有改动。

## 验收标准
1. 当前 rollout 被拆成清晰的交付组，每组有文件范围、测试命令和风险说明。
2. 所有新增测试文件都进入对应测试入口，或明确说明为何只单跑。
3. `go test ./...`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 通过。
4. `docs-linhay/scripts/check-docs.sh`、`qmd update`、`qmd embed` 通过。
5. 若保留 Wails/后端缓存改动，需完成至少一轮真实桌面或等价 sidecar mock 验收；未跑桌面时必须在交付说明标明风险。
6. 未跟踪截图/输出目录有明确归属，不混入功能提交。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-stabilize-current-rollout`
- worktree：`../GetTokens-worktrees/20260527-stabilize-current-rollout/`

备注：当前先在主工作区开 space 和计划，不立即创建 worktree。原因是现有改动已经集中在当前工作区，贸然搬迁容易引入误合并；后续若进入多日拆分或并行验证，再按本映射创建 worktree。

## 相关链接
- `docs-linhay/spaces/20260526-account-provider-picker-icons/README.md`
- `docs-linhay/spaces/20260526-auth-file-metadata-cache/README.md`
- `docs-linhay/spaces/20260527-codex-live-session-controls/README.md`
- `docs-linhay/dev/20260523-session-distillation-codex-live-sessions-ui.md`
- `docs-linhay/dev/20260527-account-detail-close-and-openai-compatible-layout.md`

## 当前状态
- 状态：verified
- 最近更新：2026-05-27
- 已完成：
  1. 创建 space 与分组执行计划。
  2. 将 `accountDisabledSync.test.mjs` 纳入 `frontend/package.json` 的 `test:unit`。
  3. 为 `output/` 增加忽略规则，避免浏览器 smoke 产物继续污染工作区。
  4. 通过 `go test ./...`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build`。
  5. 通过 `docs-linhay/scripts/check-docs.sh`、`qmd update`、`qmd embed`。
  6. 通过 `./scripts/wails-cli.sh build`，确认 Wails 绑定生成、前端生产构建、Go 桌面应用编译与 `.app` 打包成功。
  7. 当前 `master` 已存在 5 个本地提交：live-session runtime optimization、unified compose、account detail layout、disabled sync、update availability polling。剩余未提交改动按 auth-file cache、live-session 单指标 ECG、route mode header、测试入口/治理文档继续拆组。
- 待收尾：
  1. 按剩余交付组完成 staged set 与提交。
  2. `frontend/wailsjs/go/models.ts` 只有 Wails 生成空白差异，不纳入功能提交。
  3. 本轮完成 Wails 构建级桌面验证；未打开真实桌面窗口做人工点击验收，原因是当前剩余改动均有 Go mock / frontend unit / Wails build 覆盖，且避免无必要打断用户桌面。
