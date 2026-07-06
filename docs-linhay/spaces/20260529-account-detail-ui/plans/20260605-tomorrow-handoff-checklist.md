# 2026-06-05 账号详情页 v09 明日交接清单

## 当前已完成

### Space / 设计稿

- 当前收敛设计稿：`../account-detail-account-types-v09.html`
- 执行计划：`20260605-account-detail-v09-implementation-plan.md`
- README 已更新当前设计稿入口和状态。

### 前端已落地切片

1. **Header 收敛**
   - Header 左侧移除 READY/DIRTY/BUSY/ERROR 状态 pill。
   - Codex Auth-file/OAuth 头部显示 `Codex OAuth`，不再显示 auth 文件名。

2. **短消息验证**
   - 验证区文案改为“短消息验证 / 发送验证”。
   - 明确验证只发送一条短消息：`send one short chat message only`。
   - 暂未扩展真实 `onVerify` 入参，仍保留当前 `{ apiKey, baseUrl, model }` 合约。

3. **Footer 单行状态**
   - Footer 状态说明增加 `data-account-detail-footer-status="single-line"`。
   - 使用 `whitespace-nowrap / overflow-hidden / text-ellipsis` 保持单行。

4. **身份凭据区**
   - 凭据字段从 `stacked` 转为 `balanced-grid`。
   - 凭据输入固定明文 text，不再使用 password。

5. **Auth-file/OAuth 配置管理语义**
   - 从“文件摘要 / 脱敏 / 复制原文”改为“配置管理”。
   - UI 覆盖账号名称、配置预览、下载配置、应用配置、SQLite account store。
   - 2026-06-05 当时配置管理区明确标记为 `data-auth-file-config-management="ui-placeholder"`，并明确“待接入 account-store management API”，未接伪 API。
   - 2026-07-06 已 superseded：`应用配置` 接入 `ApplyAuthFileConfig(name, content)`，写回账号数据库并刷新 auth-file metadata，不再是 UI placeholder。

6. **代理路线与模型目录**
   - 账号详情代理配置改为只选择已保存代理池节点。
   - 模型目录改成 `Source Model → Alias / Route` 只读映射卡。

## 当前测试证据

- `node --test src/features/accounts/tests/accountDetailLayout.test.mjs`：29/29 通过。
- `npm run typecheck`：通过。
- `docs-linhay/scripts/check-docs.sh`：通过。

## 明天优先确认

1. **Auth-file/OAuth 配置 API**
   - `预览配置` 是否继续复用 normalize 能力，还是新增 account-store management preview endpoint？
   - `下载配置` 是下载运行时 auth 合成配置，还是下载 account-store JSON snapshot？
   - `应用配置` 的真实 sidecar management API 名称、入参和成功/失败状态。

2. **短消息验证 API**
   - 是否扩展为：`{ model, message, maxTokens, timeoutMs, persist: false }`？
   - 是否需要区分 API Key / OAuth / Split Credential 的验证路由？
   - 失败信息是否来自 sidecar 结构化错误，还是前端临时展示原始 message？

3. **模型映射编辑保存**
   - 非只读 Source/Alias 的保存 DTO 是否已经存在？
   - Source Model / Alias / Route 的唯一性、删除、只读规则由前端还是 sidecar 管？
   - Auth-file provider 模型是否永远只读？

4. **Space 历史设计稿治理**
   - 当前 `account-detail-account-types-v03..v27.html` 仍作为历史迭代证据存在。
   - 若严格执行“单期只保留一个 HTML”，建议明天确认后把历史稿归档到 README 列表或删除未采用稿，只保留 v09 当前入口。

## 建议下一步执行顺序

1. 跟用户确认上面的 API / DTO 边界。
2. 若确认短消息验证入参，先补 model/test，再扩展 `onVerify` 合约。
3. Auth-file 配置 API 已于 2026-07-06 接入 Wails binding，并把 `ui-placeholder` 改成真实状态标记；后续只需继续确认短消息验证与模型映射编辑保存。
4. 做浏览器预览截图：
   - `#frame=accounts&detail=codex-api-key%3Astable-001`
   - `#frame=accounts&detail=auth-file%3Acodex-pro.json`
5. 视确认结果处理历史 HTML 设计稿治理。
