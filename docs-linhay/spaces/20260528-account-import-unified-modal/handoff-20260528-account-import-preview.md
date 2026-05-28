# 账号导入统一 modal 交接说明

## 交接范围

本交接覆盖 GetTokens 账号导入 / 粘贴统一 modal 的收尾状态，重点是用户补充要求：候选队列中需要显示解析后的内容。

## 当前状态

- 状态：已实现，可交接。
- 主入口：`frontend/src/features/accounts/components/AccountImportModal.tsx`
- 解析与预览：`frontend/src/features/accounts/model/accountTransfer.ts`
- 相关测试：`frontend/src/features/accounts/tests/accountTransfer.test.mjs`
- 设计系统入口：`frontend/src/features/accounts/components/AccountModalComponents.stories.tsx`
- 截图证据：`docs-linhay/screenshots/20260528/accounts/20260528-accounts-import-modal-preview-after-v01.png`

## 已完成内容

1. 账户页上传文件和粘贴内容已合并为一个 `AccountImportModal`。
2. 同一个 modal 内支持多文件添加、粘贴 JSON 对象、粘贴 JSON 数组。
3. 粘贴数组会拆成多个候选项，候选队列支持逐项移除。
4. 复制的账号卡 payload 保持原语义：API Key、OpenAI-compatible provider、auth-file 分别按原类型进入导入流程。
5. 普通 JSON 对象作为 auth-file 候选进入后端上传归一化链路，CPA 自动转换继续复用 app 内现有 `UploadAuthFiles` 后端路径。
6. 候选队列行现在显示解析后的内容预览：
   - `upload-file`：解码 base64 后展示文件内容预览，预览解码只读取前段内容，避免大文件卡顿。
   - `auth-file`：展示解析后的 auth JSON 内容。
   - `codex-api-key` / `openai-compatible`：展示结构化 payload。
7. 追加收口：候选队列项已改为账号卡片样式，外层使用 `data-account-card` 与 `card-swiss`，保留解析预览入口但不再渲染为普通三列分隔列表行。

## 验收覆盖

- 单一入口：账户页只保留统一“导入账号”动作。
- 多文件：文件选择支持 multiple，并加入候选队列。
- 粘贴 JSON 数组：`parseAccountImportPayloads` 支持递归拆分数组。
- 导入前核对：候选队列行显示 title、source、kind 和解析内容预览。
- 取消导入：modal 内队列状态是本地草稿，关闭后不会影响既有账号。

## 最新验证

以下命令在 2026-05-28 已重新执行：

```bash
node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run build-storybook
npm --prefix frontend run test:unit
```

结果：全部通过。完整单测当前为 `602 pass / 0 fail`。

## 接手复核

2026-05-28 接手复核结论：

1. 账号导入聚焦测试通过：`node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs`，结果 `28 pass / 0 fail`。
2. 当前工作区下 `npm --prefix frontend run typecheck` 通过。
3. 当前工作区下完整 `npm --prefix frontend run test:unit` 未通过，但失败点是并行的 session-management / design-system 改动：`session-plugin-console-panel must provide a story path`，不在账号导入 modal 范围内。
4. 浏览器预览在 `http://127.0.0.1:4173/?preview=accounts#frame=accounts` 打开账号页后，可以通过“账号操作菜单 -> 导入账号”进入统一 modal；粘贴 auth JSON + OpenAI-compatible 账号卡 JSON 数组后，候选队列拆成 2 项，并显示 `team-codex-auth.json` / `deepseek` 的解析内容预览。
5. 当前浏览器预览在重复交互后会触发 `useAccountsPageStateContext must be used within AccountsPageStateProvider` 崩溃，属于当前并行账号页/设计系统工作区状态风险；本交接未修改这部分实现。

## 追加复核

2026-05-28 追加处理候选队列账号卡片样式和左右布局后：

1. `AccountImportModal` 的候选项外层已使用账号卡片视觉骨架：`data-account-card`、`card-swiss`、零内边距卡片容器、顶部身份区和底部预览区。
2. `AccountImportModal` 主体已改成左右两栏：左侧单个 `data-account-import-input-panel` 合并文件选择与粘贴输入，右侧为账号预览候选队列。
3. 新增源码守护测试，防止候选项回退到旧的 `grid-cols-[2.25rem_minmax(0,1fr)_auto]` 分隔列表行，并防止输入区重新拆成两个并列输入卡。
4. 验证通过：`node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs`，结果 `30 pass / 0 fail`；`npm --prefix frontend run typecheck` 通过；`npm --prefix frontend run test:unit` 通过，完整单测 `609 pass / 0 fail`。
5. 浏览器预览 DOM / 功能冒烟通过：`http://127.0.0.1:4173/?preview=accounts#frame=accounts` 中“账号操作菜单 -> 导入账号”可打开 modal；粘贴 auth JSON 可加入候选队列，预览为账号卡片并将 `access_token` 显示为 `[REDACTED]`；移除候选后队列恢复为空且提交按钮重新禁用。

## 交接注意

1. 当前仓库中账号导入相关文件已经是干净状态；最近实现已进入提交 `f107f30 feat: consolidate account and session workbenches`。
2. `git status --short` 仍显示以下无关条目：
   - `20260528-session-plugin-console-design-desktop-after-v01.png`
   - `frontend/wailsjs/go/models.ts`
   - `frontend/debug-storybook.log`
3. 不要在账号导入交接中处理上述文件，除非另一个 session-management/storybook 或 Wails 生成物任务明确要求。
4. 若继续改导入预览 UI，优先保持 `resolveAccountImportPayloadPreview` 作为单一格式化入口，避免在 React 组件里复制类型分支。

## 建议下一步

1. 人工在真实 app 中打开账户页“导入账号”，用一个 auth JSON 和一个 OpenAI-compatible 账号卡 JSON 数组做最终手测。
2. 若要继续优化体验，建议只做两类小改动：敏感字段脱敏显示、预览区折叠/展开。不要改变现有导入提交语义。
