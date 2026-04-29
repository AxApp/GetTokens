import type { DebugEntry } from '../context/DebugContext';

export interface DebugEntryViewModel {
  id: string;
  name: string;
  transport: DebugEntry['transport'];
  status: DebugEntry['status'];
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  isExpanded: boolean;
  requestText: string | null;
  responseText: string | null;
}

interface BuildDebugEntryViewModelsOptions {
  expandedIDs: string[];
  formatPayload?: (value: unknown) => string;
}

export function formatDebugPayload(value: unknown) {
  if (value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildDebugEntryViewModels(
  entries: DebugEntry[],
  options: BuildDebugEntryViewModelsOptions,
): DebugEntryViewModel[] {
  const formatPayload = options.formatPayload ?? formatDebugPayload;
  const expandedIDSet = new Set(options.expandedIDs);

  return entries.map((entry) => {
    const isExpanded = expandedIDSet.has(entry.id);

    if (!isExpanded) {
      return {
        id: entry.id,
        name: entry.name,
        transport: entry.transport,
        status: entry.status,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationMs: entry.durationMs,
        isExpanded,
        requestText: null,
        responseText: null,
      };
    }

    return {
      id: entry.id,
      name: entry.name,
      transport: entry.transport,
      status: entry.status,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationMs: entry.durationMs,
      isExpanded,
      requestText: formatPayload(entry.request),
      responseText: entry.status === 'error' ? formatPayload(entry.error) : formatPayload(entry.response),
    };
  });
}
