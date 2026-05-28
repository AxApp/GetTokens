# Design System Inspect Mode

## 背景

设计系统已有两条调试链路：

1. Storybook 作为组件工作台。
2. 应用开发态通过 `@linhey/react-debug-inspector` 注入 `data-debug`，并显示右下角组件定位器。

本次补齐的是“从设计系统入口直接进入元素定位”的产品化入口，避免开发者知道底层工具但找不到启动路径。

## 实现边界

1. `frontend/src/features/design-system/storyCatalog.ts` 新增 inspect URL 解析：`/?inspect=design-system#frame=design-system`。
2. `frontend/src/features/design-system/DesignSystemEntryFeature.tsx` 在开发态显示“定位元素”入口。
3. `frontend/src/features/design-system/inspectMode.ts` 包装 `initInspector()`，在开发态读取 `inspect=design-system` 后触发第三方 inspector 的定位按钮。
4. `frontend/src/main.tsx` 只在 `import.meta.env.DEV` 下初始化 inspect bridge，生产构建不启用。

## 验收

1. 单元测试锁定 storyCatalog URL、main 初始化、Vite `createViteDebugInspectorPlugin()` 和入口按钮。
2. 浏览器 DOM 验收：`http://127.0.0.1:5174/?inspect=design-system#frame=design-system` 自动设置 `data-design-system-inspect-mode="active"`，桥接对象存在，页面含 `data-debug` 节点。
3. 截图归档：`docs-linhay/spaces/20260528-design-system-inspect-mode/screenshots/20260528/design-system/20260528-design-system-inspect-mode-after-v01.png`。

## 后续边界

Storybook 内部 toolbar / addon 不在本期范围。若后续需要在 Storybook iframe 内直接启动定位，应单独设计 Storybook preview 层的注入与快捷键协议，不复用应用主 frame 的 URL query。
