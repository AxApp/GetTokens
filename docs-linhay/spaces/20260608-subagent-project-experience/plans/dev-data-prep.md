# Dev 数据准备记录

## 时间

- 2026-06-08

## 目标

本轮 subagent 体验只在 dev 环境进行。为保证体验接近真实状态，将正式数据目录中的必要运行数据复制到 dev 数据目录。

## 路径

- 正式数据源：`/Users/linhey/.config/gettokens/`
- dev 数据目录：`/Users/linhey/.config/gettokens-dev/`
- dev 备份目录：`/Users/linhey/.config/gettokens-dev-backups/before-subagent-project-experience-20260608T021747`

## 操作记录

1. 已先备份原 dev 数据目录到上述备份路径。
2. 初次使用 `rsync` 同步时出现 `unexpected end of file`，未将该次同步视为完整成功。
3. 随后用显式文件和目录清单补齐复制：
   - `accounts-v1.sqlite`
   - `accounts-v1.sqlite-wal`
   - `accounts-v1.sqlite-shm`
   - `live-sessions-v1.sqlite`
   - `usage-attribution-v1.sqlite`
   - `usage-observed-v1.sqlite`
   - `usage-observed-v2.sqlite`
   - `config.yaml`
   - `config.yaml.backup`
   - `config-codex-models-fix.yaml`
   - `*.json` 账号凭证文件
   - `channel-routing/`
   - `.gettokens-retry-defaults-v1`
4. 未主动复制正式环境 `sidecar.log` 与 `logs/`。dev 目录内既有日志未清理。

## 约束确认

- 未修改 `/Applications/GetTokens.app`。
- 未 kill、重启或替换正式版 GetTokens 进程。
- 后续体验和修复默认只面向本仓库 dev 构建、dev 配置目录和本 space 文档产物。

## 风险

- 正式数据库如果在复制瞬间仍有写入，SQLite WAL 组合可能不是严格事务快照；本轮用途为 dev 体验和改进建议，不作为数据迁移验收依据。
- dev 目录保留了旧日志，若后续需要日志归因，需要按时间过滤本轮新日志。
