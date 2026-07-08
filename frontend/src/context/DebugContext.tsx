import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { hasPreviewMode, hasWailsRuntime } from '../utils/previewMode';
import { DebugContext, type DebugEntry, type DebugEventPayload, type TrackRequestOptions } from './DebugContextValue';
import { limitDebugEntries, summarizeDebugPayload } from './debugPayload';

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function DebugProvider({ children }: { children?: ReactNode }) {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const sequenceRef = useRef(0);

  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  const appendExternalEntry = useCallback((payload: DebugEventPayload) => {
    sequenceRef.current += 1;
    const id = payload.id || `${Date.now()}-${sequenceRef.current}`;
    const startedAt = payload.startedAt || new Date().toISOString();

    setEntries((prev) =>
      limitDebugEntries([
        {
          id,
          name: payload.name,
          transport: payload.transport ?? 'http',
          status: payload.status,
          request: summarizeDebugPayload(payload.request),
          response: summarizeDebugPayload(payload.response),
          error: payload.error,
          startedAt,
          endedAt: payload.endedAt,
          durationMs: payload.durationMs,
        },
        ...prev,
      ])
    );
  }, []);

  useEffect(() => {
    if (hasPreviewMode() || !hasWailsRuntime()) {
      return;
    }

    const offDebugEntry = EventsOn('debug:entry', (payload: DebugEventPayload) => {
      appendExternalEntry(payload);
    });

    return () => {
      offDebugEntry?.();
    };
  }, [appendExternalEntry]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return;
    }

    const onInjectEntries = (event: WindowEventMap['debug:inject-entries']) => {
      if (!Array.isArray(event.detail)) {
        return;
      }
      setEntries(event.detail);
    };

    window.addEventListener('debug:inject-entries', onInjectEntries);
    return () => {
      window.removeEventListener('debug:inject-entries', onInjectEntries);
    };
  }, []);

  const trackRequest = useCallback(
    async <T,>(
      name: string,
      request: unknown,
      executor: () => Promise<T>,
      options?: TrackRequestOptions<T>
    ) => {
      sequenceRef.current += 1;
      const id = `${Date.now()}-${sequenceRef.current}`;
      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();

      setEntries((prev) =>
        limitDebugEntries([
          {
            id,
            name,
            transport: options?.transport ?? 'wails',
            status: 'pending',
            request: summarizeDebugPayload(request),
            startedAt,
          },
          ...prev,
        ])
      );

      try {
        const result = await executor();
        const endedAtMs = Date.now();
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  status: 'success',
                  response: summarizeDebugPayload(options?.mapSuccess ? options.mapSuccess(result) : result),
                  endedAt: new Date(endedAtMs).toISOString(),
                  durationMs: endedAtMs - startedAtMs,
                }
              : entry
          )
        );
        return result;
      } catch (error) {
        const endedAtMs = Date.now();
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  status: 'error',
                  error: normalizeError(error),
                  endedAt: new Date(endedAtMs).toISOString(),
                  durationMs: endedAtMs - startedAtMs,
                }
              : entry
          )
        );
        throw error;
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      entries,
      clearEntries,
      trackRequest,
    }),
    [clearEntries, entries, trackRequest]
  );

  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>;
}
