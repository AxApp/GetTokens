import {
  mapSessionDetailResponse,
  mapSessionManagementSnapshotResponse,
  type SessionDetail,
  type SessionManagementSnapshot,
} from './model.ts';
import {
  getSessionManagementPreviewDetail,
  getSessionManagementPreviewSnapshot,
  hasSessionManagementPreviewMode,
} from './previewData.ts';

interface SessionManagementRuntimeApp {
  GetCodexSessionManagementSnapshot?: () => Promise<unknown>;
  RefreshCodexSessionManagementSnapshot?: () => Promise<unknown>;
  GetCodexSessionDetail?: (sessionID: string) => Promise<unknown>;
  UpdateCodexSessionProviders?: (input: { projectID: string; mappings: Array<{ sourceProvider: string; targetProvider: string }> }) => Promise<unknown>;
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
  const app = globalThis.window?.go?.main?.App;
  const method = app?.[methodName];

  if (typeof method !== 'function') {
    throw new Error(`当前运行时缺少 ${methodName} 绑定。`);
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

async function fetchDevPayload(path: string) {
  const candidates = resolveDevBridgeURLs(path);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeoutID = globalThis.setTimeout(() => controller.abort(), 5000);
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

async function loadDevSnapshot(forceRefresh = false) {
  const path = forceRefresh
    ? '/__dev/session-management/snapshot?refresh=1'
    : '/__dev/session-management/snapshot';
  return fetchDevPayload(path);
}

async function loadDevDetail(sessionID: string) {
  return fetchDevPayload(`/__dev/session-management/detail?sessionID=${encodeURIComponent(sessionID)}`);
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

export async function getCodexSessionManagementSnapshot(): Promise<SessionManagementSnapshot> {
  if (hasSessionManagementPreviewMode()) {
    return getSessionManagementPreviewSnapshot();
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionManagementSnapshotResponse(await loadDevSnapshot(false));
  }

  const getSnapshot = resolveRuntimeMethod('GetCodexSessionManagementSnapshot');
  const raw = await getSnapshot();
  return mapSessionManagementSnapshotResponse(raw);
}

export async function refreshCodexSessionManagementSnapshot(): Promise<SessionManagementSnapshot> {
  if (hasSessionManagementPreviewMode()) {
    return getSessionManagementPreviewSnapshot();
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionManagementSnapshotResponse(await loadDevSnapshot(true));
  }

  const refreshSnapshot = resolveRuntimeMethod('RefreshCodexSessionManagementSnapshot');
  const raw = await refreshSnapshot();
  return mapSessionManagementSnapshotResponse(raw);
}

export async function getCodexSessionDetail(sessionID: string): Promise<SessionDetail> {
  if (hasSessionManagementPreviewMode()) {
    return getSessionManagementPreviewDetail(sessionID);
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionDetailResponse(await loadDevDetail(sessionID));
  }

  const getDetail = resolveRuntimeMethod('GetCodexSessionDetail');
  const raw = await getDetail(sessionID);
  return mapSessionDetailResponse(raw);
}

export async function updateCodexSessionProviders(
  projectID: string,
  mappings: Array<{ sourceProvider: string; targetProvider: string }>,
): Promise<SessionManagementSnapshot> {
  if (hasSessionManagementPreviewMode()) {
    throw new Error('preview 模式不支持修改 provider');
  }
  if (canUseSessionManagementDevHTTP()) {
    return mapSessionManagementSnapshotResponse(await updateDevProviders(projectID, mappings));
  }

  const updateProviders = resolveRuntimeMethod('UpdateCodexSessionProviders');
  const raw = await updateProviders({ projectID, mappings });
  return mapSessionManagementSnapshotResponse(raw);
}
