# Model catalog compatibility tracer bullet v01

## 目标

把 upstream v7.2.16 中纯静态模型目录新增项窄同步到 GetTokens sidecar fork：

- Claude Fable 5
- Kimi K2.7 Code
- Composer 2.5 Fast context window 200,000

## 红灯测试

新增 3 个 focused tests：

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/registry -run 'Test(ClaudeStaticModelsIncludeFable5|KimiStaticModelsIncludeK27Code|XAIStaticModelsIncludeComposer25Fast)' -count=1 -timeout 30s
```

预期红灯：

- `findModelInfo(GetClaudeModels(), "claude-fable-5") == nil`
- `findModelInfo(GetKimiModels(), "kimi-k2.7-code") == nil`
- `findModelInfo(GetXAIModels(), "grok-composer-2.5-fast") == nil`

## 实现边界

- 只改 `internal/registry/models/models.json` 和 `internal/registry/model_definitions_test.go`。
- 不改 executor/service/auth/router。
- 不改 builtins 注入逻辑，除非静态 JSON 无法表达该模型。
- 不运行真实 dev App；本切片只改 sidecar 静态 registry。

## 验收计划

1. focused tests 红灯。
2. 最小 JSON 更新。
3. focused tests 绿灯。
4. `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/registry -count=1 -timeout 60s`。
5. fork `git diff --check`、staged diff check。
6. fork commit。
7. clean sidecar rebuild 并记录 fingerprint。

## 验收结果

- 红灯：focused tests 初始失败，3 个模型均缺失。
- 绿灯：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/registry -run 'Test(ClaudeStaticModelsIncludeFable5|KimiStaticModelsIncludeK27Code|XAIStaticModelsIncludeComposer25Fast)' -count=1 -timeout 30s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/registry -count=1 -timeout 60s`
  - `python3 -m json.tool internal/registry/models/models.json`
  - fork `git diff --check`
  - staged `git diff --cached --check`
- fork commit：`411a50f9 feat(registry): add latest compatible models`。
- sidecar rebuild fingerprint：`411a50f929aa213948b154f9eb47fd69792d2aa1:clean:8a27e08ffa7f99f79ff668de0df4026dd75bfb7c3ae66a75f8adb54d624c13cf:darwin:arm64`。
- sidecar sha256：`b56b29e042e31ddfb1f03e2e9c3bde6a8905c71b9dcd549ce4f4b0cddb9741f0`。
