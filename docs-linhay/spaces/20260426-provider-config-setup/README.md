# 供应商配置与一键复制配置

## 背景
当前账号池中的 API Key 详情面板只展示基础字段，缺少直接复制 `API KEY` / `BASE URL` 的入口，也没有针对当前 provider 的配置片段生成能力。
同时状态页缺少一份可直接指向本地 sidecar 聚合中转服务的最小 `auth.json` 配置示例，也没有入口查看或修改聚合服务自己的客户端 `api-keys`，更不能直接给出主机名 / 局域网地址形式的访问配置。

## 目标
为 API Key 详情面板补齐一个可直接交付给用户的配置工作台：
- 单独复制 `API KEY` / `BASE URL` / `PREFIX`
- 生成当前 provider 对应的配置片段
- 提供一键复制配置按钮
- 当字段缺失时允许用户在面板内补填后再复制
- 在 auth file 详情面板提供“清洗字段”按钮，展示最小可用 auth payload
- 在状态页展示本地后端中转服务可用的最小 `auth.json` 配置示例
- 支持在状态页查看并修改聚合服务自己的客户端 API KEY
- 支持多客户端 API KEY 管理，并展示 `localhost` / `hostname` / `LAN IP` 三类访问地址
- 在状态页展示 sidecar 当前实际生效的账号轮动策略与重试配置

## 范围
- `frontend/src/features/accounts/components/ApiKeyDetailModal.tsx`
- `frontend/src/components/biz/AccountDetailModal.tsx`
- `frontend/src/features/accounts/model/accountConfig.ts`
- `frontend/src/pages/StatusPage.tsx`
- `internal/accounts/auth_file_normalize.go`
- `internal/wailsapp/auth_file_normalize.go`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`

## 非目标
- 本轮不扩展成完整的 provider 管理后台
- 本轮不新增新的账号类型或新的侧边导航入口
- 本轮不在 auth file 详情面板生成 provider 配置，只提供最小字段清洗结果

## 验收标准
- 打开 API Key 详情面板后，可以分别复制 `API KEY`、`BASE URL`、`PREFIX`
- 面板中可看到基于当前 provider 生成的配置片段
- 点击一键复制按钮后，可复制整段配置
- 当 `API KEY` 或 `BASE URL` 为空时，用户可以先补填再复制
- 粘贴导入或上传 legacy codex auth file 时，落盘前会被清洗成 sidecar 可用的最小字段集合
- 打开 auth file 详情面板后，可在“原始内容 / 清洗结果”之间切换，并复制清洗后的结果
- 状态页可直接复制一份指向本地 sidecar 端口的最小 `auth.json` 示例
- 状态页可查看并保存聚合服务自己的客户端 API KEY，而不是复用上游供应商 API KEY 资产
- 状态页支持一次维护多条客户端 API KEY，并可选择任意一条 key 与任意一个访问地址生成配置
- sidecar 默认绑定全接口，保证局域网内设备可通过主机名或内网 IP 访问
- 状态页可直接看到当前实际生效的 `routing.strategy / session-affinity / retry / quota-exceeded` 配置
- 中英文文案同步更新
- `frontend` 的 `typecheck` 与 `build` 通过

## 相关链接
- [账号池 Space](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/account-pool/README.md)
- [ApiKeyDetailModal](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx)

## 当前状态
- 状态：in_progress
- 最近更新：2026-04-26
- 补充：状态页新增“后端中转服务配置”卡片，直接读取 sidecar 顶层 `api-keys` 作为聚合服务自己的客户端 API KEY，并支持多 key 编辑、主机名展示、局域网地址选择，以及当前实际轮动配置观察
- 补充：`codex` auth file 的导入链路已收敛为最小字段清洗，账号详情面板新增“清洗字段”按钮，便于用户直接查看 sidecar 实际可消费的 payload
