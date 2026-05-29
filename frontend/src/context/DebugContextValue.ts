import { createContext } from 'react';

export interface DebugEntry {
  id: string;
  name: string;
  transport: 'wails' | 'http';
  status: 'pending' | 'success' | 'error';
  request: unknown;
  response?: unknown;
  error?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
}

export interface TrackRequestOptions<T> {
  transport?: 'wails' | 'http';
  mapSuccess?: (result: T) => unknown;
}

export interface DebugEventPayload {
  id?: string;
  name: string;
  transport?: 'wails' | 'http';
  status: 'pending' | 'success' | 'error';
  request: unknown;
  response?: unknown;
  error?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

export interface DebugContextValue {
  entries: DebugEntry[];
  clearEntries: () => void;
  trackRequest: <T>(
    name: string,
    request: unknown,
    executor: () => Promise<T>,
    options?: TrackRequestOptions<T>,
  ) => Promise<T>;
}

export const DebugContext = createContext<DebugContextValue | null>(null);

declare global {
  interface WindowEventMap {
    'debug:inject-entries': CustomEvent<DebugEntry[]>;
  }
}
