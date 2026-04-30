# 20260430 OpenAI Status Page

## 背景
当前需要为 GetTokens 新增一个“厂商 API 状态”页面，先接入 OpenAI，页面数据来源于 OpenAI 官方状态页接口，而不是手工维护的静态文案。

当前已确认的上游入口有三个：
1. `https://status.openai.com/proxy/status.openai.com`
2. `https://status.openai.com/proxy/status.openai.com/component_impacts?...`
3. `https://status.openai.com/feed.rss`

其中主接口负责当前状态、组件列表、进行中事件；`component_impacts` 负责历史事件、组件影响区间和组件可用率；RSS 负责事故更新流。页面首期目标是“在 GetTokens 设计语言里复刻这些数据”，不是 1:1 还原 OpenAI 官方视觉。

## 目标
1. 整理 OpenAI 状态接口到页面模块的映射关系，避免后续实现时边写边猜。
2. 为 GetTokens 产出一版可直接对照实现的单文件设计稿。
3. 首期页面先服务 OpenAI，但结构上保留后续扩展到多厂商状态页的空间。
4. 在真实产品中落地一级菜单 `vendor-status` 和对应页面，而不是只停留在设计稿。

## 范围
1. 新建 `docs-linhay/spaces/20260430-openai-status-page/` 作为本需求空间。
2. 明确状态页的页面结构、信息层级、数据来源和模块边界。
3. 产出 OpenAI 状态页设计稿 `design-preview.html`。
4. 在 Wails 应用中接入 `vendor-status` 导航、页面壳和 OpenAI 状态聚合逻辑。
5. 为 RSS 补桌面运行时 bridge，避免浏览器直拉 `feed.rss` 的 CORS 限制。

## 非目标
1. 本轮不处理除 OpenAI 之外的其它厂商接入细节。
2. 本轮不接入邮件提醒、Webhook 持久订阅、搜索引擎配置等外围能力。
3. 本轮不做后端缓存层、数据库落盘或后台定时任务。
4. 本轮不把 `vendor-status` 扩成多层厂商切换器，当前只保留后续扩展边界。

## 用户场景
1. 作为使用 OpenAI 相关能力的运营或研发，我想快速看到当前是否存在进行中故障，以便判断问题来自厂商还是本地配置。
2. 作为排障人员，我想看到受影响的组件和最近事件，以便判断是 `Responses`、`Realtime`、`Codex API` 还是登录类问题。
3. 作为产品维护者，我想让状态页风格与 GetTokens 保持一致，而不是在应用里嵌一个第三方风格页面。

## 数据映射

### 1. 主状态接口
`https://status.openai.com/proxy/status.openai.com`

已确认字段：
1. `summary.name`：厂商名，当前为 `OpenAI`
2. `summary.public_url`：官方状态页链接
3. `summary.components[]`：组件清单
4. `summary.affected_components[]`：当前受影响组件及状态
5. `summary.ongoing_incidents[]`：进行中事件
6. `summary.scheduled_maintenances[]`：计划维护
7. `summary.data_available_since`：可用数据起始时间

### 2. 历史影响接口
`https://status.openai.com/proxy/status.openai.com/component_impacts?...`

已确认字段：
1. `component_uptimes[]`：按组件给出 uptime 百分比
2. `component_impacts[]`：组件受影响的时间段与状态
3. `incident_links[]`：历史事件索引、标题、发布时间和详情 permalink

### 3. RSS 事故流
`https://status.openai.com/feed.rss`

已确认字段：
1. `channel.lastBuildDate`：feed 最近构建时间
2. `item.title`：事故标题
3. `item.link` / `item.guid`：事故详情页链接
4. `item.pubDate`：事故发布时间
5. `item.description` / `content:encoded`：事故状态、正文更新和受影响组件

## 数据源组合策略
完整状态页按“RSS 管事件、JSON 管状态”组合，不再假设单个接口能覆盖所有页面模块。

### 1. RSS 管事件
RSS 适合驱动：
1. 顶部当前事故卡
2. 最近更新 / 历史事件流
3. 受影响组件的事故视角摘要
4. 后续桌面通知、轮询提醒或 webhook 转发

原因：
1. RSS 天然按时间排序
2. 每条事件都带标题、发布时间、状态和受影响组件
3. `link/guid` 能直接跳到官方 incident 详情页

### 2. JSON 管状态
JSON 适合驱动：
1. `System status` 组件列表
2. uptime 条带
3. 当前组件总览与受影响状态
4. 90 天健康台账

原因：
1. RSS 没有全量组件清单
2. RSS 没有 uptime 百分比和逐段状态条
3. 这些结构依赖 `components[] / component_uptimes[] / component_impacts[]`

### 3. 页面模块映射
1. 顶部总告警卡：优先取 RSS 中最新一条未 `Resolved` 的事故；若没有，再回退主状态 JSON 的 `ongoing_incidents[]`
2. 顶部事故标题、正文、受影响范围：来自 RSS `item.title + description/content:encoded`
3. `System status` 列表：来自 JSON 组件清单与 uptime 数据
4. uptime 彩条：来自 `component_impacts[] + component_uptimes[]`
5. 历史事件列表 / `View history`：优先来自 RSS，必要时补 `incident_links[]` 做去重和详情跳转

### 4. 业务结论
1. RSS 单独可支撑“事故播报页”
2. JSON 单独可支撑“组件健康页”
3. 只有 RSS + JSON 组合，才能还原当前这版状态页的完整业务闭环

## 页面信息架构
1. 顶部概览区：厂商名称、总状态、最后同步时间、官方状态页跳转。
2. 事件提示区：进行中事件、计划维护、当前受影响组件摘要。
3. 组件状态矩阵：用卡片或表格展示核心组件的实时状态。
4. 90 天健康面板：展示组件 uptime、最近影响次数、重点组件排名。
5. 历史事件列表：展示近期事件标题、状态、发布时间，并支持跳转官方详情。

## 导航落位
本需求不并入现有 `status` 页，而是新开一级菜单与新页面。

原因：
1. 当前 `status` 页在产品里代表“本地 relay / sidecar 运行状态工作台”
2. 本需求代表“外部厂商状态中心”
3. 两者都叫“状态”，但业务层级不同；强行并页会把“本地链路状态”和“上游厂商状态”混在一起

当前落位结论：
1. 保留现有一级菜单 `status`，继续承载本地 relay / sidecar / runtime 状态
2. 新增一级菜单 `vendor-status`
3. `vendor-status` 首期只接 `OpenAI`
4. 后续 Claude / Gemini 等厂商继续扩在 `vendor-status` 下，而不是回塞到现有 `status`

## 设计方向
本期沿用当前仓库已出现的 GetTokens 工作台语言：
1. 黑白高对比的控制台式框架
2. `JetBrains Mono` / `IBM Plex Mono` 风格的等宽信息密度
3. 全页以黑白灰为主，只有 `System status` 区允许使用红黄绿表达状态
4. 组件、按钮、标签统一直角，不使用圆角语言
5. 应用壳层使用现有侧边导航语义，不做营销页式 hero

本期记忆点定为：`状态墙 + 事件带 + 稳定性台账`，即第一屏先让人感知“当前稳不稳”，第二层再展开“哪里不稳、过去 90 天怎么不稳”。

## 验收标准
1. `space` 目录结构完整，包含 `README.md`、`plans/`、`screenshots/`、`debate/`。
2. `README.md` 能回答页面做什么、首期范围是什么、数据从哪里来、页面怎么分区。
3. 设计稿是当前 `space` 根目录下唯一的单 HTML 入口文件。
4. 设计稿中至少包含：
   - 当前总状态概览
   - 进行中事件模块
   - 组件状态矩阵
   - 90 天健康/uptime 模块
   - 历史事件列表
5. 页面风格与 GetTokens 现有工作台设计一致，不直接照搬 OpenAI 官网视觉。

## 设计稿入口

- 本期设计稿：`design-preview.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260430-openai-status-page`
- worktree：`../GetTokens-worktrees/20260430-openai-status-page/`

## 相关链接
1. [design-preview.html](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260430-openai-status-page/design-preview.html)
2. `https://status.openai.com/`
3. `https://status.openai.com/proxy/status.openai.com`
4. `https://status.openai.com/proxy/status.openai.com/component_impacts`
5. `https://status.openai.com/feed.rss`

## 当前状态
- 状态：implemented-and-validated
- 最近更新：2026-04-30

## 实现落位
1. 一级菜单新增 `vendor-status`，与现有本地运行态 `status` 分离。
2. 前端页面入口为 `frontend/src/pages/VendorStatusPage.tsx`。
3. 页面主逻辑位于 `frontend/src/features/vendor-status/`。
4. RSS 通过 `app.go` 中的 `FetchVendorStatusRSS` 由桌面运行时抓取，再交给前端解析；JSON 状态接口继续由前端直连 OpenAI 代理接口。
5. 当前已补齐页面持久化、hash 路由、本地化文案、模型测试和 Go bridge 测试。
6. 浏览器预览态下若不存在 Wails bridge，页面会跳过 RSS 拉取并优雅降级到 JSON 侧数据，不再因为直接调用 `window.go.main.App` 而抛同步异常。
7. 当前已补齐 `?preview=vendor-status` 预览模式，可在纯浏览器环境下渲染稳定静态验收画面。

## 验收产物
1. 桌面截图：[20260430-openai-status-page-vendor-status-web-baseline-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260430-openai-status-page/screenshots/20260430/openai-status-page/20260430-openai-status-page-vendor-status-web-baseline-v01.png)
2. 移动截图：[20260430-openai-status-page-vendor-status-mobile-baseline-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260430-openai-status-page/screenshots/20260430/openai-status-page/20260430-openai-status-page-vendor-status-mobile-baseline-v01.png)
3. 浏览器验收脚本：`docs-linhay/scripts/vendor-status-browser-check.mjs`
