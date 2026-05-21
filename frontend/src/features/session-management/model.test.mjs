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
  getSessionDetail,
  getSessionManagementSnapshot,
  refreshCodexSessionManagementSnapshot,
  refreshSessionManagementSnapshot,
  updateCodexSessionProviders,
} from './api.ts';
import {
  formatSessionMetadataDate,
  SESSIONS_PANEL_COMPACT_META_MAX_WIDTH,
  SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH,
  shouldUseCompactSessionMetadata,
  shouldUseSessionsPanelActionMenu,
} from './sessionManagementUtils.ts';

function createProviderMergeSnapshotFixture() {
  return {
    stats: {
      projectCount: 1,
      sessionCount: 1,
      activeSessionCount: 1,
      archivedSessionCount: 0,
      lastScanAt: '2026-04-30 23:40',
      providerSummary: 'gemini 1',
    },
    projects: [
      {
        id: 'gettokens',
        name: 'GetTokens',
        sessionCount: 1,
        activeSessionCount: 1,
        archivedSessionCount: 0,
        lastActiveAt: '2026-04-30 23:40',
        providerSummary: 'gemini 1',
        sessions: [
          {
            id: 'sessions/2026/04/30/rollout-2026-04-30T23-40-00-gemini.jsonl',
            title: '归并 provider',
            status: 'active',
            messageCount: 3,
            roleSummary: 'user 1 / assistant 1',
            updatedAt: '2026-04-30 23:40',
            fileLabel: 'rollout-2026-04-30T23-40-00-gemini.jsonl',
            summary: '准备归并 provider',
            provider: 'gemini',
          },
        ],
      },
    ],
  };
}

test('sessions panel switches actions into a menu only when panel width is constrained', () => {
  assert.equal(shouldUseSessionsPanelActionMenu(SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH - 1), true);
  assert.equal(shouldUseSessionsPanelActionMenu(SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH), true);
  assert.equal(shouldUseSessionsPanelActionMenu(SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH + 1), false);
  assert.equal(shouldUseSessionsPanelActionMenu(0), false);
});

test('sessions panel uses compact metadata only when row width is constrained', () => {
  assert.equal(shouldUseCompactSessionMetadata(SESSIONS_PANEL_COMPACT_META_MAX_WIDTH - 1), true);
  assert.equal(shouldUseCompactSessionMetadata(SESSIONS_PANEL_COMPACT_META_MAX_WIDTH), true);
  assert.equal(shouldUseCompactSessionMetadata(SESSIONS_PANEL_COMPACT_META_MAX_WIDTH + 1), false);
  assert.equal(shouldUseCompactSessionMetadata(0), false);
});

test('formatSessionMetadataDate keeps current year compact and older years explicit', () => {
  const now = new Date(2026, 4, 15);

  assert.equal(formatSessionMetadataDate('2026-04-30 23:41', now), '04/30');
  assert.equal(formatSessionMetadataDate('2025-12-09 08:10', now), '2025/12/09');
  assert.equal(formatSessionMetadataDate('2026/5/7', now), '05/07');
  assert.equal(formatSessionMetadataDate('unknown', now), 'unknown');
});

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
            provider: 'openai',
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
  assert.equal(snapshot.projects[0].sessions[0].provider, 'openai');
});

test('mapSessionDetailResponse keeps message ordering and fallback labels stable', () => {
  const detail = mapSessionDetailResponse({
    sessionID: 'session-1',
    projectID: 'project-a',
    title: 'Session A',
    status: 'archived',
    fileLabel: 'session-a.jsonl',
    messageCount: 2,
    provider: 'gemini',
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
  assert.equal(detail.provider, 'gemini');
  assert.equal(detail.messages[1].summary, 'world');
});

test('mapSessionDetailResponse accepts extended message roles', () => {
  const detail = mapSessionDetailResponse({
    sessionID: 'session-2',
    projectID: 'project-b',
    title: 'Session B',
    status: 'active',
    fileLabel: 'session-b.jsonl',
    messageCount: 3,
    roleSummary: '用户 1 / 工具调用 1 / 工具结果 1',
    currentMessageLabel: '03 / 工具结果',
    messages: [
      { id: 'm-1', role: 'user', timeLabel: '11:00', title: 'ask', summary: 'show all' },
      { id: 'm-2', role: 'tool_call', timeLabel: '11:01', title: 'call', summary: 'exec_command / pwd' },
      { id: 'm-3', role: 'tool_result', timeLabel: '11:02', title: 'result', summary: '/tmp/workspace' },
    ],
  });

  assert.equal(detail.messages[1].role, 'tool_call');
  assert.equal(detail.messages[2].role, 'tool_result');
});

test('getCodexSessionManagementSnapshot throws a clear error when bridge is missing', async () => {
  globalThis.window = {};

  await assert.rejects(
    () => getCodexSessionManagementSnapshot(),
    /GetCodexSessionManagementSnapshot/,
  );
});

test('claude session management uses Claude Code runtime bindings', async () => {
  const calls = [];
  globalThis.window = {
    go: {
      main: {
        App: {
          async GetClaudeCodeSessionManagementSnapshot() {
            calls.push('snapshot');
            return {
              projectCount: 1,
              sessionCount: 1,
              activeSessionCount: 1,
              archivedSessionCount: 0,
              lastScanAt: '2026-05-21 17:00',
              providerCounts: { claude: 1 },
              projects: [
                {
                  id: 'gettokens',
                  name: 'GetTokens',
                  sessionCount: 1,
                  activeSessionCount: 1,
                  archivedSessionCount: 0,
                  lastActiveAt: '2026-05-21 17:00',
                  providerCounts: { claude: 1 },
                  providerSummary: 'claude 1',
                  sessions: [],
                },
              ],
            };
          },
          async RefreshClaudeCodeSessionManagementSnapshot() {
            calls.push('refresh');
            return {
              projectCount: 1,
              sessionCount: 2,
              activeSessionCount: 2,
              archivedSessionCount: 0,
              lastScanAt: '2026-05-21 17:01',
              providerCounts: { claude: 2 },
              projects: [],
            };
          },
          async GetClaudeCodeSessionDetail(sessionID) {
            calls.push(`detail:${sessionID}`);
            return {
              sessionID,
              projectID: 'gettokens',
              title: 'Claude Code Session',
              status: 'active',
              fileLabel: 'claude-session.jsonl',
              messageCount: 1,
              provider: 'claude',
              roleSummary: '用户 1',
              topic: 'claude resume',
              currentMessageLabel: '01 / 用户',
              messages: [{ id: 'm-1', role: 'user', timeLabel: '17:00', title: 'ask', summary: '继续' }],
            };
          },
        },
      },
    },
  };

  const snapshot = await getSessionManagementSnapshot('claude');
  assert.equal(snapshot.stats.providerSummary, 'claude 1');
  assert.equal(snapshot.projects[0].providerSummary, 'claude 1');

  const refreshed = await refreshSessionManagementSnapshot('claude');
  assert.equal(refreshed.stats.sessionCount, 2);

  const detail = await getSessionDetail('claude', 'claude-session');
  assert.equal(detail.provider, 'claude');
  assert.equal(detail.messages[0].summary, '继续');
  assert.deepEqual(calls, ['snapshot', 'refresh', 'detail:claude-session']);
});

test('claude session management reports missing Claude bindings clearly', async () => {
  globalThis.window = {};

  await assert.rejects(
    () => getSessionManagementSnapshot('claude'),
    /GetClaudeCodeSessionManagementSnapshot/,
  );
  await assert.rejects(
    () => refreshSessionManagementSnapshot('claude'),
    /RefreshClaudeCodeSessionManagementSnapshot/,
  );
  await assert.rejects(
    () => getSessionDetail('claude', 'missing-session'),
    /GetClaudeCodeSessionDetail/,
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
    if (String(url).includes('127.0.0.1:5173/__dev/session-management/snapshot')) {
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
    if (String(url).includes('127.0.0.1:5173/__dev/session-management/detail')) {
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
            provider: 'openai',
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
  assert.equal(detail.provider, 'openai');
  assert.equal(fetchCalls[0], 'http://127.0.0.1:5173/__dev/session-management/snapshot');

  globalThis.fetch = originalFetch;
});

test('localhost dev mode posts provider merge to http bridge', async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.window = {
    location: {
      href: 'http://127.0.0.1:34115/#frame=session-management',
    },
  };
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).includes('127.0.0.1:5173/__dev/session-management/provider-merge')) {
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
                providerSummary: 'openai 1',
                sessions: [],
              },
            ],
          };
        },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const snapshot = await updateCodexSessionProviders('gettokens', [
    { sourceProvider: 'gemini', targetProvider: 'openai' },
  ], createProviderMergeSnapshotFixture());

  assert.equal(snapshot.projects[0].providerSummary, 'openai 1');
  assert.equal(fetchCalls[0].url, 'http://127.0.0.1:5173/__dev/session-management/provider-merge');
  assert.equal(fetchCalls[0].options.method, 'POST');
  assert.equal(fetchCalls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(
    fetchCalls[0].options.body,
    JSON.stringify({
      projectID: 'gettokens',
      mappings: [{ sourceProvider: 'gemini', targetProvider: 'openai' }],
    }),
  );

  globalThis.fetch = originalFetch;
});

test('localhost desktop mode prefers runtime bridge when Wails bindings exist', async () => {
  const originalFetch = globalThis.fetch;
  let runtimeCalled = false;
  globalThis.window = {
    location: {
      href: 'http://127.0.0.1:34115/#frame=session-management',
    },
    go: {
      main: {
        App: {
          async GetCodexSessionManagementSnapshot() {
            runtimeCalled = true;
            return { projects: [] };
          },
        },
      },
    },
  };
  globalThis.fetch = async (url) => {
    throw new Error(`runtime bridge should skip dev fetch ${url}`);
  };

  const snapshot = await getCodexSessionManagementSnapshot();
  assert.equal(snapshot.projects.length, 0);
  assert.equal(runtimeCalled, true);

  globalThis.fetch = originalFetch;
});

test('localhost desktop mode posts provider merge through runtime bridge when Wails binding exists', async () => {
  const originalFetch = globalThis.fetch;
  let runtimeInput = null;
  globalThis.window = {
    location: {
      href: 'http://127.0.0.1:34115/#frame=session-management',
    },
    go: {
      main: {
        App: {
          async UpdateCodexSessionProviders(input) {
            runtimeInput = input;
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
                  providerSummary: 'openai 1',
                  sessions: [],
                },
              ],
            };
          },
        },
      },
    },
  };
  globalThis.fetch = async (url) => {
    throw new Error(`runtime bridge should skip dev fetch ${url}`);
  };

  const snapshot = await updateCodexSessionProviders('gettokens', [
    { sourceProvider: 'gemini', targetProvider: 'openai' },
  ], createProviderMergeSnapshotFixture());

  assert.equal(snapshot.projects[0].providerSummary, 'openai 1');
  assert.deepEqual(runtimeInput, {
    projectID: 'gettokens',
    mappings: [{ sourceProvider: 'gemini', targetProvider: 'openai' }],
    snapshot: {
      projectCount: 1,
      sessionCount: 1,
      activeSessionCount: 1,
      archivedSessionCount: 0,
      lastScanAt: '2026-04-30 23:40',
      providerCounts: { gemini: 1 },
      projects: [
        {
          id: 'gettokens',
          name: 'GetTokens',
          providerCounts: { gemini: 1 },
          sessionCount: 1,
          activeSessionCount: 1,
          archivedSessionCount: 0,
          lastActiveAt: '2026-04-30 23:40',
          providerSummary: 'gemini 1',
          sessions: [
            {
              id: 'sessions/2026/04/30/rollout-2026-04-30T23-40-00-gemini.jsonl',
              sessionID: 'sessions/2026/04/30/rollout-2026-04-30T23-40-00-gemini.jsonl',
              projectID: 'gettokens',
              projectName: 'GetTokens',
              title: '归并 provider',
              status: 'active',
              archived: false,
              messageCount: 3,
              roleSummary: 'user 1 / assistant 1',
              updatedAt: '2026-04-30 23:40',
              fileLabel: 'rollout-2026-04-30T23-40-00-gemini.jsonl',
              summary: '准备归并 provider',
              provider: 'gemini',
            },
          ],
        },
      ],
    },
  });

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
              provider: 'openai',
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
  assert.equal(detail.provider, 'openai');
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
