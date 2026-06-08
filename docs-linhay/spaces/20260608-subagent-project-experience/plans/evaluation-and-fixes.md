# 第 1 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 1 轮：评估 + 修复**。
- 输入材料：`AGENTS.md`、本 space `README.md`、`plans/dev-data-prep.md`、三份第 1 轮体验报告。
- 环境边界：仅在仓库 dev 代码与本 space 文档内评估和修复；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。
- 本轮定位：汇总建议、归并优先级，并落地低风险、可验证的小修复；不做 sidecar 热路径改造、SQLite 数据迁移或大架构调整。

## 建议数量统计

- 总建议数：52 条。
- `experience-product-operator.md`：19 条。
- `experience-runtime-routing.md`：12 条。
- `experience-extension-workbench.md`：21 条。

## 归并分组

### 可立即修复

共 20 条，适合下一轮继续从文档、诊断、测试、前端小状态或模型逻辑入手。

- 产品/运营报告：1、6、9、15、17、19。
- 运行态/路由报告：2、3。
- 扩展工作台报告：2、4、5、8、9、13、14、16、17、18、19、20。

本轮已落地其中 3 组：扩展工作台 2/16、扩展工作台 18、产品/运营 19。

### 需要产品决策

共 15 条，需要先明确入口优先级、信息架构、默认视图或用户承诺，再进入实现。

- 产品/运营报告：2、3、4、5、7、8、11、12、13、14。
- 扩展工作台报告：1、3、11、12、15。

下一步建议先由主控确认：账号池运营巡检视图、Codex 菜单排序、菜单栏快捷入口是否要正式纳入桌面产品体验；Git Skill 真安装、MCP tool approval 和 MCP preflight 是否进入扩展工作台近期范围。

### 需要较大技术方案

共 15 条，涉及 sidecar management endpoint、真实 routing engine explain、usage reconciliation、SQLite busy 治理、live history 深分页和 TOML AST patch 等，不适合本轮低风险修。

- 产品/运营报告：10、16、18。
- 运行态/路由报告：1、4、5、6、7、8、9、10、11、12。
- 扩展工作台报告：7、21。

下一轮若选择其中任一项，建议先补独立技术方案与失败测试，尤其避免在 Wails 或前端临时伪造 sidecar 已处理状态。

### 暂不处理

共 2 条，本轮不建议继续推进。

- 扩展工作台报告 6：MCP inline map 排序影响预览。价值存在，但优先级低于 conflict/unknown、raw 保存预检和 args 破坏性解析。
- 扩展工作台报告 10：浏览器预览接入真实 dev 脱敏 fixture。需要额外定义 fixture 生成、敏感字段审计和预览数据生命周期，本轮不作为低风险修复。

## 本轮修复清单

### 1. MCP conflict/unknown transport 不再降级成 stdio/ready

- 来源建议：扩展工作台报告 2、16。
- 修复内容：
  - 前端模型保留 `conflict`、`unknown` transport 和 `error` status。
  - `mapBackendMcpServer` 不再把非 HTTP transport 一律映射为 `stdio`，也不再把后端 `error` 映射成 `ready`。
  - `toBackendMcpServer` 保存前阻断未解析 transport，避免结构化保存清掉冲突配置。
  - MCP editor 对冲突/未知 transport 展示只读提示，保存按钮禁用；用户必须先显式转换为 `stdio` 或 `streamable_http`。

### 2. Git Skill source path 增加前端安全校验

- 来源建议：扩展工作台报告 18。
- 修复内容：
  - `parseTkGitSkillSource` 拒绝空 `path=`、`..` segment、绝对路径、Windows drive path 和 NUL。
  - 浏览器预览和未来 install plan 入口先形成一致的前端门禁，减少“前端显示可安装、后端拒绝”的断层。

### 3. 菜单栏导航解除 accounts 单一路由锁定

- 来源建议：产品/运营报告 19。
- 修复内容：
  - 新增 `resolveMenuBarNavigationHash(payload)` 纯函数，支持账号池、Codex workspace、运行会话、用量、session management、vendor status。
  - `App.tsx` 的 `menubar:navigate` 事件改为通过 resolver + hash parser 更新页面状态。
  - 测试从源码字符串断言改为纯函数行为断言，覆盖 `#frame=codex&workspace=live-sessions&view=project` 与 `#frame=codex&workspace=usage-codex`。

## 变更文件

- `frontend/src/features/codex-extensions/model.ts`
- `frontend/src/features/codex-extensions/adapters.ts`
- `frontend/src/features/codex-extensions/McpModals.tsx`
- `frontend/src/features/codex-extensions/model.test.mjs`
- `frontend/src/features/codex-extensions/adapters.test.mjs`
- `frontend/src/utils/pagePersistence.ts`
- `frontend/src/App.tsx`
- `frontend/src/tests/menuBarNavigation.test.mjs`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
cd frontend && node --test src/features/codex-extensions/model.test.mjs src/features/codex-extensions/adapters.test.mjs
cd frontend && node --test src/tests/menuBarNavigation.test.mjs
cd frontend && npm run typecheck
```

待补充：

- 未启动 Wails dev app 做桌面点击验收。本轮修复均为前端模型、适配、hash resolver 和 modal 状态，已用单测与类型检查覆盖；菜单栏真实原生菜单 action 仍需要后续 Wails dev 桌面验收。
- 未运行全量 `npm run test:unit`。前一份扩展工作台报告已记录该脚本会触发既有账号卡片断言失败；本轮使用 focused tests 避免把无关既有失败混入修复判断。

## 下一轮候选判断

仍有可继续修改的下一轮候选，建议优先级如下：

1. raw `config.toml` 保存前 TOML 预检与备份提示：保护价值高，边界清晰，适合后端 Wails 小步测试。
2. MCP args 从空白 split 改为数组/逐行编辑：可避免结构化保存破坏带空格参数，风险低于完整 TOML AST 改造。
3. 账号池筛选空态拆分：可直接减少“有账号但看起来为空”的误判，适合前端组件和 DOM 断言验证。
4. Live Sessions “清空会话”文案与确认：可先做前端安全语义修复，不涉及历史清理契约。

不建议下一轮直接做的候选：route probe 替换为 sidecar management endpoint、usage reconciliation、管理接口 SQLite busy 治理、request diagnostics index。这些都需要先补技术方案、接口边界和 sidecar 测试。
