import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatProviderSummary,
  getRoleSummaryLabel,
  mapSessionDetailResponse,
  mapSessionManagementSnapshotResponse,
} from './model.ts';
import {
  getCodexSessionDetail,
  getCodexSessionManagementSnapshot,
  refreshCodexSessionManagementSnapshot,
} from './api.ts';

test('mapSessionManagementSnapshotResponse builds provider summary and does not invent rewrite metrics', () => {
  const snapshot = mapSessionManagementSnapshotResponse({
    projectCount: 1,
    sessionCount: 3,
    activeSessionCount: 2,
    archivedSessionCount: 1,
    lastScanAt: '2026-04-30 11:22',
    providerCounts: {
      codex: 2,
      gemini: 1,
    },
    projects: [
      {
        id: 'project-a',
        name: 'project-a',
        sessionCount: 3,
        activeSessionCount: 2,
        archivedSessionCount: 1,
        lastActiveAt: '2026-04-30 11:20',
        sessions: [
          {
            id: 'session-1',
            title: 'session-1',
            status: 'active',
            messageCount: 4,
            roleSummary: {
              user: 1,
              assistant: 2,
              system: 1,
            },
            updatedAt: '2026-04-30 11:20',
            fileLabel: 'session-1.jsonl',
            summary: 'summary-1',
          },
        ],
      },
    ],
  });

  assert.equal(snapshot.stats.providerSummary, 'codex 2 / gemini 1');
  assert.equal(snapshot.projects[0].providerSummary, '');
  assert.equal(Object.hasOwn(snapshot.projects[0], 'rewriteSummary'), false);
  assert.equal(snapshot.projects[0].sessions[0].roleSummary, 'user 1 / assistant 2 / system 1');
});

test('mapSessionDetailResponse keeps message ordering and fallback labels stable', () => {
  const detail = mapSessionDetailResponse({
    sessionID: 'session-1',
    projectID: 'project-a',
    title: 'Session A',
    status: 'archived',
    fileLabel: 'session-a.jsonl',
    messageCount: 2,
    roleSummary: {
      user: 1,
      assistant: 1,
    },
    topic: 'quota',
    currentMessageLabel: '02 / assistant',
    messages: [
      { id: 'm-1', role: 'user', timeLabel: '11:00', title: 'ask', summary: 'hello' },
      { id: 'm-2', role: 'assistant', timeLabel: '11:01', title: 'reply', summary: 'world' },
    ],
  });

  assert.equal(detail.id, 'session-1');
  assert.equal(detail.status, 'archived');
  assert.equal(detail.roleSummary, 'user 1 / assistant 1');
  assert.equal(detail.messages[1].summary, 'world');
});

test('getCodexSessionManagementSnapshot throws a clear error when bridge is missing', async () => {
  globalThis.window = {};

  await assert.rejects(
    () => getCodexSessionManagementSnapshot(),
    /GetCodexSessionManagementSnapshot/,
  );
});

test('browser preview mode returns preview snapshot and detail without Wails bridge', async () => {
  globalThis.window = {
    location: {
      href: 'http://127.0.0.1:4173/?preview=session-management#frame=session-management',
    },
  };

  const snapshot = await getCodexSessionManagementSnapshot();
  assert.equal(snapshot.stats.projectCount, 3);
  assert.equal(snapshot.projects[0].name, 'GetTokens');

  const refreshed = await refreshCodexSessionManagementSnapshot();
  assert.equal(refreshed.stats.sessionCount, 9);

  const detail = await getCodexSessionDetail('session-gettokens-01');
  assert.equal(detail.id, 'session-gettokens-01');
  assert.equal(detail.messages[0].role, 'system');
  assert.match(detail.messages.at(-1).summary, /真实 rollout 数据/);
});

test('localhost dev mode falls back to http bridge when Wails runtime is missing', async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.window = {
    location: {
      href: 'http://127.0.0.1:34115/#frame=session-management',
    },
  };
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    if (String(url) === 'http://127.0.0.1:34115/__dev/session-management/snapshot') {
      throw new Error('bridge missing on current origin');
    }
    if (String(url) === 'http://127.0.0.1:34115/__dev/session-management/detail?sessionID=sessions%2F2026%2F04%2F30%2Frollout.jsonl') {
      throw new Error('bridge missing on current origin');
    }
    if (String(url).includes('127.0.0.1:4173/__dev/session-management/snapshot')) {
      return {
        ok: true,
        async json() {
          return {
            projectCount: 1,
            sessionCount: 1,
            activeSessionCount: 1,
            archivedSessionCount: 0,
            lastScanAt: '2026-04-30 23:41',
            providerCounts: { openai: 1 },
            projects: [
              {
                id: 'gettokens',
                name: 'GetTokens',
                sessionCount: 1,
                activeSessionCount: 1,
                archivedSessionCount: 0,
                lastActiveAt: '2026-04-30 23:41',
                providerCounts: { openai: 1 },
                sessions: [],
              },
            ],
          };
        },
      };
    }
    if (String(url).includes('127.0.0.1:4173/__dev/session-management/detail')) {
      return {
        ok: true,
        async json() {
          return {
            sessionID: 'sessions/2026/04/30/rollout.jsonl',
            projectID: 'gettokens',
            title: '真实开发态详情',
            status: 'active',
            fileLabel: 'sessions/2026/04/30/rollout.jsonl',
            messageCount: 1,
            roleSummary: '用户 1 / 助手 0 / 系统 0',
            topic: '开发态直连',
            currentMessageLabel: '01 / 用户',
            messages: [{ id: 'm-1', role: 'user', timeLabel: '23:41', title: 'ask', summary: '真实开发态详情' }],
          };
        },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const snapshot = await getCodexSessionManagementSnapshot();
  assert.equal(snapshot.projects[0].name, 'GetTokens');

  const detail = await getCodexSessionDetail('sessions/2026/04/30/rollout.jsonl');
  assert.equal(detail.title, '真实开发态详情');
  assert.deepEqual(fetchCalls.slice(0, 2), [
    'http://127.0.0.1:34115/__dev/session-management/snapshot',
    'http://127.0.0.1:4173/__dev/session-management/snapshot',
  ]);

  globalThis.fetch = originalFetch;
});

test('getCodexSessionDetail maps runtime bridge payloads', async () => {
  globalThis.window = {
    go: {
      main: {
        App: {
          async GetCodexSessionManagementSnapshot() {
            return {
              projects: [],
            };
          },
          async RefreshCodexSessionManagementSnapshot() {
            return {
              projectCount: 1,
              sessionCount: 2,
              projects: [],
            };
          },
          async GetCodexSessionDetail(sessionID) {
            return {
              sessionID,
              projectID: 'project-a',
              title: 'Session A',
              status: 'active',
              fileLabel: 'session-a.jsonl',
              messageCount: 1,
              roleSummary: 'user 1',
              topic: 'topic-a',
              currentMessageLabel: '01 / user',
              messages: [{ id: 'm-1', role: 'user', timeLabel: '11:00', title: 'ask', summary: 'hello' }],
            };
          },
        },
      },
    },
  };

  const detail = await getCodexSessionDetail('session-a');

  assert.equal(detail.id, 'session-a');
  assert.equal(detail.messages.length, 1);

  const refreshed = await refreshCodexSessionManagementSnapshot();
  assert.equal(refreshed.stats.projectCount, 1);
  assert.equal(refreshed.stats.sessionCount, 2);
});

test('summary helpers accept arrays and objects', () => {
  assert.equal(
    formatProviderSummary([
      { provider: 'codex', count: 3 },
      { provider: 'gemini', count: 2 },
    ]),
    'codex 3 / gemini 2',
  );
  assert.equal(getRoleSummaryLabel({ assistant: 2, user: 1 }), 'assistant 2 / user 1');
});
