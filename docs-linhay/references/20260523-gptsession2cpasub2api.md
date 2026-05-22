# GPTSession2CPAandSub2API

- URL: https://github.com/yynxxxxx/GPTSession2CPAandSub2API
- 状态：GitHub 调研候选
- 关联 space：`docs-linhay/spaces/20260523-cpa-auto-detect-upload/README.md`

## 关注点

1. 多种输入格式的自动检测方式。
2. 统一转换为 CPA 格式的映射规则。
3. 上传前校验、错误回退和异常提示。
4. 可复用的流程拆分与边界定义。

## 已确认结论

1. README 明确支持 ChatGPT Web session JSON，典型字段包括 `user.email`、`accessToken`、`sessionToken`、`expires`、`account.id`、`account.planType`。
2. README 明确支持 9router Codex OAuth JSON，典型字段包括 `accessToken`、`refreshToken`、`expiresAt`、`providerSpecificData.chatgptAccountId`、`providerSpecificData.chatgptPlanType`。
3. CPA 输出为 `type: "codex"` 的 auth JSON，核心字段包括 `access_token`、`session_token`、`id_token`、`email`、`account_id`、套餐和过期时间。
4. `docs/index.html` 中 `convertSession` 会在缺少真实 `id_token` 时构造 synthetic JWT，payload 的 `https://api.openai.com/auth` 中包含 `chatgpt_account_id` 和 `chatgpt_plan_type`。

## 本轮采用边界

GetTokens 只吸收 CPA 转换能力，不实现 sub2api、Cockpit 或 9router 输出。

## 备注

本文件只记录参考入口，不包含外部源码或构建产物。
