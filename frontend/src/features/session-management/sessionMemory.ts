import type { SessionMessage } from './model.ts';

export const SESSION_DETAIL_MAX_RETAINED_MESSAGES = 300;
export const SESSION_DETAIL_RAW_JSON_CACHE_LIMIT = 20;

export function appendBoundedSessionMessages(
  existing: readonly SessionMessage[],
  incoming: readonly SessionMessage[],
  maxMessages = SESSION_DETAIL_MAX_RETAINED_MESSAGES,
): SessionMessage[] {
  const safeMax = Math.max(1, Math.floor(maxMessages));
  const incomingIDs = new Set(incoming.map((message) => message.id));
  const merged = [
    ...existing.filter((message) => !incomingIDs.has(message.id)),
    ...incoming,
  ];

  if (merged.length <= safeMax) {
    return merged;
  }
  return merged.slice(merged.length - safeMax);
}

export function putBoundedRawJSON(
  cache: Readonly<Record<string, string>>,
  messageID: string,
  rawJSON: string,
  maxEntries = SESSION_DETAIL_RAW_JSON_CACHE_LIMIT,
): Record<string, string> {
  const safeMax = Math.max(1, Math.floor(maxEntries));
  const entries = Object.entries(cache).filter(([id]) => id !== messageID);
  entries.push([messageID, rawJSON]);
  return Object.fromEntries(entries.slice(Math.max(0, entries.length - safeMax)));
}
