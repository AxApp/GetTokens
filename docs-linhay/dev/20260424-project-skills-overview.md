# GetTokens 项目级 Skills 蒸馏

来源会话：`gemini --resume 05ae7144-6948-432a-8845-8ae91ef183b5`

这轮沉淀只保留对 GetTokens 后续开发仍然稳定有效的能力边界，不保留一次性的修复细节。

## 新增 skills

1. `.agents/skills/gettokens-accounts-domain`
   账号池与 auth-file 领域闭环，覆盖 Wails 到 sidecar 的接口桥接、列表、详情、验证、删除与启停。
2. `.agents/skills/gettokens-wails-dev-loop`
   Wails + Vite 开发回路，强调何时必须冷重启、何时不能信任 HMR、以及如何确认桌面窗口加载的是最新 bundle。
3. `.agents/skills/gettokens-frontend-debug`
   前端调试与交互归因，覆盖 LocatorJS、Svelte Inspector、`!!!` 打点和 Wails WebView 兼容性陷阱。
4. `.agents/skills/gettokens-ui-system`
   视觉系统与本地化约束，固化黑白灰工业风、主题切换、设置页组织方式，以及中英文文案同步规则。
5. `.agents/skills/gettokens-session-skill-distill`
   把历史会话蒸馏成项目级 skills 的方法论，覆盖 transcript 定位、重复模式提炼、skill 边界划分与写回；当用户只说“整理”且语境明显指向当前会话时，也默认触发这条流程。
6. `.agents/skills/gettokens-agents-governance-sync`
   把 AGENTS 约束真正落到仓库动作上的方法论，覆盖 docs-linhay 落位、记忆写回、qmd 索引和 `.gitignore` 对齐。
7. `.agents/skills/gettokens-space-governance`
   `spaces` 工作空间治理，覆盖 `space-key` 命名、`README.md` 模板，以及 `plans`、`screenshots`、`debate` 的归档边界。
8. `.agents/skills/gettokens-doc-writeback`
   文档与记忆写回流程，覆盖落位判断、memory 精简写回，以及 `qmd update` / `qmd embed` 的强制同步。
9. `.agents/skills/gettokens-cliproxyapi-fork-maintenance`
   当问题落到 `CLIProxyAPI` 行为本身时，覆盖 fork/upstream 关系、上游同步、补丁平移、app bundle sidecar 替换与运行态核验。

## 为什么是这些 skills

当前沉淀出来的长期知识并不是若干孤立 bug，而是八类工作模式：

1. 账号池是当前最复杂、最容易回归的业务面。
2. Wails 开发态存在“看起来编译通过，但桌面窗口没加载新代码”的高频风险。
3. 交互问题经常需要先证明“代码有没有真的跑起来”。
4. 视觉与文案已经形成明确风格，不应每轮重新定义。
5. 会话中沉淀出来的项目知识需要有一套稳定的 skill 提炼流程。
6. AGENTS、文档、记忆、索引如果不同步，项目规则很快会失真。
7. `spaces` 结构落地后，单个需求空间的创建、命名和归档需要稳定执行模式。
8. 文档写回、memory 写回和索引同步是固定动作，应该独立成 skill，避免每次靠人工回忆。
9. “整理”已经成为会话收尾口令，后续应直接把它解释为一次 `skills + AGENTS + docs + memory` 的沉淀动作，而不是只做聊天总结。
10. sidecar 行为问题已经不再只是“看参考项目”，而是需要正式维护 `CLIProxyAPI` fork，并分清源码、fork 分支和 app bundle 实际二进制三层关系。

## 不纳入 skill 的内容

1. 单次提交信息
2. 一次性排障过程中的临时猜测
3. 某个具体账号文件的数据样本
4. 仅在那次会话里出现、但没有复用价值的口头表述
