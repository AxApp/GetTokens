import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  SESSION_DETAIL_MAX_RETAINED_MESSAGES,
  SESSION_DETAIL_RAW_JSON_CACHE_LIMIT,
  appendBoundedSessionMessages,
  putBoundedRawJSON,
} from './sessionMemory.ts';

function createMessage(id) {
  return {
    id: `message-${id}`,
    role: id % 2 === 0 ? 'assistant' : 'user',
    content: `content-${id}`,
    summary: '',
    timeLabel: '12:00',
  };
}

test('appendBoundedSessionMessages keeps only the newest retained window', () => {
  const existing = Array.from({ length: SESSION_DETAIL_MAX_RETAINED_MESSAGES - 10 }, (_, index) => createMessage(index));
  const incoming = Array.from({ length: 25 }, (_, index) => createMessage(1000 + index));

  const retained = appendBoundedSessionMessages(existing, incoming);

  assert.equal(retained.length, SESSION_DETAIL_MAX_RETAINED_MESSAGES);
  assert.equal(retained[0].id, existing[15].id);
  assert.equal(retained.at(-1)?.id, incoming.at(-1)?.id);
});

test('appendBoundedSessionMessages removes duplicate message ids before applying the cap', () => {
  const existing = [createMessage(1), createMessage(2), createMessage(3)];
  const incoming = [{ ...createMessage(2), content: 'newer-content-2' }, createMessage(4)];

  const retained = appendBoundedSessionMessages(existing, incoming, 10);

  assert.deepEqual(retained.map((message) => message.id), ['message-1', 'message-3', 'message-2', 'message-4']);
  assert.equal(retained[2].content, 'newer-content-2');
});

test('putBoundedRawJSON evicts oldest raw JSON entries', () => {
  let cache = {};
  for (let index = 0; index < SESSION_DETAIL_RAW_JSON_CACHE_LIMIT + 3; index += 1) {
    cache = putBoundedRawJSON(cache, `message-${index}`, `{"index":${index}}`);
  }

  assert.equal(Object.keys(cache).length, SESSION_DETAIL_RAW_JSON_CACHE_LIMIT);
  assert.equal(cache['message-0'], undefined);
  assert.equal(cache['message-1'], undefined);
  assert.equal(cache['message-2'], undefined);
  assert.equal(cache[`message-${SESSION_DETAIL_RAW_JSON_CACHE_LIMIT + 2}`], `{"index":${SESSION_DETAIL_RAW_JSON_CACHE_LIMIT + 2}}`);
});

test('useSessionManagementDetail routes message and raw-json retention through bounded helpers', async () => {
  const source = await readFile(new URL('./useSessionManagementDetail.ts', import.meta.url), 'utf8');

  assert.match(source, /appendBoundedSessionMessages\(\[\], page\.messages\)/);
  assert.match(source, /appendBoundedSessionMessages\(previous\.detail\.messages, page\.messages\)/);
  assert.match(source, /putBoundedRawJSON\(previous\.rawJSONByMessageID, message\.id, result\.rawJSON\)/);
  assert.doesNotMatch(source, /messages:\s*\[\.\.\.previous\.detail\.messages,\s*\.\.\.page\.messages\]/);
});
