# Dependabot Vite and Babel Security Remediation

## 背景

GitHub 默认分支在 2026-07-11 报告 5 个 open Dependabot alerts。告警由
3 个漏洞事实构成：

| Alerts | 依赖 | 严重度 | 当前版本 | 修复下限 | 事实 |
| --- | --- | --- | --- | --- | --- |
| #2、#5 | `vite` | high | `5.4.21` | `6.4.3` | Windows alternate path 可绕过 `server.fs.deny` |
| #3、#6 | `vite` / `launch-editor` | medium | `5.4.21` | `6.4.3` | Windows UNC path 可触发 NTLMv2 hash disclosure |
| #4 | `@babel/core` | low | `7.29.0` | `7.29.6` | `sourceMappingURL` 可导致任意文件读取 |

GitHub 对 Vite 的两个 manifest 位置分别计数，因此 3 个漏洞事实表现为 5
个 alerts。`npm audit` 还发现 Vite 5 引入的 `esbuild <= 0.24.2` moderate
漏洞；升级到 Vite 6.4.3 会把 esbuild 依赖提升到 `^0.25.0`。

## 证据门禁

- 问题来源：GitHub Dependabot open alerts #2 至 #6。
- 代码事实位置：`frontend/package.json` 与 `frontend/package-lock.json`。
- 当前现象：
  - `npm ls` 显示 `vite@5.4.21`、`@babel/core@7.29.0`。
  - `npm audit --json` 返回 3 个 vulnerability records，进程退出码为 1。
- 兼容性事实：
  - `@vitejs/plugin-react@5.2.0` peer dependency 支持 Vite 4 至 8。
  - `vite@6.4.3` 支持 Node 18、20 和 22 以上版本。
- 可证伪条件：升级后仍解析到 `vite < 6.4.3`、`@babel/core < 7.29.6`、
  `esbuild <= 0.24.2`，或现有前端/Wails 构建失败。

## 目标

1. 清除 GitHub 当前 5 个 Dependabot alerts。
2. 让 `npm audit` 返回 0 vulnerabilities。
3. 保持前端单测、typecheck、production build 与 Wails build readiness 通过。

## 范围

- 将直接开发依赖 Vite 升级到 `^6.4.3`。
- 通过 npm override 保证传递依赖 `@babel/core >= 7.29.6`。
- 更新 `frontend/package-lock.json` 与 `frontend/package.json.md5`。
- 运行依赖树、安全扫描、前端、Go、Wails 和文档门禁。

## 非目标

- 不升级到 Vite 7 或 8。
- 不改前端业务逻辑、样式或运行时功能。
- 不处理 GitHub 尚未报告、且 `npm audit` 未发现的其他依赖升级。

## BDD 场景

### 场景 1：安装前端开发依赖

- Given 仓库使用受影响的 Vite 5 和 Babel 7.29.0。
- When 维护者执行锁文件安装。
- Then 依赖树解析到 `vite >= 6.4.3`、`@babel/core >= 7.29.6`、
  `esbuild > 0.24.2`。

### 场景 2：执行安全扫描

- Given 已更新依赖清单和锁文件。
- When 执行 `npm audit`。
- Then 扫描返回 0 vulnerabilities，退出码为 0。

### 场景 3：构建桌面前端

- Given Vite 已跨 major 升级到 6.4.3。
- When 执行前端测试、typecheck、production build 与 Wails build readiness。
- Then 现有 React/Wails 构建契约保持通过，生成绑定无漂移。

## 验收标准

- `npm ls vite @babel/core esbuild launch-editor --all` 显示安全版本。
- `npm audit --json` 的 vulnerability total 为 0。
- frontend 1137 项 unit、typecheck、production build 通过。
- GetTokens `go test ./...` 通过。
- Wails build readiness 通过且不触碰 `/Applications/GetTokens.app`。
- `docs-linhay/scripts/check-docs.sh` 与 `git diff --check` 通过。
- 推送后 GitHub Dependabot open alerts 数量降为 0；若 GitHub 仍在重算，记录
  精确 alert 状态并等待平台刷新，不手工 dismiss。

## 设计稿入口

- 本期设计稿：`（不适用，纯依赖安全修复）`

## Worktree 映射

- branch：`master`（一次性短改动）
- worktree：`（不创建）`

## 相关链接

- GitHub Dependabot alerts #2 至 #6
- GHSA-fx2h-pf6j-xcff
- GHSA-v6wh-96g9-6wx3
- GHSA-4x5r-pxfx-6jf8

## 当前状态

- 状态：implemented-awaiting-github-recalculation
- 最近更新：2026-07-11

## 实施结果

- `vite`：`5.4.21` -> `6.4.3`
- `@babel/core`：`7.29.0` -> `7.29.7`
- `esbuild`：`0.21.5` -> `0.25.12`
- `frontend/package.json` 增加 `@babel/core >= 7.29.6` override，防止传递
  依赖重新解析到受影响版本。
- `npm ci` 与 `npm audit --audit-level=low` 均通过，audit total 为 0。
- frontend 1137 项 unit、typecheck、Vite 6 production build 通过。
- GetTokens `go test ./...` 通过。
- Wails build readiness 通过，生成绑定无漂移，未触碰正式 App。
- `check-docs.sh` 与 `git diff --check` 通过。
- 修复提交 `271d15fd` 已推送到 `origin/master`，远端 manifest/lockfile 已确认
  为安全版本。
- 2026-07-11 23:01（Asia/Shanghai）前持续轮询约 9 分钟，alerts #2 至 #6
  仍为 open，且 `updated_at` 仍停留在 2026-06-27/30；这是 GitHub 尚未重算
  依赖图的外部状态，不手工 dismiss。
