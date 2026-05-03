export type SessionFilter = 'all' | 'active' | 'archived';
export type SessionStatus = Exclude<SessionFilter, 'all'>;
export type MessageRole =
  | 'system'
  | 'user'
  | 'assistant'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'event';

export interface SessionMessage {
  id: string;
  role: MessageRole;
  timeLabel: string;
  title: string;
  summary: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  messageCount: number;
  roleSummary: string;
  updatedAt: string;
  fileLabel: string;
  summary: string;
  provider: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  sessionCount: number;
  activeSessionCount: number;
  archivedSessionCount: number;
  lastActiveAt: string;
  providerSummary: string;
  sessions: SessionSummary[];
}

export interface SessionManagementStats {
  projectCount: number;
  sessionCount: number;
  activeSessionCount: number;
  archivedSessionCount: number;
  lastScanAt: string;
  providerSummary: string;
}

export interface SessionManagementSnapshot {
  stats: SessionManagementStats;
  projects: ProjectSummary[];
}

export interface SessionDetail {
  id: string;
  projectID: string;
  title: string;
  status: SessionStatus;
  fileLabel: string;
  messageCount: number;
  roleSummary: string;
  topic: string;
  currentMessageLabel: string;
  provider: string;
  messages: SessionMessage[];
}

const EMPTY_VALUE = '—';
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getText(value: unknown, fallback = EMPTY_VALUE) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getOptionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getCount(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getStatus(value: unknown): SessionStatus {
  return value === 'archived' ? 'archived' : 'active';
}

function getMessageRole(value: unknown): MessageRole {
  if (
    value === 'system' ||
    value === 'assistant' ||
    value === 'user' ||
    value === 'reasoning' ||
    value === 'tool_call' ||
    value === 'tool_result' ||
    value === 'event'
  ) {
    return value;
  }

  return 'assistant';
}

function getCountLabel(value: unknown, preferredKey: 'provider' | 'role') {
  if (!isRecord(value)) {
    return '';
  }

  const preferred = getOptionalText(value[preferredKey]);
  if (preferred) {
    return preferred;
  }

  return (
    getOptionalText(value.name) ||
    getOptionalText(value.label) ||
    getOptionalText(value.key)
  );
}

function getCountValue(value: unknown) {
  if (!isRecord(value)) {
    return 0;
  }

  if (typeof value.count === 'number' && Number.isFinite(value.count)) {
    return value.count;
  }

  if (typeof value.value === 'number' && Number.isFinite(value.value)) {
    return value.value;
  }

  return 0;
}

function formatCountSummary(value: unknown, preferredKey: 'provider' | 'role') {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const label = getCountLabel(entry, preferredKey);
        const count = getCountValue(entry);
        return label ? `${label} ${count}` : '';
      })
      .filter(Boolean)
      .join(' / ');
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([label, count]) => `${label} ${getCount(count)}`)
      .join(' / ');
  }

  return '';
}

export function formatProviderSummary(value: unknown) {
  return formatCountSummary(value, 'provider');
}

export function getRoleSummaryLabel(value: unknown) {
  const summary = formatCountSummary(value, 'role');
  return summary || EMPTY_VALUE;
}

function mapSessionSummary(raw: unknown): SessionSummary {
  const source = isRecord(raw) ? raw : {};
  const id = getText(source.id ?? source.sessionID);
  const topic = getOptionalText(source.topic);
  const fileLabel = getText(source.fileLabel);
  const summary =
    getOptionalText(source.summary) ||
    topic ||
    (fileLabel === EMPTY_VALUE ? '' : fileLabel) ||
    EMPTY_VALUE;

  return {
    id,
    title: getOptionalText(source.title),
    status: getStatus(source.status),
    messageCount: getCount(source.messageCount),
    roleSummary: getRoleSummaryLabel(source.roleSummary),
    updatedAt: getText(source.updatedAt ?? source.lastActiveAt),
    fileLabel,
    summary,
    provider: getText(source.provider),
  };
}

function mapSessionMessage(raw: unknown, index: number): SessionMessage {
  const source = isRecord(raw) ? raw : {};
  return {
    id: getText(source.id, `message-${index + 1}`),
    role: getMessageRole(source.role),
    timeLabel: getText(source.timeLabel),
    title: getText(source.title),
    summary: getText(source.summary),
  };
}

function mapProjectSummary(raw: unknown): ProjectSummary {
  const source = isRecord(raw) ? raw : {};
  const sessions = Array.isArray(source.sessions) ? source.sessions.map(mapSessionSummary) : [];
  const activeSessionCount = getCount(
    source.activeSessionCount,
    sessions.filter((session) => session.status === 'active').length,
  );
  const archivedSessionCount = getCount(
    source.archivedSessionCount,
    sessions.filter((session) => session.status === 'archived').length,
  );

  return {
    id: getText(source.id),
    name: getText(source.name),
    sessionCount: getCount(source.sessionCount, sessions.length),
    activeSessionCount,
    archivedSessionCount,
    lastActiveAt: getText(source.lastActiveAt),
    providerSummary:
      getOptionalText(source.providerSummary) ||
      formatProviderSummary(source.providerCounts),
    sessions,
  };
}

export function mapSessionManagementSnapshotResponse(raw: unknown): SessionManagementSnapshot {
  const source = isRecord(raw) ? raw : {};
  const projects = Array.isArray(source.projects) ? source.projects.map(mapProjectSummary) : [];
  const derivedSessionCount = projects.reduce((sum, project) => sum + project.sessionCount, 0);
  const derivedActiveCount = projects.reduce((sum, project) => sum + project.activeSessionCount, 0);
  const derivedArchivedCount = projects.reduce((sum, project) => sum + project.archivedSessionCount, 0);

  return {
    stats: {
      projectCount: getCount(source.projectCount, projects.length),
      sessionCount: getCount(source.sessionCount, derivedSessionCount),
      activeSessionCount: getCount(source.activeSessionCount, derivedActiveCount),
      archivedSessionCount: getCount(source.archivedSessionCount, derivedArchivedCount),
      lastScanAt: getText(source.lastScanAt),
      providerSummary: formatProviderSummary(source.providerCounts) || EMPTY_VALUE,
    },
    projects,
  };
}

export function mapSessionDetailResponse(raw: unknown): SessionDetail {
  const source = isRecord(raw) ? raw : {};
  const messages = Array.isArray(source.messages)
    ? source.messages.map((message, index) => mapSessionMessage(message, index))
    : [];

  return {
    id: getText(source.sessionID ?? source.id),
    projectID: getText(source.projectID),
    title: getText(source.title),
    status: getStatus(source.status),
    fileLabel: getText(source.fileLabel),
    messageCount: getCount(source.messageCount, messages.length),
    roleSummary: getRoleSummaryLabel(source.roleSummary),
    topic: getText(source.topic),
    currentMessageLabel: getText(source.currentMessageLabel),
    provider: getText(source.provider),
    messages,
  };
}
