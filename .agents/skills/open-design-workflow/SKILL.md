---
name: open-design-workflow
description: Use when wiring Open Design into this project or agent workflow, including `od` daemon health checks, CLI/API/MCP setup, Skills and design-system registry inspection, media generation, or project artifact reads.
---

# Open Design Workflow

用于把 Open Design 接入当前 agent 工作流。Open Design 是本地特权 daemon `od`，提供 CLI、HTTP API、MCP 和 Skills 四种等价入口。

## 启动判断
1. 先确认 daemon 可达：
   ```bash
   curl -s od://app/api/health | jq
   ```
2. 如果返回 404、超时或无法连接，暂停接入动作并让用户启动 Open Design：
   - 开发模式：`pnpm tools-dev`
   - 打包版：打开 Open Design app
3. 确认 `od` 在 PATH 且能看到 agent 环境：
   ```bash
   od doctor
   od status --json
   ```

## MCP 接入
1. 不手写 `mcpServers` 配置，先从 daemon 拉取安装片段：
   ```bash
   curl -s od://app/api/mcp/install-info | jq
   ```
2. 按返回片段写入目标客户端配置。常见目标包括 Codex、Claude Code、Cursor、OpenCode/openclaw、Hermes 或自定义 runner。
3. 写配置前先读取现有配置文件，做最小合并，避免覆盖已有 MCP server。
4. 返回片段通常包含：
   - `command`: `od`
   - `args`: `["mcp", "--daemon-url", "od://app"]` 或等价 daemon URL
   - `env`: 固定 `OD_DATA_DIR`，确保 MCP 与 daemon 使用同一数据目录

## 端到端验证
1. 验证 HTTP Skills registry：
   ```bash
   curl -s od://app/api/skills | jq '.skills | length'
   ```
2. 验证 CLI Skills registry：
   ```bash
   od skills list --json
   ```
3. 需要外部设计系统资料时再检查 Open Design registry：
   ```bash
   od design-systems list --json
   ```

## 本地 UI 评价与修正闭环
当用户要求用 Open Design 评价本地 Wails / Web 页面并继续“你来改”时，按以下顺序执行：

1. 先记录评价目标 URL、桌面视口和当前页面 hash；GetTokens 默认按桌面 / Wails 容器验收，不做移动端门禁。
2. 使用 `od status --json` 或健康检查确认 Open Design daemon 可达；如果 HTTP 健康检查卡住，可用 `timeout 3 od status --json` 补充状态证据。
3. 用无头浏览器或 `agent-browser` 抓取真实页面截图与 accessibility / DOM 快照，评价必须基于证据，不只凭源码印象。
4. 先给出明确设计判断，再落地最小视觉修正：层级、密度、边框强度、标题尺度、元信息分组、扫读宽度等优先于大改交互。
5. 视觉修正也要补测试。没有像素测试时，至少增加源码级设计约束测试，锁定关键 class / token / 结构契约，避免回归到重噪声层级。
6. 截图归档到对应 space，路径遵循 `docs-linhay/scripts/check-docs.sh`：`screenshots/YYYYMMDD/<topic>/YYYYMMDD-<topic>-<target>-(before|after|baseline|failed)-vNN.png`。
7. 修正后重新截图，并在 space README 记录修改前后证据、验收标准和仍保留的调试态边界。

注意：GetTokens 内置 Storybook / `design-system` route / component highlight 已退役。Open Design 只能作为外部评价和素材输入，不要恢复 `data-design-system-*` 标记或 inspect mode。

## 入口选择
- 静态读取、列表、健康检查：优先 HTTP API `od://app/api/*`。
- agent 工具调用、预览、生成、项目读写：优先 MCP。
- shell 自动化、CI、headless generation：优先 CLI。
- 只读使用 Skills 模板：可通过 skill 目录或 `od skills list --json`，daemon 非必需。

## 常用命令
生成图片：
```bash
od media generate \
  --surface image \
  --model gpt-image-1 \
  --aspect 1:1 \
  --prompt "Editorial product shot, soft daylight, muted palette" \
  --output ./out/hero.png
```

运行插件并流式输出 JSON lines：
```bash
od run \
  --plugin od-new-generation \
  --prompt 'A 10-slide investor pitch for a SaaS for design teams' \
  --json --follow
```

读取项目文件：
```bash
od project list --daemon-url od://app
od files list <project-id> --daemon-url od://app
od files read <project-id> index.html --daemon-url od://app
```

## 边界
- 不记录账号、token、provider key 或一次性本机隐私路径。
- 不在 daemon 不可达时伪造 MCP 配置；先让用户启动 daemon。
- 不覆盖用户已有 MCP 配置；只追加或合并 `open-design` server。
- 需要安装依赖、启动长期服务或修改全局 agent 配置时，先说明影响并遵循当前环境的审批规则。
