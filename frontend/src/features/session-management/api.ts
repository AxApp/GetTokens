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
import { hasWailsRuntime } from '../../utils/previewMode.ts';

interface SessionManagementRuntimeApp {
  GetCodexSessionManagementSnapshot?: () => Promise<unknown>;
  RefreshCodexSessionManagementSnapshot?: () => Promise<unknown>;
  GetCodexSessionDetail?: (sessionID: string) => Promise<unknown>;
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
  if (typeof window === 'undefined' || hasWailsRuntime()) {
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
  const urls = new Set<string>();
  urls.add(new URL(path, url.origin).toString());

  for (const port of ['5173', '4173', '5174', '4174']) {
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
    try {
      const response = await fetch(candidate);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `session management dev bridge failed: ${response.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
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
