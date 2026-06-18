# 20260617 Round 15 Extension Manifest Schema Gate

日期：2026-06-17

## 1. 目标

在不引入 runtime mutation、marketplace 或网络依赖的前提下，把 Extension manifest v0 主 schema 纳入 contract artifact validator 的本地 schema-level gate：

1. 对 `examples/provider-metadata-model-catalog.valid.json` 执行 schema validation。
2. 用 invalid fixtures 证明未知 capability、禁用权限、缺 required 字段会被拒绝。
3. 继续补强当前本地 schema runner 已支持、但最容易在 schema 调整里退化的负例：
   - 顶层 `additionalProperties` / unknown top-level field；
   - manifest `source.type` 非法枚举；
   - capability 缺失必填 `source` 字段。
4. 保持 validator 仍然只服务文档/contract artifact，不触碰 frontend runtime、Wails runtime、dispatch 或 memory。

## 2. 边界

明确不做：

1. 不改 `internal/gettokensextensions`、Wails/root binding、frontend registry runtime。
2. 不引入 marketplace、enable/disable mutation 或 active runner。
3. 不引入第三方 schema validator 包或网络请求。
4. 不扩大到 `~/.codex/config.toml`、Codex Skills/MCP 保存链路。

## 3. 证据门禁

### 3.1 问题来源

- README 已记录 manifest schema 是 v0 artifact，但当前 validator 实际只对 enable-state artifact 做 schema-level gate。
- 第十四轮只证明 enable-state example 能过 schema，manifest 仍主要靠解析/语义断言。

### 3.2 代码 / artifact 事实位置

- `docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
  - 已有本地轻量 runner，但当前只用于 enable-state schema-level validation。
- `schemas/gettokens-extension-v0.schema.json`
  - 已声明 capability/permission enum、required 字段、`oneOf`/`allOf` 等结构化约束。
- `examples/provider-metadata-model-catalog.valid.json`
  - 当前是 Phase 1 只读 registry 的 canonical valid manifest。
- `examples/js-hook-unknown-capability.invalid.json`
  - 已承载 unknown capability / forbidden permission 证据，但尚未进入 schema gate。

### 3.3 当前缺口

1. valid manifest 还没有通过同一个本地 schema runner 自证。
2. unknown capability / forbidden permission 目前主要靠语义断言，不足以证明 schema gate 已接线。
3. 缺少 “required 字段缺失会被 schema 拒绝” 的 manifest invalid fixture。
4. 还没有专门锁住顶层 unknown field、manifest `source.type` 枚举，以及 capability `source` 必填字段。

### 3.4 本轮验收路径

1. `check-omniroute-contract-artifacts.mjs`
   - 对 manifest valid example 执行本地 schema validation。
   - 对 manifest invalid fixtures 证明以下变更会失败：
     - unknown capability；
     - forbidden permission；
     - missing required field；
     - unknown top-level field；
     - invalid manifest source type；
     - capability missing required source field。
2. 运行：
   - `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
   - `docs-linhay/scripts/check-docs.sh`
   - `git diff --check`

## 4. Artifact Gate

本轮固定 manifest artifact：

1. `schemas/gettokens-extension-v0.schema.json`
2. `examples/provider-metadata-model-catalog.valid.json`
3. `examples/js-hook-unknown-capability.invalid.json`
4. `examples/provider-metadata-model-catalog.invalid-forbidden-permission.json`
5. `examples/provider-metadata-model-catalog.invalid-missing-required.json`
6. `examples/provider-metadata-model-catalog.invalid-unknown-top-level-field.json`
7. `examples/provider-metadata-model-catalog.invalid-source-type.json`
8. `examples/provider-metadata-model-catalog.invalid-capability-source-missing-required.json`

artifact 必须持续证明：

1. valid example 能通过本地 schema-level validation。
2. unknown capability 会被 `oneOf` / capability kind gate 拒绝。
3. forbidden permission 会被 permission enum gate 拒绝。
4. missing required field 会被 required gate 拒绝。
5. unknown top-level field 会被顶层 `additionalProperties = false` 拒绝。
6. invalid source type 会被 manifest `source.type` enum gate 拒绝。
7. capability missing required source field 会被 capability required gate 拒绝。

变更 manifest 字段、capability 白名单或 permission 白名单时，README、本文档和 validator 必须同轮同步。
