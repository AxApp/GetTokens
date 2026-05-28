# 账号导入 / 粘贴统一 modal

## 背景

GetTokens 现在已经具备两段相关能力：

1. `20260523-cpa-auto-detect-upload` 里完成了多格式自动检测、转换为 CPA / Codex auth JSON 的 first pass。
2. 账户页当前仍然把“文件上传”和“粘贴导入”拆成两个独立入口：上传走隐藏 file input，粘贴走单独 modal。

本 space 记录第二阶段需求：把上传和粘贴合并成一个统一 modal，支持一次添加多个文件，支持粘贴 JSON 数组，并沿用现有自动识别与转换结果展示。

## 目标

1. 把账户导入入口收敛成一个统一 modal。
2. 在同一个 modal 内同时支持文件上传和文本粘贴两种输入方式。
3. 支持一次添加多个文件，不要求用户反复打开弹窗。
4. 支持粘贴 JSON 数组，并把数组中的每个元素拆成独立候选项。
5. 继续复用现有的自动检测 / 自动转换 / 导入前确认 / 错误提示链路。

## 范围

1. 账户页的导入入口 UI 重构。
2. 旧粘贴导入弹窗与上传入口的合并。
3. 账户导入数据解析：单对象、JSON 数组、多个文件、已有的 CPA / auth-file / Codex API Key / OpenAI-compatible payload。
4. 导入前预览、错误展示、重复项提示和提交确认。
5. 对现有账户列表、API key、OpenAI-compatible provider、auth-file 导入流程保持兼容。

## 非目标

1. 不改变现有账号模型和 sidecar 写入语义。
2. 不新增远程 `configUrl` / 外部导入服务。
3. 不重写 account card 的编辑、删除、quota、usage 等周边功能。
4. 不把这次改动扩展成新的账户系统重构。

## 验收标准

### 场景 1：单一 modal 统一入口

Given 用户在账户页点击导入入口
When 打开导入界面
Then 看到的是一个统一 modal
And 上传与粘贴是同一页面内的不同输入方式

### 场景 2：多文件添加

Given 用户在同一个 modal 内选择多个文件
When 系统读取文件
Then 每个文件都进入候选解析流程
And 用户不需要反复打开 modal

### 场景 3：粘贴 JSON 数组

Given 用户粘贴一个 JSON 数组
When 系统识别到顶层结构是数组
Then 数组中的每个元素都可以被识别和转换
And 候选列表可以逐项确认或排除

### 场景 4：自动识别与转换

Given 用户输入非单一格式内容
When 系统识别出可转换格式
Then 结果会先自动规范化为内部目标格式
And 再进入导入前预览

### 场景 5：取消导入

Given 用户已生成导入草稿
When 用户关闭 modal 或取消
Then 草稿状态被丢弃
And 已有账户列表不受影响

## 设计稿入口

- 本期设计稿：`design-preview.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260528-account-import-unified-modal`
- worktree：`../GetTokens-worktrees/20260528-account-import-unified-modal/`

## 相关链接

- 前序 space：[多格式自动检测转 CPA 上传](../20260523-cpa-auto-detect-upload/README.md)
- 实施计划：[Plan v01](plans/20260528-account-import-unified-modal-plan-v01.md)
- 交接说明：[账号导入统一 modal 交接说明](handoff-20260528-account-import-preview.md)
- 账户页实现：`frontend/src/features/accounts/`
- 账户导入解析：`frontend/src/features/accounts/model/accountTransfer.ts`
- 账户导入弹窗：`frontend/src/features/accounts/components/AccountImportModal.tsx`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-28

## 实施结果

1. 账户页菜单已把上传文件和粘贴内容收敛为一个“导入账号”入口。
2. 新增 `AccountImportModal`，同一个 modal 内支持多文件添加、粘贴 JSON / JSON 数组、候选队列和逐项移除。
3. 粘贴解析新增 `parseAccountImportPayloads`，复制的账号卡 payload 保持原有 API Key / OpenAI-compatible / auth-file 创建语义；普通 JSON 对象作为 auth-file 内容进入上传链路。
4. 文件候选和粘贴 auth-file 候选继续走 `UploadAuthFiles`，CPA 自动转换仍复用现有 app 内后端归一化路径。
5. 设计系统侧已用 `AccountModalComponents.stories.tsx` 和 `componentManifest.ts` 收编统一导入 modal。
6. 队列项现在直接展示解析后的内容预览，便于提交前核对导入对象。
7. 2026-05-28 追加：候选队列项从普通分隔列表行改为复用账号卡片视觉骨架，外层使用 `data-account-card` 与 `card-swiss`，顶部展示标题、来源和类型 badge，底部保留解析内容预览。
8. 2026-05-28 追加：导入 modal 主体改为左右布局，左侧合并“选择文件”和“粘贴输入”，右侧固定为账号预览候选队列。

## 验证

- `node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- `npm --prefix frontend run build-storybook`
- 队列预览截图：`docs-linhay/screenshots/20260528/accounts/20260528-accounts-import-modal-preview-after-v01.png`
- 2026-05-28 追补验证：账号导入 targeted tests、`npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run build`、`npm --prefix frontend run build-storybook` 通过。
- 交接前复核：`npm --prefix frontend run test:unit` 通过，完整单测 `602 pass / 0 fail`。
- 2026-05-28 账号卡片与左右布局追加验证：`node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs` 通过，`30 pass / 0 fail`；`npm --prefix frontend run typecheck` 通过；`npm --prefix frontend run test:unit` 通过，完整单测 `609 pass / 0 fail`。
- 2026-05-28 浏览器预览 DOM 验收：`http://127.0.0.1:4173/?preview=accounts#frame=accounts` 中打开导入 modal，粘贴 auth JSON 后候选项渲染为 `data-account-card` / `card-swiss ... flex ... p-0`，并显示 `AUTH FILE` 与脱敏内容预览。
- 2026-05-28 功能冒烟：浏览器预览中“账号操作菜单 -> 导入账号”可打开 modal；粘贴 auth JSON 可加入候选队列，预览敏感字段脱敏；点击“移除候选”后队列恢复为空且提交按钮重新禁用。
