# Codex 扩展与配置工作台体验巡检报告

轮次：第 1 轮：体验 + 代码逻辑审核

## 体验范围

本报告以“Codex 扩展与配置工作台体验者”视角巡检 GetTokens dev 环境中与 Codex Skills、MCP Servers、`~/.codex/config.toml` 编辑、deep-link import、openai-compatible 映射和浏览器预览相关的体验链路。

只做只读巡检与安全测试，未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

写入范围仅限本文件。

## 方法

1. 读取本轮 space 约束、dev 数据准备记录和 Codex 扩展管理 skill。
2. 检查前端实现：`frontend/src/features/codex-extensions/`、Codex 账号列表、deep-link import、状态页 local apply 与 model catalog 相关入口。
3. 检查后端实现：`internal/wailsapp/codex_extensions.go`、DTO、mapper 与测试。
4. 只读查看 dev 数据目录结构与账号库非敏感字段：账号类型数量、openai-compatible provider/model 摘要、Codex 路由配置。
5. 运行安全测试：
   - `node --test src/features/codex-extensions/model.test.mjs`：通过，6 项。
   - `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`：通过。
   - `npm run test:unit -- src/features/codex-extensions/model.test.mjs` 实际触发项目完整 unit 脚本，因账号卡片既有断言失败而失败；扩展模型测试本身通过。

## 建议清单

### 1. Git Skill 安装入口需要从“浏览器预览”补齐为真实安装计划

问题：当前 `Add Skill` 在浏览器模式会解析 `tk://github.com` / `tk://gitlab.com` 并插入预览记录，但桌面真实路径没有对应的 `Plan/Install/Update` Wails 方法，后端也只有 `parseCodexGitSkillSource` 解析函数。用户看到“安装 / 更新”按钮时，会自然期待它能 clone、校验、落盘和记录来源。

影响：Skill source 的产品承诺和实际能力不一致；团队共享 Skill、回滚和更新不可追溯，容易出现“列表里看起来安装了，但 Codex 实际扫描不到”的落差。

建议改法：新增独立的 Git Skill 事务链路，不复用 MCP 或 Skill enabled 保存接口。先实现 `PlanCodexGitSkillInstall` 与 `InstallCodexGitSkill`：解析 schema、clone/fetch 到 managed cache、resolve commit、校验目标路径含 `SKILL.md`、materialize 到 `$HOME/.agents/skills/<skill-id>` 或 `$CODEX_HOME/skills/<skill-id>`，写 `.lock.json` 记录 source URL、repo、ref、resolved commit、source path、local path、skill name。UI 先展示 install plan 和 commit，再允许安装。

验收方式：用临时 `CODEX_HOME` 和临时 Git repo 做后端测试，确认安装后目录存在、`SKILL.md` 可扫描、lock 含 commit；前端测试确认无 Wails 时仍是 preview，桌面绑定存在时调用真实 plan/install；手动刷新 Skills 列表能看到新 skill 且 origin/version 来自 lock。

### 2. MCP 结构化编辑器不能安全处理 conflict/unknown transport

问题：后端可以解析出 `transport = "conflict"` 或 `"unknown"` 并标记 error，但前端 `mapBackendMcpServer` 会把非 `streamable_http` 一律归为 `stdio`。用户打开冲突配置时，编辑器会以 stdio 表单展示，保存可能把 `url` 等冲突信息清掉。

影响：问题配置的诊断入口和修复入口混在一起，用户很可能在不理解原始冲突的情况下保存，导致本来只想查看的配置被结构化重写。

建议改法：前端 model 扩展 `McpTransport` 支持 `conflict | unknown` 的只读状态；列表展示 error badge 和 warning 摘要。打开编辑器时先展示原始 TOML 与明确修复操作，例如“转为 stdio”或“转为 streamable_http”，用户选择后才进入对应表单并清理互斥字段。

验收方式：构造同时含 `command` 和 `url` 的 `config.toml` 测试；列表显示 error，打开 modal 不默认改为 stdio；点击“转为 HTTP”后预览 diff 明确删除 `command/args/env` 并保留 `url`。

### 3. MCP tool approval 只能读取，不能编辑或新增

问题：后端会把 `[mcp_servers.<id>.tools.<tool>]` 解析到 `Tools`，raw config 也保留 nested tool sections，但 `McpServerEditorModal` 的“工具范围”只编辑 `enabled_tools`、`disabled_tools`、`scopes`，没有编辑 tool approval rows。

影响：用户能看到当前值里有工具审批策略，却无法在结构化表单中修改；最终只能切到 raw editor，降低了结构化编辑的可信度。

建议改法：在 MCP editor 增加“Tool approval”小表格：tool name、approval_mode 下拉、删除、添加一行。保存时 patch 目标 server 的 nested tool sections，并保留未触碰 tool section 的未知字段。change preview 增加 `tools.<name>.approval_mode`。

验收方式：后端新增测试验证修改一个 tool、新增一个 tool、删除一个 tool 不影响其它 server；前端模型测试覆盖 `serializeMcpTools`/diff；手动在 preview config 中修改 `write_file=prompt` 后 raw current value 和保存后 reload 一致。

### 4. raw `config.toml` 编辑器缺少 TOML 预检和保存前备份提示

问题：`SaveCodexConfigToml` 会直接原样写入内容，前端只显示 dirty/clean，没有 TOML 解析预检、MCP 解析预览或自动备份路径提示。结构化保存有字段校验，raw 保存风险明显更高。

影响：用户误粘贴非法 TOML 后，Codex 和工作台结构化视图都可能失效；配置恢复成本高，尤其是 `config.toml` 里同时包含模型 provider、MCP、profiles 和 skills 禁用规则。

建议改法：raw 保存前先用后端 TOML parser 做语法预检，并返回将被识别的 MCP servers、warnings 和无法解析的行号。保存时在 `$CODEX_HOME/config.toml.gettokens-backup-<timestamp>` 创建备份，保存结果返回 backup path 并在 HUD 中展示。允许用户显式“仍然保存非法 TOML”时也必须二次确认。

验收方式：非法 TOML 保存默认被阻止并显示行号；合法 TOML 保存后备份文件存在；保存后自动 reload MCP 列表；单元测试覆盖非法 TOML、合法 TOML、备份失败时不写入。

### 5. raw editor 与结构化 editor 的双向同步还不完整

问题：raw editor 保存后会 `reloadServers`，但结构化保存后如果 raw editor 仍打开，`configEditor.content` 不会刷新。用户在两个 modal 间切换或并行打开时，raw 视图可能保留旧内容。

影响：用户可能基于旧 raw 内容继续编辑并覆盖刚保存的结构化改动，尤其是 MCP section 与 nested oauth/tools section 同时存在时。

建议改法：结构化保存成功后，如果 raw editor 已打开，重新调用 `GetCodexConfigToml` 刷新 `content/originalContent`；如果 raw editor dirty，则阻止结构化保存或提示“raw editor 有未保存改动，先保存/丢弃”。反向也一样：raw dirty 时打开 server editor 应显示冲突提示。

验收方式：打开 raw editor 修改但不保存，再打开 MCP editor 保存，应出现冲突提示；结构化保存成功后 raw editor 中对应 section 同步为最新内容；前端测试覆盖 dirty arbitration 状态。

### 6. MCP 保存会重排 inline env/http_headers，diff 不提示排序变化

问题：后端 `formatTomlInlineEnv` 会按 key 排序；结构化保存会重新格式化已知字段，尽管保留未知字段。对于用户手写配置，保存后可读顺序可能变化，但 change preview 只展示字段值变化，不展示格式化/排序影响。

影响：配置 diff 里会出现非业务变更，用户难以判断保存是否只改了预期字段；团队排查配置历史时噪声增加。

建议改法：保存前增加“格式化影响”预览：列出会被重写的已知字段和 nested section，明确 env/http_headers 将按 key 排序。中期可改为尽量保留原 inline map key 顺序，只对新增/修改 key 做局部 patch。

验收方式：构造 `env = { Z = "1", A = "2" }`，只改 `tool_timeout_sec`，保存前提示 env 排序影响；如果采用保序 patch，保存后 env 顺序不变。

### 7. MCP Server ID 只允许 bare TOML key，缺少重命名/引号 key 支持

问题：`validateCodexMcpServer` 要求 server id 是 bare TOML key；Codex TOML dotted path 本身可以用 quoted key 表达包含特殊字符的 id。当前 UI 也把 id 和 label 绑定，重命名没有迁移 nested oauth/tools section 的明确体验。

影响：已有 quoted id 的 MCP server 可能只能 raw 编辑；用户想把 server id 从 `linear` 改成 `linear-team` 时，不知道 nested tool/oauth 是否会随之移动。

建议改法：分两步做：第一步在 UI 禁止直接改 ID，只显示“重命名 server”动作；第二步实现 quoted key 支持和 section rename，迁移主 section、`.oauth`、`.tools.*`，并在 diff 中展示 old id -> new id。若暂不支持 quoted key，列表应显示“需 raw 编辑”的只读标记。

验收方式：测试 quoted id `[mcp_servers."linear.team"]` 可读取且不会被错误降级；重命名 `linear` 后 nested oauth/tools 迁移到新 id；旧 section 不残留。

### 8. Skills 启停缺少“规则来源”解释

问题：后端支持 path selector 和 name selector 的 `[[skills.config]] enabled=false`，并按顺序应用；UI 只显示 enabled 状态，不解释是默认启用、path override 还是 name override 命中。

影响：用户看到某个 Skill 关闭时，无法判断关闭来自哪个配置块；启用操作会移除匹配的禁用 override，但如果同名或路径规则并存，用户不容易预测保存结果。

建议改法：后端在 `CodexSkillRecord` 增加 `enabledReason` / `matchedConfigRule` / `configRuleIndex`，UI 在详情 modal 中展示“启停来源”。启用/禁用前的确认 diff 展示将新增或移除的 `[[skills.config]]` 块。

验收方式：构造 name selector 和 path selector 两种禁用配置；列表/详情展示命中规则；启用后只移除相关禁用块，不写 `enabled=true`；测试覆盖规则顺序。

### 9. Skill 文件扫描没有数量/深度预算提示

问题：`listCodexSkillFiles` 对单个 Skill 目录做完整 WalkDir，只按单文件 64KB 控制 previewable。若某个 skill 包含大量 assets、node_modules 或生成文件，列表加载可能变慢，UI 也没有“已截断/跳过”的提示。

影响：真实用户安装外部 Git Skill 后，可能因为包体大导致 Skills 页面加载明显变慢；体验上会误以为工作台卡住。

建议改法：给单个 skill 的文件扫描增加预算，例如最大文件数、最大目录深度、跳过 `.git/node_modules/dist/build`，返回 `filesTruncated` 和 warnings。UI 在详情文件列表顶部展示“仅展示前 N 个文件，已跳过目录...”。

验收方式：构造包含 3000 个文件和 node_modules 的临时 skill；snapshot 在预算内返回，warnings 可见，页面不卡死；点击 `SKILL.md` 仍可预览。

### 10. 浏览器预览数据与真实 dev 数据断层较大

问题：Codex extensions previewData 固定展示 3 个 skills 和 3 个 MCP server；dev 数据里账号库有 37 个 auth-file、16 个 codex-api-key、5 个 openai-compatible，且 openai-compatible 当前全部 disabled，Codex 路由仍保留若干账号顺序。扩展页的浏览器预览无法反映“配置可写但运行时不可用”的真实状态。

影响：开发者或体验者在浏览器预览中难以发现 openai-compatible disabled、路由账号失效、MCP env missing 等真实工作台风险，导致预览验收过绿。

建议改法：增加 dev bridge/fixture 预览模式：从安全脱敏的 dev snapshot 生成 preview fixtures，只包含类型、启用状态、provider、模型 alias、MCP server 状态，不含凭证。Codex extensions 页面在 localhost dev 模式优先使用该 fixture，而不是完全固定 mock。

验收方式：生成一份脱敏 fixture 后，浏览器预览显示 openai-compatible disabled 数量和模型 alias 摘要；无 fixture 时回退固定 previewData；测试确认 fixture 不含 api key/token/auth_json。

### 11. openai-compatible 模型映射与 Codex 扩展/配置页缺少跳转闭环

问题：openai-compatible 模型映射主要在 Codex account list 和 status/local apply 中处理；MCP/config workbench 只显示 `config.toml`，不提示当前 `model_provider/model/model_catalog_json` 与本地 account-store 的可用 provider 是否匹配。

影响：用户在扩展工作台编辑 `config.toml` 后，可能以为 Codex 已能请求 DeepSeek/MiMo 等 openai-compatible 模型，但 dev 数据里这些账号可能 disabled 或没有 active backing，最终运行时才报 `auth_unavailable`。

建议改法：在 MCP/config 页面顶部增加“Codex config health”摘要：当前 model_provider、当前 model、model catalog 指针、active openai-compatible provider 数、disabled provider 数。对可疑状态提供跳转到 Codex Account List 或 Status local apply 的按钮。

验收方式：dev 数据中 openai-compatible 全 disabled 时，页面显示 warning；启用一个 provider 后 warning 消失或降级；点击跳转保留 `frame=codex&workspace=account-list`。

### 12. deep-link import 与 Codex config apply 没有进入扩展工作台的可见审计面

问题：deep-link import 由 `deeplink:import` 事件进入 Accounts 入口，Codex config patch 设计要求复用 local apply 和受控 patch；但 Codex extensions/config 页面没有“最近导入/待应用配置草稿/导入来源”的审计视图。

影响：外部链接导入账号或 Codex setup 后，用户很难从扩展工作台复核它到底准备改哪些 `auth.json` / `config.toml` 字段；扩展工作台无法承担“配置工作台”的追溯职责。

建议改法：新增一个只读“Import & Apply History”侧栏或 modal，展示最近 deep-link import 的 source、resource、nonce、目标文档、受控字段 diff、执行状态和失败原因。数据来源可以先用前端会话态和 dev bridge，后续再落到 account runtime apply state。

验收方式：触发 `gt-dev://app/v1/import?...resource=codex-setup` 后，Accounts 确认页仍负责执行；Codex extensions 页面能看到同一条导入记录和 config diff；不展示 api key/token 明文。

### 13. MCP env/header 编辑用纯文本 textarea，缺少行级校验

问题：`env`、`http_headers`、`env_http_headers` 都用 `KEY=value` textarea 解析；无 `=` 的行会被解析成空值，非 bare TOML key 的 header/env key 在写回时会被 `formatTomlInlineEnv` 静默跳过。

影响：用户以为保存了 `X-Client=GetTokens` 或复杂 header，但由于 key 不满足 bare TOML key 规则，最终配置可能缺字段；这个问题不容易从当前 change preview 看出来。

建议改法：把 textarea 升级为行级编辑器：key、value 两列，key 实时校验 bare TOML key；不合法 key 禁止保存或提示需 raw editor。对于 HTTP header 常见 `X-Client` 可以允许 bare key，因为 `-` 已支持；对包含空格/冒号的 key 明确报错。

验收方式：输入非法 key `Authorization Header=xxx` 时保存按钮禁用并显示错误；输入 `X-Client=GetTokens` 保存后 raw TOML 正确；测试覆盖“旧实现会静默丢弃”的 case。

### 14. 扩展详情 modal 未接入独立 hash 路由

问题：AGENTS 规则要求详情类 modal 具备可恢复 hash 路由；Codex account list 已有 `detail=<id>` / `modal=<route>`，但 Codex Skills/MCP editor modal 只存在本地 state，刷新或分享 URL 后无法恢复。

影响：体验巡检、问题复现和截图归档时无法直达某个 Skill 或 MCP server；用户在刷新后丢失正在查看的详情上下文。

建议改法：为 Codex extensions 增加 `detail=<encoded-skill-or-server-id>` 和 `modal=codex-config` / `modal=codex-git-skill-install` 路由。打开/关闭 modal 只增删对应参数，保留 `frame=codex&workspace=skills|mcp-servers`。

验收方式：打开 skill 详情后 hash 包含 detail；刷新页面恢复同一详情；关闭只移除 detail；MCP config raw editor 用 `modal=codex-config` 可恢复。

### 15. 缺少 MCP “运行前诊断”按钮

问题：MCP 页面能编辑 command/url/env，但没有检查命令是否存在、cwd 是否存在、环境变量是否设置、HTTP URL 是否 reachable、bearer env 是否为空。

影响：用户保存成功不代表 Codex 可以启动 MCP server；错误会延迟到 Codex 会话中暴露，定位成本高。

建议改法：增加只读诊断按钮，不启动长期 server，只做轻量 preflight：stdio 检查 command path、cwd、env var presence；HTTP 检查 URL 格式、bearer token env var 是否存在，可选 HEAD/OPTIONS 探测。结果只显示存在/缺失，不显示 env 值。

验收方式：配置 `bearer_token_env_var=LINEAR_API_KEY` 但环境未设置时显示 missing-env；配置不存在 cwd 时显示 error；诊断不写 `config.toml`，不输出 secret。

## 代码逻辑审核补充

说明：原 15 条已经覆盖业务体验和部分代码逻辑风险，其中第 2、3、4、5、6、7、9、13 条与源码实现直接相关。本补充基于已读过的 `frontend/src/features/codex-extensions/`、`internal/wailsapp/codex_extensions.go`、`internal/wailsapp/codex_extensions_test.go`、Codex local apply / deep-link 相关入口，继续补充代码逻辑层面的中度建议。

### 16. 前端 MCP transport/status 类型与后端状态不一致

问题：后端 `parseCodexMcpServerSection` 能产出 `transport = "conflict" | "unknown"` 和 `status = "error"`，但前端 `McpTransport` 只有 `stdio | streamable_http`，`mapBackendMcpServer` 也把非 HTTP 的 transport 映射成 `stdio`，status 非 `disabled/missing-env` 时映射成 `ready`。

影响：后端已经识别出的错误状态在前端被吞掉，业务层看到的是 ready/stdio。后续即使后端增强 warnings，前端仍可能误导用户保存错误配置。

建议改法：把前端 `McpTransport` 与 `McpServerRecord.status` 扩展到后端完整枚举，至少支持 `conflict`、`unknown`、`error`。`toBackendMcpServer` 只允许可保存的 transport；不可保存状态必须先经过显式转换动作。

验收方式：新增前端 model/adapters 测试，输入后端 `transport=conflict,status=error` 时前端仍保持 conflict/error；打开编辑器不能直接保存；选择修复 transport 后才可调用 `SaveCodexMcpServer`。

### 17. MCP args 的前端解析会丢失带空格参数语义

问题：`parseMcpArgs` 用空白字符直接 split，`serializeMcpArgs` 用空格 join。实际 MCP stdio args 可能包含带空格路径、JSON 字符串或 shell 风格 quoted 参数，例如 `--config '{"root": "/My Project"}'`，结构化编辑一次就会拆坏。

影响：用户只要打开并保存包含 quoted args 的 server，就可能改变 Codex 启动 MCP server 的真实参数。这个问题属于配置破坏型逻辑风险，不只是展示问题。

建议改法：args 编辑从单行 shell 字符串改为逐行数组编辑，或使用 JSON array 文本编辑并做解析校验。读取时保留后端数组，保存时直接提交数组，不走空白 split。

验收方式：前端测试覆盖 `["--path", "/Users/me/My Project", "--json", "{\"a\":\"b c\"}"]` 往返不变；结构化保存后 raw TOML 的 args 数组与原数组一致。

### 18. Git Skill source 前后端 parser 规则未完全对齐

问题：前端 `parseTkGitSkillSource` 只校验 `tk://`、host 和基本 path 参数，未拒绝 `..`、绝对路径、Windows drive path、空 path 等逃逸形态；后端 `parseCodexGitSkillSource` 有部分 path 校验，但当前没有真实 install 方法调用它形成统一门禁。

影响：浏览器预览可能把危险或无效 source 显示为可安装，等桌面实现补齐时容易出现前端允许、后端拒绝的体验断层；如果后续有人直接复用前端 parser 生成 install plan，会放大路径风险。

建议改法：抽出前端 `validateTkGitSkillSource` 与后端 `parseCodexGitSkillSource` 的共享测试矩阵，明确拒绝空 path、`..` segment、绝对路径、Windows drive、NUL、非 allowlist GitLab host。UI invalid reason 要和后端错误口径一致。

验收方式：同一组 source case 在前端 `model.test.mjs` 和后端 `codex_extensions_test.go` 都通过；`tk://github.com/a/b?path=../x`、`path=/tmp/x`、`path=C:%5Cx` 均被前端和后端拒绝。

### 19. `SaveCodexMcpServer` 保存结果没有使用输入的 tools

问题：`SaveCodexMcpServer` 保存后构造 `saved.Tools = document.tools[saved.ID]`，也就是保存前文档中的 tools；即使未来前端把 `input.Server.Tools` 提交进来，返回值和 rawConfig 仍会显示旧 tools。当前工具审批不可编辑时问题被掩盖，但一旦补齐第 3 条就会变成实际 bug。

影响：用户修改 tool approval 后可能看到保存成功但 UI reload 前仍是旧值；如果 patch 逻辑也未同步处理 tools，会导致保存结果、文件内容和前端状态三者不一致。

建议改法：实现 tools patch 时同步调整保存链路：`patchCodexMcpServerSection` 或独立函数负责 patch nested tool sections；保存后的 `saved.Tools` 取规范化后的 `input.Server.Tools`，再从写入后的 TOML 重读一次作为最终真源。

验收方式：后端测试提交 tools 修改后，返回 result.server.tools 与文件内容一致；保存后立即调用 `GetCodexMcpServers`，两者 tools 完全一致。

### 20. MCP section patch 对 quoted server id 的查找与写回不完整

问题：读取侧 `parseCodexMcpServerSectionID` 能解析 `[mcp_servers."linear.team"]`，但保存侧 `patchCodexMcpServerSection` 使用 `header := "[mcp_servers." + server.ID + "]"` 查找 section，并且 `validateCodexMcpServer` 只允许 bare TOML key。读取与写回能力不对称。

影响：quoted server id 在列表中可能被读到，但无法结构化保存；更糟的是如果后续放宽 validate，却不修 patch 查找，就可能找不到原 section 并追加新 section，造成重复配置。

建议改法：把 section id 保留为解析后的 logical id，同时保存原始 header path 或 formatted TOML path segment。查找时支持 bare 和 quoted 两种 header，写回时沿用原 header；新增 server 才使用 `formatTomlPathSegment`。

验收方式：构造 `[mcp_servers."linear.team"]`，结构化修改 `enabled=false` 后只 patch 原 section，不新增 `[mcp_servers.linear.team]`；nested oauth/tools 也沿用 quoted id。

### 21. 后端 TOML 解析仍是 ad-hoc 行解析，缺少多行结构测试

问题：`parseTomlStringArrayKeyValue`、`parseTomlInlineStringMap`、`parseTomlRawKeyValue` 等逻辑按单行解析，适合当前简单 case，但真实 `config.toml` 可能出现多行数组、注释、转义字符串和更复杂 inline table。raw editor 又允许任意 TOML 写入，结构化视图容易漏读字段。

影响：用户在 raw editor 写入合法 TOML，但结构化 MCP 列表读不出来或保存时重写丢失部分已知字段。由于未知字段保留策略只保护未识别 key，已知 key 的复杂表达反而更容易被跳过或覆盖。

建议改法：中期引入 TOML AST parser 做读取和局部 patch，至少先新增多行数组、转义字符串、含注释字符串、inline map 顺序等测试，明确当前不支持时在 UI warning 里提示“该字段使用复杂 TOML 表达，仅 raw editor 可编辑”。

验收方式：测试合法多行 `args = [ "-y", "@playwright/mcp@latest" ]` 能被读取；若暂不支持，snapshot 返回 warning 且结构化保存不覆盖该字段。

## 优先候选

1. MCP conflict/unknown transport 只读修复入口：风险低，能直接避免结构化编辑误写坏配置，适合作为评估修复阶段的第一候选。
2. raw `config.toml` 保存前 TOML 预检与备份：用户保护价值高，改动边界清晰，后端测试可控。
3. MCP tool approval 结构化编辑：补齐当前已经解析但不能编辑的能力，能显著提升 MCP 工作台完整度。

## 风险/未覆盖

1. 本轮未启动 Wails dev App 做可视化点击验收，建议由主控在汇总阶段统一做桌面预览和截图归档。
2. 未读取正式数据目录，dev 数据来自主控已搬运目录；SQLite WAL 快照风险沿用 `dev-data-prep.md` 说明。
3. 未测试真实 Git clone、MCP server 启动或外部 HTTP 探测，避免引入网络副作用；Git Skill 安装建议仍需单独设计事务与回滚。
4. `npm run test:unit -- src/features/codex-extensions/model.test.mjs` 因脚本实际跑全量测试而失败，失败点在账号卡片测试断言，与本报告巡检的 Codex extensions 模型测试无直接关系；单独 `node --test src/features/codex-extensions/model.test.mjs` 已通过。
