# Quota Curl 模板解析边界

关联 space：`docs-linhay/spaces/20260505-codex-api-key-custom-quota-curl/README.md`

## 背景

`codex-api-key` 的在线额度查询允许用户粘贴 curl 模板。用户粘贴的 curl 往往来自浏览器或第三方文档，可能包含 `--http2`、`--connect-timeout`、`-A` 等运行时参数。早期实现遇到未知参数会直接报错，导致本来可以请求成功的额度接口无法保存。

## 决策

Quota curl 不是完整 curl 运行时，也不执行 shell。它是结构化 HTTP 请求模板：

1. 解析 URL、method、headers、body、cookie，并替换 `{{apiKey}} / {{baseUrl}} / {{prefix}}`。
2. 继续拒绝 shell 能力：管道、重定向、多命令、反引号、`$()`。
3. 对暂不支持但不需要 shell 执行的 curl 参数采用宽容策略：记录为 ignored option，然后继续发起请求。
4. 请求成功时不提示 ignored option，直接允许保存。
5. 请求失败或响应无法解析时，把 ignored option 作为排查提示附加到错误信息。
6. 前端保存启用 quota curl 的配置前，先用当前草稿调用 `TestCodexAPIKeyQuotaCurl`；测试成功后才保存。

## 不纳入

以下能力暂不视为已支持：

1. cookie jar 文件读写，例如 `-b cookie.txt` / `-c cookie.txt` 的文件语义。
2. `.netrc`、curl config file、文件上传、form multipart。
3. curl 自带代理、TLS、HTTP 版本强制等运行时效果。
4. 任意 shell 组合命令。

如果后续要扩大兼容面，优先引入成熟 shell parser 解决词法与 AST 问题，再在白名单内映射 HTTP 参数；不要把 curl 文本交给 shell 执行。

## 验证

本次落地验证：

1. `go test ./internal/accounts`
2. `go test ./internal/wailsapp`
3. `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs`
4. `npm --prefix frontend run test:unit -- src/features/accounts/tests/accountConfig.test.mjs`
5. `npm --prefix frontend run typecheck`
6. `docs-linhay/scripts/check-docs.sh`
