# 2026-06-15 沟通稿模板

## 目的

把当前 research space 的结论压缩成几份可直接复用的沟通稿，分别适用于：

1. 对外短答
2. 内部同步
3. 更保守的升级建议

这些稿子不新增技术结论，只把已有研究结果整理成更适合传达的形态。

## 一、对外短答版

适合回复“我们现在支不支持 Claude Code 对接 open-response？”这类直接追问。

### 模板

```text
目前不支持把 Claude Code 对接 open-response 当作正式能力来描述。

现阶段 Claude Code 在 GetTokens 里的正式入口仍然是 anthropic / /v1/messages。仓库里确实能看到一部分协议转换基础，但更接近 messages -> chat 的 compat 线路；要支持 messages -> responses，还需要补正向 translator、executor 的 /responses path 和 focused tests。
```

### 适用场景

1. 用户直接问支持与否
2. 不需要展开太多技术细节
3. 需要一个不误导的稳定口径

## 二、对外稍展开版

适合对方会继续追问“为什么不算支持”的场景。

### 模板

```text
当前不建议把这件事表述成“Claude Code 已支持 open-response”。

原因有三个：
1. Claude Code 在产品边界上仍是 anthropic / /v1/messages；
2. 运行时默认更像 messages -> chat，而不是 messages -> responses；
3. 目前还缺 Claude -> OpenAI Responses 的正向 translator、executor /responses path 和对应 focused tests。

所以更准确的说法是：现在最多只有一部分 compat 基础，还不是正式交付能力。
```

## 三、内部同步版

适合发给团队、写在 issue/space 评论里，统一认知。

### 模板

```text
这轮 research 已经收口：

1. 现在不能把 Claude Code 对接 open-response 说成已支持；
2. 当前主链路证据更接近 Claude /messages -> OpenAI chat upstream；
3. Responses 方向现有代码更多是 OpenAI Responses -> Claude，不是我们要的正向路径；
4. 如果后续要做，应先进入 technical spike，而不是先改 UI 候选池。

建议顺序：
translator -> executor /responses path -> focused tests -> Wails/probe -> frontend 文案。
在 runtime 主链路没跑通前，不开放产品面。
```

## 四、内部决策升级版

适合在有人想推动“那我们是不是直接做掉”时使用。

### 模板

```text
这件事不是零成本补个开关。

如果要把 Claude Code 的 open-response 兼容真正做成立，至少要同时补：
1. Claude -> OpenAI Responses request translator；
2. OpenAICompatExecutor 的普通 /responses path；
3. stream/tool/usage/error focused tests；
4. probe / evidence / UI 能力标记。

建议只在出现明确 Responses-only upstream 需求时启动 M3 technical spike。否则短期更合理的是继续维持“不支持正式能力”的产品口径，并补强现有 messages -> chat compat 基线测试。
```

## 五、更保守的对外建议版

适合不想让对方误解成“已经在做”的时候。

### 模板

```text
目前这项能力还在研究结论阶段，没有进入正式实现交付。

现有代码里确实有一些相关协议转换基础，但还不足以支撑“Claude Code 已支持 open-response”这个说法。若后续确认有明确需求，再按技术 spike 方式推进会更稳妥。
```

## 六、对外最稳的一句话

如果只能说一句，建议用这一句：

```text
GetTokens 目前不支持 Claude Code 以 open-response 作为正式上游协议；当前最多只具备 messages -> chat compat 的技术基础，messages -> responses 仍需新增 translator、executor /responses path 和 focused tests。
```

## 七、使用注意

1. 不要把“compat 基础”说成“已支持”
2. 不要把 local draft 能生成配置说成“runtime 已闭环”
3. 不要把 `responses/compact` 说成现成的 Claude compat path
4. 如果还没进入实现，不要让表述听起来像“下个版本一定会做”
