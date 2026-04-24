# GetTokens Svelte -> React 迁移完整指南

## 1. 文档目标

本文档用于指导 Copilot 或其他代理，将 GetTokens 前端从当前的 Svelte + Vite 迁移为 React + Vite，同时保持 Wails 桌面壳、Go 绑定、sidecar 业务接口和现有视觉风格稳定。

这不是“一次性重做 UI”的计划，而是一份“低风险、可回滚、分阶段验证”的迁移执行指南。

## 2. 当前项目事实

当前前端并不是原始 DOM 脚本，而是已经完成组件化的 Svelte 项目：

- `frontend/src/main.js`
- `frontend/src/App.svelte`
- `frontend/src/pages/StatusPage.svelte`
- `frontend/src/pages/AccountsPage.svelte`
- `frontend/src/pages/SettingsPage.svelte`
- `frontend/src/components/biz/Sidebar.svelte`
- `frontend/src/components/biz/AccountDetailModal.svelte`
- `frontend/src/components/ui/SegmentedControl.svelte`
- `frontend/src/lib/i18n.js`
- `frontend/src/lib/stores.js`

当前核心业务复杂度不在“前端框架渲染能力”本身，而在：

1. Wails 启动与开发态链路
2. sidecar 状态同步
3. 账号池业务闭环
4. 桌面 WebView 调试能力

因此迁移目标必须是“框架替换”，不是“业务重写”。

## 3. 迁移目标

迁移完成后，前端应满足以下目标：

1. 使用 React 替代 Svelte 作为 UI 框架
2. 继续使用 Vite 作为开发与构建工具
3. 保留现有 `frontend/wailsjs/` Go 绑定调用方式
4. 保留现有 `style.css`、Tailwind 和视觉风格
5. 保留现有页面信息架构：
   - `status`
   - `accounts`
   - `settings`
6. 保留现有业务行为：
   - sidecar 状态监听
   - account list 加载
   - detail modal
   - delete / enable / disable
   - theme / locale persistence

## 4. 非目标

本轮迁移不包含以下事项：

1. 不同时升级 TypeScript
2. 不同时改 Go 代码
3. 不同时重构 sidecar API
4. 不同时重做视觉系统
5. 不同时引入 Redux / Zustand / TanStack Query
6. 不同时接入复杂 React 调试工具

换句话说，第一轮只做“React 版可跑、等价、稳定”。

## 5. 推荐目标技术栈

第一阶段推荐栈：

- React
- React DOM
- Vite
- JavaScript
- 继续使用现有 Tailwind / PostCSS / `style.css`

不建议在第一轮直接使用：

- TypeScript
- Redux
- Zustand
- React Router
- React Query

原因：会把“框架迁移”扩大成“架构迁移”。

## 6. 高层迁移策略

### 6.1 总原则

1. 先基础设施，后页面
2. 先壳层，后业务页
3. 每阶段必须可运行
4. 每阶段必须可验证
5. 每阶段必须能独立提交

### 6.2 页面迁移顺序

推荐顺序：

1. `App` + `Sidebar`
2. `StatusPage`
3. `SettingsPage`
4. `AccountsPage`
5. `AccountDetailModal`

原因：

- `StatusPage` 最简单，适合验证 React + Wails 事件链
- `SettingsPage` 可以验证主题和语言持久化
- `AccountsPage` 最复杂，依赖 sidecar ready gating 和一系列 Wails 调用
- `AccountDetailModal` 依赖账户页状态，最后迁最稳妥

## 7. 分阶段执行计划

## 阶段 A：基础设施迁移

### 目标

把项目从 Svelte Vite 切换为 React Vite，但只保留最小可运行壳层。

### 要做的事

1. 修改 `frontend/package.json`
   - 移除 Svelte 相关依赖
   - 加入 `react`、`react-dom`
   - 加入 `@vitejs/plugin-react`
2. 修改 `frontend/vite.config.js`
   - 从 `@sveltejs/vite-plugin-svelte` 切到 `@vitejs/plugin-react`
3. 修改 `frontend/src/main.js`
   - 改为 React 挂载方式
4. 新增 `frontend/src/App.jsx`
   - 先做最小可运行内容
5. 暂时保留 `frontend/src/style.css`

### 验收标准

1. `npm install` 成功
2. `npm run build` 成功
3. Wails app 能启动
4. 桌面窗口不是空白页

### 风险

1. Vite 插件切换后构建中断
2. 旧 `.svelte` 文件仍被入口引用
3. React 挂载后 Wails dev server 未正确加载新 bundle

## 阶段 B：壳层迁移

### 目标

用 React 重建最外层应用壳：

- `App`
- `Sidebar`
- active page switching
- version loading
- sidecar status loading and listening

### 对应原文件

- `frontend/src/App.svelte`
- `frontend/src/components/biz/Sidebar.svelte`

### React 实现要求

1. 使用 `useState` 管理 `activePage`
2. 使用 `useState` 管理 `sidecarStatus`
3. 使用 `useState` 管理 `version`
4. 使用 `useEffect` 调用：
   - `GetVersion()`
   - `GetSidecarStatus()`
5. 使用 `window.runtime.EventsOn('sidecar:status', ...)` 监听状态
6. 必须处理 effect 清理，避免重复绑定

### 验收标准

1. 左侧导航可切换页面
2. version 可显示
3. sidecar 状态变化能反映到页面

## 阶段 C：StatusPage 迁移

### 目标

迁移状态页，不改行为。

### 对应原文件

- `frontend/src/pages/StatusPage.svelte`

### 必须保留的行为

1. sidecar ready 时触发 `/healthz` 检查
2. uptime 定时刷新
3. status / port / uptime / build 卡片显示
4. 保持现有视觉结构

### React 实现注意点

1. `setInterval` 必须在 `useEffect` 中建立并清理
2. `checkHealth()` 的依赖必须绑定 `sidecarStatus.port`
3. 不要在每次 render 时重复启动 timer

### 验收标准

1. 状态页正常渲染
2. uptime 正常增长
3. sidecar ready 时 healthz 正常更新

## 阶段 D：SettingsPage 迁移

### 目标

迁移设置页，并重建主题与语言切换能力。

### 对应原文件

- `frontend/src/pages/SettingsPage.svelte`
- `frontend/src/components/ui/SegmentedControl.svelte`
- `frontend/src/lib/stores.js`
- `frontend/src/lib/i18n.js`

### 推荐实现

1. 不要引状态库
2. 用 React Context + custom hook 即可：
   - `ThemeContext`
   - `I18nContext`
3. 保留 localStorage 持久化：
   - `theme-mode`
   - `app-locale`

### 需要拆出的 React 文件建议

- `frontend/src/context/ThemeContext.jsx`
- `frontend/src/context/I18nContext.jsx`
- `frontend/src/components/ui/SegmentedControl.jsx`

### 必须保留的行为

1. 支持 `system / light / dark`
2. `system` 跟随 `prefers-color-scheme`
3. locale 切换立即生效
4. 默认 locale 仍然是中文，除非本地有保存值

### 验收标准

1. 主题切换可用
2. 语言切换可用
3. 刷新后持久化有效

## 阶段 E：AccountsPage 迁移

### 目标

迁移账号池页面，保持 sidecar 状态门控和账户列表闭环。

### 对应原文件

- `frontend/src/pages/AccountsPage.svelte`

### 必须保留的业务规则

1. sidecar 未 ready 时不能请求账户列表
2. sidecar ready 后再调用 `ListAuthFiles()`
3. 搜索仍按 `name` 与 `provider`
4. 删除后必须重新拉取列表
5. 点击详情后打开 modal

### React 实现注意点

1. sidecar ready gating 放在 `useEffect` 中
2. 不要在每次 render 时重复拉取
3. 删除 / 启停类操作后重新调用 `loadAccounts()`
4. 搜索结果可用 `useMemo`，但不是必须
5. 删除确认不要依赖 `window.confirm`。本项目在真实 Wails 桌面窗口下出现过“点击 Delete 没有发出任何 DELETE 请求”的回归，改为页面内二次确认更稳。

### 验收标准

1. 页面能加载账户
2. 搜索有效
3. 删除有效
4. 空状态正确
5. sidecar 未 ready 时显示等待态

## 阶段 F：AccountDetailModal 迁移

### 目标

迁移详情弹窗，不改数据契约。

### 对应原文件

- `frontend/src/components/biz/AccountDetailModal.svelte`

### 必须保留的行为

1. `GetAuthFileModels(account.name)`
2. `DownloadAuthFile(account.name)`
3. raw content base64 解码
4. verify 行为
5. close 行为

### React 实现注意点

1. modal 打开后加载 models 与 raw content
2. 请求期间保留 loading 状态
3. verify 结果是本地 UI 状态，不要误写成全局状态
4. backdrop click 与 close button 行为要一致

### 验收标准

1. modal 能打开
2. models 能加载
3. raw content 能显示
4. verify 能反馈结果

## 8. 文件级映射建议

### 现有文件 -> React 对应文件

- `frontend/src/App.svelte` -> `frontend/src/App.jsx`
- `frontend/src/pages/StatusPage.svelte` -> `frontend/src/pages/StatusPage.jsx`
- `frontend/src/pages/AccountsPage.svelte` -> `frontend/src/pages/AccountsPage.jsx`
- `frontend/src/pages/SettingsPage.svelte` -> `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/components/biz/Sidebar.svelte` -> `frontend/src/components/biz/Sidebar.jsx`
- `frontend/src/components/biz/AccountDetailModal.svelte` -> `frontend/src/components/biz/AccountDetailModal.jsx`
- `frontend/src/components/ui/SegmentedControl.svelte` -> `frontend/src/components/ui/SegmentedControl.jsx`
- `frontend/src/lib/stores.js` -> `frontend/src/context/ThemeContext.jsx`
- `frontend/src/lib/i18n.js` -> `frontend/src/context/I18nContext.jsx`

### 暂不迁移的文件

- `frontend/src/style.css`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `frontend/wailsjs/**`

## 9. Copilot 执行指南

以下内容可以直接给 Copilot：

```text
请为 GetTokens 执行 Svelte -> React 迁移，但必须遵守以下约束：

1. 不改 Go 代码和 Wails Go 接口契约
2. 不改 sidecar API 行为
3. 第一轮只迁前端框架，不升级 TypeScript
4. 保持当前视觉风格和 Tailwind/style.css 基本不变
5. 分阶段执行：
   - 阶段 A：基础设施迁移
   - 阶段 B：App/Sidebar
   - 阶段 C：StatusPage
   - 阶段 D：SettingsPage
   - 阶段 E：AccountsPage
   - 阶段 F：AccountDetailModal
6. 每个阶段完成后必须保证：
   - npm run build 通过
   - Wails app 可启动
7. 不要引入 Redux/Zustand/TanStack Query 等额外状态库
8. 先不要接 React 调试库
9. 优先复用现有 CSS 类名和文案 key
10. 每个阶段输出：
   - 修改文件列表
   - 风险点
   - 验证结果
11. 如果某阶段无法稳定通过构建或运行验证，不继续下一阶段
```

## 10. 每阶段强制验证清单

每个阶段都必须执行并记录：

1. `npm run build`
2. 通过 VS Code 或现有脚本拉起 Wails app
3. 确认桌面窗口不是空白
4. 确认当前阶段涉及的页面可交互

### 全量回归清单

最终必须全量验证：

1. 页面切换：`status / accounts / settings`
2. sidecar 状态更新
3. healthz 检查
4. 主题切换
5. 语言切换
6. accounts list 加载
7. 搜索
8. detail modal 打开
9. raw content 显示
10. delete 行为

## 11. 关键风险与防错指南

### 风险 1：重复绑定 Wails 事件

问题：
React `useEffect` 写法不当时，`window.runtime.EventsOn` 可能重复绑定。

要求：

1. 壳层事件监听只绑定一次
2. 如果 API 支持取消订阅，要在 cleanup 中取消
3. 若不支持，至少确保 effect 依赖数组稳定

### 风险 2：timer 泄漏

问题：
`StatusPage` 的 uptime timer 在 React 中很容易重复创建。

要求：

1. timer 只创建一次
2. unmount 时必须清理

### 风险 3：主题和语言持久化丢失

问题：
Svelte store 迁到 React 后，本地持久化容易漏掉。

要求：

1. `theme-mode` 保持兼容
2. `app-locale` 保持兼容
3. 旧用户已有 localStorage 值时不能丢失

### 风险 4：Accounts 页面过早请求

问题：
React effect 比较容易在 sidecar 未 ready 时就触发 list 请求。

要求：

1. sidecar status 不是 `ready` 时，禁止调用 `ListAuthFiles`
2. ready 之后再触发加载

### 风险 5：Modal 数据加载逻辑错位

问题：
modal 迁移后 models / raw content / verify 三条状态线可能互相污染。

要求：

1. 分别管理 loading state
2. 避免一个请求把另一个状态覆盖掉

### 风险 6：Wails 开发态缓存误判

问题：
可能出现“构建通过，但桌面窗口没加载新 bundle”。

要求：

1. 不只看终端成功信息
2. 必须看真实桌面窗口
3. 如果 HMR 表现异常，执行完整重启

## 12. 推荐提交粒度

建议至少按以下粒度提交：

1. `chore(frontend): switch vite from svelte to react`
2. `feat(frontend): migrate app shell to react`
3. `feat(frontend): migrate status page to react`
4. `feat(frontend): migrate settings page to react`
5. `feat(frontend): migrate accounts page to react`
6. `feat(frontend): migrate account detail modal to react`
7. `chore(frontend): remove obsolete svelte files`

## 13. 什么时候再接 React 调试工具

只有在 React 版本已经稳定后，再考虑：

1. `react-debug-inspector`
2. `react-grab`
3. 自定义 React debug overlay

不建议在迁移过程中就引入。

原因：

1. 会增加构建变量
2. 会放大 WebView 兼容性问题
3. 会干扰“到底是迁移问题还是调试库问题”的判断

## 14. 最终建议

对 GetTokens，这次迁移是可以做的，但必须满足两条底线：

1. 迁移目标是“React 版等价可跑”，不是“顺便全面重构”
2. 任何阶段如果桌面 app 不稳定，就停止扩散范围，先修稳定性

如果执行得当，这次迁移的合理收益是：

1. 后续更容易接入 React 生态调试工具
2. 更容易与团队其他 React 项目统一
3. 更容易复用 React 组件和协作工具链

如果执行失控，最容易出现的问题是：

1. 迁了一半，桌面 app 能构建但不好用
2. 前端框架、调试工具、状态管理三件事同时变化，导致排障混乱
3. 业务行为在迁移中被悄悄改变

所以：严格分阶段，严格验证，严格限制范围。

## 15. 2026-04-24 实施结果

本次迁移已实际落地，采用的是“React + Vite 原生 esbuild JSX”路线，而不是 `@vitejs/plugin-react`。

### 实际落地原因

当前环境无法稳定访问 `registry.npmjs.org`，而本机 npm cache 已具备：

1. `react`
2. `react-dom`

但不具备 `@vitejs/plugin-react` 的完整依赖链缓存，因此最终实现改为：

1. 使用 React 18
2. 使用 `vite` 原生 `esbuild.jsx = "automatic"`
3. 保留现有 `style.css`
4. 保留 Wails Go 绑定

### 已完成内容

1. 入口从 `main.js + App.svelte` 迁移为 `main.jsx + App.jsx`
2. 页面迁移完成：
   - `StatusPage.jsx`
   - `AccountsPage.jsx`
   - `SettingsPage.jsx`
3. 组件迁移完成：
   - `Sidebar.jsx`
   - `AccountDetailModal.jsx`
   - `SegmentedControl.jsx`
4. 状态迁移完成：
   - `ThemeContext.jsx`
   - `I18nContext.jsx`
5. 旧 Svelte 文件已移除

### 已验证内容

1. `frontend/npm run build` 通过
2. `npm_config_offline=true ./scripts/wails-cli.sh build -skipbindings` 通过
3. Wails 成功打包 `GetTokens.app`

### 残余风险

1. 本轮主要完成了构建链路与桌面打包验证，未做完整人工 GUI 点选回归
2. `window.runtime.EventsOn` 在 React 下已保持单次绑定，但仍建议后续做一次真实桌面交互验收
3. 若后续要接 React 调试工具，应在当前 React 版本稳定后单独接入，不要和迁移耦合
