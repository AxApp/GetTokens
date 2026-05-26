# Current Rollout Stabilization Execution Plan v01

## 1. 原则

本轮采用“先冻结边界，再分组验证，最后再考虑提交”的最稳方案。

执行期间不继续扩大功能面；所有改动只允许服务于以下目标：

1. 修复已发现的编译、测试、输入校验、敏感日志问题。
2. 把新增测试纳入稳定测试入口。
3. 明确截图、output、space、memory 的归属。
4. 为后续拆提交或交付验收减少不确定性。

## 2. 当前交付组

### A. 账号新增与详情布局

文件范围：

- `frontend/src/features/accounts/AccountsFeature.tsx`
- `frontend/src/features/accounts/components/AccountsHeader.tsx`
- `frontend/src/features/accounts/components/UnifiedComposeModal.tsx`
- `frontend/src/features/accounts/components/OpenAICompatibleDetailModal.tsx`
- `frontend/src/features/accounts/components/OpenAICompatibleDetailPanel.tsx`
- `frontend/src/features/accounts/components/accountHeaderMenu.ts`
- `frontend/src/features/accounts/model/unifiedComposeCopy.ts`
- `frontend/src/locales/en.json`
- `frontend/src/locales/zh.json`
- 对应 accounts 测试文件

验收重点：

1. Header actions menu 文案来自 locale，不再混用硬编码 label。
2. Unified compose 配置步骤复用详情页模块栈，不破坏 API key / base URL / quota / billing 编辑。
3. OpenAI-compatible model row 删除按钮在中等宽度不挤压成窄竖条。
4. Account detail close 先清本地 hash state，再清 URL hash，避免详情重新 hydrate。

测试：

- `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/accounts/tests/openAICompatible.test.mjs`
- `npm --prefix frontend run typecheck`

### B. 账号 disabled 同步

文件范围：

- `frontend/src/features/accounts/model/accountDisabledSync.ts`
- `frontend/src/features/accounts/hooks/useAccountsActions.ts`
- `frontend/src/features/accounts/hooks/useAccountsPageState.ts`
- `frontend/src/features/accounts/tests/accountDisabledSync.test.mjs`
- `frontend/src/features/codex/CodexAccountListFeature.tsx`
- `frontend/src/features/codex/model/codexAccountList.ts`
- `frontend/src/features/codex/codexAccountList.test.mjs`

验收重点：

1. disabled 事件只接受 canonical account id。
2. `disabled` 字段只接受 boolean，拒绝 `"false"` / `1` 这类边界输入。
3. Accounts 与 Codex account list 的 requestable / blockReason 同步，不把 disabled 账号继续显示为可请求。
4. 新增 `accountDisabledSync.test.mjs` 必须纳入 `frontend/package.json` 的 `test:unit`，否则全量单测不会覆盖它。

测试：

- `node --test frontend/src/features/accounts/tests/accountDisabledSync.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
- `npm --prefix frontend run test:unit`

### C. auth-file metadata cache

文件范围：

- `internal/wailsapp/app.go`
- `internal/wailsapp/auth_files.go`
- `internal/wailsapp/auth_files_cache.go`
- `internal/wailsapp/auth_files_test.go`
- `docs-linhay/spaces/20260526-auth-file-metadata-cache/`

验收重点：

1. cache key 为 `name + size + modified`，文件变化自然绕过旧缓存。
2. 缓存只保存展示元数据，不保存完整 auth-file 原文。
3. 上传、删除、启停状态修改成功后按文件名失效缓存。
4. 不在常规日志里输出 auth-file 文件名、邮箱、provider、plan、priority。

测试：

- `go test ./internal/wailsapp -run 'TestListAuthFilesCachesInferredMetadataAcrossRepeatedCalls|TestListAuthFilesDoesNotRedownloadWhenCachedMetadataRemainsIncomplete|TestListAuthFilesRefreshesMetadataCacheWhenFingerprintChanges'`
- `go test ./...`

### D. Codex live-session 趋势图

文件范围：

- `frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx`
- `frontend/src/features/codex-live-sessions/model/requestTimingTrend.ts`
- `frontend/src/features/codex-live-sessions/model/mockData.ts`
- `frontend/src/features/codex-live-sessions/model.test.mjs`
- `.agents/skills/gettokens-domain-engineering/SKILL.md`
- `docs-linhay/dev/20260523-session-distillation-codex-live-sessions-ui.md`

验收重点：

1. 趋势图继续使用 timestamp x 轴和固定窗口，不回到 index spacing。
2. active request 才允许 live 投影，stale streaming request 不继续增长。
3. ECG 视觉只改变呈现，不改变数据语义。
4. metric 可点击切换时类型安全，不能让 undefined metric 进入 `onSelectMetric`。

测试：

- `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

### E. 文档、memory 与产物治理

文件范围：

- `docs-linhay/spaces/20260527-stabilize-current-rollout/`
- `docs-linhay/spaces/20260527-codex-live-session-controls/`
- `docs-linhay/spaces/20260526-auth-file-metadata-cache/`
- `docs-linhay/dev/*.md`
- `docs-linhay/memory/2026-05-26.md`
- `docs-linhay/memory/2026-05-27.md`
- `output/`
- 根目录临时截图（如存在）

验收重点：

1. space / plan / memory 对当前边界描述一致。
2. `output/` 和根目录截图不直接混入功能提交；需要保留的截图归档到对应 space，临时产物进 `.gitignore` 或保持未跟踪。
3. 不把当前 controls 评估误写成已实现。
4. qmd 索引刷新完成。

测试：

- `docs-linhay/scripts/check-docs.sh`
- `qmd update`
- `qmd embed`

## 3. 执行顺序

1. [x] 冻结边界：确认 `git status`、`git diff --stat`、未跟踪文件清单。
2. [x] 补齐测试入口：若 `accountDisabledSync.test.mjs` 仍未在 `test:unit` 中，先加入脚本。
3. [x] 分组跑 focused tests：A / B / C / D 各自先跑对应测试。
4. [x] 全量自动化验证：`go test ./...`、`npm --prefix frontend run test:unit`、`typecheck`、`build`。
5. [x] Wails 构建级验证：`./scripts/wails-cli.sh build`。
6. [x] 文档校验与 qmd：跑 `check-docs.sh`、`qmd update`、`qmd embed`。
7. [x] 产物治理：`output/` 加入忽略规则；`frontend/wailsjs/go/models.ts` 生成空白差异不进入功能提交。
8. [ ] 交付审阅：按组列出 remaining risks，并建议拆分提交顺序。

## 4. 回滚与止损

1. 若 A/B 前端组失败，先修测试入口或纯类型问题，不碰后端。
2. 若 C 后端 cache 失败，优先禁用 cache 命中路径，保留原 fresh 读取语义。
3. 若 D live-session 图表失败，优先回退到最近通过的纯模型语义，视觉调整可后置。
4. 若文档/qmd 失败，不继续提交，先修路径、引用和 collection 状态。

## 5. 暂不执行项

1. 不创建 feature worktree，除非后续需要多日并行拆分。
2. 不 stage / commit，等分组验证和产物归属清楚后再做。
3. 不对正式 sidecar `8317` 做 stop、kill、restart 或清理动作。
4. 不启动可见浏览器抢占用户显示器；需要截图时默认使用无头或明确归档脚本。
