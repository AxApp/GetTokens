# Round 25 / AST lexical static gate retry

日期：2026-06-18

## 本轮目标

1. 将 `check-quota-no-direct-fact-parser.mjs` 从逐行正则升级为无依赖的词法 / 轻 AST 扫描。
2. 降低注释、字符串、说明文案中的 `quotaFact` / `quota_fact` 误报。
3. 扩展直接解析拦截面：`originalMessage`、`rawPayload`、object destructuring、raw alias 后 `JSON.parse`、property / bracket quota fact 访问。
4. 继续允许 canonical helper/parser、focused tests 和 preview fixtures 构造 quota fact payload。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| 旧 gate 误报 | Round24 gate 按行正则扫描，注释或字符串里出现 `payload.quotaFact` 会被判违规 | 新增临时 fixture `proseOnlyQuotaNotice.ts`，先证明旧 gate 失败，再由词法扫描跳过 comments / string literal | `node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs` |
| raw payload 漏报 | 旧 gate 主要识别 `quotaFact/quota_fact/fact` 形态，不覆盖 `originalMessage/rawPayload` raw source | token 扫描 property、bracket、destructuring，并追踪 `rawPayload/originalMessage` alias 进入 `JSON.parse` | 同一集成测试的临时 `directRawFact.ts` / `originalMessageFact.ts` |
| canonical 与 fixture 允许面 | `accountQuota.ts` 是唯一 direct parser 入口；tests / previewData 仍需要构造显式 fact | 保留 `canonicalParserFiles` 与 fixture allowlist，并在测试中用临时 canonical + fixture 文件锁定 | 集成测试 + gate JSON `canonicalFiles/fixtureFiles` |
| docs-check 链路 | Round24 已把 gate 接入 `check-docs.sh` | 维持脚本 CLI 输出兼容，新增 `scanner.mode=lexical-light-ast` 便于验收读数 | `bash docs-linhay/scripts/check-docs.sh` |

## 红绿灯记录

- 红灯：先扩展 `check-quota-static-gate-integration.test.mjs`，新增注释/字符串 fixture；旧 gate 失败并报告字符串、注释中的 `quotaFact` / `quota_fact`。
- 绿灯：重写 gate 为 token 扫描后，同一集成测试通过；实际仓库扫描 `335` 个 frontend feature 文件，`49` 个 fixture 文件，`1` 个 canonical 文件，`findings: []`。

## 实现记录

- `check-quota-no-direct-fact-parser.mjs` 增加 tokenizer，跳过 `//`、`/* */`、quoted string 和 template string 内容。
- 扫描形态从正则升级为 token 规则：
  - property access：`payload.quotaFact`、`status.originalMessage`
  - bracket access：`payload['quota_fact']`、`status['rawPayload']`
  - object destructuring：`const { rawPayload: raw } = status`
  - raw alias：`const raw = status.originalMessage`
  - `JSON.parse(raw)` / `JSON.parse(status.rawPayload)` raw payload parse
- 脚本导出 `findDirectParserLines()` 与 `runQuotaGate()`，同时保留 CLI 执行路径，便于后续 focused tests 直接复用。

## 验收命令

```bash
node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs
node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
bash docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs docs-linhay/scripts/check-quota-static-gate-integration.test.mjs docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md docs-linhay/spaces/20260616-quota-intelligence-dashboard/plans/20260617-round25-ast-static-gate.md
```

## 剩余风险

1. 该 gate 仍不是完整 TypeScript AST；computed dynamic key、跨函数数据流、template expression 内的真实代码不做完整语义追踪，需要 code review 配合。
2. Round23 保留的 Doctor Workbench typed consumer 例外仍存在；本轮避免触碰并行 Doctor 文件，只强化其他 feature 文件的 direct parser gate。
