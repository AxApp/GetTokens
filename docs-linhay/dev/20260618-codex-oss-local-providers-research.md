# Codex OSS Local Providers Research

日期：2026-06-18

源码基线：docs-linhay/references/codex 已从 openai/codex 的 origin/main 快进到 683bd170dc（[codex] control automatic realtime handoff delivery (#27986)）。

官方文档基线：Codex manual 已刷新到本机缓存 /var/folders/rk/yj_4tlx92sz7t5k73kxppyl80000gn/T/openai-docs-cache/codex-manual.md。

## 研究范围

本轮研究对象是 Codex advanced config 中的 OSS mode (local providers)，重点回答：

- --oss 实际做了什么。
- oss_provider、--local-provider、model_provider 的关系。
- Ollama 与 LM Studio 在源码里的差异。
- 这个功能对 GetTokens 的 Codex 配置、账号路由、模型目录和本地提供商支持有什么影响。

## 官方语义

官方 manual 在 Advanced Configuration 中描述：

- Codex 支持通过 --oss 使用本地 open source provider，例如 Ollama 或 LM Studio。
- 如果传了 --oss 但没有显式指定 provider，Codex 使用 oss_provider 作为默认本地 provider。
- 示例配置是用户级 config.toml：

~~~toml
oss_provider = "ollama" # or "lmstudio"
~~~

同一段文档还说明 custom provider 不能复用内置 provider id：openai、ollama、lmstudio。

源码补充了文档没有完全写出的细节：当前 CLI 还有 --local-provider 参数，取值注释为 lmstudio 或 ollama。更准确的用户入口是：

~~~bash
codex --oss --local-provider ollama
codex --oss --local-provider lmstudio
codex --oss -m gpt-oss:20b
~~~

## 配置与参数链路

### 1. CLI 参数

文件：codex-rs/utils/cli/src/shared_options.rs

- --oss 映射到 SharedCliOptions.oss: bool。
- --local-provider 映射到 SharedCliOptions.oss_provider: Option<String>。
- 注释写明：如果 --oss 下没有指定 provider，就使用配置默认值，交互模式会展示选择器。

### 2. 配置字段

文件：codex-rs/config/src/config_toml.rs

ConfigToml 增加字段 oss_provider: Option<String>。

校验函数 validate_oss_provider 只接受：

- lmstudio
- ollama

旧值 ollama-chat 会被明确拒绝，并提示替换为 ollama。

### 3. Provider 解析优先级

文件：codex-rs/core/src/config/mod.rs

resolve_oss_provider(explicit_provider, config_toml) 的规则：

1. 有显式 --local-provider 时，用显式值。
2. 没有显式值时，用 config_toml.oss_provider。
3. 两者都没有时返回 None。

交互 TUI 和非交互 exec 对 None 的处理不同：

- TUI：进入 provider selection，根据端口探测结果自动选择或让用户选。
- codex exec --oss：没有交互选择，直接报错，要求传 --local-provider=provider 或配置 oss_provider。

## 内置 Provider 模型

文件：codex-rs/model-provider-info/src/lib.rs

Codex 当前内置 provider 列表包括：

- openai
- amazon-bedrock
- ollama
- lmstudio

OSS provider 的默认端口是：

- Ollama：11434
- LM Studio：1234

OSS provider 的 ModelProviderInfo 由 create_oss_provider_with_base_url 生成，关键属性是：

- name = "gpt-oss"
- base_url = http://localhost:<port>/v1
- wire_api = responses
- env_key = None
- auth = None
- requires_openai_auth = false
- supports_websockets = false

这说明 --oss 不是走 ChatGPT OAuth，也不是 OpenAI API key；它是把 Codex 的模型请求切到一个本地 OpenAI-compatible Responses API endpoint。

源码里还存在两个实验环境变量：

- CODEX_OSS_PORT：覆盖默认端口。
- CODEX_OSS_BASE_URL：覆盖完整 base URL。

注释明确说这两个变量是 experimental，未来可能改成从 config.toml 读取。因此 GetTokens 不应把它们作为稳定 UI 契约暴露给普通用户，只适合做高级调试入口。

## 启动行为

### TUI：codex --oss

文件：codex-rs/tui/src/lib.rs

流程：

1. 加载 bootstrap config。
2. 如果 cli.oss == true，解析 --local-provider 或 oss_provider。
3. 如果没有默认 provider，进入 oss_selection::select_oss_provider()。
4. 如果用户没有显式 -m，根据 provider 自动设置默认模型。
5. 加载完整 config，并执行 ensure_oss_provider_ready(provider_id, &config)。
6. 如果用户在 TUI 选择器里手动选择了 provider，会把选择写回 oss_provider。

选择器文件：codex-rs/tui/src/oss_selection.rs

选择器会先探测两个端口：

- 1234：LM Studio
- 11434：Ollama

如果只有一个运行，会自动选中；如果两个都运行或都没运行，会展示 TUI 选择界面。

### Exec：codex exec --oss

文件：codex-rs/exec/src/lib.rs

非交互模式没有选择器。没有 --local-provider 且没有 oss_provider 时直接失败：

~~~text
No default OSS provider configured. Use --local-provider=provider or set oss_provider to one of: lmstudio, ollama in config.toml
~~~

这对 GetTokens 很关键：如果未来支持在后台或自动化里发起 Codex OSS 模式，必须显式写入 provider，不能依赖交互选择。

## 默认模型与准备动作

文件：codex-rs/utils/oss/src/lib.rs

默认模型按 provider 分流：

- ollama -> gpt-oss:20b
- lmstudio -> openai/gpt-oss-20b

准备动作按 provider 分流：

- ollama：先检查 Ollama Responses API 支持，再检查服务与模型，缺失时 pull。
- lmstudio：检查 server 与模型，缺失时通过 LM Studio 下载，并后台 load model。
- 未知 provider：ensure_oss_provider_ready 当前会跳过 setup。

这里有一个实现边界：resolve_oss_provider 本身不校验显式 --local-provider 是否是内置二选一；配置写入路径会校验，但显式参数走到未知 provider 时可能只作为普通 provider id 进入后续配置解析或跳过 OSS setup。GetTokens 如果暴露 UI，应在本侧限制为 ollama / lmstudio，避免任意字符串进入“OSS provider”概念。

## Ollama 细节

文件：

- codex-rs/ollama/src/lib.rs
- codex-rs/ollama/src/client.rs

关键行为：

- 默认模型：gpt-oss:20b。
- 健康探测：
  - OpenAI-compatible base URL：请求 /v1/models。
  - 原生 Ollama root：请求 /api/tags。
- 模型列表：从 /api/tags 的 models[].name 读取。
- 缺模型时调用 pull 流程。
- Responses API 最低版本要求：0.13.4；如果版本不可解析或 endpoint 不存在，会容忍继续。

## LM Studio 细节

文件：

- codex-rs/lmstudio/src/lib.rs
- codex-rs/lmstudio/src/client.rs

关键行为：

- 默认模型：openai/gpt-oss-20b。
- 健康探测：请求 <base_url>/models。
- 模型列表：从 OpenAI-compatible data[].id 读取。
- 缺模型时通过 LM Studio 客户端下载。
- 加载模型时向 <base_url>/responses 发一个空 input、max_output_tokens = 1 的请求，作为后台预热。
- 找 lms 命令时先查 PATH，再查平台默认路径，例如 Unix 下 ~/.lmstudio/bin/lms。

## 与 custom model provider 的区别

model_provider = "local_ollama" 和 --oss --local-provider ollama 不是同一层语义：

- custom provider 是普通 provider catalog 扩展，用户自己定义 [model_providers.xxx]。
- OSS mode 是 Codex 内置的本地 provider 快捷模式，带默认模型、服务探测、模型下载/加载等 bootstrap 行为。
- oss_provider 只决定 --oss 默认选择谁，不会改变普通 Codex 会话的 provider。

如果用户只是想接一个代理、Azure、Mistral 或 GetTokens sidecar OpenAI-compatible endpoint，应使用 model_provider + [model_providers.xxx]，不要用 oss_provider。

## 对 GetTokens 的产品结论

### 1. 配置 UI 应分清三类 provider

GetTokens 的 Codex 配置界面建议分成三类概念：

- Cloud/OpenAI：OpenAI / ChatGPT OAuth / API key。
- Custom provider：代理、Azure、Mistral、GetTokens sidecar openai-compatible endpoint。
- Local OSS：仅 ollama / lmstudio，对应 Codex --oss。

oss_provider 不应出现在普通 provider 列表里作为一个可路由账号；它只是 --oss 的默认本地 provider preference。

### 2. 自动化/后台执行必须显式 provider

如果 GetTokens 未来支持“用本地 OSS provider 启动 Codex exec”，必须生成类似：

~~~bash
codex exec --oss --local-provider ollama ...
~~~

或提前写入：

~~~toml
oss_provider = "ollama"
~~~

不能只发 codex exec --oss，因为非交互模式没有 provider selection。

### 3. 不要把 OSS provider 绑定到账号池

OSS provider 没有 env_key、没有 OpenAI auth、requires_openai_auth = false。它更像本机 runtime capability，不是云账号。

GetTokens 侧如果要展示，应放在“本地运行时 / Provider runtime”或 Codex 配置页，而不是账号池 quota / OAuth token 列表。

### 4. 模型目录要按 provider 映射名称

同一个 gpt-oss 20B，在两个 provider 下模型 id 不同：

- Ollama：gpt-oss:20b
- LM Studio：openai/gpt-oss-20b

GetTokens 如果提供模型选择或模板，应按 provider 输出对应 model id，不能把一个 id 复用到两个 provider。

### 5. 文档与源码存在小幅漂移

官方 command reference 当前写 --oss 等价 -c model_provider="oss" 且“validates that Ollama is running”。最新源码显示：

- 实际内置 provider id 是 ollama / lmstudio，未看到稳定的 oss provider id。
- --oss 会根据 --local-provider、oss_provider 或 TUI 选择器解析成 ollama / lmstudio。
- 准备动作不只验证 Ollama，也支持 LM Studio。

因此在 GetTokens 文档和 UI 里应以源码行为为准：--oss 是“本地 OSS provider bootstrap mode”，不是一个名为 oss 的 provider。

## 建议的 GetTokens 支持边界

### 产品决策更新：支持 GetTokens 自己的 OSS 链路

本轮进一步确认：Codex upstream 的 oss_provider 对 GetTokens 当前产品价值有限，但“本地 OSS 链路”本身值得支持。GetTokens 不应复制 upstream 的窄入口，而应支持一个由 GetTokens sidecar / 配置层 / 本地 runtime 状态共同管理的 OSS 链路。

2026-06-18 追加判断：当前阶段按“只支持 OSS 链路”记录。也就是说，后续产品化优先围绕本地 OSS runtime 编排展开；普通 custom provider 仍可作为 Codex 配置输出格式或兼容层存在，但不作为本轮 GetTokens 能力主线。

这里的“支持 OSS 链路”不是指把 Codex 的 oss_provider 原样暴露出来，而是：

- 允许用户把本地模型运行时接入 GetTokens 管理面。
- 由 GetTokens 负责 provider 状态、模型映射、启动/探测、错误解释和命令生成。
- 对 Codex 输出时优先生成稳定的 model_provider / model_providers 配置，而不是依赖 --oss 的交互选择。
- 对 Ollama / LM Studio 这类本地 runtime 可以提供比 Codex upstream 更完整的状态和诊断。

因此 GetTokens 的方向应是“本地 OSS runtime orchestration”，而不是“Codex oss_provider wrapper”。

短期只做文档和只读识别：

- 识别 oss_provider = "ollama" | "lmstudio"。
- 在 Codex 配置说明里解释它只影响 --oss。
- 对 --local-provider 作为 CLI override 做展示。
- 同时为 GetTokens 自己的 OSS 链路保留产品入口，不把 upstream oss_provider 视为最终方案。

中期可以做配置辅助：

- 提供二选一切换 oss_provider。
- 对 ollama / lmstudio 展示默认端口、默认模型和本地服务状态。
- 对 codex exec --oss 生成命令时强制带 --local-provider。
- 对 GetTokens 托管的 OSS 链路，输出 model_provider / model_providers 配置，让 Codex 作为普通 Responses-compatible provider 使用。

暂不建议做：

- 把 CODEX_OSS_PORT / CODEX_OSS_BASE_URL 做成普通设置项。
- 把 OSS provider 放入账号池或 quota 流。
- 允许任意字符串作为 OSS provider。
- 为了 OSS 模式改动 GetTokens sidecar 的账号路由热路径。
- 把 GetTokens OSS 链路绑定到 Codex upstream 的 --oss 行为上。

## 验收记录

- 已执行 git -C docs-linhay/references/codex pull --ff-only，参考仓库更新到 683bd170dc。
- 已刷新 Codex manual。
- 已基于源码读取以下关键文件：
  - codex-rs/utils/cli/src/shared_options.rs
  - codex-rs/config/src/config_toml.rs
  - codex-rs/core/src/config/mod.rs
  - codex-rs/model-provider-info/src/lib.rs
  - codex-rs/tui/src/lib.rs
  - codex-rs/tui/src/oss_selection.rs
  - codex-rs/exec/src/lib.rs
  - codex-rs/utils/oss/src/lib.rs
  - codex-rs/ollama/src/lib.rs
  - codex-rs/ollama/src/client.rs
  - codex-rs/lmstudio/src/lib.rs
  - codex-rs/lmstudio/src/client.rs
