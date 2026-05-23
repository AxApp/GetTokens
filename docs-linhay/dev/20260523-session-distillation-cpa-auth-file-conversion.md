# CPA auth-file 自动转换会话沉淀

日期：2026-05-23

## 背景

本轮从 `yynxxxxx/GPTSession2CPAandSub2API` 参考项目出发，为 GetTokens 增加多格式自动检测并转换为 CPA / sidecar-compatible `type: "codex"` auth JSON 的上传前处理。

## 可复用模式

1. 账号凭证格式转换应放在 `internal/accounts` 域层，而不是前端上传组件。
2. `UploadAuthFiles`、粘贴导入、详情 normalize 等入口应复用同一个 `NormalizeAuthFileForSidecar` 规则。
3. 对 session-like OAuth JSON 的识别必须同时满足 token 和账号身份信号，避免把普通 JSON 误判为 CPA。
4. 缺少真实 `id_token` 但具备账号 ID 时，可以生成 synthetic JWT，并在 `https://api.openai.com/auth` claims 中写入 `chatgpt_account_id` / `chatgpt_plan_type`，保持后续 profile/quota 推断可用。
5. 测试必须覆盖域层转换和 Wails 上传 multipart 入口，防止只测 helper、不测真实上传链路。

## 不纳入

1. 不把 sub2api、Cockpit、9router 输出格式纳入 GetTokens 首版。
2. 不把参考项目源码纳入 git；只保留索引和调研结论。
3. 不升级 `AGENTS.md`。这是账号凭证域内规则，尚不是 repo-wide 长期治理规则。

## 已沉淀入口

- 项目 skill：`.agents/skills/gettokens-domain-engineering/SKILL.md`
- 需求 space：`docs-linhay/spaces/20260523-cpa-auto-detect-upload/`
- 参考索引：`docs-linhay/references/20260523-gptsession2cpasub2api.md`

## 验证记录

- `go test ./internal/accounts ./internal/wailsapp`
- `go test ./...`
- `./docs-linhay/scripts/check-docs.sh`
- `qmd update`
- `qmd embed`
