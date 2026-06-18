# 20260617 Round 17 Conditional Source Schema Gate

日期：2026-06-17

## 1. 目标

只补 Extension Contract manifest artifact gate，锁住 `model-catalog-source.source` 的条件必填约束：

1. `source.type = declared-endpoint` 时必须声明 `endpoint`。
2. `source.type = static-json` 时必须声明 `path`。
3. 本地 artifact validator 必须用 invalid fixtures 证明两条路径都会被 schema validation 拒绝。

## 2. 边界

本轮只处理 artifact / schema gate：

1. 不实现 enable/disable mutation。
2. 不实现 active runner 或 declared endpoint fetch。
3. 不实现 marketplace、远程安装或 Codex config 保存。
4. 不修改 Wails、frontend registry 页面、sidecar runtime 或其它 OmniRoute space。

## 3. 证据门禁

### 问题来源

Round 16 已覆盖 unknown top-level field、invalid manifest `source.type`、capability missing required `source`。剩余风险是条件 source 约束缺少负例：`declared-endpoint` 可能缺 `endpoint`，`static-json` 可能缺 `path`。

### 事实位置

- Schema：`schemas/gettokens-extension-v0.schema.json` 的 `$defs.modelCatalogSource.allOf` 已表达 `if/then` 条件。
- Validator：`docs-linhay/scripts/check-omniroute-contract-artifacts.mjs` 已有轻量 schema runner，但此前没有把这两类条件缺失加入 manifest invalid expectations。
- Examples：`examples/provider-metadata-model-catalog.valid.json` 是当前 manifest 正例。

### 当前缺口

缺少两份 invalid fixtures，以及 validator 对具体错误路径的断言。

## 4. Artifact Gate

新增 invalid fixtures：

1. `examples/provider-metadata-model-catalog.invalid-declared-endpoint-missing-endpoint.json`
2. `examples/provider-metadata-model-catalog.invalid-static-json-missing-path.json`

validator 必须断言：

1. `declared-endpoint` fixture 被拒绝，并包含 `$.capabilities[1].source is missing required property endpoint`。
2. `static-json` fixture 被拒绝，并包含 `$.capabilities[1].source is missing required property path`。

## 5. 验收

运行：

```bash
node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs
docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-omniroute-contract-artifacts.mjs docs-linhay/spaces/20260616-extension-contract-v0/README.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260616-extension-contract-v0-artifacts-plan.md docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round17-conditional-source-schema-gate.md docs-linhay/spaces/20260616-extension-contract-v0/examples/provider-metadata-model-catalog.invalid-declared-endpoint-missing-endpoint.json docs-linhay/spaces/20260616-extension-contract-v0/examples/provider-metadata-model-catalog.invalid-static-json-missing-path.json
```
