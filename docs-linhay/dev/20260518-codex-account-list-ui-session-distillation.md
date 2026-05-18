# Codex 账号列表 UI 会话沉淀

日期：2026-05-18

## 背景

本轮围绕 Codex 账号列表的请求顺序、路由探测、状态颜色和阻塞账号过滤连续迭代。用户反馈集中在两个方向：

1. 请求顺序列表需要更像高密度排序工作台，而不是卡片信息堆叠。
2. 路由探测 modal 需要重新规划成可操作控制台，而不是随意拼接的说明区。

## 已沉淀模式

### 1. 请求顺序列表模式

列表模式只承担高密度排序与状态扫描职责：

- 左侧 rail 固定承载顺位和拖拽手柄。
- 顺位数字和拖拽手柄横向排列，数字必须足够大，不能像辅助脚注。
- 候选、跳过、阻塞状态必须在左侧竖条和右侧标签同时可见。
- 阻塞账号可以通过筛选隐藏，但筛选只影响展示，不能改变真实排序数组或运行时请求顺序。

### 2. 账号状态颜色来源

Codex 账号列表不再复制账号池 tone 颜色。账号池和 Codex 行统一从 `frontend/src/features/accounts/components/attributionCardTone.ts` 读取：

- border tone
- fill tone
- badge tone

后续新增状态色时优先扩展这个共享来源，而不是在单个组件内手写 Tailwind 色值。

### 3. 路由探测 modal 工作台结构

路由探测 modal 应按调试工作台组织：

- 顶部：标题、测试模型、候选数量、当前命中状态。
- 左侧：模型输入、测试一次、连续测试、重置、备用账号开关。
- 右侧上半区：候选队列，按当前请求顺序逐行展示。
- 右侧下半区：终端式测试流，展示命令、候选和 attempt 结果。

候选队列不能再用一行 `A -> B -> C` 长文本表达；这会丢失顺序扫描能力，也会让 modal 看起来像临时说明卡。

### 4. 浏览器验收边界

这轮是前端结构与视觉调整，没有改 Wails/sidecar 调用。验收以浏览器 preview 为主：

- `http://127.0.0.1:5173/#frame=codex&workspace=account-list`
- `density=list` 用于请求顺序列表验收。
- 路由探测 modal 需要同时验桌面宽度和 375px 宽度。
- 截图归档到对应 space 的 `screenshots/YYYYMMDD/codex/`；该目录当前被 gitignore 忽略，截图作为本地验收产物存在，不强制入库。

涉及真实路由命中、sidecar ready、Wails binding 或后端 DTO 时，浏览器验收不能替代桌面 Wails 验收。

## 不纳入沉淀

- 本轮具体候选账号名称、截图文件编号和临时端口不沉淀为规则。
- 375px 下主页面被 sidebar 压缩属于既有桌面工作台约束，本轮只要求 modal 可滚动可操作，不把整个 Codex 页面改成移动优先。
- `docs-linhay/references/CLIProxyAPI` 子模块脏标记、`CLAUDE.md`、未跟踪需求目录和 `frontend/package.json.md5` 不属于本轮 Codex UI 沉淀。

## 已更新入口

- 项目 skill：`.agents/skills/gettokens-codex-account-list/SKILL.md`
- Space 记录：`docs-linhay/spaces/20260511-codex-account-list-tab/README.md`
- Memory：`docs-linhay/memory/2026-05-18.md`
