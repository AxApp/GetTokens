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
  lineNumber?: number;
  role: MessageRole;
  timeLabel: string;
  title: string;
  summary: string;
  content?: string;
  truncated?: boolean;
}

export interface SessionMessageRawJSON {
  sessionID: string;
  lineNumber: number;
  rawJSON: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  displayTitle?: string;
  titleSource?: string;
  titleConfidence?: string;
  status: SessionStatus;
  messageCount: number;
  roleSummary: string;
  updatedAt: string;
  fileLabel: string;
  summary: string;
  primaryIntent?: string;
  lastOutcome?: string;
  hasInstructionPreamble?: boolean;
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
  displayTitle?: string;
  titleSource?: string;
  titleConfidence?: string;
  status: SessionStatus;
  fileLabel: string;
  messageCount: number;
  roleSummary: string;
  topic: string;
  primaryIntent?: string;
  lastOutcome?: string;
  hasInstructionPreamble?: boolean;
  currentMessageLabel: string;
  provider: string;
  messages: SessionMessage[];
}

export interface SessionMessagePageInput {
  offset: number;
  limit: number;
}

export interface SessionMessagePage {
  sessionID: string;
  offset: number;
  limit: number;
  messageCount: number;
  nextOffset: number;
  hasMore: boolean;
  messages: SessionMessage[];
}

export interface AnalyzeCodexSessionsInput {
  scope: 'all' | 'project' | 'selected';
  projectID?: string;
  sessionIDs?: string[];
  limit?: number;
}

export type SessionAnalysisPluginMode = 'all' | 'project' | 'recent';

export interface SessionAnalysisPluginRequest {
  mode: SessionAnalysisPluginMode;
  projectID?: string;
  sessionIDs?: string[];
  recentLimit?: number;
}

export interface SessionAnalysisKeyword {
  term: string;
  count: number;
  sessionCount: number;
  score: number;
}

export interface SessionAnalysisWordCloudItem {
  term: string;
  count: number;
  sessionCount: number;
  weight: number;
}

export interface SessionAnalysisCommonPhrase {
  text: string;
  count: number;
  sessionCount: number;
  score: number;
}

export interface SessionAnalysisRoleContribution {
  role: string;
  messageCount: number;
  termCount: number;
  share: number;
}

export interface SessionAnalysisProjectSummary {
  projectID: string;
  projectName: string;
  sessionCount: number;
  messageCount: number;
  termCount: number;
  keywords: SessionAnalysisKeyword[];
}

export interface SessionAnalysisSessionSummary {
  sessionID: string;
  projectID: string;
  projectName: string;
  title: string;
  status: SessionStatus;
  provider: string;
  model: string;
  messageCount: number;
  termCount: number;
  topicLine: string;
  keywords: SessionAnalysisKeyword[];
  commonPhrases: SessionAnalysisCommonPhrase[];
  roleContributions: SessionAnalysisRoleContribution[];
}

export interface SessionAnalysisResult {
  scope: string;
  generatedAt: string;
  requestedSessionCount: number;
  analyzedSessionCount: number;
  skippedSessionCount: number;
  totalMessages: number;
  totalTerms: number;
  keywords: SessionAnalysisKeyword[];
  wordCloud: SessionAnalysisWordCloudItem[];
  commonPhrases: SessionAnalysisCommonPhrase[];
  roleContributions: SessionAnalysisRoleContribution[];
  projects: SessionAnalysisProjectSummary[];
  sessions: SessionAnalysisSessionSummary[];
}

export function filterSessionManagementProjects(
  projects: readonly ProjectSummary[],
  query: string,
): ProjectSummary[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...projects];
  }
  return projects.filter((project) => {
    if (normalizeSearchText(project.name).includes(normalizedQuery)) {
      return true;
    }
    return project.sessions.some((session) => sessionMatchesQuery(session, normalizedQuery));
  });
}

export function filterSessionManagementSessions(
  project: ProjectSummary,
  query: string,
  sessions: readonly SessionSummary[] = project.sessions,
): SessionSummary[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...sessions];
  }
  if (normalizeSearchText(project.name).includes(normalizedQuery)) {
    return [...sessions];
  }
  return sessions.filter((session) => sessionMatchesQuery(session, normalizedQuery));
}

export function buildSessionAnalysisInput(request: SessionAnalysisPluginRequest): AnalyzeCodexSessionsInput {
  if (request.mode === 'project') {
    return {
      scope: 'project',
      projectID: getOptionalText(request.projectID),
    };
  }

  if (request.mode === 'recent') {
    const recentLimit = Number.isFinite(request.recentLimit) && (request.recentLimit ?? 0) > 0
      ? Math.floor(request.recentLimit ?? 0)
      : 20;
    const sessionIDs = Array.from(
      new Set(
        (request.sessionIDs || [])
          .map((sessionID) => getOptionalText(sessionID))
          .filter(Boolean),
      ),
    ).slice(0, recentLimit);
    return {
      scope: 'selected',
      sessionIDs,
    };
  }

  return {
    scope: 'all',
  };
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
  const title = getOptionalText(source.title);
  const displayTitle =
    getOptionalText(source.displayTitle) ||
    title ||
    topic ||
    (fileLabel === EMPTY_VALUE ? '' : fileLabel) ||
    EMPTY_VALUE;
  const summary =
    getOptionalText(source.summary) ||
    topic ||
    (fileLabel === EMPTY_VALUE ? '' : fileLabel) ||
    EMPTY_VALUE;

  return {
    id,
    title,
    displayTitle,
    titleSource: getOptionalText(source.titleSource),
    titleConfidence: getOptionalText(source.titleConfidence),
    status: getStatus(source.status),
    messageCount: getCount(source.messageCount),
    roleSummary: getRoleSummaryLabel(source.roleSummary),
    updatedAt: getText(source.updatedAt ?? source.lastActiveAt),
    fileLabel,
    summary,
    primaryIntent: getOptionalText(source.primaryIntent),
    lastOutcome: getOptionalText(source.lastOutcome),
    hasInstructionPreamble: source.hasInstructionPreamble === true,
    provider: getText(source.provider),
  };
}

function mapSessionMessage(raw: unknown, index: number): SessionMessage {
  const source = isRecord(raw) ? raw : {};
  return {
    id: getText(source.id, `message-${index + 1}`),
    lineNumber: getCount(source.lineNumber),
    role: getMessageRole(source.role),
    timeLabel: getText(source.timeLabel),
    title: getText(source.title),
    summary: getText(source.summary),
    content: getOptionalText(source.content),
    truncated: source.truncated === true,
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

function sessionMatchesQuery(session: SessionSummary, normalizedQuery: string): boolean {
  return [
    session.id,
    session.title,
    session.displayTitle,
    session.fileLabel,
    session.summary,
    session.primaryIntent,
    session.lastOutcome,
    session.titleSource,
    session.provider,
    session.roleSummary,
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
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
  const title = getText(source.title);
  const displayTitle = getOptionalText(source.displayTitle) || title;

  return {
    id: getText(source.sessionID ?? source.id),
    projectID: getText(source.projectID),
    title,
    displayTitle,
    titleSource: getOptionalText(source.titleSource),
    titleConfidence: getOptionalText(source.titleConfidence),
    status: getStatus(source.status),
    fileLabel: getText(source.fileLabel),
    messageCount: getCount(source.messageCount, messages.length),
    roleSummary: getRoleSummaryLabel(source.roleSummary),
    topic: getText(source.topic),
    primaryIntent: getOptionalText(source.primaryIntent),
    lastOutcome: getOptionalText(source.lastOutcome),
    hasInstructionPreamble: source.hasInstructionPreamble === true,
    currentMessageLabel: getText(source.currentMessageLabel),
    provider: getText(source.provider),
    messages,
  };
}

export function mapSessionMessagePageResponse(raw: unknown): SessionMessagePage {
  const source = isRecord(raw) ? raw : {};
  const messages = Array.isArray(source.messages)
    ? source.messages.map((message, index) => mapSessionMessage(message, index))
    : [];
  const offset = getCount(source.offset);
  return {
    sessionID: getText(source.sessionID ?? source.id, ''),
    offset,
    limit: getCount(source.limit, messages.length),
    messageCount: getCount(source.messageCount, messages.length),
    nextOffset: getCount(source.nextOffset, offset + messages.length),
    hasMore: source.hasMore === true,
    messages,
  };
}

export function mapSessionMessageRawJSONResponse(raw: unknown): SessionMessageRawJSON {
  const source = isRecord(raw) ? raw : {};
  return {
    sessionID: getText(source.sessionID ?? source.id, ''),
    lineNumber: getCount(source.lineNumber),
    rawJSON: getOptionalText(source.rawJSON),
  };
}

function mapSessionAnalysisKeyword(raw: unknown): SessionAnalysisKeyword {
  const source = isRecord(raw) ? raw : {};
  return {
    term: getText(source.term, ''),
    count: getCount(source.count),
    sessionCount: getCount(source.sessionCount),
    score: typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : 0,
  };
}

function mapSessionAnalysisWordCloudItem(raw: unknown): SessionAnalysisWordCloudItem {
  const source = isRecord(raw) ? raw : {};
  return {
    term: getText(source.term, ''),
    count: getCount(source.count),
    sessionCount: getCount(source.sessionCount),
    weight: typeof source.weight === 'number' && Number.isFinite(source.weight) ? source.weight : 0,
  };
}

function mapSessionAnalysisCommonPhrase(raw: unknown): SessionAnalysisCommonPhrase {
  const source = isRecord(raw) ? raw : {};
  return {
    text: getText(source.text, ''),
    count: getCount(source.count),
    sessionCount: getCount(source.sessionCount),
    score: typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : 0,
  };
}

function mapSessionAnalysisRoleContribution(raw: unknown): SessionAnalysisRoleContribution {
  const source = isRecord(raw) ? raw : {};
  return {
    role: getText(source.role, ''),
    messageCount: getCount(source.messageCount),
    termCount: getCount(source.termCount),
    share: typeof source.share === 'number' && Number.isFinite(source.share) ? source.share : 0,
  };
}

function mapSessionAnalysisProject(raw: unknown): SessionAnalysisProjectSummary {
  const source = isRecord(raw) ? raw : {};
  return {
    projectID: getText(source.projectID, ''),
    projectName: getText(source.projectName),
    sessionCount: getCount(source.sessionCount),
    messageCount: getCount(source.messageCount),
    termCount: getCount(source.termCount),
    keywords: Array.isArray(source.keywords) ? source.keywords.map(mapSessionAnalysisKeyword) : [],
  };
}

function mapSessionAnalysisSession(raw: unknown): SessionAnalysisSessionSummary {
  const source = isRecord(raw) ? raw : {};
  return {
    sessionID: getText(source.sessionID, ''),
    projectID: getText(source.projectID, ''),
    projectName: getText(source.projectName),
    title: getText(source.title),
    status: getStatus(source.status),
    provider: getText(source.provider),
    model: getOptionalText(source.model),
    messageCount: getCount(source.messageCount),
    termCount: getCount(source.termCount),
    topicLine: getText(source.topicLine),
    keywords: Array.isArray(source.keywords) ? source.keywords.map(mapSessionAnalysisKeyword) : [],
    commonPhrases: Array.isArray(source.commonPhrases)
      ? source.commonPhrases.map(mapSessionAnalysisCommonPhrase)
      : [],
    roleContributions: Array.isArray(source.roleContributions)
      ? source.roleContributions.map(mapSessionAnalysisRoleContribution)
      : [],
  };
}

export function mapSessionAnalysisResultResponse(raw: unknown): SessionAnalysisResult {
  const source = isRecord(raw) ? raw : {};
  return {
    scope: getText(source.scope, 'all'),
    generatedAt: getText(source.generatedAt),
    requestedSessionCount: getCount(source.requestedSessionCount),
    analyzedSessionCount: getCount(source.analyzedSessionCount),
    skippedSessionCount: getCount(source.skippedSessionCount),
    totalMessages: getCount(source.totalMessages),
    totalTerms: getCount(source.totalTerms),
    keywords: Array.isArray(source.keywords) ? source.keywords.map(mapSessionAnalysisKeyword) : [],
    wordCloud: Array.isArray(source.wordCloud) ? source.wordCloud.map(mapSessionAnalysisWordCloudItem) : [],
    commonPhrases: Array.isArray(source.commonPhrases)
      ? source.commonPhrases.map(mapSessionAnalysisCommonPhrase)
      : [],
    roleContributions: Array.isArray(source.roleContributions)
      ? source.roleContributions.map(mapSessionAnalysisRoleContribution)
      : [],
    projects: Array.isArray(source.projects) ? source.projects.map(mapSessionAnalysisProject) : [],
    sessions: Array.isArray(source.sessions) ? source.sessions.map(mapSessionAnalysisSession) : [],
  };
}
