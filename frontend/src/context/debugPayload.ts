import type { DebugEntry } from './DebugContextValue';

export const DEBUG_ENTRY_LIMIT = 80;
export const DEBUG_ARRAY_SAMPLE_LIMIT = 0;
export const DEBUG_OBJECT_KEY_LIMIT = 24;
export const DEBUG_STRING_LIMIT = 500;
export const DEBUG_DEPTH_LIMIT = 3;

const REDACTED_VALUE = '[redacted]';
const TRUNCATED_OBJECT_KEY = '__truncatedKeys';

const SENSITIVE_KEY_PATTERN =
  /(api[-_]?key|authorization|bearer|cookie|password|secret|token|access[_-]?token|refresh[_-]?token|contentbase64|rawauthfile|platformcookie)/i;

export function summarizeDebugPayload(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (typeof value === 'string') {
    return summarizeString(value);
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }

  if (Array.isArray(value)) {
    const summary: Record<string, unknown> = {
      type: 'array',
      length: value.length,
    };
    if (DEBUG_ARRAY_SAMPLE_LIMIT > 0 && value.length > 0 && depth < DEBUG_DEPTH_LIMIT) {
      summary.sample = value
        .slice(0, DEBUG_ARRAY_SAMPLE_LIMIT)
        .map((item) => summarizeDebugPayload(item, depth + 1));
    }
    return summary;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: summarizeString(value.message),
    };
  }

  if (depth >= DEBUG_DEPTH_LIMIT) {
    return {
      type: 'object',
      keys: Object.keys(value as Record<string, unknown>).length,
    };
  }

  const source = value as Record<string, unknown>;
  const entries = Object.entries(source);
  const summarized: Record<string, unknown> = {};

  for (const [key, entryValue] of entries.slice(0, DEBUG_OBJECT_KEY_LIMIT)) {
    summarized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED_VALUE
      : summarizeDebugPayload(entryValue, depth + 1);
  }

  if (entries.length > DEBUG_OBJECT_KEY_LIMIT) {
    summarized[TRUNCATED_OBJECT_KEY] = entries.length - DEBUG_OBJECT_KEY_LIMIT;
  }

  return summarized;
}

export function limitDebugEntries(entries: DebugEntry[], limit = DEBUG_ENTRY_LIMIT): DebugEntry[] {
  if (entries.length <= limit) {
    return entries;
  }
  return entries.slice(0, limit);
}

function summarizeString(value: string): string {
  if (value.length <= DEBUG_STRING_LIMIT) {
    return value;
  }
  return `${value.slice(0, DEBUG_STRING_LIMIT)}... [truncated ${value.length - DEBUG_STRING_LIMIT} chars]`;
}
