# 20260610-settings-git-hash-links

## 背景
应用设置页「版本更新」区块展示 GetTokens `Git Hash` 与 `CLIProxyAPI Git Hash`。用户在浏览器评论中指出：

- `CLIProxyAPI Git Hash` 的外链没有打开到对应完整 commit，例如期望 `https://github.com/AxApp/CLIProxyAPI/commit/6cb405781439879387f9a6e06eb1d6796ef63b7f`。
- 展示 hash 和实际 commit 对不上。
- 需要顺带检查 GetTokens 自身 `Git Hash` 是否有同类问题。

## 目标
- 设置页展示仍保持短 hash，避免 UI 撑开。
- 点击 GetTokens `Git Hash` 与 `CLIProxyAPI Git Hash` 时使用完整 commit 构造 GitHub commit URL。
- CLIProxyAPI sidecar metadata 默认记录完整 commit，避免运行态只能拿到短 hash。

## 范围
- `frontend/src/features/settings/settingsBuildMetadata.ts`
- `frontend/src/features/settings/SettingsFeature.tsx`
- `frontend/src/features/settings/settingsRelease.ts`
- `frontend/vite.config.js`
- `scripts/ensure-sidecar.sh`
- `scripts/build-sidecar.sh`
- `scripts/build-local-macos-package.sh`
- 对应前端与脚本回归测试。

## 非目标
- 不修改正式版 `/Applications/GetTokens.app` 或正式版 sidecar。
- 不升级或切换 CLIProxyAPI fork HEAD。
- 不改变设置页视觉结构。

## 验收标准
- `formatBuildGitHash` 只负责展示短 hash；完整 hash 可通过新 helper 保留给外链。
- `buildGitHubCommitURL` 拒绝 `DEV`、`—`、空值和非 hex hash，避免无效占位链接。
- `SettingsFeature` 中 GetTokens 与 CLIProxyAPI hash 外链都使用 raw/full hash，而不是展示 label。
- `scripts/ensure-sidecar.sh`、`scripts/build-sidecar.sh`、`scripts/build-local-macos-package.sh` 在没有显式 commit 覆盖时使用完整 `git rev-parse HEAD`。
- 相关单元/脚本测试通过。

## 证据门禁

| 来源 | 事实位置 | 当前现象 | 预期验收 | 反证条件 |
| --- | --- | --- | --- | --- |
| 浏览器评论 1 | 设置页 `#frame=settings` 版本更新区块 | 用户选中的 `CLIProxyAPI Git Hash` 点击后未到期望完整 commit 链接 | 前端测试证明外链用 full hash；必要时浏览器 DOM 检查按钮触发 URL | 若 `SettingsFeature` 已使用 full hash 且 sidecar metadata 已存 full hash，则另查 BrowserOpenURL/Wails runtime |
| 代码阅读 | `SettingsFeature.tsx` | `cliProxyApiGitHashLabel = formatBuildGitHash(sidecarStatus.gitHash)` 后直接传给 `buildGitHubCommitURL` | 修改为 raw hash 构造 URL、label 只用于展示 | 若 `formatBuildGitHash` 返回完整 hash，则该假设不成立 |
| 浏览器预览 | `http://localhost:5173/#frame=settings` | 点击 GetTokens `Git Hash` 打开 `.../commit/eb393f6e1470`，说明构建注入值本身是短 hash | `vite.config.js` 注入完整 `git rev-parse HEAD`，展示仍由前端 helper 裁短 | 若注入值已完整但点击仍短，则说明事件处理仍用了 label |
| 代码阅读 | `frontend/vite.config.js` | `resolveBuildGitHash` 使用 `git rev-parse --short=12 HEAD` | 源文件测试锁定 `git rev-parse HEAD`，拒绝 `--short` | 若 CI/构建环境显式传 `VITE_GIT_HASH` 为短值，则需要发布流程同步传完整值 |
| 代码阅读 | `scripts/ensure-sidecar.sh` | `resolve_commit` 默认 `git rev-parse --short HEAD`，metadata `commit` 只记录短 hash | 脚本测试证明 metadata `commit` 记录完整 HEAD | 若 release/dev 构建显式传入完整 `CLI_PROXY_COMMIT`，当前脚本默认问题仍需保留但不是截图主因 |
| blast check | `scripts/build-sidecar.sh`、`scripts/build-local-macos-package.sh` | 仍存在 `rev-parse --short`，会让二进制 ldflags 或本地 macOS 包继续注入短 hash | `ensure-sidecar.test.sh` 禁止版本元数据构建脚本出现 `rev-parse --short` | 若有第三方外部环境显式传短 `VITE_GIT_HASH` / `CLI_PROXY_COMMIT`，需要在外部调用方修正 |
| 本地状态 | `build/bin/cli-proxy-api.meta.json` 与 `docs-linhay/references/CLIProxyAPI` | 当前磁盘 metadata 为 `2acd6ec0`，参考仓 HEAD 为 `2acd6ec04427...`；截图中的 `eb393f6e1470` 应来自运行中旧 dev 状态 | 修复后重新构建 sidecar metadata 会记录完整 commit | 若运行中 dev app 仍显示旧 hash，需要按 dev sidecar freshness 检查进程路径和 app bundle 内 metadata |

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260610-settings-git-hash-links`
- worktree：`../GetTokens-worktrees/20260610-settings-git-hash-links/`

## 相关链接
- 验收截图：`screenshots/20260610/settings-git-hash/20260610-settings-git-hash-browser-after-v01.png`

## 验证记录

- `node --test frontend/src/features/settings/settingsBuildMetadata.test.mjs frontend/src/features/settings/settingsRelease.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
- `bash scripts/ensure-sidecar.test.sh`
- `npm --prefix frontend run typecheck`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`
- 浏览器验收：临时 `127.0.0.1:5174` 打开 `#frame=settings`，界面显示短 `Git Hash=8cfb91457076`；点击后新标签 URL 为 `https://github.com/AxApp/GetTokens/commit/8cfb914570760076f8dfdb52c518771bf630e455`。`CLIProxyAPI Git Hash=DEV` 时不显示外链按钮。

## 当前状态
- 状态：done
- 最近更新：2026-06-10
