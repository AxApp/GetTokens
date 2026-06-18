# Round 15 Structured Route DOM Gate

日期：2026-06-17

## 背景

- 问题来源：OmniRoute 第十五轮 Doctor Workbench 切片，要求在已落地的 structured route evidence UI 与 shared digest 语义之上，补更强的 preview / browser / DOM 验收。
- 前置事实：
  - 第十三轮已把 structured route block 显式渲染进 Doctor evidence card。
  - 第十四轮已把 Doctor route evidence identity/digest 对齐到 Route Resilience 共享 helper 语义。
- 当前缺口：
  - Doctor preview snapshot 还没有稳定承载“full identity + partial identity fallback”同屏案例。
  - `docs-linhay/scripts/check-doctor-workbench-preview.mjs` 仅验证标题、source boundary 和基础 hash，不验证 structured route markers，也没有归档 fallback。
  - 页面虽保持只读，但 preview / DOM gate 还没有专门证明“无 repair mutation / 无 repair handler”。

## 代码 / UI 事实位置

- preview UI：`frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx`
- route evidence 派生：`frontend/src/features/doctor-workbench/model/doctorWorkbench.ts`
- preview data：`frontend/src/features/doctor-workbench/model/previewData.ts`
- focused tests：`frontend/src/features/doctor-workbench/tests/*.test.mjs`
- preview check script：`docs-linhay/scripts/check-doctor-workbench-preview.mjs`

## 本轮目标

1. 用 preview snapshot 提供一个稳定的 structured route evidence DOM 基线：
   - full identity evidence 渲染 `target/account/auth/model/scope/blocking` markers；
   - partial identity evidence 保持 fallback，不升级成 structured route truth。
2. 硬化 preview check script：
   - 默认 headless dump DOM；
   - Chrome 不可用时回退到归档 snapshot / screenshot；
   - 显式验证页面仍是 read-only、无 repair mutation / handler。
3. 不新增 repair mutation，不伪造 route truth，不越界改 accounts/status/extension/protocol/dispatch/memory/AGENTS。

## BDD / 红灯场景

1. Given Doctor preview snapshot 同时包含 full identity dropped reason 与 partial identity dropped reason
   When 派生 Doctor workbench view
   Then full identity evidence 渲染 structured route target，partial identity evidence 只保留 fallback marker。

2. Given headless preview DOM gate 读取 Doctor preview 页面
   When structured route block 存在
   Then DOM 中必须出现 target/account/auth/model/scope/blocking markers，且出现 partial identity fallback marker。

3. Given Doctor preview 页面是只读诊断面板
   When preview script / source guard 运行
   Then 页面只允许 snapshot 读取与跳转，不暴露 repair mutation / handler。

## 实现边界

- 允许修改：
  - `docs-linhay/scripts/check-doctor-workbench-preview.mjs`
  - `frontend/src/features/doctor-workbench/**`
  - Doctor tests
  - 本 space README
  - 本计划文件与必要的 preview artifact
- 不允许修改：
  - accounts/status/extension/protocol
  - dispatch/memory/AGENTS
  - repair mutation / sidecar authority 语义

## 验收

1. `npm --prefix frontend run test:doctor-workbench`
2. `node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
3. 若触发前端类型面：`npm --prefix frontend run typecheck`
4. `docs-linhay/scripts/check-docs.sh`
5. `git diff --check`

## 沉淀审计

- 本轮主要是对既有 Doctor preview 验收脚本补齐 structured DOM / read-only gate，暂不形成新的 repo-wide 治理规则。
- 收尾时若出现可复用的 preview-script fallback 模式差异，再决定是否升级到 skill 或 dev workflow。
