import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_PAGE_STORAGE_KEY,
  ACCOUNT_WORKSPACE_STORAGE_KEY,
  CLAUDE_WORKSPACE_STORAGE_KEY,
  CODEX_WORKSPACE_STORAGE_KEY,
  CODEX_LIVE_SESSIONS_VIEW_STORAGE_KEY,
  USAGE_DESK_WORKSPACE_STORAGE_KEY,
  SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY,
  USAGE_DESK_SOURCE_STORAGE_KEY,
  USAGE_DESK_RANGE_STORAGE_KEY,
  buildAccountDetailFrameHash,
  buildAccountDetailScriptFrameHash,
  buildCodexDetailFrameHash,
  buildCodexSkillDetailFrameHash,
  buildCodexModalFrameHash,
  buildClaudeDetailFrameHash,
  buildClaudeModalFrameHash,
  buildFrameHash,
  clearAccountDetailFrameHash,
  clearAccountDetailScriptFrameHash,
  clearCodexDetailFrameHash,
  clearCodexSkillDetailFrameHash,
  clearCodexModalFrameHash,
  clearClaudeDetailFrameHash,
  clearClaudeModalFrameHash,
  isAccountDetailScriptRoute,
  isAccountWorkspace,
  isDeveloperAppPage,
  isAppPage,
  isClaudeWorkspace,
  isCodexWorkspace,
  isCodexLiveSessionsView,
  isLegacyClaudeCodexWorkspace,
  isSessionManagementWorkspace,
  isUsageDeskRangeStorageValue,
  isUsageDeskSourceStorageValue,
  isUsageDeskWorkspace,
  persistAccountWorkspace,
  persistActivePage,
  persistClaudeWorkspace,
  persistCodexWorkspace,
  persistCodexLiveSessionsView,
  persistSessionManagementWorkspace,
  persistUsageDeskRange,
  persistUsageDeskSource,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredAccountWorkspace,
  readStoredActivePage,
  readStoredClaudeWorkspace,
  readStoredCodexWorkspace,
  readStoredCodexLiveSessionsView,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskRange,
  readStoredUsageDeskSource,
  readStoredUsageDeskWorkspace,
  resolveInitialAccountWorkspace,
  resolveInitialActivePage,
  resolveInitialClaudeWorkspace,
  resolveInitialCodexWorkspace,
  resolveInitialCodexLiveSessionsView,
  resolveInitialSessionManagementWorkspace,
  resolveInitialUsageDeskRange,
  resolveInitialUsageDeskSource,
  resolveInitialUsageDeskWorkspace,
} from './pagePersistence.ts';

test('isAppPage only accepts known sidebar pages', () => {
  assert.equal(isAppPage('status'), true);
  assert.equal(isAppPage('accounts'), true);
  assert.equal(isAppPage('request-orchestration'), false);
  assert.equal(isAppPage('session-management'), true);
  assert.equal(isAppPage('vendor-status'), true);
  assert.equal(isAppPage('proxy-pool'), false);
  assert.equal(isAppPage('codex'), true);
  assert.equal(isAppPage('claude'), true);
  assert.equal(isAppPage('usage-desk'), true);
  assert.equal(isAppPage('settings'), true);
  assert.equal(isAppPage('design-system'), false);
  assert.equal(isAppPage('debug'), true);
  assert.equal(isAppPage('unknown'), false);
  assert.equal(isAppPage(null), false);
});

test('developer pages are rejected when developer tools are disabled', () => {
  const productionOptions = { includeDeveloperPages: false };

  assert.equal(isDeveloperAppPage('design-system'), false);
  assert.equal(isDeveloperAppPage('debug'), true);
  assert.equal(isAppPage('accounts', productionOptions), true);
  assert.equal(isAppPage('design-system', productionOptions), false);
  assert.equal(isAppPage('debug', productionOptions), false);
});

test('resolveInitialActivePage falls back to accounts for invalid values', () => {
  assert.equal(resolveInitialActivePage('settings'), 'settings');
  assert.equal(resolveInitialActivePage('design-system'), 'accounts');
  assert.equal(resolveInitialActivePage('session-management'), 'codex');
  assert.equal(resolveInitialActivePage('vendor-status'), 'codex');
  assert.equal(resolveInitialActivePage('proxy-pool'), 'accounts');
  assert.equal(resolveInitialActivePage('request-orchestration'), 'accounts');
  assert.equal(resolveInitialActivePage('codex'), 'codex');
  assert.equal(resolveInitialActivePage('claude'), 'claude');
  assert.equal(resolveInitialActivePage('unknown'), 'accounts');
  assert.equal(resolveInitialActivePage(null), 'accounts');
});

test('resolveInitialActivePage falls back from developer pages in production', () => {
  const productionOptions = { includeDeveloperPages: false };

  assert.equal(resolveInitialActivePage('design-system', 'accounts', productionOptions), 'accounts');
  assert.equal(resolveInitialActivePage('debug', 'accounts', productionOptions), 'accounts');
  assert.equal(resolveInitialActivePage('settings', 'accounts', productionOptions), 'settings');
});

test('readStoredActivePage restores the last valid page from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACTIVE_PAGE_STORAGE_KEY);
      return 'session-management';
    },
  };

  assert.equal(readStoredActivePage(storage), 'codex');
});

test('readStoredActivePage falls back when storage is unavailable or invalid', () => {
  assert.equal(readStoredActivePage(null), 'accounts');
  assert.equal(
    readStoredActivePage({
      getItem() {
        return 'invalid-page';
      },
    }),
    'accounts',
  );
});

test('readStoredActivePage ignores persisted developer pages in production', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACTIVE_PAGE_STORAGE_KEY);
      return 'debug';
    },
  };

  assert.equal(readStoredActivePage(storage, { includeDeveloperPages: false }), 'accounts');
});

test('persistActivePage writes the selected page to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistActivePage(storage, 'session-management');

  assert.deepEqual(writes, [[ACTIVE_PAGE_STORAGE_KEY, 'session-management']]);
});

test('isAccountWorkspace only accepts all', () => {
  assert.equal(isAccountWorkspace('all'), true);
  assert.equal(isAccountWorkspace('codex'), false);
  assert.equal(isAccountWorkspace('openai-compatible'), false);
  assert.equal(isAccountWorkspace('unknown'), false);
  assert.equal(isAccountWorkspace(null), false);
});

test('isAccountDetailScriptRoute only accepts quota and billing editor routes', () => {
  assert.equal(isAccountDetailScriptRoute('quota'), true);
  assert.equal(isAccountDetailScriptRoute('billing'), true);
  assert.equal(isAccountDetailScriptRoute('rate-limit'), false);
  assert.equal(isAccountDetailScriptRoute(null), false);
});

test('resolveInitialAccountWorkspace falls back to all for non-all values', () => {
  assert.equal(resolveInitialAccountWorkspace('all'), 'all');
  assert.equal(resolveInitialAccountWorkspace('openai-compatible'), 'all');
  assert.equal(resolveInitialAccountWorkspace('codex'), 'all');
  assert.equal(resolveInitialAccountWorkspace('unknown'), 'all');
  assert.equal(resolveInitialAccountWorkspace(null), 'all');
});

test('readStoredAccountWorkspace restores all for legacy stored values', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNT_WORKSPACE_STORAGE_KEY);
      return 'openai-compatible';
    },
  };

  assert.equal(readStoredAccountWorkspace(storage), 'all');
});

test('persistAccountWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistAccountWorkspace(storage, 'all');

  assert.deepEqual(writes, [[ACCOUNT_WORKSPACE_STORAGE_KEY, 'all']]);
});


test('codex live sessions view accepts only session and project dimensions', () => {
  assert.equal(isCodexLiveSessionsView('session'), true);
  assert.equal(isCodexLiveSessionsView('project'), true);
  assert.equal(isCodexLiveSessionsView('projects'), false);
  assert.equal(isCodexLiveSessionsView('unknown'), false);
  assert.equal(resolveInitialCodexLiveSessionsView('project'), 'project');
  assert.equal(resolveInitialCodexLiveSessionsView('unknown'), 'session');

  const storage = {
    getItem(key) {
      assert.equal(key, CODEX_LIVE_SESSIONS_VIEW_STORAGE_KEY);
      return 'project';
    },
  };
  assert.equal(readStoredCodexLiveSessionsView(storage), 'project');

  const writes = [];
  persistCodexLiveSessionsView({
    setItem(key, value) {
      writes.push([key, value]);
    },
  }, 'project');
  assert.deepEqual(writes, [[CODEX_LIVE_SESSIONS_VIEW_STORAGE_KEY, 'project']]);
});

test('codex live sessions hash preserves project dimension view', () => {
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=live-sessions&view=project'), {
    page: 'codex',
    codexWorkspace: 'live-sessions',
    codexLiveSessionsView: 'project',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=live-sessions&view=invalid'), {
    page: 'codex',
    codexWorkspace: 'live-sessions',
    codexLiveSessionsView: 'session',
  });
  assert.equal(
    buildFrameHash('codex', 'all', 'live-sessions', 'codex', 'codex', null, { codexLiveSessionsView: 'project' }),
    '#frame=codex&workspace=live-sessions&view=project',
  );
});

test('isCodexWorkspace only accepts known codex subpages', () => {
  assert.equal(isCodexWorkspace('feature-config'), true);
  assert.equal(isCodexWorkspace('binary-management'), true);
  assert.equal(isCodexWorkspace('skills'), true);
  assert.equal(isCodexWorkspace('mcp-servers'), true);
  assert.equal(isCodexWorkspace('account-list'), true);
  assert.equal(isCodexWorkspace('claude-account-list'), false);
  assert.equal(isCodexWorkspace('session-management'), true);
  assert.equal(isCodexWorkspace('vendor-status'), true);
  assert.equal(isCodexWorkspace('usage-codex'), true);
  assert.equal(isCodexWorkspace('usage-gemini'), false);
  assert.equal(isCodexWorkspace('unknown'), false);
  assert.equal(isCodexWorkspace(null), false);
});

test('resolveInitialCodexWorkspace falls back to feature config for invalid values', () => {
  assert.equal(resolveInitialCodexWorkspace('feature-config'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace('binary-management'), 'binary-management');
  assert.equal(resolveInitialCodexWorkspace('extension-registry'), 'extension-registry');
  assert.equal(resolveInitialCodexWorkspace('skills'), 'skills');
  assert.equal(resolveInitialCodexWorkspace('mcp-servers'), 'mcp-servers');
  assert.equal(resolveInitialCodexWorkspace('account-list'), 'account-list');
  assert.equal(resolveInitialCodexWorkspace('claude-account-list'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace('session-management'), 'session-management');
  assert.equal(resolveInitialCodexWorkspace('vendor-status'), 'vendor-status');
  assert.equal(resolveInitialCodexWorkspace('usage-codex'), 'usage-codex');
  assert.equal(resolveInitialCodexWorkspace('usage-gemini'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace('unknown'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace(null), 'feature-config');
});

test('readStoredCodexWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, CODEX_WORKSPACE_STORAGE_KEY);
      return 'feature-config';
    },
  };

  assert.equal(readStoredCodexWorkspace(storage), 'feature-config');
});

test('persistCodexWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistCodexWorkspace(storage, 'feature-config');

  assert.deepEqual(writes, [[CODEX_WORKSPACE_STORAGE_KEY, 'feature-config']]);
});

test('extension registry codex workspace persists and round-trips through hash parsing', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, CODEX_WORKSPACE_STORAGE_KEY);
      return 'extension-registry';
    },
  };

  assert.equal(isCodexWorkspace('extension-registry'), true);
  assert.equal(readStoredCodexWorkspace(storage), 'extension-registry');
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=extension-registry'), {
    page: 'codex',
    codexWorkspace: 'extension-registry',
  });
  assert.equal(
    buildFrameHash('codex', 'all', 'extension-registry', 'codex', 'codex'),
    '#frame=codex&workspace=extension-registry',
  );
});

test('isClaudeWorkspace only accepts known claude subpages', () => {
  assert.equal(isClaudeWorkspace('account-list'), true);
  assert.equal(isClaudeWorkspace('skills'), true);
  assert.equal(isClaudeWorkspace('mcp-servers'), true);
  assert.equal(isClaudeWorkspace('extensions'), false);
  assert.equal(isClaudeWorkspace('session-management'), true);
  assert.equal(isClaudeWorkspace('usage'), true);
  assert.equal(isClaudeWorkspace('claude-account-list'), false);
  assert.equal(isClaudeWorkspace('unknown'), false);
  assert.equal(isClaudeWorkspace(null), false);
});

test('isLegacyClaudeCodexWorkspace detects the old codex-hosted claude workspace', () => {
  assert.equal(isLegacyClaudeCodexWorkspace('claude-account-list'), true);
  assert.equal(isLegacyClaudeCodexWorkspace('account-list'), false);
  assert.equal(isLegacyClaudeCodexWorkspace(null), false);
});

test('resolveInitialClaudeWorkspace falls back to account list for invalid values', () => {
  assert.equal(resolveInitialClaudeWorkspace('account-list'), 'account-list');
  assert.equal(resolveInitialClaudeWorkspace('skills'), 'skills');
  assert.equal(resolveInitialClaudeWorkspace('mcp-servers'), 'mcp-servers');
  assert.equal(resolveInitialClaudeWorkspace('extensions'), 'skills');
  assert.equal(resolveInitialClaudeWorkspace('session-management'), 'session-management');
  assert.equal(resolveInitialClaudeWorkspace('usage'), 'usage');
  assert.equal(resolveInitialClaudeWorkspace('claude-account-list'), 'account-list');
  assert.equal(resolveInitialClaudeWorkspace('unknown'), 'account-list');
  assert.equal(resolveInitialClaudeWorkspace(null), 'account-list');
});

test('readStoredClaudeWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, CLAUDE_WORKSPACE_STORAGE_KEY);
      return 'mcp-servers';
    },
  };

  assert.equal(readStoredClaudeWorkspace(storage), 'mcp-servers');
});

test('readStoredClaudeWorkspace migrates legacy extensions storage to skills', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, CLAUDE_WORKSPACE_STORAGE_KEY);
      return 'extensions';
    },
  };

  assert.equal(readStoredClaudeWorkspace(storage), 'skills');
});

test('persistClaudeWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistClaudeWorkspace(storage, 'skills');

  assert.deepEqual(writes, [[CLAUDE_WORKSPACE_STORAGE_KEY, 'skills']]);
});

test('isSessionManagementWorkspace only accepts known session management subpages', () => {
  assert.equal(isSessionManagementWorkspace('codex'), true);
  assert.equal(isSessionManagementWorkspace('claude'), true);
  assert.equal(isSessionManagementWorkspace('unknown'), false);
  assert.equal(isSessionManagementWorkspace(null), false);
});

test('resolveInitialSessionManagementWorkspace falls back to codex for invalid values', () => {
  assert.equal(resolveInitialSessionManagementWorkspace('codex'), 'codex');
  assert.equal(resolveInitialSessionManagementWorkspace('claude'), 'claude');
  assert.equal(resolveInitialSessionManagementWorkspace('unknown'), 'codex');
  assert.equal(resolveInitialSessionManagementWorkspace(null), 'codex');
});

test('readStoredSessionManagementWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY);
      return 'codex';
    },
  };

  assert.equal(readStoredSessionManagementWorkspace(storage), 'codex');
});

test('persistSessionManagementWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistSessionManagementWorkspace(storage, 'codex');

  assert.deepEqual(writes, [[SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY, 'codex']]);
});

test('isUsageDeskWorkspace only accepts known usage desk subpages', () => {
  assert.equal(isUsageDeskWorkspace('codex'), true);
  assert.equal(isUsageDeskWorkspace('claude'), true);
  assert.equal(isUsageDeskWorkspace('gemini'), false);
  assert.equal(isUsageDeskWorkspace('unknown'), false);
  assert.equal(isUsageDeskWorkspace(null), false);
});

test('resolveInitialUsageDeskWorkspace falls back to codex for invalid values', () => {
  assert.equal(resolveInitialUsageDeskWorkspace('codex'), 'codex');
  assert.equal(resolveInitialUsageDeskWorkspace('claude'), 'claude');
  assert.equal(resolveInitialUsageDeskWorkspace('gemini'), 'codex');
  assert.equal(resolveInitialUsageDeskWorkspace('unknown'), 'codex');
  assert.equal(resolveInitialUsageDeskWorkspace(null), 'codex');
});

test('readStoredUsageDeskWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, USAGE_DESK_WORKSPACE_STORAGE_KEY);
      return 'claude';
    },
  };

  assert.equal(readStoredUsageDeskWorkspace(storage), 'claude');
});

test('persistUsageDeskWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistUsageDeskWorkspace(storage, 'claude');

  assert.deepEqual(writes, [[USAGE_DESK_WORKSPACE_STORAGE_KEY, 'claude']]);
});

test('isUsageDeskSourceStorageValue only accepts known usage desk source values', () => {
  assert.equal(isUsageDeskSourceStorageValue('observed'), true);
  assert.equal(isUsageDeskSourceStorageValue('projected'), true);
  assert.equal(isUsageDeskSourceStorageValue('unknown'), false);
  assert.equal(isUsageDeskSourceStorageValue(null), false);
});

test('resolveInitialUsageDeskSource falls back to observed for invalid values', () => {
  assert.equal(resolveInitialUsageDeskSource('observed'), 'observed');
  assert.equal(resolveInitialUsageDeskSource('projected'), 'projected');
  assert.equal(resolveInitialUsageDeskSource('unknown'), 'observed');
  assert.equal(resolveInitialUsageDeskSource(null), 'observed');
});

test('readStoredUsageDeskSource restores the last valid source from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, USAGE_DESK_SOURCE_STORAGE_KEY);
      return 'projected';
    },
  };

  assert.equal(readStoredUsageDeskSource(storage), 'projected');
});

test('persistUsageDeskSource writes the selected source to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistUsageDeskSource(storage, 'projected');

  assert.deepEqual(writes, [[USAGE_DESK_SOURCE_STORAGE_KEY, 'projected']]);
});

test('isUsageDeskRangeStorageValue only accepts known usage desk range values', () => {
  assert.equal(isUsageDeskRangeStorageValue('TODAY'), true);
  assert.equal(isUsageDeskRangeStorageValue('7D'), true);
  assert.equal(isUsageDeskRangeStorageValue('14D'), true);
  assert.equal(isUsageDeskRangeStorageValue('30D'), true);
  assert.equal(isUsageDeskRangeStorageValue('全部'), true);
  assert.equal(isUsageDeskRangeStorageValue('unknown'), false);
  assert.equal(isUsageDeskRangeStorageValue(null), false);
});

test('resolveInitialUsageDeskRange falls back to 7D for invalid values', () => {
  assert.equal(resolveInitialUsageDeskRange('TODAY'), 'TODAY');
  assert.equal(resolveInitialUsageDeskRange('全部'), '全部');
  assert.equal(resolveInitialUsageDeskRange('unknown'), '7D');
  assert.equal(resolveInitialUsageDeskRange(null), '7D');
});

test('readStoredUsageDeskRange restores the last valid range from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, USAGE_DESK_RANGE_STORAGE_KEY);
      return '30D';
    },
  };

  assert.equal(readStoredUsageDeskRange(storage), '30D');
});

test('persistUsageDeskRange writes the selected range to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistUsageDeskRange(storage, 'TODAY');

  assert.deepEqual(writes, [[USAGE_DESK_RANGE_STORAGE_KEY, 'TODAY']]);
});

test('readFrameHashState parses top-level frame pages', () => {
  assert.deepEqual(readFrameHashState('#frame=status'), { page: 'status' });
  assert.deepEqual(readFrameHashState('#frame=session-management'), { page: 'codex', codexWorkspace: 'session-management' });
  assert.deepEqual(readFrameHashState('#frame=vendor-status'), { page: 'codex', codexWorkspace: 'vendor-status' });
  assert.deepEqual(readFrameHashState('#frame=proxy-pool'), null);
  assert.deepEqual(readFrameHashState('#frame=request-orchestration'), null);
  assert.deepEqual(readFrameHashState('#frame=proxy-pool&workspace=codex'), null);
  assert.deepEqual(readFrameHashState('#frame=codex'), { page: 'codex', codexWorkspace: 'feature-config' });
  assert.deepEqual(readFrameHashState('#frame=claude'), { page: 'claude', claudeWorkspace: 'account-list' });
  assert.deepEqual(readFrameHashState('#frame=usage-desk'), { page: 'codex', codexWorkspace: 'usage-codex' });
  assert.deepEqual(readFrameHashState('#frame=settings'), { page: 'settings' });
  assert.equal(readFrameHashState('#frame=design-system'), null);
});

test('readFrameHashState rejects developer frames in production', () => {
  const productionOptions = { includeDeveloperPages: false };

  assert.equal(readFrameHashState('#frame=design-system', productionOptions), null);
  assert.equal(readFrameHashState('#frame=debug', productionOptions), null);
  assert.deepEqual(readFrameHashState('#frame=settings', productionOptions), { page: 'settings' });
});

test('readFrameHashState parses accounts workspace and falls back to all for legacy', () => {
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=all&filter=risk'), {
    page: 'accounts',
    workspace: 'all',
    accountFilter: 'risk',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=codex'), {
    page: 'accounts',
    workspace: 'all',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=codex&detail=api-key%3Alocal-1'), {
    page: 'accounts',
    workspace: 'all',
    accountDetailID: 'api-key:local-1',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&detail=api-key%3Alocal-1&script=quota'), {
    page: 'accounts',
    workspace: 'all',
    accountDetailID: 'api-key:local-1',
    accountDetailScript: 'quota',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&detail=api-key%3Alocal-1&script=billing'), {
    page: 'accounts',
    workspace: 'all',
    accountDetailID: 'api-key:local-1',
    accountDetailScript: 'billing',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&detail=api-key%3Alocal-1&script=rate-limit'), {
    page: 'accounts',
    workspace: 'all',
    accountDetailID: 'api-key:local-1',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&script=quota'), {
    page: 'accounts',
    workspace: 'all',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts'), {
    page: 'accounts',
    workspace: 'all',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=unknown'), {
    page: 'accounts',
    workspace: 'all',
  });
});

test('readFrameHashState parses codex workspace and falls back to feature config', () => {
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=feature-config'), {
    page: 'codex',
    codexWorkspace: 'feature-config',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=skills'), {
    page: 'codex',
    codexWorkspace: 'skills',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=mcp-servers'), {
    page: 'codex',
    codexWorkspace: 'mcp-servers',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=account-list'), {
    page: 'codex',
    codexWorkspace: 'account-list',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=account-list&detail=openai-compatible%3Adeepseek'), {
    page: 'codex',
    codexWorkspace: 'account-list',
    accountDetailID: 'openai-compatible:deepseek',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=skills&detail=%2FUsers%2Fme%2F.agents%2Fskills%2Fdemo%2FSKILL.md'), {
    page: 'codex',
    codexWorkspace: 'skills',
    codexSkillDetailID: '/Users/me/.agents/skills/demo/SKILL.md',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=session-management'), {
    page: 'codex',
    codexWorkspace: 'session-management',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=vendor-status'), {
    page: 'codex',
    codexWorkspace: 'vendor-status',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=usage-codex'), {
    page: 'codex',
    codexWorkspace: 'usage-codex',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=usage-gemini'), {
    page: 'codex',
    codexWorkspace: 'feature-config',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=unknown'), {
    page: 'codex',
    codexWorkspace: 'feature-config',
  });
});

test('readFrameHashState parses claude workspace and migrates old codex claude route', () => {
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=account-list'), {
    page: 'claude',
    claudeWorkspace: 'account-list',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=skills'), {
    page: 'claude',
    claudeWorkspace: 'skills',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=mcp-servers'), {
    page: 'claude',
    claudeWorkspace: 'mcp-servers',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=extensions'), {
    page: 'claude',
    claudeWorkspace: 'skills',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=session-management'), {
    page: 'claude',
    claudeWorkspace: 'session-management',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=usage'), {
    page: 'claude',
    claudeWorkspace: 'usage',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=account-list&detail=claude%3Asonnet'), {
    page: 'claude',
    claudeWorkspace: 'account-list',
    accountDetailID: 'claude:sonnet',
  });
  assert.deepEqual(readFrameHashState('#frame=claude&workspace=unknown'), {
    page: 'claude',
    claudeWorkspace: 'account-list',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=claude-account-list'), {
    page: 'claude',
    claudeWorkspace: 'account-list',
  });
});

test('readFrameHashState migrates legacy usage desk routes to codex usage', () => {
  assert.deepEqual(readFrameHashState('#frame=usage-desk&workspace=gemini'), {
    page: 'codex',
    codexWorkspace: 'usage-codex',
  });
  assert.deepEqual(readFrameHashState('#frame=usage-desk&workspace=unknown'), {
    page: 'codex',
    codexWorkspace: 'usage-codex',
  });
});

test('readFrameHashState parses session management workspace and falls back to codex', () => {
  assert.deepEqual(readFrameHashState('#frame=session-management&workspace=codex'), {
    page: 'codex',
    codexWorkspace: 'session-management',
  });
  assert.deepEqual(readFrameHashState('#frame=session-management&workspace=unknown'), {
    page: 'codex',
    codexWorkspace: 'session-management',
  });
});

test('readFrameHashState returns null for invalid hashes', () => {
  assert.equal(readFrameHashState(''), null);
  assert.equal(readFrameHashState('#workspace=codex'), null);
  assert.equal(readFrameHashState('#frame=unknown'), null);
  assert.equal(readFrameHashState(null), null);
});

test('account detail hash helpers add and remove modal marker', () => {
  assert.equal(
    buildAccountDetailFrameHash('#frame=accounts&workspace=openai-compatible', 'openai-compatible:deepseek'),
    '#frame=accounts&workspace=openai-compatible&detail=openai-compatible%3Adeepseek',
  );
  assert.equal(
    buildAccountDetailFrameHash('#frame=accounts&script=quota', 'api-key:local-1'),
    '#frame=accounts&detail=api-key%3Alocal-1',
  );
  assert.equal(
    buildAccountDetailScriptFrameHash('#frame=accounts&detail=api-key%3Alocal-1', 'api-key:local-1', 'quota'),
    '#frame=accounts&detail=api-key%3Alocal-1&script=quota',
  );
  assert.equal(
    buildAccountDetailScriptFrameHash('#frame=accounts&workspace=codex', 'api-key:local-1', 'billing'),
    '#frame=accounts&workspace=codex&detail=api-key%3Alocal-1&script=billing',
  );
  assert.equal(
    clearAccountDetailScriptFrameHash('#frame=accounts&workspace=codex&detail=api-key%3Alocal-1&script=quota'),
    '#frame=accounts&workspace=codex&detail=api-key%3Alocal-1',
  );
  assert.equal(
    clearAccountDetailFrameHash('#frame=accounts&workspace=codex&detail=api-key%3Alocal-1&script=billing'),
    '#frame=accounts&workspace=codex',
  );
});

test('codex detail hash helpers add and remove modal marker', () => {
  assert.equal(
    buildCodexDetailFrameHash('#frame=codex&workspace=account-list', 'openai-compatible:deepseek'),
    '#frame=codex&workspace=account-list&detail=openai-compatible%3Adeepseek',
  );
  assert.equal(
    buildCodexDetailFrameHash('#frame=codex', 'codex-api-key:stable'),
    '#frame=codex&detail=codex-api-key%3Astable',
  );
  assert.equal(
    clearCodexDetailFrameHash('#frame=codex&workspace=account-list&detail=openai-compatible%3Adeepseek'),
    '#frame=codex&workspace=account-list',
  );
});

test('codex skill detail hash helpers preserve peer params and only clear detail', () => {
  assert.equal(
    buildCodexSkillDetailFrameHash('#frame=codex&workspace=skills&modal=route-probe', '/Users/me/.agents/skills/demo/SKILL.md'),
    '#frame=codex&workspace=skills&modal=route-probe&detail=%2FUsers%2Fme%2F.agents%2Fskills%2Fdemo%2FSKILL.md',
  );
  assert.equal(
    clearCodexSkillDetailFrameHash('#frame=codex&workspace=skills&modal=route-probe&detail=%2FUsers%2Fme%2F.agents%2Fskills%2Fdemo%2FSKILL.md'),
    '#frame=codex&workspace=skills&modal=route-probe',
  );
});

test('claude detail hash helpers add and remove modal marker', () => {
  assert.equal(
    buildClaudeDetailFrameHash('#frame=claude&workspace=account-list', 'claude:sonnet'),
    '#frame=claude&workspace=account-list&detail=claude%3Asonnet',
  );
  assert.equal(
    clearClaudeDetailFrameHash('#frame=claude&workspace=account-list&detail=claude%3Asonnet'),
    '#frame=claude&workspace=account-list',
  );
});

test('account-list modal hash helpers add and remove independent modal routes', () => {
  assert.equal(
    buildCodexModalFrameHash('#frame=codex&workspace=account-list', 'route-probe'),
    '#frame=codex&workspace=account-list&modal=route-probe',
  );
  assert.equal(
    buildCodexModalFrameHash('#frame=codex&workspace=account-list', 'project-config'),
    '#frame=codex&workspace=account-list&modal=project-config',
  );
  assert.equal(
    clearCodexModalFrameHash('#frame=codex&workspace=account-list&modal=route-probe'),
    '#frame=codex&workspace=account-list',
  );
  assert.equal(
    buildClaudeModalFrameHash('#frame=claude&workspace=account-list', 'route-probe'),
    '#frame=claude&workspace=account-list&modal=route-probe',
  );
  assert.equal(
    buildClaudeModalFrameHash('#frame=claude&workspace=account-list', 'project-config'),
    '#frame=claude&workspace=account-list&modal=project-config',
  );
  assert.equal(
    clearClaudeModalFrameHash('#frame=claude&workspace=account-list&modal=route-probe'),
    '#frame=claude&workspace=account-list',
  );
});

test('buildFrameHash serializes page and optional accounts workspace', () => {
  assert.equal(buildFrameHash('status', 'all', 'feature-config', 'codex', 'codex'), '#frame=status');
  assert.equal(
    buildFrameHash('codex', 'all', 'skills', 'codex', 'codex'),
    '#frame=codex&workspace=skills',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'mcp-servers', 'codex', 'codex'),
    '#frame=codex&workspace=mcp-servers',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'account-list', 'codex', 'codex'),
    '#frame=codex&workspace=account-list',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'session-management', 'codex', 'codex'),
    '#frame=codex&workspace=session-management',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'vendor-status', 'codex', 'codex'),
    '#frame=codex&workspace=vendor-status',
  );
  assert.equal(buildFrameHash('vendor-status', 'all', 'feature-config', 'codex', 'codex'), '#frame=vendor-status');
  assert.equal(buildFrameHash('codex', 'all', 'feature-config', 'codex', 'codex'), '#frame=codex');
  assert.equal(buildFrameHash('claude', 'all', 'feature-config', 'codex', 'codex'), '#frame=claude&workspace=account-list');
  assert.equal(
    buildFrameHash('claude', 'all', 'feature-config', 'codex', 'codex', null, { claudeWorkspace: 'skills' }),
    '#frame=claude&workspace=skills',
  );
  assert.equal(
    buildFrameHash('claude', 'all', 'feature-config', 'codex', 'codex', null, { claudeWorkspace: 'mcp-servers' }),
    '#frame=claude&workspace=mcp-servers',
  );
  assert.equal(
    buildFrameHash('claude', 'all', 'feature-config', 'codex', 'codex', null, { claudeWorkspace: 'session-management' }),
    '#frame=claude&workspace=session-management',
  );
  assert.equal(
    buildFrameHash('claude', 'all', 'feature-config', 'codex', 'codex', null, { claudeWorkspace: 'usage' }),
    '#frame=claude&workspace=usage',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'usage-codex', 'codex', 'codex'),
    '#frame=codex&workspace=usage-codex',
  );
  assert.equal(buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex'), '#frame=accounts');
  assert.equal(
    buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex', null, { density: 'list' }),
    '#frame=accounts&density=list',
  );
  assert.equal(
    buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex', null, {
      density: 'compact',
      group: 'source',
      sort: 'quota',
    }),
    '#frame=accounts&density=compact&group=source&sort=quota',
  );
  assert.equal(
    buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex', null, { density: 'compact' }),
    '#frame=accounts&density=compact',
  );
  assert.equal(
    buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex', null, { density: 'full' }),
    '#frame=accounts',
  );
  assert.equal(
    buildFrameHash('accounts', 'openai-compatible', 'feature-config', 'codex', 'codex'),
    '#frame=accounts&workspace=openai-compatible',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'account-list', 'codex', 'codex', 'openai-compatible:deepseek'),
    '#frame=codex&workspace=account-list&detail=openai-compatible%3Adeepseek',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'account-list', 'codex', 'codex', null, { modal: 'route-probe' }),
    '#frame=codex&workspace=account-list&modal=route-probe',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'account-list', 'codex', 'codex', null, { modal: 'project-config' }),
    '#frame=codex&workspace=account-list&modal=project-config',
  );
  assert.equal(
    buildFrameHash('claude', 'all', 'feature-config', 'codex', 'codex', 'claude:sonnet', {
      claudeWorkspace: 'account-list',
      modal: 'route-probe',
    }),
    '#frame=claude&workspace=account-list&detail=claude%3Asonnet&modal=route-probe',
  );
  assert.equal(
    buildFrameHash('accounts', 'codex', 'feature-config', 'codex', 'codex', 'api-key:local-1'),
    '#frame=accounts&workspace=codex&detail=api-key%3Alocal-1',
  );
  assert.equal(
    buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex', 'api-key:local-1', {
      accountDetailScript: 'quota',
    }),
    '#frame=accounts&detail=api-key%3Alocal-1&script=quota',
  );
});
