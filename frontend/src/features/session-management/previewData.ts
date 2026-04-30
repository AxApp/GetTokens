import type { SessionDetail, SessionManagementSnapshot } from './model.ts';

const PREVIEW_SNAPSHOT: SessionManagementSnapshot = {
  stats: {
    projectCount: 3,
    sessionCount: 9,
    activeSessionCount: 6,
    archivedSessionCount: 3,
    lastScanAt: '2026-04-30 23:41',
    providerSummary: 'codex 6 / gemini 3',
  },
  projects: [
    {
      id: 'project-gettokens',
      name: 'GetTokens',
      sessionCount: 4,
      activeSessionCount: 3,
      archivedSessionCount: 1,
      lastActiveAt: '2026-04-30 23:41',
      providerSummary: 'codex 3 / gemini 1',
      sessions: [
        {
          id: 'session-gettokens-01',
          title: '会话管理第一页接入真实 rollout',
          status: 'active',
          messageCount: 12,
          roleSummary: 'system 1 / user 5 / assistant 6',
          updatedAt: '2026-04-30 23:41',
          fileLabel: '2026/04/30/session-management-01.jsonl',
          summary: '补项目列表、会话列表和详情弹层，改成真实 rollout 读取。',
        },
        {
          id: 'session-gettokens-02',
          title: '项目会话列表头部筛选',
          status: 'active',
          messageCount: 7,
          roleSummary: 'system 1 / user 3 / assistant 3',
          updatedAt: '2026-04-30 21:08',
          fileLabel: '2026/04/30/session-management-02.jsonl',
          summary: '把全部 / 活跃 / 已归档 固定在列表头右侧。',
        },
        {
          id: 'session-gettokens-03',
          title: '真实消息样本脱敏整理',
          status: 'archived',
          messageCount: 9,
          roleSummary: 'system 1 / user 4 / assistant 4',
          updatedAt: '2026-04-29 19:16',
          fileLabel: '2026/04/29/session-management-03.jsonl',
          summary: '把绝对路径、会话 id 和源码定位压缩到安全边界内。',
        },
        {
          id: 'session-gettokens-04',
          title: '详情弹层改成一条消息一行',
          status: 'active',
          messageCount: 6,
          roleSummary: 'system 1 / user 2 / assistant 3',
          updatedAt: '2026-04-29 17:54',
          fileLabel: '2026/04/29/session-management-04.jsonl',
          summary: '弹层主体只保留消息列表，其他内容压缩到顶部摘要区。',
        },
      ],
    },
    {
      id: 'project-nolon',
      name: 'nolon',
      sessionCount: 3,
      activeSessionCount: 2,
      archivedSessionCount: 1,
      lastActiveAt: '2026-04-30 20:12',
      providerSummary: 'codex 2 / gemini 1',
      sessions: [
        {
          id: 'session-nolon-01',
          title: 'rewrite 边界确认',
          status: 'active',
          messageCount: 8,
          roleSummary: 'system 1 / user 3 / assistant 4',
          updatedAt: '2026-04-30 20:12',
          fileLabel: '2026/04/30/nolon-rewrite-01.jsonl',
          summary: '确认 rewrite 是 preview -> rollout -> state db -> verify 的多阶段链路。',
        },
        {
          id: 'session-nolon-02',
          title: 'project/provider 分组漂移',
          status: 'active',
          messageCount: 5,
          roleSummary: 'system 1 / user 2 / assistant 2',
          updatedAt: '2026-04-30 18:42',
          fileLabel: '2026/04/30/nolon-grouping-02.jsonl',
          summary: '对齐 UI grouping 和 CLI rewrite 之间的语义差异。',
        },
        {
          id: 'session-nolon-03',
          title: 'usage index 与 projection cache',
          status: 'archived',
          messageCount: 4,
          roleSummary: 'system 1 / user 1 / assistant 2',
          updatedAt: '2026-04-29 22:08',
          fileLabel: '2026/04/29/nolon-cache-03.jsonl',
          summary: '确认 usage index 与 projection cache 都只是可丢弃加速层。',
        },
      ],
    },
    {
      id: 'project-cliproxyapi',
      name: 'CLIProxyAPI',
      sessionCount: 2,
      activeSessionCount: 1,
      archivedSessionCount: 1,
      lastActiveAt: '2026-04-30 15:27',
      providerSummary: 'codex 1 / gemini 1',
      sessions: [
        {
          id: 'session-cli-01',
          title: 'relay key metadata 独立挂钩',
          status: 'active',
          messageCount: 6,
          roleSummary: 'system 1 / user 2 / assistant 3',
          updatedAt: '2026-04-30 15:27',
          fileLabel: '2026/04/30/relay-key-01.jsonl',
          summary: '把 createdAt / lastUsedAt 放在本地 metadata 文件而不是上游协议。',
        },
        {
          id: 'session-cli-02',
          title: '管理页字段对齐',
          status: 'archived',
          messageCount: 5,
          roleSummary: 'system 1 / user 2 / assistant 2',
          updatedAt: '2026-04-29 16:03',
          fileLabel: '2026/04/29/relay-fields-02.jsonl',
          summary: '梳理 relay service 配置和管理页展示字段的边界。',
        },
      ],
    },
  ],
};

const PREVIEW_DETAILS: Record<string, SessionDetail> = {
  'session-gettokens-01': {
    id: 'session-gettokens-01',
    projectID: 'project-gettokens',
    title: '会话管理第一页接入真实 rollout',
    status: 'active',
    fileLabel: '2026/04/30/session-management-01.jsonl',
    messageCount: 12,
    roleSummary: 'system 1 / user 5 / assistant 6',
    topic: '项目列表 / 项目会话 / 详情弹层',
    currentMessageLabel: '当前消息 12',
    messages: [
      { id: 'm-01', role: 'system', timeLabel: '23:12', title: '系统提示', summary: '保持 GetTokens 当前页面语言，左侧项目列表，右侧项目会话列表。' },
      { id: 'm-02', role: 'user', timeLabel: '23:14', title: '需求确认', summary: '先实现项目列表 + 项目会话列表 + 会话详情弹层。' },
      { id: 'm-03', role: 'assistant', timeLabel: '23:16', title: '范围收口', summary: '第一页先不接 rewrite 执行链，也不进入 provider groups 第二页。' },
      { id: 'm-04', role: 'user', timeLabel: '23:18', title: '设计裁定', summary: '左边是项目列表，右边是项目对应的会话列表。点击会话列表会弹详情页面。' },
      { id: 'm-05', role: 'assistant', timeLabel: '23:20', title: '数据边界', summary: '会话详情不是左右分栏，主体就是消息列表，其他信息都压到顶部。' },
      { id: 'm-06', role: 'user', timeLabel: '23:22', title: '脱敏要求', summary: '你可以从我们的机器里面抽一份对话，然后抹去敏感信息，作为设计稿显示。' },
      { id: 'm-07', role: 'assistant', timeLabel: '23:25', title: '实现策略', summary: 'Wails bridge 扫描本机 sessions 和 archived_sessions，按项目聚合。' },
      { id: 'm-08', role: 'assistant', timeLabel: '23:27', title: '刷新入口', summary: '补 GetCodexSessionManagementSnapshot / RefreshCodexSessionManagementSnapshot / GetCodexSessionDetail。' },
      { id: 'm-09', role: 'assistant', timeLabel: '23:30', title: '前端切换', summary: '移除 mock 数据，改成运行时读取真实 snapshot 与 detail。' },
      { id: 'm-10', role: 'user', timeLabel: '23:34', title: '收口要求', summary: '继续一直推进到完成为止。' },
      { id: 'm-11', role: 'assistant', timeLabel: '23:37', title: '验收结果', summary: '自动化测试、前端构建和 Wails 应用级构建全部通过。' },
      { id: 'm-12', role: 'assistant', timeLabel: '23:41', title: '当前状态', summary: '第一页已接真实 rollout 数据，后续再推进 rewrite 与 provider groups。' },
    ],
  },
};

export function hasSessionManagementPreviewMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const href = window.location?.href;
  if (typeof href !== 'string' || href.length === 0) {
    return false;
  }

  const url = new URL(href);
  return url.searchParams.get('preview') === 'session-management';
}

export function getSessionManagementPreviewDetailID() {
  if (!hasSessionManagementPreviewMode()) {
    return '';
  }

  const href = window.location?.href;
  if (typeof href !== 'string' || href.length === 0) {
    return '';
  }

  const url = new URL(href);
  return url.searchParams.get('detail') ?? '';
}

export async function getSessionManagementPreviewSnapshot() {
  return PREVIEW_SNAPSHOT;
}

export async function getSessionManagementPreviewDetail(sessionID: string) {
  return PREVIEW_DETAILS[sessionID] ?? PREVIEW_DETAILS['session-gettokens-01'];
}
