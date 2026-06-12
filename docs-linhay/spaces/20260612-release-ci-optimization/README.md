# 20260612-release-ci-optimization

## 背景
2026-06-12 用户要求对 GetTokens Release CI 做测试与优化，并明确要求必须有 baseline。当前发布链由 `.github/workflows/release.yml` 的 `Release` workflow 触发，正式发布范围仍为 macOS，不能改变签名、公证、Sparkle 分架构 appcast、GitHub Release 七类资产和 sidecar metadata 校验边界。

本轮证据来源：
- 成功 baseline：`v1.2.6` Release run `27294060586`，结论 `success`，URL `https://github.com/AxApp/GetTokens/actions/runs/27294060586`。
- 失败参考：`v1.2.7` Release run `27399638655`，结论 `failure`，失败发生在两个 macOS job 的 `Ensure CLIProxyAPI sidecar from source`，URL `https://github.com/AxApp/GetTokens/actions/runs/27399638655`。

`v1.2.6` baseline 耗时：
- Workflow 总耗时：`17:32:22 -> 17:46:42`，约 `14m20s`。
- `Build H5`：约 `20s`。
- `Build macOS arm64`：`17:32:50 -> 17:39:11`，约 `6m21s`。
- `Build macOS amd64`：`17:32:51 -> 17:45:28`，约 `12m37s`。
- `Publish Sparkle appcast`：约 `52s`。
- `Publish Release`：约 `14s`，当前在 Sparkle appcast 后才开始。

关键 step baseline：
- arm64 `Install Wails` 约 `44s`，`Ensure CLIProxyAPI sidecar from source` 约 `1m09s`，`Wails build` 约 `1m27s`。
- amd64 `Install Wails` 约 `56s`，`Ensure CLIProxyAPI sidecar from source` 约 `3m08s`，`Wails build` 约 `4m02s`。

## 目标
1. 用可重复的本地契约测试锁住 Release workflow 的优化边界。
2. 让 CLIProxyAPI sidecar 构建从 macOS 打包 job 中拆出为独立 matrix job，提前失败并减少 macOS runner 被占用时间。
3. 让 `Publish Release` 在 macOS build artifacts 就绪后即可运行，不再等待 `Publish Sparkle appcast`，两者并行收尾。
4. 保持七类 GitHub Release 资产、分架构 Sparkle appcast、bundle 内 sidecar metadata commit 校验不变。

## 范围
- `.github/workflows/release.yml` 的 DAG 与 artifact 流转。
- 根目录 Go 契约测试，解析 release workflow 并验证关键 job/needs/asset 契约。
- 本 space 的 baseline、验收标准和优化记录。

## 非目标
- 不触碰 `/Applications/GetTokens.app` 正式版。
- 不改变 release tag 规则；已经被 `v1.2.7` 消费的 tag 不复用。
- 不改变签名、公证、DMG 打包、Sparkle feed 内容生成规则。
- 本轮不做 Wails CLI cache，避免在未确认 Node 24 兼容动作版本前引入额外发布变量。

## 验收标准
1. `go test -run 'TestReleaseWorkflow' ./...` 通过，证明 workflow DAG 满足：
   - 存在独立 `build-sidecar` matrix job，覆盖 `darwin/arm64` 与 `darwin/amd64`。
   - macOS `build` job 同时依赖 `build-frontend` 与 `build-sidecar`，并下载 sidecar artifact，不再在 macOS job 内从源码构建 sidecar。
   - `release` job 只依赖 `build`，不再等待 `sparkle-appcast`。
   - GitHub Release 七类资产名保持不变。
2. `docs-linhay/scripts/check-docs.sh` 通过。
3. `git diff --check` 通过。
4. `scripts/ensure-sidecar.test.sh` 通过，证明 sidecar metadata/fingerprint 与缺失 source 拉取语义保持不变。
5. `actionlint .github/workflows/release.yml` 通过，证明 GitHub Actions 表达式和 job 依赖静态语义有效。
6. 若继续发版验证，必须使用下一个 patch tag，不能复用已失败/已消费的 `v1.2.7`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260612-release-ci-optimization`
- worktree：`../GetTokens-worktrees/20260612-release-ci-optimization/`

## 相关链接
- Baseline run：`https://github.com/AxApp/GetTokens/actions/runs/27294060586`
- Failed reference run：`https://github.com/AxApp/GetTokens/actions/runs/27399638655`
- Release workflow：`.github/workflows/release.yml`

## 当前状态
- 状态：local-validated
- 最近更新：2026-06-12

## 本地验证记录
- `go test -run 'TestReleaseWorkflow' ./...`：通过。
- `go test ./...`：通过。
- `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false scripts/ensure-sidecar.test.sh`：通过；关闭进程级 commit signing 仅用于脚本内部临时 git repo，未修改用户全局配置。
- `actionlint .github/workflows/release.yml`：通过。
- `docs-linhay/scripts/check-docs.sh`：通过。
- `git diff --check`：通过。
