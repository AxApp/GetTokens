# Claude Code Open Responses M1 文件与测试映射

## 目的

前面的 `M1 决策门` 已经回答了“要不要做”“做到哪算不越界”。
本文件继续往前推进半步，回答：

1. 如果真的开做 M1，首批最可能会改哪些现有文件
2. 每个文件为什么属于 M1
3. 每个文件应该补哪类 focused tests
4. 哪些文件虽然相关，但当前不该进入 M1

## M1 的范围再次确认

M1 只包含三类工作：

1. 统一口径
2. 给现有 `messages -> chat` compat 主路径补最小 focused tests
3. 核查并收口 UI / workbench / preview 文案

M1 不应进入：

1. `Claude -> OpenAI Responses` translator
2. `OpenAICompatExecutor` `/responses` path
3. Claude 候选池开放 `openai_responses`
4. UI 正式暴露 Responses compat 能力

## 一、M1 首批应关注的文件总表

| 层级 | 文件 | M1 角色 | 建议动作 |
| --- | --- | --- | --- |
| 业务规则 / skill | `.agents/skills/gettokens-claude-code-account-list/SKILL.md` | Claude Code 账号列表领域规则真源 | 校准口径，明确“不支持 open-response 正式能力” |
| 历史需求口径 | `docs-linhay/spaces/20260519-claude-code-account-list/README.md` | 旧 Claude account-list space 真源 | 查找是否存在会误导为跨协议已支持的表述 |
| Wails probe | `internal/wailsapp/claude_code_routing_probe.go` | 运行时证据源 | M1 不改协议，只确认注释/行为与当前口径一致 |
| Wails 路由解释 | `internal/wailsapp/channel_routing.go` | Claude explain 共享候选过滤语义 | 只核查 Claude 仍按 `anthropic` 入口表达 |
| 前端纯模型 | `frontend/src/features/claude-code/model/claudeCodeAccountList.ts` | Claude 列表筛选和 summary 语义真源 | 保持 `anthropic` 筛选前提，必要时加注释或测试 |
| 前端工作台展示 | `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.tsx` | 用户最容易被误导的说明文字 | 收口显示文案，避免把 compat 说成 responses 支持 |
| 前端页面控制器 | `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx` | probe / preview / details 入口 | 核查页面说明与 modal 文案是否越界 |
| 前端 preview | `frontend/src/features/claude-code/previewData.ts` | 浏览器预览证据基线 | 保持 preview 数据只体现 Anthropic 入口 |
| Design System 示例 | `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.stories.tsx` | 设计系统示例口径 | 收口示例数据与示例文案 |
| 本地 apply 纯模型 | `frontend/src/features/accounts/model/accountLocalCliMapping.ts` | Codex vs Claude local apply target 边界 | 继续明确 Claude 只从 `anthropic` 生成 draft |

## 二、文件分组与建议动作

## A. 口径真源文件

### 1. `.agents/skills/gettokens-claude-code-account-list/SKILL.md`

### 当前作用

这是 Claude Code 账号列表领域规则的长期真源，已经明确写了：

1. Claude 渠道筛选主条件是 `supportedFormats` 包含 `anthropic`
2. Claude runtime routing 的主路径是 Claude channel config
3. Claude Code 本地仍只写一个 relay endpoint / relay key

### M1 为什么该碰

如果仓库后续要稳定回答“现在不支持 open-response 正式能力”，skill 是最应该同步的规则源之一。
否则 research 文档说一套，skill 仍只停在旧边界，后续 agent 或维护者仍可能误判。

### M1 建议动作

1. 增补一句明确口径：
   - 当前不把 `openai_responses` 作为 Claude Code 正式支持面
2. 保持 skill 仍强调：
   - Claude 候选筛选看 `anthropic`
   - 不因为出现 compat 研究就放开 channel 候选策略

### 建议测试 / 校验

1. `docs-linhay/scripts/check-docs.sh`
2. `git diff --check`

---

### 2. `docs-linhay/spaces/20260519-claude-code-account-list/README.md`

### 当前作用

这是旧 Claude Code account-list 需求空间，里面已经写明：

1. 本期只把 `anthropic` 作为明确 P0
2. 非 Anthropic 格式转换不在当前交付范围

### M1 为什么该碰

这份 README 仍然是很多后续讨论会回看的历史需求真源。
如果当前 open-response 研究已经把边界说得更精确，旧 space 最多需要补一小段“当前结论仍然成立，并已由 20260615 research 进一步确认”。

### M1 建议动作

1. 只做轻量回链或补充说明
2. 不重写整个旧 space

### 建议测试 / 校验

1. `docs-linhay/scripts/check-docs.sh`
2. `git diff --check`

## B. Wails / 运行时证据文件

### 3. `internal/wailsapp/claude_code_routing_probe.go`

### 当前作用

这里是当前最直接的运行时证据之一：

1. 候选只认 `supportsAnthropicFormat(...)`
2. probe 实际发 `POST /v1/messages`

### M1 为什么该碰

M1 不需要改它的协议行为，但需要把它视为“必须保住的现状证据”。
如果要补 `messages -> chat` compat focused proof，这里也是最容易继续加注释、加 guard、加解释性测试的地方。

### M1 建议动作

1. 原则上不改逻辑
2. 如需改动，只应是：
   - 增补注释
   - 增补测试
   - 收紧错误信息或 explain 文案

### 建议测试

1. `internal/wailsapp/claude_code_routing_probe_test.go`
2. 重点保住：
   - 仍打 `/v1/messages`
   - 仍只接受 `anthropic` 候选

---

### 4. `internal/wailsapp/channel_routing.go`

### 当前作用

这是 Claude / Codex 共用的 routing explain 逻辑入口之一。

### M1 为什么该碰

不是因为要做功能改造，而是因为：

1. Claude 侧 route explain / filtered reason 是否持续体现 `anthropic` 入口边界
2. 是否存在会让人误解为 Claude 也按 Responses 入口筛选的提示文字

### M1 建议动作

1. 只核查 Claude explain 语义
2. 没有强证据时，不要在这里扩格式判断

### 建议测试

1. `internal/wailsapp/channel_routing_test.go`
2. 重点是 Claude / Codex 格式边界继续分离

## C. 前端纯模型与页面说明文件

### 5. `frontend/src/features/claude-code/model/claudeCodeAccountList.ts`

### 当前作用

这是 Claude 列表筛选和 summary 的纯模型真源，当前核心行为是：

1. `isClaudeCodeRequestAccount()` 只认 `supportedFormats.includes('anthropic')`
2. summary 里的 `anthropic` 计数也围绕这一条件

### M1 为什么该碰

这份文件是前端“真实规则”的中心。
如果 M1 要把口径产品化，这里需要确保：

1. 逻辑不被误改
2. 测试足够说明“只认 anthropic”是当前刻意产品边界，不是偶然实现

### M1 建议动作

1. 大概率只补测试或短注释
2. 不改筛选规则

### 建议测试

1. `frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`
2. 建议补：
   - `anthropic + openai_responses` 仍以 Anthropic 入口语义进入 Claude 列表
   - 纯 `openai_responses` 账号不会进入 Claude 列表

---

### 6. `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.tsx`

### 当前作用

这里是用户最容易形成产品认知的展示层：

1. header 文案
2. 请求顺序说明
3. probe / profile / mapping 的说明文字

### M1 为什么该碰

如果 M1 只做一处显性口径收口，这里几乎一定在首批名单里。
因为用户对“支不支持 open-response”的感觉，很大程度来自页面 copy，而不是只看模型函数。

### M1 建议动作

1. 检查以下文案是否足够稳：
   - “只收 `supportedFormats` 包含 `anthropic` 的账号”
   - “Claude Code 本地只应用一个 relay endpoint 和 key”
2. 如果需要加一句 clarify，建议表达为：
   - 当前入口是 Anthropic relay queue
   - 不在这里暗示 open-response 已支持

### 建议测试 / 验证

1. story / preview 肉眼校对
2. 若要加自动化，可在前端测试里断言关键 copy 存在

---

### 7. `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx`

### 当前作用

页面 controller，负责：

1. 真实数据加载
2. preview fallback
3. route probe modal
4. project config / detail hash

### M1 为什么该碰

这里只需要做“解释层面”的核查：

1. 有没有任何 message / toast / modal copy 会让人误解成 Claude 支持 Responses
2. preview mode 有没有演示出不该在 M1 暴露的能力

### M1 建议动作

1. 核查为主
2. 只在发现误导文案时局部收口

### 建议测试

1. 现有 hash / modal 路由测试继续保留
2. 如增加 copy，补最小文本断言即可

---

### 8. `frontend/src/features/claude-code/previewData.ts`

### 当前作用

浏览器预览固定 mock 数据真源。

### M1 为什么该碰

如果 preview 数据里偷偷引入 `openai_responses` 账号给 Claude 示例使用，会直接制造错误预期。
所以这份文件虽小，但属于 M1 需要明确保住的基线。

### M1 建议动作

1. 不主动扩数据形态
2. 保持 preview 数据只反映 Anthropic 入口

### 建议测试

1. `frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`
2. 继续保住 “preview rows exclude non-Anthropic accounts”

---

### 9. `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.stories.tsx`

### 当前作用

设计系统业务示例口径。

### M1 为什么该碰

story 是长期视觉和文案参考面。
如果 story 里写出会误导的 `supportedFormats`、probe 行文或标签，下游很容易照着抄。

### M1 建议动作

1. 校准 mock 数据里的格式标签
2. 校准 probeLines，避免像“Claude 在走 Responses”这种暗示

### 建议验证

1. Storybook 预览或 source review
2. 无需额外复杂自动化

## D. 本地 apply 边界文件

### 10. `frontend/src/features/accounts/model/accountLocalCliMapping.ts`

### 当前作用

这是本地 apply 的 target 分流真源：

1. `openai_responses` -> `codex`
2. `anthropic` -> `claude`

### M1 为什么该碰

这份文件是最容易被误读成“Claude 也能从 responses draft 推出来”的地方之一。
当前实现其实已经把边界分得很清楚，所以 M1 更像是“把这份边界作为反证固定下来”。

### M1 建议动作

1. 逻辑大概率不用改
2. 只补测试、注释或口径说明

### 建议测试

1. `frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs`
2. 建议保住：
   - Claude target 只从 `anthropic` 生成
   - `openai_responses` 只影响 Codex target
   - 同一账号同时有 `openai_responses + anthropic` 时，两端各走各的 target

## 三、M1 首批建议补强的测试

## 1. 必保测试

| 文件 | 当前覆盖重点 | M1 建议 |
| --- | --- | --- |
| `internal/wailsapp/claude_code_routing_probe_test.go` | `/v1/messages`、route headers、Anthropic 候选筛选 | 保持现状，必要时补一条更直白的“responses-only account rejected” |
| `frontend/src/features/claude-code/claudeCodeAccountList.test.mjs` | Anthropic 筛选、preview 行为、mapping 规则 | 补一条 `openai_responses` 不能单独进入 Claude 列表 |
| `frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs` | Codex / Claude local apply target 分流 | 补一条“Claude local apply 不是 responses target”的显式断言 |

## 2. 可选测试

| 文件 | 适用场景 | 建议 |
| --- | --- | --- |
| `internal/wailsapp/channel_routing_test.go` | 如果需要更明确钉死 Claude / Codex 格式边界 | 增补 Claude explain 的 filtered reason 测试 |
| `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx` 相关前端测试 | 如果页面 copy 有实质改动 | 只补最小文本断言，不扩大到复杂 UI 集成测试 |

## 四、与 M1 相关但当前不应进入首批改动的文件

以下文件和主题虽然相关，但不建议放进 M1：

| 文件 / 区域 | 原因 |
| --- | --- |
| `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go` | 这已经是 M3 runtime spike 范围，不属于 M1 |
| `docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/*` | 正向/反向 translator 改造都超出 M1 |
| `internal/wailsapp/channel_routing.go` 中的格式判定逻辑扩展 | 若扩格式就是越过当前证据门 |
| `frontend/src/features/claude-code/model/claudeCodeAccountList.ts` 的候选规则放宽 | 一旦放宽到 `openai_responses` 就会制造假支持 |
| 任何把 `responses upstream compat` 当成正式 UI capability 的 badge / label | 这属于 M4，不属于 M1 |

## 五、推荐的 M1 执行顺序

如果后续真的开做 M1，建议顺序如下：

1. 先改口径真源
   - `gettokens-claude-code-account-list/SKILL.md`
   - 必要时轻补旧 `20260519` space README
2. 再补纯模型 / local apply focused tests
   - `claudeCodeAccountList.test.mjs`
   - `accountLocalCliMapping.test.mjs`
   - 必要时 `claude_code_routing_probe_test.go`
3. 最后收口展示层 copy
   - `ClaudeCodeAccountListWorkbench.tsx`
   - `ClaudeCodeAccountListFeature.tsx`
   - `previewData.ts`
   - `ClaudeCodeAccountListWorkbench.stories.tsx`

这样做的好处是：

1. 先把规则讲清楚
2. 再把当前规则用测试钉住
3. 最后再让 UI 跟着规则表达

## 六、当前结论

基于当前仓库现状，M1 真正会碰到的主路径文件并不多，核心就是：

1. 一个 Claude 领域 skill
2. 一份旧需求 space README
3. 两个 Wails 证据文件
4. 四个前端 Claude account-list 相关文件
5. 一个 local apply 纯模型文件
6. 三到五个 focused tests

这说明 M1 完全可以作为一个很窄、很可控的收口轮次执行，而不需要扩大成 Claude 协议改造。

## 当前状态

- 状态：research
- 最近更新：2026-06-15
