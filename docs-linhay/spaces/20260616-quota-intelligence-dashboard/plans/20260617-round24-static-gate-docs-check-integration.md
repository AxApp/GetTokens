# Round 24 / Static gate docs-check integration

日期：2026-06-17

## 本轮目标

1. 将 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs` 纳入常规 docs check 链路。
2. 让主控和后续 agents 运行 `bash docs-linhay/scripts/check-docs.sh` 时自动覆盖 quota no-direct-fact-parser gate。
3. 保持 tests / preview fixtures allowlist，不把构造测试 payload 的文件误判为违规。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Round23 static gate | `check-quota-no-direct-fact-parser.mjs` 已能单独扫描 `frontend/src/features`，但容易被主控或后续 agents 忘跑 | 在 `check-docs.sh` 尾部直接调用 quota gate，并显式传入 `GETTOKENS_REPO_ROOT` | `bash docs-linhay/scripts/check-docs.sh` 输出 `Running quota static gate...` 和 quota gate JSON |
| docs check 入口 | `check-docs.sh` 是 AGENTS/space 治理默认文档门禁 | 接入 docs check，不新增 package script，不扩大并行脏工作树写入面 | `node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs` |
| tests / preview fixture 边界 | Round23 允许 accounts/status/doctor tests 与 previewData 构造显式 `quotaFact` payload | 新增脚本级集成测试锁定 fixture allowlist 仍存在 | 集成测试检查 allowlist 包含 tests 和 previewData path patterns |

## 红绿灯记录

- 红灯：先新增 `docs-linhay/scripts/check-quota-static-gate-integration.test.mjs`，在 `check-docs.sh` 未引用 quota gate 时失败，报 `docs check must invoke the quota no-direct-fact-parser gate`。
- 绿灯：`check-docs.sh` 接入 quota gate 后，集成测试通过；`bash docs-linhay/scripts/check-docs.sh` 会自动运行 quota gate，当前扫描 `335` 个 frontend feature 文件，`49` 个 fixture 文件，`5` 个 Doctor Workbench 已知例外，`findings: []`。

## 实现记录

- `docs-linhay/scripts/check-docs.sh` 在文档结构检查通过后调用 `node "$SCRIPT_DIR/check-quota-no-direct-fact-parser.mjs"`。
- 调用时设置 `GETTOKENS_REPO_ROOT` 默认值为 repo root，避免从非仓库根目录执行 docs check 时 quota gate 扫描错路径。
- 新增 `check-quota-static-gate-integration.test.mjs`，证明 docs check 集成存在，并锁定 tests / preview fixture allowlist。

## 验收命令

```bash
node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs
node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
bash docs-linhay/scripts/check-docs.sh
node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs
git diff --check -- docs-linhay/scripts/check-docs.sh docs-linhay/scripts/check-quota-static-gate-integration.test.mjs docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md docs-linhay/spaces/20260616-quota-intelligence-dashboard/plans/20260617-round24-static-gate-docs-check-integration.md
```

## 剩余风险

1. 静态 gate 仍是正则形态扫描，不是 AST parser；动态字段拼接仍需要 code review 配合。
2. Doctor Workbench typed quota consumer 仍保留为 Round23 已知例外；本轮只保证 docs check 不漏跑现有 gate，不收敛该例外。
