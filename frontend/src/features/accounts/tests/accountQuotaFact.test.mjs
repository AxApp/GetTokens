import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQuotaFactEvidenceView,
  coerceQuotaFactDisplay,
  resolveExplicitQuotaFactDisplay,
  resolveQuotaFact,
} from '../model/accountQuota.ts';
import { resolveQuotaStatusEvidenceFromPayload } from '../model/quotaStatusEvidence.ts';

const quotaCapableAccount = {
  id: 'acct_codex_001',
  accountKind: 'codex-api-key',
  provider: 'codex',
  credentialSource: 'api-key',
  displayName: 'Codex Key',
  status: 'configured',
  quotaEnabled: true,
  quotaCurl: 'curl https://quota.example.test',
  quotaKey: 'acct_codex_001',
};

test('resolveQuotaFact marks accounts without quota probes as unsupported', () => {
  const fact = resolveQuotaFact({
    id: 'acct_no_quota',
    provider: 'openai-compatible',
    credentialSource: 'api-key',
    displayName: 'No Quota',
    status: 'configured',
    quotaEnabled: false,
    quotaCurl: '',
  });

  assert.equal(fact.state, 'unsupported');
  assert.equal(fact.freshness, 'unknown');
  assert.equal(fact.confidence, 'none');
});

test('resolveQuotaFact keeps missing quota runtime separate from no quota', () => {
  const fact = resolveQuotaFact(quotaCapableAccount);

  assert.equal(fact.state, 'unknown');
  assert.equal(fact.risk, 'unknown');
  assert.equal(fact.confidence, 'none');
});

test('resolveQuotaFact does not infer no quota authority from exhausted windows and blockReason', () => {
  const fact = resolveQuotaFact(quotaCapableAccount, {
    status: 'success',
    quota: {
      accountKey: 'acct_codex_001',
      source: 'provider-quota-curl',
      status: 'success',
      planType: 'pro',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 0, resetLabel: '06/16 18:00', resetAtUnix: 1781613600 },
        { id: 'weekly', label: '7D', remainingPercent: 0, resetLabel: '06/20 18:00', resetAtUnix: 1781959200 },
      ],
      sources: [],
      blocked: true,
      blockReason: 'quota empty: weekly',
    },
  });

  assert.equal(fact.state, 'unknown');
  assert.equal(fact.freshness, 'unknown');
  assert.equal(fact.confidence, 'none');
  assert.equal(fact.risk, 'unknown');
  assert.equal(fact.explanation, 'Quota runtime status did not include an explicit quotaFact.');
});

test('resolveQuotaFact does not infer stale authority from runtime status and cached windows', () => {
  const fact = resolveQuotaFact(quotaCapableAccount, {
    status: 'success',
    quota: {
      accountKey: 'acct_codex_001',
      source: 'provider-quota-curl',
      status: 'stale',
      stale: true,
      degradedReason: 'management api-call failed',
      planType: 'pro',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 42, resetLabel: '06/16 18:00', resetAtUnix: 1781613600 },
      ],
      sources: [],
      blocked: false,
    },
  });

  assert.equal(fact.state, 'unknown');
  assert.equal(fact.freshness, 'unknown');
  assert.equal(fact.confidence, 'none');
  assert.equal(fact.risk, 'unknown');
  assert.equal(fact.explanation, 'Quota runtime status did not include an explicit quotaFact.');
});

test('resolveQuotaFact does not infer denied authority from degraded reason or usage totals', () => {
  const fact = resolveQuotaFact(quotaCapableAccount, {
    status: 'success',
    quota: {
      account_key: 'acct_codex_001',
      source: 'auth-file-usage',
      status: 'degraded',
      stale: true,
      degraded_reason: 'ChatGPT usage request failed (402) (deactivated_workspace)',
      windows: [],
      usageTotals: { input: 4096, output: 512, total: 4608 },
      sources: [],
      blocked: false,
    },
  });

  assert.equal(fact.state, 'unknown');
  assert.equal(fact.freshness, 'unknown');
  assert.equal(fact.confidence, 'none');
  assert.equal(fact.risk, 'unknown');
  assert.equal(fact.explanation, 'Quota runtime status did not include an explicit quotaFact.');
});

test('resolveQuotaFact prefers sidecar quota fact when present', () => {
  const fact = resolveQuotaFact(quotaCapableAccount, {
    status: 'success',
    quota: {
      account_key: 'acct_codex_001',
      status: 'success',
      fact: {
        state: 'no_quota',
        source: 'quota-runtime',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'blocking',
        explanation: 'weekly window exhausted',
        observed_at: '2026-06-16T08:00:00Z',
        expires_at: '2026-06-16T13:00:00Z',
        evidence_refs: ['window:weekly', 'guard:quota-empty'],
      },
      windows: [
        { id: 'weekly', label: '7D', remaining_percent: 0, reset_label: '06/20 18:00', reset_at_unix: 1781959200 },
      ],
      sources: [],
      blocked: true,
    },
  });

  assert.deepEqual(fact, {
    state: 'no-quota',
    source: 'quota-runtime',
    freshness: 'fresh',
    confidence: 'high',
    risk: 'blocking',
    explanation: 'weekly window exhausted',
    observedAt: '2026-06-16T08:00:00Z',
    expiresAt: '2026-06-16T13:00:00Z',
    evidenceRefs: ['window:weekly', 'guard:quota-empty'],
  });
});

test('resolveQuotaFact also accepts legacy quotaFact camel case metadata', () => {
  const fact = resolveQuotaFact(quotaCapableAccount, {
    status: 'success',
    quota: {
      accountKey: 'acct_codex_001',
      status: 'success',
      quotaFact: {
        state: 'available',
        source: 'quota-runtime',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'none',
        explanation: 'daily window available',
        observedAt: '2026-06-16T08:05:00Z',
        expiresAt: '2026-06-16T13:05:00Z',
        evidenceRefs: ['window:daily'],
      },
      windows: [],
      sources: [],
      blocked: false,
    },
  });

  assert.deepEqual(fact, {
    state: 'available',
    source: 'quota-runtime',
    freshness: 'fresh',
    confidence: 'high',
    risk: 'none',
    explanation: 'daily window available',
    observedAt: '2026-06-16T08:05:00Z',
    expiresAt: '2026-06-16T13:05:00Z',
    evidenceRefs: ['window:daily'],
  });
});

test('resolveQuotaFact accepts explicit quota_fact snake case metadata', () => {
  const fact = resolveQuotaFact(quotaCapableAccount, {
    status: 'success',
    quota: {
      account_key: 'acct_codex_001',
      status: 'success',
      quota_fact: {
        state: 'stale',
        source: 'quota-runtime',
        freshness: 'stale',
        confidence: 'medium',
        risk: 'warning',
        explanation: 'sidecar reported cached quota fact',
        observed_at: '2026-06-16T08:10:00Z',
        expires_at: '2026-06-16T13:10:00Z',
        evidence_refs: ['window:cached'],
      },
      windows: [{ id: 'weekly', label: '7D', remaining_percent: 0 }],
      block_reason: 'quota empty: weekly',
    },
  });

  assert.deepEqual(fact, {
    state: 'stale',
    source: 'quota-runtime',
    freshness: 'stale',
    confidence: 'medium',
    risk: 'warning',
    explanation: 'sidecar reported cached quota fact',
    observedAt: '2026-06-16T08:10:00Z',
    expiresAt: '2026-06-16T13:10:00Z',
    evidenceRefs: ['window:cached'],
  });
});

test('explicit quota fact shared helper covers account status and usage consumers', () => {
  const payloadMatrix = [
    {
      label: 'camel',
      payload: {
        quotaFact: {
          state: 'available',
          source: 'quota-runtime',
          freshness: 'fresh',
          confidence: 'high',
          risk: 'none',
          evidenceRefs: ['fact:camel'],
        },
      },
      expectedState: 'available',
      expectedRef: 'fact:camel',
    },
    {
      label: 'snake',
      payload: {
        quota_fact: {
          state: 'no_quota',
          source: 'quota-runtime',
          freshness: 'fresh',
          confidence: 'high',
          evidence_refs: ['fact:snake'],
        },
      },
      expectedState: 'no-quota',
      expectedRef: 'fact:snake',
    },
    {
      label: 'legacy',
      payload: {
        fact: {
          state: 'denied',
          source: 'quota-runtime',
          freshness: 'fresh',
          confidence: 'high',
          risk: 'denied',
          evidence_refs: ['fact:legacy'],
        },
      },
      expectedState: 'denied',
      expectedRef: 'fact:legacy',
    },
  ];

  for (const { label, payload, expectedState, expectedRef } of payloadMatrix) {
    const fact = resolveExplicitQuotaFactDisplay({
      ...payload,
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: `${label} should not require local inference`,
    });
    const statusEvidence = resolveQuotaStatusEvidenceFromPayload(payload, 'codex');

    assert.equal(fact?.state, expectedState, `${label} shared helper state`);
    assert.equal(fact?.source, 'quota-runtime', `${label} shared helper source`);
    assert.equal(fact?.evidenceRefs?.[0], expectedRef, `${label} shared helper evidence ref`);
    assert.equal(statusEvidence?.view.evidenceRefs?.[0], expectedRef, `${label} status evidence ref`);
  }

  assert.equal(
    resolveExplicitQuotaFactDisplay({
      windows: [{ id: 'weekly', remainingPercent: 0, authority: 'window-derived' }],
      blockReason: 'quota empty: weekly',
      usageTotals: { state: 'no-quota', confidence: 'high' },
      factLike: { state: 'available' },
    }),
    undefined,
  );
});

test('resolveExplicitQuotaFactDisplay applies source and explanation fallbacks without promoting non-facts', () => {
  const fact = resolveExplicitQuotaFactDisplay(
    {
      quotaFact: {
        state: 'available',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'none',
        evidenceRefs: ['fact:doctor'],
      },
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
    },
    {
      sourceFallback: 'quota-runtime',
      explanationFallback: 'typed fact remains authoritative; summary only fills explanation',
    },
  );

  assert.deepEqual(fact, {
    state: 'available',
    source: 'quota-runtime',
    freshness: 'fresh',
    confidence: 'high',
    risk: 'none',
    explanation: 'typed fact remains authoritative; summary only fills explanation',
    observedAt: undefined,
    expiresAt: undefined,
    evidenceRefs: ['fact:doctor'],
  });

  assert.equal(
    resolveExplicitQuotaFactDisplay(
      {
        windows: [{ id: 'weekly', remainingPercent: 0 }],
        blockReason: 'quota empty: weekly',
      },
      {
        sourceFallback: 'quota-runtime',
        explanationFallback: 'must not invent typed fact',
      },
    ),
    undefined,
  );
});

test('coerceQuotaFactDisplay normalizes snake case evidence payloads for status consumers', () => {
  const fact = coerceQuotaFactDisplay({
    state: 'no_quota',
    source: 'quota-runtime',
    freshness: 'fresh',
    confidence: 'high',
    explanation: 'weekly window exhausted',
    observed_at: '2026-06-16T08:00:00Z',
    expires_at: '2026-06-16T13:00:00Z',
    evidence_refs: ['window:weekly'],
  });

  assert.deepEqual(fact, {
    state: 'no-quota',
    source: 'quota-runtime',
    freshness: 'fresh',
    confidence: 'high',
    risk: 'blocking',
    explanation: 'weekly window exhausted',
    observedAt: '2026-06-16T08:00:00Z',
    expiresAt: '2026-06-16T13:00:00Z',
    evidenceRefs: ['window:weekly'],
  });
});

test('buildQuotaFactEvidenceView exposes one quota evidence view model for usage or status surfaces', () => {
  const view = buildQuotaFactEvidenceView({
    state: 'stale',
    source: 'quota-runtime',
    freshness: 'stale',
    confidence: 'medium',
    risk: 'warning',
    explanation: 'cached quota fact',
    observedAt: '2026-06-16T08:00:00Z',
    expiresAt: '2026-06-16T13:00:00Z',
    evidenceRefs: ['window:weekly', 'source:cache'],
  });

  assert.deepEqual(view, {
    stateLabel: 'Stale',
    sourceLabel: 'Quota runtime authority',
    freshnessLabel: 'Stale',
    confidenceLabel: 'Medium confidence',
    riskLabel: 'Warning risk',
    summary: 'Stale / Warning risk',
    explanation: 'cached quota fact',
    observedAt: '2026-06-16T08:00:00Z',
    expiresAt: '2026-06-16T13:00:00Z',
    evidenceRefs: ['window:weekly', 'source:cache'],
  });
});
