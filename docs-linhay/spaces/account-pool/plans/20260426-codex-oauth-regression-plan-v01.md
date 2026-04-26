# 20260426 Codex OAuth Regression Plan V01

## 目标

为账号池内的 `ChatGPT 登录 / codex 重新登录` 闭环提供一份可重复执行的回归方案，降低后续修改账号池、Wails bridge 或 sidecar OAuth 时的回归风险。

## 适用范围

1. `StartCodexOAuth`
2. `GetOAuthStatus`
3. `FinalizeCodexOAuth`
4. 账号卡片失败态 `重新登录`
5. 新 auth 回填原文件名

## 自动化回归

### Go

运行：

```bash
go test ./internal/wailsapp ./internal/cliproxyapi
```

关注点：

1. OAuth 起始接口是否仍正确桥接到 sidecar
2. 回填逻辑是否仍保留原文件名
3. 多个新 `codex` auth file 同时出现时，是否仍能拒绝歧义结果

### Frontend

运行：

```bash
cd frontend
npm run test:unit
npm run typecheck
npm run build
```

关注点：

1. 失败态 `codex auth-file` 是否仍被识别为可重登
2. 登录 / 重登横幅文案是否仍按场景区分
3. 新增入口和卡片动作是否未破坏现有构建

## 手动回归

### 场景 1：新增 ChatGPT 账号

1. 打开账号池
2. 点击 `ChatGPT 登录`
3. 确认浏览器被拉起
4. 完成授权
5. 返回应用，确认出现“登录进行中”横幅
6. 同步完成后确认出现“登录成功”横幅
7. 确认账号池新增一个 `codex` auth-file 账号

### 场景 2：失败账号重新登录

1. 准备一个失败态 `codex` auth-file 账号
2. 确认卡片显示失败原因和 `重新登录`
3. 点击 `重新登录`
4. 完成浏览器授权
5. 返回应用并等待同步
6. 确认原文件名对应的账号恢复，而不是出现一新一旧两个重复账号

### 场景 3：登录失败

1. 发起 `ChatGPT 登录`
2. 在浏览器中取消授权或让流程超时
3. 返回应用
4. 确认出现错误横幅
5. 确认账号池未新增错误资产
6. 确认可再次点击登录

### 场景 4：异常歧义保护

1. 人为制造多个新的 `codex` auth file
2. 触发失败账号 `重新登录`
3. 确认应用不静默覆盖错误账号
4. 确认错误被显式提示，而不是产生不可追踪的数据错配

## 通过标准

1. 自动化测试全部通过
2. 新增登录和重登两条路径都能完成
3. 回填后不残留重复账号
4. 失败时能明确提示且不破坏原账号
