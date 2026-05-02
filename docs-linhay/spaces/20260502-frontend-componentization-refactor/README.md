# Frontend Componentization & Architecture Optimization (2026-05-02)

## 1. 概述
本 Space 记录了对 `GetTokens` 前端进行的深度重构工作。本次治理的核心目标是拆分超大组件（Monolithic Components）、统一 Feature 驱动的目录结构，并收拢全局引导逻辑。

## 2. 治理目标与达成情况

### 2.1 遵循工作流规范
- [x] 遵循 `docs-linhay/dev/20260426-componentization-split-workflow.md`。
- [x] 逻辑从 `pages/` 下沉到 `features/`。
- [x] 优先提取业务 Hooks，其次提取展示组件。

### 2.2 核心模块重构

#### A. DebugPage (已完成)
- **Before**: 8KB 的单文件，直接位于 `pages/DebugPage.tsx`，包含所有 UI 和状态。
- **After**:
    - `pages/DebugPage.tsx` 仅作为 Feature Wrapper。
    - `features/debug/DebugFeature.tsx`：主控制器，组织 Hooks 与组件。
    - `features/debug/hooks/useDebugFeature.ts`：收拢所有选择、复制、清除逻辑。
    - `features/debug/components/`：拆分出 `DebugHeader`、`DebugEntryCard`、`DebugEmptyState`。

#### B. UsageDesk (已完成)
- **Before**: 1422 行的巨型文件 `UsageDeskWorkspace.tsx`，深度耦合数据拉取、事件订阅、SVG 渲染、明细表格。
- **After**:
    - 重命名并迁移至 `features/accounts/UsageDeskFeature.tsx`。
    - `features/accounts/hooks/useUsageDeskFeature.ts`：处理 sidecar 事件、GetUsageStatistics/GetCodexLocalUsage 请求、复杂的派生状态。
    - `features/accounts/components/usage-desk/`：
        - `UsageDeskChart.tsx`：收拢复杂的 SVG 坐标计算与渲染逻辑。
        - `UsageDetailTable.tsx`：收拢用量明细表格及其行组件。
        - `UsageDeskPanels.tsx`：提取 `StatePanel` 和 `InfoCard` 等辅助 UI。

#### C. App Shell (已完成)
- **Before**: `App.tsx` 承担了过多职责，包括 Wails 生命周期监控、路由持久化、CSS 变量应用。
- **After**:
    - `hooks/useAppBootstrap.ts`：收拢版本获取、Sidecar 状态心跳、更新检查逻辑。
    - `hooks/useAppNavigation.ts`：收拢 Hash 路由同步、`activePage` 与 `workspace` 的本地持久化。
    - `components/ui/PageLoadingFallback.tsx`：提取公共加载态组件。
    - `App.tsx` 行数显著减少，仅作为布局框架。

#### D. AccountRotationModal (已完成)
- **Before**: 30KB 的复杂弹窗逻辑，混合了拖拽排序、策略配置、状态同步。
- **After**:
    - `features/accounts/hooks/useAccountRotation.ts`：提取核心业务逻辑。
    - `features/accounts/components/account-rotation/`：拆分出 `RotationPriorityItem` 和 `RotationConfigSection`。

## 3. 架构收益
| 核心指标 | 重构前 (Estimated) | 重构后 | 改进 |
| :--- | :--- | :--- | :--- |
| `UsageDesk` 主文件行数 | 1422 | ~400 | -72% (职责下沉) |
| `App.tsx` 行数 | ~320 | ~120 | -62% (逻辑 Hook 化) |
| `DebugPage.tsx` 体积 | 8KB | < 1KB | 迁移至 Feature 驱动 |
| 重用性 | 低 (内嵌函数多) | 高 (通用 Hook 与组件) | 易于后续单元测试 |

## 4. 验证与交付
- **静态检查**: `npm run typecheck` 通过。
- **自动化测试**: 全部 187 项单元测试通过（包括新生成的 `useUsageDeskFeature` 相关逻辑依赖的 `usageDesk.test.mjs` 覆盖范围）。
- **交互验证**: 保持了与重构前完全一致的交互体验。

## 5. 待办与后续建议
- [ ] 针对新拆分的 `useUsageDeskFeature` 补充更细粒度的逻辑测试。
- [ ] 对 `features/accounts/` 下的 `ApiKeyDetailModal` 进行类似的职责拆分。
