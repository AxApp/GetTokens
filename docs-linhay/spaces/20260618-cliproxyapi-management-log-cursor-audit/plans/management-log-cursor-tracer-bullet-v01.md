# Management log cursor tracer bullet v01

## 目标

用最小 tracer bullet 从 upstream v7.2.16 提取 management logs cursor tail 能力，并在 GetTokens sidecar fork 中验证：

- tail limit 不全量扫描旧日志；
- 响应返回 `next-cursor`；
- cursor 读取只返回新增完整行；
- truncate / rotation 场景有可解释 reset 或 continuation；
- cursor 不暴露绝对路径并拒绝 unsafe file name。

## 当前 fork 差异

当前 fork `internal/api/handlers/management/logs.go`：

- `GetLogs` 解析 `after` / `limit`；
- 使用 `newLogAccumulator(cutoff, limit)` 顺序扫描所有 log files；
- 响应字段只有 `lines`、`line-count`、`latest-timestamp`；
- 没有 `cursor` query、`next-cursor`、`cursor-reset`、cursor encode/decode、complete-line boundary、tail read、rotation continuation。

upstream v7.2.16 增加：

- `logCursor` encoded payload；
- `readCompleteLogLines` 跳过 trailing partial line；
- `tailLogFiles` / `readLogFilesFromCursor`；
- cursor file fingerprint；
- truncate / missing file reset 到 tail；
- zero-offset / empty file rotation disambiguation。

## 红灯测试计划

先补 5 个 focused tests：

1. `TestDecodeLogCursorRejectsUnsafeFiles`
2. `TestGetLogsTailLimitReturnsRecentLinesWithCursor`
3. `TestGetLogsCursorReturnsOnlyNewCompleteLines`
4. `TestGetLogsCursorResetAfterTruncateTailsLimit`
5. `TestGetLogsCursorReadsAcrossRotation`

命令：

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -run 'Test(GetLogsTailLimitReturnsRecentLinesWithCursor|GetLogsCursorReturnsOnlyNewCompleteLines|GetLogsCursorResetAfterTruncateTailsLimit|GetLogsCursorReadsAcrossRotation|DecodeLogCursorRejectsUnsafeFiles)' -count=1 -timeout 60s
```

预期红灯：

- `decodeLogCursor` / `logCursor` / `logCursorVersion` 未定义；或
- `next-cursor` 为空；或
- cursor query 被旧实现忽略，返回旧行而不是新增行。

## 实现边界

- 只改 `logs.go` 与 `logs_test.go`。
- 不改 handler route 注册、management auth 或 config schema。
- 不改 GetTokens-specific hooks。
- 不引入 network listener；tests 使用 `httptest.NewRecorder` / `gin.Engine.ServeHTTP`，不受当前 sandbox localhost bind 限制影响。

## 验收计划

1. focused cursor tests 通过。
2. `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -count=1 -timeout 120s`。
3. `git -C docs-linhay/references/CLIProxyAPI diff --check`。
4. fork commit。
5. `./scripts/ensure-sidecar.sh darwin arm64` clean rebuild，并记录 fingerprint。
6. 文档与 memory 写回；父仓只做文档门禁，不混入其他无关改动。

## 验收结果

- 红灯：focused cursor tests 初始 build failed，缺少 cursor helper。
- 绿灯：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -run 'Test(GetLogsTailLimitReturnsRecentLinesWithCursor|GetLogsCursorReturnsOnlyNewCompleteLines|GetLogsCursorResetAfterTruncateTailsLimit|GetLogsCursorReadsAcrossRotation|DecodeLogCursorRejectsUnsafeFiles)' -count=1 -timeout 60s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -run 'Test(GetLogs|DecodeLogCursor)' -count=1 -timeout 120s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -run 'Test(GetLogs|DecodeLogCursor)' -count=1 -timeout 180s`
  - fork `git diff --check`
  - staged `git diff --cached --check`
- package 全量限制：`go test ./internal/api/handlers/management -count=1` 当前被既有 `httptest.NewServer` 用例阻塞于 sandbox localhost bind restriction。
- fork commit：`8d1ef22c fix(management): add log cursor tailing`。
- sidecar rebuild fingerprint：`8d1ef22c967ae0ae9ca9c149584dadc15e9aa7ef:clean:a58339be04eb235743f7649d337710700bc82c5cbd9b0b9a3d1b06d887b1d3af:darwin:arm64`。
- sidecar sha256：`ab3258e112116b8893d67fd7c45542268906544d08ba684bafcc9bd221a675ae`。
