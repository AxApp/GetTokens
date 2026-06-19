# 前端设计参考项目整理（2026-06-04）

本文件整理 3 个外部前端设计 / 体验工程参考项目。完整源码已按 `docs-linhay/references/README.md` 规则克隆到本机 `docs-linhay/references/<project>/`，这些源码目录默认被 `.gitignore` 忽略；GetTokens 仓库只提交本索引与调研结论。

## 本地镜像

| 项目 | URL | 本地路径 | 当前提交 | License | 主要用途 |
|---|---|---|---|---|---|
| `taste-skill` | <https://github.com/Leonxlnx/taste-skill> | `docs-linhay/references/taste-skill/` | `3c7017d636c3a4aad378433ea6d0cfa6c921da4a`（2026-05-26） | MIT | AI 前端设计 skills、反模板化 UI 指令、图片到代码/品牌板/移动端和 Web 设计图生成参考。 |
| `impeccable` | <https://github.com/pbakaus/impeccable> | `docs-linhay/references/impeccable/` | `1d5d745823aae7019044e8b0a621af4366dae224`（2026-06-03） | Apache-2.0 | 设计 skill 命令系统、确定性 anti-pattern 检测、浏览器 live iteration、设计上下文文档化参考。 |
| `frontend-system-design` | <https://github.com/devkodeio/frontend-system-design> | `docs-linhay/references/frontend-system-design/` | `ca56b546e5f12c408a2e75b2499264aacba99065`（2022-02-24） | MIT | 大型前端系统设计 checklist：PRD、架构、性能、安全、i18n、治理、QA 等。 |

## 1. taste-skill

### 项目定位

`taste-skill` 是一组面向 AI coding agent / image generation 的前端审美与交付 skills。核心目标是避免模型生成千篇一律的 SaaS 模板视觉，强调版式、字体、动效、色彩和空间层次。

### 可借鉴内容

- **项目级 skill 资产组织**：`skills/<skill-name>/SKILL.md` 结构清晰，适合作为 GetTokens 后续维护项目级 skills 的参考。
- **反模板化设计约束**：强调避免默认字体、紫蓝渐变、卡片套卡片、过度居中 hero 等常见 AI UI 痕迹。
- **按交付类型拆 skill**：既有代码实现类 skill，也有 image generation、brand kit、image-to-code 等视觉前置类 skill。
- **可调设计参数**：`DESIGN_VARIANCE`、`MOTION_INTENSITY`、`VISUAL_DENSITY` 这类旋钮可转化为 GetTokens 设计需求讨论时的验收语言。

### 已存在的项目内关联

当前 GetTokens `.agents/skills/` 已包含一批来自该方向的 skills，例如：

- `taste-skill/`、`taste-skill-v1/`
- `redesign-skill/`、`image-to-code-skill/`
- `imagegen-frontend-web/`、`imagegen-frontend-mobile/`、`brandkit/`
- `brutalist-skill/`、`minimalist-skill/`、`soft-skill/`、`stitch-skill/`、`gpt-tasteskill/`

因此本轮不重复复制源码到 `.agents/skills/`，只保留本地参考镜像与索引。

### GetTokens 使用建议

- 新建或重做桌面 Web/Wails 页面视觉时，优先用项目级统一入口 `gettokens-frontend-design-quality` 产出方向；Codex 仍负责业务状态、接口契约、测试门禁和最终集成。原 `design-taste-frontend` / `redesign-existing-projects` 作为参考材料保留，不再直接参与项目级 skill discovery。
- 对 GetTokens 这类密度较高的桌面工作台，应把 `VISUAL_DENSITY` 维持在中高区间，但避免牺牲可读性。
- 移动端相关 skills 仅在用户明确提出移动端目标时使用；GetTokens 默认仍是 macOS/Wails 桌面产品。

## 2. impeccable

### 项目定位

`impeccable` 是一个前端设计质量工具包：包含一个综合设计 skill、23 个命令、设计参考文件、确定性 anti-pattern 检测器、浏览器扩展和 live iteration 流程。

### 关键结构

- `skill/SKILL.src.md`：综合 skill 入口。
- `skill/reference/*.md`：按命令和设计领域拆分参考，例如 typography、color、motion、interaction、responsive、ux writing，以及 `audit`、`polish`、`harden`、`live` 等命令。
- `cli/` / `tests/`：反模式检测、CLI 和 live 流程的实现与测试。
- `PRODUCT.md` / `DESIGN.md`：项目产品上下文与设计系统文档范式。

### 可借鉴内容

- **命令化设计工作流**：`craft`、`shape`、`critique`、`audit`、`polish`、`harden`、`adapt`、`optimize` 等命令把“做设计”拆成可复用动作。
- **确定性 anti-pattern 检测**：把常见 UI 问题从纯主观审美转成可扫描规则，适合作为 GetTokens 后续 UI 门禁脚本的参考方向。
- **live visual iteration**：浏览器中选中元素、生成替代方案、接受/丢弃的 loop，可作为 GetTokens 后续桌面预览/设计迭代工具链参考。
- **PRODUCT/DESIGN 文档常驻上下文**：可参考其做法，进一步强化 GetTokens 的 space README、设计稿、验收标准之间的联动。

### GetTokens 使用建议

- 涉及页面级视觉重构时，可借鉴 `shape -> critique -> polish -> harden` 的顺序：先明确界面意图，再做审美评价，再做发布前补齐。
- 对高风险 UI（账号、路由、quota、运行会话），“harden” 应优先覆盖错误态、空态、长文本、i18n、加载态和低权限态，而不是只看静态好不好看。
- 短期只作为参考项目，不直接引入其 CLI/浏览器扩展；若后续要接入 anti-pattern 检测，应单独开 space 做 BDD/TDD 与脚本边界设计。

## 3. frontend-system-design

### 项目定位

`frontend-system-design` 是一份偏系统架构与面试 checklist 的前端系统设计指南。内容覆盖工程设计、高层架构、低层设计、性能、安全、治理、国际化、测试与发布实验。

### 可借鉴内容

- **需求与工程设计入口**：团队规模、用户群、合规、知识库、PRD、roadmap 等问题可用于 space README 的背景补齐。
- **高层设计 checklist**：平台、SPA/MPA、SSR/SSG/CSR、CI/CD、SEO、鉴权、状态管理、E2E、角色权限等。
- **低层设计 checklist**：目录结构、组件设计、表单、存储、API、instrumentation、routing、design system、性能与单元测试。
- **非功能需求**：性能、可访问性、安全、i18n、浏览器兼容、治理和实验发布。

### GetTokens 使用建议

- 对通用看板、账号池、运行会话、扩展管理等中大型 feature，space README 可增加“系统设计 checklist”小节，从该项目抽取必要问题。
- GetTokens 默认是 macOS/Wails 桌面，不需要照搬 SEO、移动端优先等 Web 站点规则；但性能、可访问性、i18n、状态管理、E2E 和错误态仍适用。
- 该项目资料较老（最后提交 2022-02-24），适合作为 checklist 起点，不作为现代框架/API 的事实来源。

## 4. 已沉淀的项目级 skill

本轮已将 3 个项目的可复用内容合并沉淀为 GetTokens 项目级 skill：

- `.agents/skills/gettokens-frontend-design-quality/SKILL.md`：统一入口，内部按 `Shape/Handoff`、`System Design`、`Audit/Polish/Harden`、`Implementation Gate` 四种模式执行。

合并说明：此前曾拆出 `gettokens-frontend-shape-handoff`、`gettokens-frontend-system-design`、`gettokens-frontend-audit-polish` 三个细分 skills，但触发语义与总控 skill 高度重叠，已合并回统一入口，避免项目级 skills 过度碎片化。

该 skill 的职责不是复制参考项目的原文或运行时代码，而是提供 GetTokens 桌面/Wails 前端可执行工作流：

1. `space` 级前端需求与验收输入。
2. 来自 `frontend-system-design` 的系统设计 checklist。
3. 来自 `taste-skill` 的反模板化视觉 pre-flight。
4. 来自 `impeccable` 的 `shape / critique / audit / polish / harden / optimize` 命令化 loop。
5. GetTokens 特有的 Wails binding、sidecar 数据边界、无头浏览器截图与桌面验收门禁。

## 5. 后续落地建议

1. **参考资产保持轻量**：继续遵循“完整源码本机保留，仓库只提交索引/摘要”的规则。
2. **设计流程入口**：GetTokens 后续前端任务优先触发 `gettokens-frontend-design-quality`。如需原始外部视觉 prompt，仅作为参考读取 `docs-linhay/references/taste-skill/skills/`，不再恢复多个相似项目级视觉 skills。
3. **暂不新增 AGENTS 规则**：本轮已新增项目级 skill，但既有 `AGENTS.md` 已覆盖文档落位、前端分工、桌面验收和参考源码不入库规则，无需新增 repo-wide 约束。
4. **暂不直接引入运行时依赖**：三个项目均未作为 GetTokens 生产依赖接入；若未来要引入 CLI、检测器或浏览器扩展，需要单独立项、测试和许可复核。
