# Codex Binary 会话蒸馏

## 背景

本轮围绕 Codex 二进制管理从设计、业务边界、远端版本拉取、下载/激活、托管 PATH、版本 cell UI、菜单操作、进度展示到前端拆文件完成了一整轮迭代。用户明确要求“蒸馏会话，整理 skill / 行为 / 偏好 / 工作流”，因此将稳定模式沉淀为项目级 skill，并记录本次不升级到 `AGENTS.md` 的判断。

## 沉淀为 Skill 的内容

新增项目级 skill：

- `.agents/skills/gettokens-codex-binary-management/SKILL.md`

覆盖范围：

- Codex Binary 独立业务边界。
- GitHub Releases / Atom / HTML fallback 与本地缓存策略。
- 下载与激活分离。
- 一键托管 PATH 的 shell/profile 识别边界。
- 紧凑版本列表 UI、更多菜单、release notes 展开方式。
- 前端拆分结构：controller、components、presentation、model。
- Wails/root binding 约束与生成文件空白清理。
- 自动化验证与截图落位。

同时在 `.agents/skills/gettokens-domain-engineering/SKILL.md` 的 Codex workspace 区域补了指向，避免后续 Codex Binary 需求继续被塞进通用工程规则。

## 行为与偏好

本轮稳定偏好：

- 全程中文交付与中文文案。
- Codex Binary 页面应极简、紧凑，主要只显示下载、激活和变更记录。
- 下载、激活是两个独立阶段，不同时显示在同一个未安装版本上。
- 次级动作放在右侧菜单，主按钮只保留当前阶段最关键动作。
- 不要卡中卡，不要解释性文案堆叠，不要把操作台做成营销页。
- 默认看正式版，Alpha 通过筛选进入。
- 不要每次进入页面都刷新 GitHub，显式点击“检查更新”才远端拉取。
- 需要真实页面截图/浏览器核对来判断 UI 是否可接受。
- 复杂前端文件要及时拆成 controller、组件和展示工具，避免单文件继续膨胀。

## 工作流

后续同类需求推荐流程：

1. 先确认是否属于 Codex Binary 独立业务；若涉及账号池、local apply、用量或会话，默认不并入。
2. 更新对应 space 的需求、验收标准或实施状态。
3. 后端先保证 `internal/codexbinary` 领域服务和 Wails/root binding 闭环。
4. 前端保持 `CodexBinaryFeature.tsx` 为 controller，复杂视图拆到 `components/`，纯展示逻辑放 `presentation.ts`。
5. UI 调整后必须看真实页面，不只靠代码推断。
6. 运行相关前端/Go 测试；若触碰 Wails 生成文件，清理 `models.ts` 空白并跑 `git diff --check`。
7. 写回 space README、memory，并执行 `qmd update` / `qmd embed`。

## 不纳入的临时内容

以下内容暂不升级为长期规则：

- 本轮具体截图文件名和每一次版本 cell 的中间布局方案。
- “绿色进度条”等单点视觉争议的历史讨论，只在 skill 中保留当前实现应避免回退到异常/警告色的原则。
- 是否未来支持取消下载、事件推送、断点续传。这些仍是需求待办，不作为已完成规则。
- AGENTS 级规则不更新；本轮沉淀主要是功能域工作流，不是全仓统一硬约束。

## 后续入口

- Codex Binary 需求：优先使用 `gettokens-codex-binary-management`。
- 文档、space、memory、qmd：继续使用 `gettokens-ops-governance`。
- 会话整理：继续使用 `gettokens-session-skill-distill`。
