# Release Label 与 Version 边界

## 背景
本轮 Sidebar 版本号需求要求界面显示发布日期小时，如 `2026.04.06.11`。但应用现有 `Version` 同时被自动更新逻辑使用，直接改写 `Version` 会把 UI 展示格式和版本比较语义耦合到一起。

## 结论
GetTokens 后续统一采用双轨元数据：

1. `Version`
   用于自动更新比较、Git tag / release 语义、对外版本标识。
2. `ReleaseLabel`
   仅用于 UI 展示，格式固定为 `YYYY.MM.DD.HH`。

## 规则
1. 不要把 `Version` 直接用于 Sidebar、角标、构建时间标签等纯展示场景。
2. 需要展示发布日期时，优先读取后端注入的 `ReleaseLabel`。
3. release 构建必须在 CI 中显式生成 `ReleaseLabel`，不要依赖运行时猜测。
4. 生成 `ReleaseLabel` 时必须显式声明时区；当前采用 `Asia/Shanghai`。
5. 开发态允许前端对空值/`dev` 做本地 fallback，但 release 包必须优先展示注入值。

## 当前落地
1. Go 入口新增 `ReleaseLabel` 全局变量，通过 `-ldflags` 注入。
2. Wails 暴露 `GetReleaseLabel()` 给前端读取。
3. Sidebar 仅消费 `ReleaseLabel`，不再直接消费 `Version`。
4. GitHub Release workflow 在构建前计算 `RELEASE_LABEL=$(TZ=Asia/Shanghai date +'%Y.%m.%d.%H')`。

## 适用场景
1. Sidebar / Header / About 面板里的构建标签。
2. 未来需要区分“用户可见发布日期”与“机器可比较版本号”的任何 UI。

## 不适用场景
1. 自动更新版本比较。
2. Git tag、发布说明标题、兼容性判断。
