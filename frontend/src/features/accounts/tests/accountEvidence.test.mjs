import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountEvidenceRows, formatEvidenceTimestamp } from '../model/accountEvidence.ts';

const t = (key) =>
  ({
    'accounts.card_asset': '账号 ID',
    'accounts.card_source_type': '数据源',
    'accounts.card_last_hit': '最后命中',
    'accounts.card_attribution_key': '归因键',
  })[key] || key;

test('account evidence rows keep diagnostic fields for the detail page', () => {
  const rows = buildAccountEvidenceRows(
    t,
    {
      id: 'codex-api-key:local-1',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'Primary Codex',
      status: 'ready',
      formatBaseUrls: {
        openai_chat: 'https://relay.local/v1',
      },
    },
    {
      accountKey: 'codex-api-key:local-1',
      attributionKey: 'auth-file:team-codex',
      source: 'attribution',
      requestCount: 12,
      successCount: 12,
      failureCount: 0,
      totalTokens: 4800,
      inputTokens: 3200,
      outputTokens: 1600,
      lastActivityAt: 1747288800000,
    },
  );

  assert.deepEqual(
    rows.map((row) => row.label),
    ['账号 ID', '数据源', '归因键', '最后命中', 'ENDPOINT · OPENAI_CHAT'],
  );
  assert.equal(rows[1].value, 'ATTRIBUTION');
  assert.equal(rows[2].value, 'auth-file:team-codex');
  assert.equal(rows[4].value, 'https://relay.local/v1');
});

test('formatEvidenceTimestamp falls back when timestamp is absent', () => {
  assert.equal(formatEvidenceTimestamp(null), '—');
  assert.equal(formatEvidenceTimestamp(Number.NaN), '—');
});
