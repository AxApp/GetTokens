# Deep Link Scheme Smoke Session Distillation

## 背景

本轮 `20260528-cc-switch-one-click-import` 从旧 `gettokens://v1/import` 收敛为 GetTokens 私有账号导入入口：

```text
gt://app/v1/import?payload=<base64url-json>
```

用户追问“走过冒烟吗？dev 环境可以使用不同的 schema 来测试”后，补充了本地开发别名：

```text
gt-dev://app/v1/import?payload=<base64url-json>
```

这里的关键不是 payload `schema` 变更；payload 仍使用 `schema=gettokens.import.v1`。`gt-dev` 是 URL scheme 层面的 dev alias，用于隔离本地 LaunchServices 冒烟，不改变导入语义。

## 可复用模式

Wails/macOS deep link 改造必须按四层闭环处理：

1. 后端 parser 支持生产 scheme 与 dev scheme，并保留实际 `Protocol`。
2. root 启动参数和 `SingleInstanceLock` 二次启动参数都过滤所有支持的 scheme，避免 Wails flag parser 误读。
3. `wails.json` 注册所有可由系统打开的 scheme，并用 root 测试读取配置防回归。
4. `./scripts/wails-cli.sh build` 后检查 built app 的 `Info.plist`，确认 `CFBundleURLTypes` 包含目标 scheme。

只有 parser 测试通过不能说明系统 deep link 可用；只有 `Info.plist` 正确也不能说明当前 build 收到了 URL。

## 冒烟归因规则

macOS LaunchServices 可能把 `open gt-dev://...` 交给本机已经注册过的其他 dev build。遇到这种情况时：

1. 可以记录为“系统 scheme 可解析”。
2. 不能宣称“当前 worktree 新 build 已完成完整桌面 UI 冒烟”。
3. 不应为了抢占 scheme 所有权直接 kill 既有 prod/dev GetTokens 进程，除非用户明确同意。
4. 例行冒烟优先使用 `open -g`，避免抢前台。

本轮实际情况：`build/bin/GetTokens.app/Contents/Info.plist` 已包含 `gt` 与 `gt-dev`；`open -g gt-dev://...` 未抢前台，但命中了本机已有另一个 dev build，因此只作为系统 scheme 可解析冒烟记录。

## 不纳入内容

1. 不把 `gt-dev` 写入外部产品链接或正式分发文档。
2. 不把 payload `schema` 改成 dev 版本；这会制造两套数据契约。
3. 不升级 `AGENTS.md`。该规则属于 Wails/macOS deep link 交付流程，沉淀到 `gettokens-ops-governance` 与本文档即可。

## 后续入口

后续只要涉及 GetTokens deep link scheme、macOS URL handoff 或 Wails URL scheme 注册，优先使用 `.agents/skills/gettokens-ops-governance/SKILL.md` 的 `macOS Deep Link Scheme & Smoke Loop`。
