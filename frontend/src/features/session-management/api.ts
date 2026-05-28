import {
  mapSessionAnalysisResultResponse,
  mapSessionDetailResponse,
  mapSessionMessageRawJSONResponse,
  mapSessionMessagePageResponse,
  mapSessionManagementSnapshotResponse,
  type AnalyzeCodexSessionsInput,
  type SessionDetail,
  type SessionMessagePage,
  type SessionMessagePageInput,
  type SessionMessageRawJSON,
  type SessionAnalysisResult,
  type SessionManagementSnapshot,
} from './model.ts';
import {
  getSessionManagementPreviewDetail,
  getSessionManagementPreviewSnapshot,
  hasSessionManagementPreviewMode,
} from './previewData.ts';
import type { SessionManagementWorkspace } from '../../types';

interface SessionManagementRuntimeApp {
  AnalyzeCodexSessions?: (input: AnalyzeCodexSessionsInput) => Promise<unknown>;
  GetCodexSessionManagementSnapshot?: () => Promise<unknown>;
  RefreshCodexSessionManagementSnapshot?: () => Promise<unknown>;
  GetCodexSessionDetail?: (sessionID: string) => Promise<unknown>;
  GetCodexSessionMessagePage?: (sessionID: string, input: SessionMessagePageInput) => Promise<unknown>;
  GetCodexSessionMessageRawJSON?: (sessionID: string, input: { lineNumber: number }) => Promise<unknown>;
  GetClaudeCodeSessionManagementSnapshot?: () => Promise<unknown>;
  RefreshClaudeCodeSessionManagementSnapshot?: () => Promise<unknown>;
  GetClaudeCodeSessionDetail?: (sessionID: string) => Promise<unknown>;
  GetClaudeCodeSessionMessagePage?: (sessionID: string, input: SessionMessagePageInput) => Promise<unknown>;
  GetClaudeCodeSessionMessageRawJSON?: (sessionID: string, input: { lineNumber: number }) => Promise<unknown>;
  UpdateCodexSessionProviders?: (input: {
    projectID: string;
    mappings: Array<{ sourceProvider: string; targetProvider: string }>;
    snapshot?: RuntimeSessionManagementSnapshot;
  }) => Promise<unknown>;
}

interface RuntimeSessionManagementSnapshot {
  projectCount: number;
  sessionCount: number;
  activeSessionCount: number;
  archivedSessionCount: number;
  lastScanAt: string;
  providerCounts: Record<string, number>;
  projects: Array<{
    id: string;
    name: string;
    providerCounts: Record<string, number>;
    sessionCount: number;
    activeSessionCount: number;
    archivedSessionCount: number;
    lastActiveAt: string;
    providerSummary: string;
    sessions: Array<{
      id: string;
      sessionID: string;
      projectID: string;
      projectName: string;
      title: string;
      status: string;
      archived: boolean;
      messageCount: number;
      roleSummary: string;
      updatedAt: string;
      fileLabel: string;
      summary: string;
      provider: string;
    }>;
  }>;
}

declare global {
  interface Window {
    go?: {
      main?: {
        App?: SessionManagementRuntimeApp;
      };
    };
  }
}

function resolveRuntimeMethod<T extends keyof SessionManagementRuntimeApp>(methodName: T) {
  const method = getRuntimeMethod(methodName);

  if (!method) {
    throw new Error(`当前运行时缺少 ${methodName} 绑定。`);
  }

  return method;
}

function getRuntimeMethod<T extends keyof SessionManagementRuntimeApp>(methodName: T) {
  const app = globalThis.window?.go?.main?.App;
  const method = app?.[methodName];

  if (typeof method !== 'function') {
    return null;
  }

  return method.bind(app) as NonNullable<SessionManagementRuntimeApp[T]>;
}

function canUseSessionManagementDevHTTP() {
  if (typeof window === 'undefined') {
    return false;
  }

  const href = window.location?.href;
  if (typeof href !== 'string' || href.length === 0) {
    return false;
  }

  const url = new URL(href);
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function resolveDevBridgeURLs(path: string) {
  if (typeof window === 'undefined') {
    return [path];
  }

  const url = new URL(window.location.href);
  const devPorts = ['5173', '4173', '5174', '4174'];
  const urls = new Set<string>();
  if (devPorts.includes(url.port)) {
    urls.add(new URL(path, url.origin).toString());
  }

  for (const port of devPorts) {
    if (url.port === port) {
      continue;
    }
    urls.add(new URL(path, `${url.protocol}//127.0.0.1:${port}`).toString());
    urls.add(new URL(path, `${url.protocol}//localhost:${port}`).toString());
  }

  return Array.from(urls);
}

async function fetchDevPayload(path: string, timeoutMs = 5000) {
  const candidates = resolveDevBridgeURLs(path);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeoutID = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(candidate, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `session management dev bridge failed: ${response.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      globalThis.clearTimeout(timeoutID);
    }
  }

  throw lastError ?? new Error('session management dev bridge unavailable');
}

async function loadDevSnapshot(workspace: SessionManagementWorkspace, forceRefresh = false) {
  const query = new URLSearchParams();
  if (workspace !== 'codex') {
    query.set('workspace', workspace);
  }
  if (forceRefresh) {
    query.set('refresh', '1');
  }
  const suffix = query.toString();
  const path = suffix
    ? `/__dev/session-management/snapshot?${suffix}`
    : '/__dev/session-management/snapshot';
  return fetchDevPayload(path);
}

async function loadDevDetail(workspace: SessionManagementWorkspace, sessionID: string) {
  const query = new URLSearchParams({ sessionID });
  if (workspace !== 'codex') {
    query.set('workspace', workspace);
  }
  return fetchDevPayload(`/__dev/session-management/detail?${query.toString()}`);
}

async function loadDevMessagePage(workspace: SessionManagementWorkspace, sessionID: string, input: SessionMessagePageInput) {
  const detail = mapSessionDetailResponse(await loadDevDetail(workspace, sessionID));
  const offset = Math.max(0, Math.floor(input.offset || 0));
  const limit = Math.max(1, Math.floor(input.limit || 50));
  const messages = detail.messages.slice(offset, offset + limit).map((message, index) => ({
    ...message,
    lineNumber: message.lineNumber || offset + index + 1,
  }));
  return {
    sessionID: detail.id,
    offset,
    limit,
    messageCount: detail.messageCount,
    nextOffset: offset + messages.length,
    hasMore: offset + messages.length < detail.messageCount,
    messages,
  };
}

async function loadDevRawJSON(workspace: SessionManagementWorkspace, sessionID: string, lineNumber: number) {
  return {
    sessionID,
    lineNumber,
    rawJSON: JSON.stringify({
      preview: true,
      workspace,
      sessionID,
      lineNumber,
    }, null, 2),
  };
}

async function loadLegacyDevSnapshot(forceRefresh = false) {
  const path = forceRefresh
    ? '/__dev/session-management/snapshot?refresh=1'
    : '/__dev/session-management/snapshot';
  return fetchDevPayload(path);
}

async function updateDevProviders(projectID: string, mappings: Array<{ sourceProvider: string; targetProvider: string }>) {
  const candidates = resolveDevBridgeURLs('/__dev/session-management/provider-merge');
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeoutID = globalThis.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(candidate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectID, mappings }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `session management provider merge failed: ${response.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      globalThis.clearTimeout(timeoutID);
    }
  }

  throw lastError ?? new Error('session management provider merge unavailable');
}

async function analyzeDevSessions(input: AnalyzeCodexSessionsInput) {
  const query = new URLSearchParams();
  query.set('scope', input.scope);
  if (input.projectID) {
    query.set('projectID', input.projectID);
  }
  if (input.limit) {
    query.set('limit', String(input.limit));
  }
  if (input.sessionIDs?.length) {
    query.set('sessionIDs', input.sessionIDs.join(','));
  }
  return fetchDevPayload(`/__dev/session-management/analysis?${query.toString()}`, 300000);
}

function addProviderCount(counts: Record<string, number>, provider: string) {
  const key = provider.trim();
  if (!key || key === '—') {
    return;
  }
  counts[key] = (counts[key] ?? 0) + 1;
}

function toRuntimeSessionManagementSnapshot(
  snapshot?: SessionManagementSnapshot,
): RuntimeSessionManagementSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  const providerCounts: Record<string, number> = {};
  const projects = snapshot.projects.map((project) => {
    const projectProviderCounts: Record<string, number> = {};
    const sessions = project.sessions.map((session) => {
      addProviderCount(providerCounts, session.provider);
      addProviderCount(projectProviderCounts, session.provider);
      return {
        id: session.id,
        sessionID: session.id,
        projectID: project.id,
        projectName: project.name,
        title: session.title,
        status: session.status,
        archived: session.status === 'archived',
        messageCount: session.messageCount,
        roleSummary: session.roleSummary,
        updatedAt: session.updatedAt,
        fileLabel: session.fileLabel,
        summary: session.summary,
        provider: session.provider,
      };
    });

    return {
      id: project.id,
      name: project.name,
      providerCounts: projectProviderCounts,
      sessionCount: project.sessionCount,
      activeSessionCount: project.activeSessionCount,
      archivedSessionCount: project.archivedSessionCount,
      lastActiveAt: project.lastActiveAt,
      providerSummary: project.providerSummary,
      sessions,
    };
  });

  return {
    projectCount: snapshot.stats.projectCount,
    sessionCount: snapshot.stats.sessionCount,
    activeSessionCount: snapshot.stats.activeSessionCount,
    archivedSessionCount: snapshot.stats.archivedSessionCount,
    lastScanAt: snapshot.stats.lastScanAt,
    providerCounts,
    projects,
  };
}

export async function getCodexSessionManagementSnapshot(): Promise<SessionManagementSnapshot> {
  return getSessionManagementSnapshot('codex');
}

export async function refreshCodexSessionManagementSnapshot(): Promise<SessionManagementSnapshot> {
  return refreshSessionManagementSnapshot('codex');
}

export async function getCodexSessionDetail(sessionID: string): Promise<SessionDetail> {
  return getSessionDetail('codex', sessionID);
}

export async function getSessionMessagePage(
  workspace: SessionManagementWorkspace,
  sessionID: string,
  input: SessionMessagePageInput,
): Promise<SessionMessagePage> {
  if (hasSessionManagementPreviewMode()) {
    const detail = await getSessionManagementPreviewDetail(sessionID);
    const offset = Math.max(0, Math.floor(input.offset || 0));
    const limit = Math.max(1, Math.floor(input.limit || 50));
    const messages = detail.messages.slice(offset, offset + limit).map((message, index) => ({
      ...message,
      lineNumber: message.lineNumber || offset + index + 1,
    }));
    return {
      sessionID: detail.id,
      offset,
      limit,
      messageCount: detail.messageCount,
      nextOffset: offset + messages.length,
      hasMore: offset + messages.length < detail.messageCount,
      messages,
    };
  }

  if (workspace === 'claude') {
    const getPage = getRuntimeMethod('GetClaudeCodeSessionMessagePage');
    if (getPage) {
      return mapSessionMessagePageResponse(await getPage(sessionID, input));
    }
    if (canUseSessionManagementDevHTTP()) {
      return loadDevMessagePage(workspace, sessionID, input);
    }
    const missingPage = resolveRuntimeMethod('GetClaudeCodeSessionMessagePage');
    return mapSessionMessagePageResponse(await missingPage(sessionID, input));
  }

  const getPage = getRuntimeMethod('GetCodexSessionMessagePage');
  if (getPage) {
    return mapSessionMessagePageResponse(await getPage(sessionID, input));
  }
  if (canUseSessionManagementDevHTTP()) {
    return loadDevMessagePage('codex', sessionID, input);
  }
  const missingPage = resolveRuntimeMethod('GetCodexSessionMessagePage');
  return mapSessionMessagePageResponse(await missingPage(sessionID, input));
}

export async function getSessionMessageRawJSON(
  workspace: SessionManagementWorkspace,
  sessionID: string,
  lineNumber: number,
): Promise<SessionMessageRawJSON> {
  if (!Number.isFinite(lineNumber) || lineNumber <= 0) {
    throw new Error('缺少有效的消息行号');
  }

  if (hasSessionManagementPreviewMode()) {
    return loadDevRawJSON(workspace, sessionID, lineNumber);
  }

  const input = { lineNumber };
  if (workspace === 'claude') {
    const getRawJSON = getRuntimeMethod('GetClaudeCodeSessionMessageRawJSON');
    if (getRawJSON) {
      return mapSessionMessageRawJSONResponse(await getRawJSON(sessionID, input));
    }
    if (canUseSessionManagementDevHTTP()) {
      return loadDevRawJSON(workspace, sessionID, lineNumber);
    }
    const missingRawJSON = resolveRuntimeMethod('GetClaudeCodeSessionMessageRawJSON');
    return mapSessionMessageRawJSONResponse(await missingRawJSON(sessionID, input));
  }

  const getRawJSON = getRuntimeMethod('GetCodexSessionMessageRawJSON');
  if (getRawJSON) {
    return mapSessionMessageRawJSONResponse(await getRawJSON(sessionID, input));
  }
  if (canUseSessionManagementDevHTTP()) {
    return loadDevRawJSON('codex', sessionID, lineNumber);
  }
  const missingRawJSON = resolveRuntimeMethod('GetCodexSessionMessageRawJSON');
  return mapSessionMessageRawJSONResponse(await missingRawJSON(sessionID, input));
}

export async function analyzeCodexSessions(input: AnalyzeCodexSessionsInput): Promise<SessionAnalysisResult> {
  if (hasSessionManagementPreviewMode()) {
    throw new Error('preview 模式不支持批量分析');
  }
  const analyze = getRuntimeMethod('AnalyzeCodexSessions');
  if (analyze) {
    const raw = await analyze(input);
    return mapSessionAnalysisResultResponse(raw);
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionAnalysisResultResponse(await analyzeDevSessions(input));
  }

  const missingAnalyze = resolveRuntimeMethod('AnalyzeCodexSessions');
  const raw = await missingAnalyze(input);
  return mapSessionAnalysisResultResponse(raw);
}

export async function getSessionManagementSnapshot(
  workspace: SessionManagementWorkspace,
): Promise<SessionManagementSnapshot> {
  if (hasSessionManagementPreviewMode()) {
    return getSessionManagementPreviewSnapshot();
  }
  if (workspace === 'claude') {
    const getSnapshot = getRuntimeMethod('GetClaudeCodeSessionManagementSnapshot');
    if (getSnapshot) {
      const raw = await getSnapshot();
      return mapSessionManagementSnapshotResponse(raw);
    }
    if (canUseSessionManagementDevHTTP()) {
      return mapSessionManagementSnapshotResponse(await loadDevSnapshot(workspace, false));
    }

    const missingSnapshot = resolveRuntimeMethod('GetClaudeCodeSessionManagementSnapshot');
    const raw = await missingSnapshot();
    return mapSessionManagementSnapshotResponse(raw);
  }

  const getSnapshot = getRuntimeMethod('GetCodexSessionManagementSnapshot');
  if (getSnapshot) {
    const raw = await getSnapshot();
    return mapSessionManagementSnapshotResponse(raw);
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionManagementSnapshotResponse(await loadLegacyDevSnapshot(false));
  }

  const missingSnapshot = resolveRuntimeMethod('GetCodexSessionManagementSnapshot');
  const raw = await missingSnapshot();
  return mapSessionManagementSnapshotResponse(raw);
}

export async function refreshSessionManagementSnapshot(
  workspace: SessionManagementWorkspace,
): Promise<SessionManagementSnapshot> {
  if (hasSessionManagementPreviewMode()) {
    return getSessionManagementPreviewSnapshot();
  }
  if (workspace === 'claude') {
    const refreshSnapshot = getRuntimeMethod('RefreshClaudeCodeSessionManagementSnapshot');
    if (refreshSnapshot) {
      const raw = await refreshSnapshot();
      return mapSessionManagementSnapshotResponse(raw);
    }
    if (canUseSessionManagementDevHTTP()) {
      return mapSessionManagementSnapshotResponse(await loadDevSnapshot(workspace, true));
    }

    const missingRefreshSnapshot = resolveRuntimeMethod('RefreshClaudeCodeSessionManagementSnapshot');
    const raw = await missingRefreshSnapshot();
    return mapSessionManagementSnapshotResponse(raw);
  }

  const refreshSnapshot = getRuntimeMethod('RefreshCodexSessionManagementSnapshot');
  if (refreshSnapshot) {
    const raw = await refreshSnapshot();
    return mapSessionManagementSnapshotResponse(raw);
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionManagementSnapshotResponse(await loadLegacyDevSnapshot(true));
  }

  const missingRefreshSnapshot = resolveRuntimeMethod('RefreshCodexSessionManagementSnapshot');
  const raw = await missingRefreshSnapshot();
  return mapSessionManagementSnapshotResponse(raw);
}

export async function getSessionDetail(
  workspace: SessionManagementWorkspace,
  sessionID: string,
): Promise<SessionDetail> {
  if (hasSessionManagementPreviewMode()) {
    return getSessionManagementPreviewDetail(sessionID);
  }
  if (workspace === 'claude') {
    const getDetail = getRuntimeMethod('GetClaudeCodeSessionDetail');
    if (getDetail) {
      const raw = await getDetail(sessionID);
      return mapSessionDetailResponse(raw);
    }
    if (canUseSessionManagementDevHTTP()) {
      return mapSessionDetailResponse(await loadDevDetail(workspace, sessionID));
    }

    const missingDetail = resolveRuntimeMethod('GetClaudeCodeSessionDetail');
    const raw = await missingDetail(sessionID);
    return mapSessionDetailResponse(raw);
  }

  const getDetail = getRuntimeMethod('GetCodexSessionDetail');
  if (getDetail) {
    const raw = await getDetail(sessionID);
    return mapSessionDetailResponse(raw);
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionDetailResponse(await loadDevDetail('codex', sessionID));
  }

  const missingDetail = resolveRuntimeMethod('GetCodexSessionDetail');
  const raw = await missingDetail(sessionID);
  return mapSessionDetailResponse(raw);
}

export async function updateCodexSessionProviders(
  projectID: string,
  mappings: Array<{ sourceProvider: string; targetProvider: string }>,
  snapshot?: SessionManagementSnapshot,
): Promise<SessionManagementSnapshot> {
  if (hasSessionManagementPreviewMode()) {
    throw new Error('preview 模式不支持修改 provider');
  }
  const updateProviders = getRuntimeMethod('UpdateCodexSessionProviders');
  const runtimeSnapshot = toRuntimeSessionManagementSnapshot(snapshot);
  if (updateProviders) {
    const raw = await updateProviders({ projectID, mappings, snapshot: runtimeSnapshot });
    return mapSessionManagementSnapshotResponse(raw);
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionManagementSnapshotResponse(await updateDevProviders(projectID, mappings));
  }

  const missingUpdateProviders = resolveRuntimeMethod('UpdateCodexSessionProviders');
  const raw = await missingUpdateProviders({ projectID, mappings, snapshot: runtimeSnapshot });
  return mapSessionManagementSnapshotResponse(raw);
}
