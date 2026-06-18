# OpenAI video diff audit v01

## 对比结果

当前 fork 与 upstream 都存在：

- `sdk/api/handlers/openai/openai_videos_handlers.go`
- `sdk/api/handlers/openai/openai_videos_handlers_test.go`

fork 已覆盖基础能力：

- XAI video model validation。
- `grok-imagine-video` / `grok-imagine-video-1.5-preview` create request。
- seconds / size / reference image validation。
- XAI create/retrieve response 基础转换。
- unsupported model / invalid JSON / form request。

upstream v7.2.16 新增但 fork 未覆盖的 tests：

```text
TestBuildXAIVideosCreateRequestMapsSoraModelToXAIBackend
TestBuildVideosRetrieveAPIResponseFromXAINormalizesTopLevelError
TestBuildVideosRetrieveAPIResponseFromXAINormalizesNestedError
TestXAIVideoContentURLFromPayload
TestWriteVideoContentFromURL
TestWriteVideoContentFromURLUsesPinnedAuthProxy
TestWriteVideoContentFromURLFallsBackToGlobalProxy
TestVideosContentUsesSelectedAuthProxyForDownload
TestVideosCreateBindsRetrieveToSelectedAuth
TestXAIVideosNativeCreateBindsRetrieveToSelectedAuth
TestVideoAuthBindingTTLUsesConfig
TestVideoAuthBindingStoreExpiresEntries
```

## 判定

结论：`defer-product-scenario-no-port`。

理由：

1. 这些不是 isolated translator bug；它们引入 video proxy 的网络下载、代理选择、selected auth binding、TTL cache 与 OpenAI Sora compatibility。
2. GetTokens 当前没有独立 video proxy 产品入口、UI 验收、账号能力模型或 fake upstream 验证场景。
3. 如果直接 reference-port，可能在没有用户授权和产品语义的情况下引入额外网络下载路径与账号代理绑定状态。
4. fork 已有历史 XAI video preview model 支持，不等于要支持 Sora compatibility 或 video content proxy。

## 后续 evidence gate

如果后续确认要做 video proxy，先补独立需求 space，并满足：

- 用户可见场景：在哪里创建/查看/下载 video，错误如何展示。
- model catalog：`sora-2*` 是否显示给用户，如何声明实际上走 XAI backend。
- fake upstream：覆盖 create / retrieve / content URL / error normalization。
- auth binding：create 后 retrieve/content 是否必须 pinned 到同一 auth；失败、过期、切换账号如何处理。
- proxy：账号代理、全局代理、无代理优先级和失败降级。
- security：content URL 下载大小、content-type、timeout、redirect、SSRF 边界。
- sidecar rebuild 与 dev/API 验收。

## 本轮验收

- 本轮只做 diff audit 与 defer 记录。
- 不改 fork 代码，不新增 fork commit，不重建 sidecar。
- 最新 sidecar 仍来自上一切片 `8d1ef22c967ae0ae9ca9c149584dadc15e9aa7ef:clean:a58339be04eb235743f7649d337710700bc82c5cbd9b0b9a3d1b06d887b1d3af:darwin:arm64`。
