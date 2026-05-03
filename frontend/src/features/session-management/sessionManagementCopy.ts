import type { ProjectSummary, SessionManagementSnapshot } from './model.ts';
import type { SessionManagementCopy } from './SessionManagementView.tsx';

export const SESSION_MANAGEMENT_EMPTY_VALUE = '—';

export function createSessionManagementCopy(
  locale: 'zh' | 'en',
  t: (key: string) => string,
): SessionManagementCopy {
  const isEnglish = locale === 'en';
  const resolve = (key: string, zhText: string, enText: string) => {
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
    return isEnglish ? enText : zhText;
  };

  return {
    refresh: isEnglish ? 'Refresh' : '刷新',
    refreshing: isEnglish ? 'Refreshing' : '刷新中',
    retry: isEnglish ? 'Retry' : '重试',
    loadFailed: isEnglish ? 'Load failed' : '加载失败',
    loading: isEnglish ? 'Loading' : '加载中',
    unavailable: SESSION_MANAGEMENT_EMPTY_VALUE,
    unknownProvider: isEnglish ? 'Unknown' : '未知',
    sessionsUnit: isEnglish ? 'sessions' : '会话',
    noProjects: isEnglish ? 'No project data yet.' : '当前还没有项目数据。',
    noSessions: isEnglish ? 'No sessions match the current filter.' : '当前筛选下没有会话。',
    noMessages: isEnglish ? 'No message records available.' : '当前会话没有消息记录。',
    projectStatusLine: (project: ProjectSummary) =>
      isEnglish
        ? `Active ${project.activeSessionCount} / Archived ${project.archivedSessionCount}`
        : `活跃 ${project.activeSessionCount} / 归档 ${project.archivedSessionCount}`,
    projectSessionTag: (project: ProjectSummary) =>
      isEnglish ? `${project.sessionCount} sessions` : `${project.sessionCount} 条会话`,
    projectActiveTag: (project: ProjectSummary) =>
      isEnglish ? `Active ${project.activeSessionCount}` : `活跃 ${project.activeSessionCount}`,
    projectArchivedTag: (project: ProjectSummary) =>
      isEnglish ? `Archived ${project.archivedSessionCount}` : `归档 ${project.archivedSessionCount}`,
    projectRecentTag: (project: ProjectSummary) =>
      isEnglish ? `Recent ${project.lastActiveAt}` : `最近 ${project.lastActiveAt}`,
    sessionSubtitleLine: (session: {
      summary: string;
      messageCount: number;
      updatedAt: string;
    }) =>
      isEnglish
        ? `${session.summary || SESSION_MANAGEMENT_EMPTY_VALUE} / ${session.messageCount} messages / ${session.updatedAt}`
        : `${session.summary || SESSION_MANAGEMENT_EMPTY_VALUE} / ${session.messageCount} 条消息 / ${session.updatedAt}`,
    summaryLine: (snapshot: SessionManagementSnapshot['stats']) =>
      isEnglish
        ? `${snapshot.projectCount} projects / ${snapshot.sessionCount} sessions`
        : `${snapshot.projectCount} 个项目 / ${snapshot.sessionCount} 条会话`,
    headerSubtitleLine: (snapshot: SessionManagementSnapshot['stats']) =>
      isEnglish
        ? `${snapshot.projectCount} projects / ${snapshot.sessionCount} sessions / ${snapshot.providerSummary} / ${snapshot.lastScanAt}`
        : `${snapshot.projectCount} 个项目 / ${snapshot.sessionCount} 条会话 / ${snapshot.providerSummary} / ${snapshot.lastScanAt}`,
    scanLine: (value: string) => (isEnglish ? `Last scan / ${value}` : `最近扫描 / ${value}`),
    providerLine: (value: string) => `Provider / ${value}`,
    projectListTitle: resolve('session_management.project_list', '项目列表', 'Projects'),
    projectSessionsTitle: resolve('session_management.project_sessions', '项目会话', 'Sessions'),
    modalTitle: resolve('session_management.modal_title', '会话详情', 'Session Detail'),
    close: resolve('session_management.modal_close', '关闭', 'Close'),
    filterActive: resolve('session_management.filter_active', '活跃', 'Active'),
    filterArchived: resolve('session_management.filter_archived', '已归档', 'Archived'),
    roleSystem: resolve('session_management.message_role_system', '系统', 'System'),
    roleUser: resolve('session_management.message_role_user', '用户', 'User'),
    roleAssistant: resolve('session_management.message_role_assistant', '助手', 'Assistant'),
    roleReasoning: '推理',
    roleToolCall: '工具调用',
    roleToolResult: '工具结果',
    roleEvent: '事件',
    metaMessages: resolve('session_management.session_meta_messages', '消息', 'Messages'),
    metaRoles: resolve('session_management.session_meta_roles', '角色分布', 'Roles'),
    metaUpdated: resolve('session_management.session_meta_updated', '最近更新', 'Updated'),
    metaFile: resolve('session_management.session_meta_file', '文件', 'File'),
    metaProvider: resolve('session_management.project_meta_provider', 'Provider', 'Provider'),
    modalMetaStatus: isEnglish ? 'Status' : '状态',
    modalMetaCurrent: resolve('session_management.modal_summary_current', '当前消息', 'Current'),
    modalMetaTopic: resolve('session_management.modal_summary_topic', '主题', 'Topic'),
  };
}
