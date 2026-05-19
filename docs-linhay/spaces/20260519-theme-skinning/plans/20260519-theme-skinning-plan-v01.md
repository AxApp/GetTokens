# Theme Skinning Plan v01

## 需求边界
本期目标是把现有明暗模式升级为可扩展主题体系，而不是一次性重做所有视觉。先建立主题模型、token 契约、设置入口和核心页面验收方法，再逐步把页面样式迁移到语义 token。

## 当前基线
1. `frontend/src/context/ThemeContext.tsx` 负责读取和写入 `localStorage.theme-mode`。
2. `frontend/src/App.tsx` 根据 `themeMode` 切换 `document.documentElement.classList.dark`。
3. `frontend/src/features/settings/SettingsFeature.tsx` 已在 Appearance 区域提供 `system / light / dark` 分段控件。
4. `frontend/src/types.ts` 中 `ThemeMode` 当前只包含 `system | light | dark`。

## 阶段计划
### 阶段 1：主题契约与兼容迁移
1. 明确 `ThemeMode` 与 `ThemePreset` 是否分离。
2. 保留 `theme-mode` 兼容读取。
3. 新增主题解析与持久化测试。
4. 输出 token 字典草案，先覆盖核心语义色和状态色。

### 阶段 2：设置入口与预览
1. 在 Appearance 区域增加主题风格选择。
2. 为每个主题提供小型预览，不只展示文本名称。
3. 设计一个 browser preview 入口，能一次查看多主题状态。

### 阶段 3：核心页面接入
1. 账号池、Codex 账号列表、代理池、状态页、设置页接入主题 token。
2. 优先处理卡片、弹窗、表单、分段控件、状态徽标、用量区块。
3. 避免在迁移中改变业务状态或数据流。

### 阶段 4：验证与沉淀
1. 跑单元测试、类型检查和前端 build。
2. 产出每个主题的 browser 截图。
3. Wails 桌面验证窗口主题与 Web 主题同步。
4. 将可复用的主题接入规则沉淀到 dev 文档或项目 skill。

## 测试策略
1. 单元测试：
   - 主题值解析。
   - 旧 `theme-mode` 兼容。
   - 非法存储值回退。
2. 组件测试：
   - 设置页主题控件展示和切换。
   - 主题预览数据稳定。
3. 端到端 / 截图：
   - 核心页面在每个内置主题下无明显重叠、低对比或不可读状态。

## 风险
1. CSS 变量和 Tailwind class 混用可能导致部分组件绕过 token。
2. 深色模式与主题风格如果耦合不清，会让 `system` 模式行为难以解释。
3. 主题改动容易扩大到纯视觉重构，需要控制第一阶段范围。
4. Wails 原生窗口主题和 Web 根节点主题可能出现状态不同步，需要桌面验证。

## 待确认
1. 第一批内置主题名称和风格方向。
2. 是否需要支持跟随 Codex / Claude / Gemini 等账号类型的品牌强调色。
3. 是否把主题配置纳入导入导出或只保留本地偏好。
