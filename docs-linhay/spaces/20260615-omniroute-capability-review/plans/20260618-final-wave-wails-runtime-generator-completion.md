# Final Completion Wave：Wails runtime / generator completion

日期：2026-06-18

## 目标

一次性校准当前项目真实可用的 Wails binding generation、build 与 dev readiness 路径，不再把 `generate bindings` 不可用挂成后续 Round 待办。

## 证据门禁

| 项 | 证据 |
|---|---|
| 问题来源 | Final Completion Wave 明确要求确认 `check-wails-generated-drift.mjs` 中的 `generate bindings` 不可用是 Wails v2.12.0 命令不存在、wrapper 用法错误，还是应由 build/dev 触发 generation。 |
| 代码事实位置 | `scripts/wails-cli.sh`、`docs-linhay/scripts/check-wails-generated-drift.mjs`、`docs-linhay/scripts/check-wails-binding-surface.mjs`、`frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs`、`frontend/wailsjs/go/*`。 |
| 当前现象 | `bash scripts/wails-cli.sh generate --help` 与 `generate bindings` 在 Wails CLI v2.12.0 下只展示 `generate module/template`；没有 standalone `bindings` 子命令。 |
| 预期验收 | gate 输出 JSON classifier，明确 standalone generator 不存在且这是终态边界；无 side effect 时不再失败为无限待办；可选 build readiness smoke 只构建本仓 `build/bin/GetTokens.app` 并记录不触碰 `/Applications/GetTokens.app`。 |
| 反证条件 | 若 `scripts/wails-cli.sh build` 可安全完成并证明 build/dev 是绑定生成入口，则 gate 记录替代命令；若 build 被当前并行脏树阻塞，也必须输出具体失败证据和残余风险。 |

## BDD 场景

1. Given 当前 Wails CLI 为 v2.12.0
   When 通过项目 wrapper 执行 `generate bindings`
   Then gate 应识别为 “standalone binding generator unavailable”，并列出 CLI generate 子命令证据。
2. Given standalone generator 不存在
   When generated surface 静态 gate 通过且 generator 没有改动 `frontend/wailsjs`
   Then 默认 drift gate 退出 0，作为终态 classifier，而不是继续要求不存在的命令变绿。
3. Given 需要最低 build readiness smoke
   When 显式传入 `--build-readiness`
   Then 只运行本仓 `scripts/wails-cli.sh build`，记录 `build/bin/GetTokens.app` 产物、退出码、stdout/stderr tail，并在 finally 恢复 generated binding 快照。

## TDD 计划

- 先更新 `frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs`，要求 JSON report 包含 `standaloneGenerator`、`readinessAlternative`、`surfaceCheck` 和 build readiness command contract。
- 再更新 `check-wails-generated-drift.mjs` 最小实现。
- 最后运行 wrapper help/generate/build-readiness、binding surface、Node tests、docs check 与 diff check。

## 实现结论

1. `bash scripts/wails-cli.sh --help` 确认当前使用本机 `/Users/linhey/go/bin/wails`，Wails CLI 版本为 `v2.12.0`，顶层命令包含 `build/dev/generate`。
2. `bash scripts/wails-cli.sh generate --help`、`generate`、`generate bindings` 均只展示 `Wails generate - Code Generation Tools`，可用子命令只有 `module` / `template`；`bindings` 不是 Wails v2.12.0 的 standalone generator 子命令。
3. `generate bindings` 返回 0 且打印 help，不是 generated surface 成功；因此根因不是前端 binding surface 缺字段，也不是脚本恢复失败，而是当前 Wails CLI 没有 standalone bindings generator。
4. `scripts/wails-cli.sh build --help` 证明 build 命令存在 `-skipbindings` flag；实际 `scripts/wails-cli.sh build` 输出 `Generating bindings: Done.`，说明 build/dev lifecycle 才是当前项目可用的绑定生成路径。
5. wrapper help/build-help 目前仍会先执行 sidecar/menubar 准备，并在 `build --help` 后对已有本仓 build bundle 做 post-build 安装/签名动作；本轮未改 wrapper 行为，只在 classifier 文档中记录该 side effect。build smoke 会按 wrapper 规则管理本仓 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`，但正式版 `/Applications/GetTokens.app` 与其 sidecar 未被触碰。

## 代码改动

- `docs-linhay/scripts/check-wails-generated-drift.mjs`
  - schema 升为 v3。
  - 保留 `wrapperCommand=bash scripts/wails-cli.sh generate bindings`，但新增 `standaloneGenerator` 终态证据：`available=false`、`terminalBoundary=true`、`availableGenerateCommands=["module","template"]`。
  - 默认模式在 generated surface gate 通过、无 generated side effect 时返回 `exitClassification=standalone-generator-unavailable-surface-pass` 并退出 0，不再作为无限待办失败。
  - 新增 `readinessAlternative` 与 `--build-readiness`。显式 build smoke 会运行 `bash scripts/wails-cli.sh build`，记录 `build/bin/GetTokens.app`、stdout/stderr tail、generated snapshot restore、`buildBundleSidecarPath`、`formalApplicationsPathTouched=false` 与 `formalBundleSidecarTouched=false`。
- `frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs`
  - 更新 contract 测试，锁定 standalone generator classifier、build readiness command、surface check 与正式版不触碰标记。
- `.agents/skills/gettokens-ops-governance/SKILL.md`
  - 写入 Wails v2.12 generator boundary：不要继续追不存在的 standalone `generate bindings`，最低 build readiness 走 `--build-readiness`。

## 验收结果

| 命令 | 结果 |
|---|---|
| `bash scripts/wails-cli.sh --help` | 通过；Wails CLI `v2.12.0`，顶层包含 `build/dev/generate`。 |
| `bash scripts/wails-cli.sh generate --help` | 通过；`generate` 只含 `module/template`。 |
| `bash scripts/wails-cli.sh generate bindings` | 通过但只打印 generate help；无 standalone bindings generation。 |
| `node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-final-wave.json` | 通过；`exitClassification=standalone-generator-unavailable-surface-pass`、`changedFiles=[]`、`surfaceCheck.status=pass`。 |
| `node docs-linhay/scripts/check-wails-binding-surface.mjs` | 通过。 |
| `node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs` | 通过，7/7。 |
| `node docs-linhay/scripts/check-wails-generated-drift.mjs --build-readiness --report /private/tmp/gettokens-wails-final-wave-build-readiness.json` | 通过；`exitClassification=build-readiness-pass`，`buildReadiness.artifactExists=true`，`changedGeneratedFiles=[]`，`buildBundleSidecarPath=build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`，`formalApplicationsPathTouched=false`，`formalBundleSidecarTouched=false`。 |

## 产物与边界

- Build smoke 产物：`build/bin/GetTokens.app`。
- JSON report：
  - `/private/tmp/gettokens-wails-final-wave.json`
  - `/private/tmp/gettokens-wails-final-wave-build-readiness.json`
- 未启动真实 dev App；本轮目标是 generator/build readiness，不涉及菜单栏、status item、LaunchServices 或窗口生命周期手点验收。
- 未读取或写入真实 `~/.codex/config.toml`。
- 未修改、重启、kill 或替换 `/Applications/GetTokens.app` 及其 sidecar；仅观察到正式版 sidecar 进程存在，未操作。本仓 build smoke 按 wrapper 规则写入的是 `build/bin/GetTokens.app` 内 sidecar。

## 残余风险

1. 当前 wrapper 在 help 类命令前仍会执行本仓 sidecar/menubar 准备；这不是正式版风险，但若后续要把 help 当完全只读命令，应单独修 wrapper。
2. Build smoke 使用当前并行脏树构建，本次只证明当前工作区 build readiness 可达；它不是 release artifact 验收。
3. `generate bindings` standalone 不存在是当前 Wails v2.12.0 事实；未来升级 Wails 后需重新校准 classifier。
