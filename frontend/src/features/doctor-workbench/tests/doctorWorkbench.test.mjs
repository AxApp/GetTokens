import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveDoctorWorkbenchCheckFilterOptions,
  deriveDoctorWorkbenchFilteredChecks,
  deriveDoctorWorkbenchView,
  deriveOmniRouteWorkbenchProductizationView,
  deriveOmniRouteWorkbenchSafeActionSurface,
} from '../model/doctorWorkbench.ts';
import { getDoctorWorkbenchPreviewSnapshot } from '../model/previewData.ts';
import { deriveGetTokensExtensionCodexConfigDryRunView } from '../../gettokens-extension-registry/model.ts';
import { getGetTokensExtensionCodexConfigDryRunPreview } from '../../gettokens-extension-registry/previewData.ts';

test('doctor workbench view sorts blocking checks before healthy checks', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());

  assert.deepEqual(
    view.checks.map((check) => check.id),
    [
      'applied-not-routeable',
      'catalog-visible-no-backing',
      'quota_facts',
      'stale-route-guard',
      'route_guard_dropped_reasons',
      'account-store-startup-reconcile',
    ],
  );
  assert.deepEqual(view.statusCounts, {
    critical: 1,
    warning: 4,
    degraded: 0,
    not_ready: 0,
    ok: 1,
    skipped: 0,
  });
});

test('doctor runtime snapshot keeps core check field structure', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [{ kind: 'route_decision', label: 'acct_route', summary: 'rate-limit', refID: 'rd_1', source: 'sidecar' }],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
      {
        id: 'quota_facts',
        kind: 'quota-runtime-fact',
        title: 'Quota runtime facts need attention',
        status: 'warning',
        reason: 'Sidecar reported quota facts with risk.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [{ kind: 'provider', label: 'acct_quota', summary: 'no_quota', refID: 'acct_quota', source: 'quota-runtime' }],
        navigation: [{ kind: 'status', label: 'Open status', hash: '#frame=status' }],
      },
      {
        id: 'sidecar-runtime-ready',
        kind: 'sidecar-readiness',
        title: 'Sidecar runtime ready',
        status: 'ok',
        reason: 'Sidecar reports ready.',
        repairability: 'none',
        authority: 'wails',
        confidence: 'high',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [{ kind: 'sidecar_status', label: 'ready', summary: 'ready', refID: 'sidecar:8317', source: 'wails-aggregate' }],
        navigation: [{ kind: 'status', label: 'Open status', hash: '#frame=status' }],
      },
    ],
  });

  assert.equal(view.source, 'sidecar-diagnostics');
  assert.equal(view.runtimeTruth, true);
  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  const quotaCheck = view.checks.find((item) => item.id === 'quota_facts');
  assert.equal(routeCheck?.evidence[0]?.sourceLabel, 'Sidecar authority');
  assert.equal(routeCheck?.evidence[0]?.summaryLabel, 'rate-limit');
  assert.equal(routeCheck?.evidence[0]?.routeFallbackState, 'unknown-non-authoritative');
  assert.equal(quotaCheck?.evidence[0]?.sourceLabel, 'Quota Runtime');
  assert.equal(quotaCheck?.evidence[0]?.summaryLabel, 'no_quota');
  for (const id of ['route_guard_dropped_reasons', 'quota_facts', 'sidecar-runtime-ready']) {
    const check = view.checks.find((item) => item.id === id);
    assert.ok(check, `missing runtime check ${id}`);
    assert.ok(check.status, `missing status ${id}`);
    assert.ok(check.reason, `missing reason ${id}`);
    assert.ok(check.repairability, `missing repairability ${id}`);
    assert.ok(check.evidenceCount > 0, `missing evidence ${id}`);
    assert.ok(check.primaryNavigation?.hash.startsWith('#'), `missing navigation ${id}`);
  }
});

test('doctor preview snapshot is explicitly marked as not runtime truth', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());

  assert.equal(view.source, 'preview');
  assert.equal(view.runtimeTruth, false);
  assert.equal(view.sidecarReady, true);
});

test('doctor preview covers first acceptance checks with evidence and navigation', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const byID = Object.fromEntries(view.checks.map((check) => [check.id, check]));

  for (const id of ['applied-not-routeable', 'catalog-visible-no-backing', 'stale-route-guard', 'route_guard_dropped_reasons', 'quota_facts']) {
    assert.ok(byID[id], `missing preview check: ${id}`);
    assert.ok(byID[id].evidenceCount > 0, `missing evidence: ${id}`);
    assert.ok(byID[id].primaryNavigation?.hash.startsWith('#'), `missing navigation hash: ${id}`);
    assert.notEqual(byID[id].authority, 'preview', `preview must not be authority for ${id}`);
  }
});

test('doctor preview snapshot exposes one structured route evidence target and one partial fallback', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');

  assert.ok(routeCheck, 'missing route_guard_dropped_reasons preview check');
  assert.equal(routeCheck.evidenceCount, 3);

  const structured = routeCheck.evidence.find((item) => item.targetKey);
  const fallback = routeCheck.evidence.find((item) => item.routeFallbackState === 'partial-identity');
  const unknown = routeCheck.evidence.find((item) => item.routeFallbackState === 'unknown-non-authoritative');

  assert.ok(structured, 'missing structured route evidence');
  assert.equal(structured?.targetKey, 'acct_route_001|auth_route_001|gpt-5|upstream-error|model');
  assert.equal(structured?.accountKey, 'acct_route_001');
  assert.equal(structured?.authId, 'auth_route_001');
  assert.equal(structured?.model, 'gpt-5');
  assert.equal(structured?.scope, 'model');
  assert.equal(structured?.routeBlockingLabel, 'Route blocking');

  assert.ok(fallback, 'missing partial identity fallback evidence');
  assert.equal(fallback?.targetKey, undefined);
  assert.equal(fallback?.accountKey, undefined);
  assert.equal(fallback?.authId, undefined);
  assert.equal(fallback?.model, undefined);
  assert.equal(fallback?.scope, undefined);
  assert.equal(fallback?.routeFallbackState, 'partial-identity');
  assert.ok(unknown, 'missing unknown non-authoritative fallback evidence');
});

test('doctor browser preview snapshot fixture keeps nested droppedReason as route authority', () => {
  const snapshot = getDoctorWorkbenchPreviewSnapshot();
  const routeCheck = snapshot.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  const structuredFixture = routeCheck?.evidence.find((item) => item.refID === 'rd_preview_nested_dropped_reason');

  assert.ok(structuredFixture, 'missing preview droppedReason fixture');
  assert.equal(structuredFixture?.routeEvidence, undefined);
  assert.equal(structuredFixture?.accountKey, undefined);
  assert.equal(structuredFixture?.droppedReason?.accountKey, 'acct_route_001');
  assert.equal(structuredFixture?.droppedReason?.authId, 'auth_route_001');
  assert.equal(structuredFixture?.droppedReason?.model, 'gpt-5');
  assert.equal(structuredFixture?.droppedReason?.source, 'upstream-error');
  assert.equal(structuredFixture?.droppedReason?.scope, 'model');
  assert.equal(structuredFixture?.droppedReason?.reason, 'nested preview droppedReason survives browser fixture');
  assert.equal(structuredFixture?.droppedReason?.routeBlocking, true);

  const view = deriveDoctorWorkbenchView(snapshot);
  const viewRouteCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  const structured = viewRouteCheck?.evidence.find((item) => item.targetKey === 'acct_route_001|auth_route_001|gpt-5|upstream-error|model');

  assert.ok(structured, 'missing derived preview droppedReason evidence');
  assert.equal(structured?.reasonSummary, 'nested preview droppedReason survives browser fixture');
  assert.equal(structured?.routeBlockingLabel, 'Route blocking');
});

test('doctor runtime sidecar diagnostics source is treated as runtime truth', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [],
  });

  assert.equal(view.source, 'sidecar-diagnostics');
  assert.equal(view.runtimeTruth, true);
});

test('doctor preview keeps source labels aligned for status evidence', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const readyCheck = view.checks.find((item) => item.id === 'account-store-startup-reconcile');

  assert.equal(readyCheck?.evidence[0]?.sourceLabel, 'Wails aggregate');
  assert.equal(readyCheck?.evidence[0]?.summaryLabel, 'Open with no recovery events.');
});

test('doctor preview includes explicit quota fact and non-authoritative missing fact evidence', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const quotaCheck = view.checks.find((item) => item.id === 'quota_facts');

  assert.ok(quotaCheck, 'missing quota_facts preview check');
  assert.equal(quotaCheck?.evidenceCount, 2);
  assert.equal(quotaCheck?.evidence[0]?.sourceLabel, 'Quota runtime authority');
  assert.equal(quotaCheck?.evidence[0]?.summaryLabel, 'Stale / Warning risk');
  assert.equal(quotaCheck?.evidence[1]?.sourceLabel, 'Quota Runtime');
  assert.equal(
    quotaCheck?.evidence[1]?.summaryLabel,
    'Missing explicit quotaFact; windows and usage totals are non-authoritative.',
  );
});

test('doctor workbench check filters expose actionable route quota and critical slices', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const options = deriveDoctorWorkbenchCheckFilterOptions(view);
  const byID = Object.fromEntries(options.map((option) => [option.id, option]));
  const actionable = deriveDoctorWorkbenchFilteredChecks(view, 'actionable');
  const route = deriveDoctorWorkbenchFilteredChecks(view, 'route');
  const quota = deriveDoctorWorkbenchFilteredChecks(view, 'quota');
  const critical = deriveDoctorWorkbenchFilteredChecks(view, 'critical');

  assert.equal(byID.all?.count, view.checks.length);
  assert.equal(byID.actionable?.count, actionable.length);
  assert.equal(byID.route?.count, route.length);
  assert.equal(byID.quota?.count, quota.length);
  assert.equal(byID.critical?.count, critical.length);
  assert.ok(actionable.length > 0);
  assert.ok(actionable.every((check) => check.status !== 'ok' && check.repairability !== 'none'));
  assert.ok(route.some((check) => check.id === 'route_guard_dropped_reasons'));
  assert.ok(route.every((check) => check.kind.includes('route') || check.id.includes('route') || check.evidence.some((item) => item.targetKey)));
  assert.ok(quota.some((check) => check.id === 'quota_facts'));
  assert.ok(critical.every((check) => check.status === 'critical'));
});

test('omniroute productization view summarizes route quota extension and ledger signals', () => {
  const doctorView = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const extensionImpact = deriveGetTokensExtensionCodexConfigDryRunView(
    getGetTokensExtensionCodexConfigDryRunPreview(),
  );
  const productView = deriveOmniRouteWorkbenchProductizationView(doctorView, extensionImpact);
  const byKind = Object.fromEntries(productView.signals.map((signal) => [signal.kind, signal]));

  assert.equal(productView.title, 'OmniRoute Workbench v1');
  assert.equal(productView.primaryStatus, 'critical');
  assert.equal(productView.signals.length, 4);
  assert.equal(byKind.route?.status, 'warning');
  assert.match(byKind.route?.summary || '', /1 stable route target/);
  assert.equal(byKind.route?.navigationHash, '#frame=codex&workspace=account-list');
  assert.deepEqual(byKind.route?.actionLinks, [
    { id: 'account-detail', label: 'Open account detail', hash: '#frame=accounts&detail=codex-api-key%3Astable-001' },
    { id: 'route-decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' },
  ]);
  assert.equal(byKind.quota?.status, 'warning');
  assert.match(byKind.quota?.summary || '', /1 explicit fact/);
  assert.match(byKind.quota?.summary || '', /1 non-authoritative fallback/);
  assert.deepEqual(byKind.quota?.actionLinks, [
    { id: 'quota-status', label: 'Open quota status', hash: '#frame=status' },
    { id: 'quota-account-detail', label: 'Open related account', hash: '#frame=accounts&detail=codex-api-key%3Astable-001' },
  ]);
  assert.equal(byKind.extension?.status, 'preview');
  assert.match(byKind.extension?.summary || '', /2 config operations projected/);
  assert.match(byKind.extension?.blockedReason || '', /Preview only/);
  assert.deepEqual(byKind.extension?.actionLinks, [
    { id: 'extension-registry', label: 'Open extension registry', hash: '#frame=codex&workspace=extension-registry' },
  ]);
  assert.equal(byKind.ledger?.status, 'ready');
  assert.match(byKind.ledger?.summary || '', /route target ready/);
});

test('omniroute safe action surface blocks preview actions and real config apply', () => {
  const doctorView = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const extensionImpact = deriveGetTokensExtensionCodexConfigDryRunView(
    getGetTokensExtensionCodexConfigDryRunPreview(),
  );
  const surface = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, extensionImpact, {
    runtimeAvailable: false,
  });
  const byID = Object.fromEntries(surface.actions.map((action) => [action.id, action]));

  assert.equal(byID['route-recheck']?.status, 'blocked');
  assert.equal(byID['route-recheck']?.enabled, false);
  assert.match(byID['route-recheck']?.disabledReason || '', /Wails runtime/);
  assert.equal(byID['route-recheck']?.target?.targetKey, 'acct_route_001|auth_route_001|gpt-5|upstream-error|model');

  assert.equal(byID['extension-staged-apply']?.status, 'blocked');
  assert.equal(byID['extension-staged-apply']?.enabled, false);
  assert.match(byID['extension-staged-apply']?.summary || '', /2 dry-run operations/);
  assert.match(byID['extension-staged-apply']?.disabledReason || '', /explicit temp\/test target/);
  assert.match(byID['extension-staged-apply']?.disabledReason || '', /real ~\/\.codex\/config\.toml write is out of scope/);

  const ledgerByID = Object.fromEntries(surface.ledgerEntries.map((entry) => [entry.id, entry]));
  assert.equal(surface.ledgerEntries.length, 3);
  assert.equal(ledgerByID['diagnostics-snapshot']?.status, 'failed');
  assert.match(ledgerByID['diagnostics-snapshot']?.summary || '', /doctor checks/);
  assert.equal(ledgerByID['route-action-ledger']?.status, 'ready');
  assert.match(ledgerByID['route-action-ledger']?.summary || '', /target=acct_route_001/);
  assert.equal(ledgerByID['extension-config-ledger']?.status, 'ready');
  assert.match(ledgerByID['extension-config-ledger']?.summary || '', /2 dry-run operations/);
});

test('omniroute route recheck becomes ready only with runtime and stable typed target', () => {
  const doctorView = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const surface = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, null, {
    runtimeAvailable: true,
  });
  const action = surface.actions.find((item) => item.id === 'route-recheck');

  assert.equal(action?.status, 'ready');
  assert.equal(action?.enabled, true);
  assert.equal(action?.disabledReason, '');
  assert.equal(action?.target?.accountKey, 'acct_route_001');
  assert.equal(action?.target?.authId, 'auth_route_001');
  assert.equal(action?.target?.model, 'gpt-5');
  assert.equal(action?.target?.scope, 'model');
});

test('omniroute safe action surface exposes pending success warning and failure results', () => {
  const doctorView = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());

  const pending = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, null, {
    runtimeAvailable: true,
    routeActionPending: true,
  }).actions.find((item) => item.id === 'route-recheck');
  assert.equal(pending?.status, 'pending');

  const success = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, null, {
    runtimeAvailable: true,
    routeActionResult: {
      ok: true,
      status: 'applied',
      auditId: 'audit-route-001',
      before: { routeable: false },
      after: { routeable: true },
    },
  }).actions.find((item) => item.id === 'route-recheck');
  assert.equal(success?.status, 'success');
  assert.equal(success?.resultLabel, 'applied');
  assert.match(success?.rollbackLabel || '', /audit=audit-route-001/);

  const successSurface = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, null, {
    runtimeAvailable: true,
    routeActionResult: {
      ok: true,
      status: 'applied',
      auditId: 'audit-route-001',
      before: { routeable: false },
      after: { routeable: true },
    },
  });
  const routeLedger = successSurface.ledgerEntries.find((entry) => entry.id === 'route-action-ledger');
  assert.equal(routeLedger?.status, 'success');
  assert.match(routeLedger?.detail || '', /audit=audit-route-001/);

  const notImplemented = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, null, {
    runtimeAvailable: true,
    routeActionResult: {
      ok: false,
      status: 'not_implemented',
      httpStatus: 501,
      notImplementedReason: 'sidecar action endpoint is not enabled',
    },
  }).actions.find((item) => item.id === 'route-recheck');
  assert.equal(notImplemented?.status, 'warning');
  assert.equal(notImplemented?.resultLabel, '未实现');
  assert.match(notImplemented?.resultDetail || '', /sidecar action endpoint is not enabled/);

  const failed = deriveOmniRouteWorkbenchSafeActionSurface(doctorView, null, {
    runtimeAvailable: true,
    routeActionError: 'sidecar unavailable',
  }).actions.find((item) => item.id === 'route-recheck');
  assert.equal(failed?.status, 'failed');
  assert.equal(failed?.resultLabel, 'Failed');
  assert.match(failed?.resultDetail || '', /sidecar unavailable/);
});

test('doctor route evidence falls back when stable route identity is not explicit', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'recent decision',
            summary: 'upstream recovered later',
            refID: 'rd_1',
            source: 'sidecar',
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.label, 'recent decision');
  assert.equal(routeCheck?.evidence[0]?.summaryLabel, 'upstream recovered later');
  assert.equal(routeCheck?.evidence[0]?.sourceLabel, 'Sidecar authority');
  assert.equal(routeCheck?.evidence[0]?.targetKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.accountKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.authId, undefined);
  assert.equal(routeCheck?.evidence[0]?.model, undefined);
  assert.equal(routeCheck?.evidence[0]?.scope, undefined);
  assert.equal(routeCheck?.evidence[0]?.reasonSummary, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeBlockingLabel, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeFallbackState, 'unknown-non-authoritative');
});

test('doctor route evidence falls back when route identity is only partial', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_decision',
            label: 'acct_route',
            summary: 'rate-limit',
            refID: 'rd_1',
            source: 'sidecar',
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.label, 'acct_route');
  assert.equal(routeCheck?.evidence[0]?.summaryLabel, 'rate-limit');
  assert.equal(routeCheck?.evidence[0]?.targetKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeFallbackState, 'unknown-non-authoritative');
});

test('doctor route evidence aggregates by stable target identity instead of reason text', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'account=acct_route_001 auth=auth_route_001',
            summary: 'reason=upstream recovered scope=model routeBlocking=true',
            refID: 'model=gpt-5',
            source: 'upstream-error',
          },
          {
            kind: 'route_dropped_reason',
            label: 'auth=auth_route_001 account=acct_route_001',
            summary: 'routeBlocking=true reason=temporary upstream timeout',
            refID: 'scope=model model=gpt-5',
            source: 'upstream-error',
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 2);
  for (const evidence of routeCheck?.evidence ?? []) {
    assert.equal(evidence.targetKey, undefined);
    assert.equal(evidence.accountKey, undefined);
    assert.equal(evidence.authId, undefined);
    assert.equal(evidence.model, undefined);
    assert.equal(evidence.scope, undefined);
    assert.equal(evidence.reasonSummary, undefined);
    assert.equal(evidence.routeBlockingLabel, undefined);
    assert.equal(evidence.routeFallbackState, 'unknown-non-authoritative');
  }
});

test('doctor route evidence consumes Round19 nested droppedReason typed payload before misleading text', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'account=acct_wrong auth=auth_wrong',
            summary: 'scope=account reason=wrong text routeBlocking=false',
            refID: 'model=wrong-model',
            source: 'wrong-source',
            droppedReason: {
              accountKey: 'acct_route_nested',
              accountId: 'acct_route_nested',
              authId: 'auth_route_nested',
              model: 'gpt-5',
              source: 'upstream-rate-limit',
              scope: 'model',
              reason: 'nested droppedReason wins',
              routeBlocking: true,
            },
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.label, 'acct_route_nested');
  assert.equal(routeCheck?.evidence[0]?.targetKey, 'acct_route_nested|auth_route_nested|gpt-5|upstream-rate-limit|model');
  assert.equal(routeCheck?.evidence[0]?.accountKey, 'acct_route_nested');
  assert.equal(routeCheck?.evidence[0]?.authId, 'auth_route_nested');
  assert.equal(routeCheck?.evidence[0]?.model, 'gpt-5');
  assert.equal(routeCheck?.evidence[0]?.scope, 'model');
  assert.equal(routeCheck?.evidence[0]?.reasonSummary, 'nested droppedReason wins');
  assert.equal(routeCheck?.evidence[0]?.routeBlockingLabel, 'Route blocking');
});

test('doctor quota evidence consumes typed quotaFact and does not infer from summary text', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'quota_facts',
        kind: 'quota-runtime-fact',
        title: 'Quota runtime facts',
        status: 'warning',
        reason: 'Sidecar reported quota facts.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'quota_fact',
            label: 'acct_quota_typed',
            summary: 'wrong summary should not win',
            refID: 'acct_quota_typed',
            source: 'sidecar',
            quotaFact: {
              state: 'denied',
              source: 'quota-curl',
              freshness: 'fresh',
              confidence: 'high',
              risk: 'denied',
              explanation: 'typed quota fact wins',
              observedAt: '2026-06-17T08:00:00Z',
              evidenceRefs: ['quota-status:acct_quota_typed'],
            },
          },
          {
            kind: 'quota_fact',
            label: 'acct_quota_fallback',
            summary: 'top-level summary only fills missing explanation',
            refID: 'acct_quota_fallback',
            source: 'quota-runtime',
            quotaFact: {
              state: 'available',
              freshness: 'fresh',
              confidence: 'high',
              risk: 'none',
              evidenceRefs: ['quota-status:acct_quota_fallback'],
            },
          },
          {
            kind: 'quota_fact',
            label: 'acct_quota_text_only',
            summary: 'no_quota',
            refID: 'acct_quota_text_only',
            source: 'quota-runtime',
          },
        ],
        navigation: [{ kind: 'status', label: 'Open status', hash: '#frame=status' }],
      },
    ],
  });

  const quotaCheck = view.checks.find((item) => item.id === 'quota_facts');
  assert.equal(quotaCheck?.evidenceCount, 3);
  assert.equal(quotaCheck?.evidence[0]?.summaryLabel, 'Denied / Denied by provider');
  assert.equal(quotaCheck?.evidence[0]?.sourceLabel, 'Quota Curl');
  assert.equal(quotaCheck?.evidence[1]?.summaryLabel, 'Available');
  assert.equal(quotaCheck?.evidence[1]?.sourceLabel, 'Quota runtime authority');
  assert.equal(quotaCheck?.evidence[2]?.summaryLabel, 'no_quota');
  assert.equal(quotaCheck?.evidence[2]?.sourceLabel, 'Quota Runtime');
});

test('doctor quota evidence does not infer authority from quota-like non-fact fields', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'quota_facts',
        kind: 'quota-runtime-fact',
        title: 'Quota runtime facts',
        status: 'warning',
        reason: 'Sidecar reported quota facts.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'quota_fact',
            label: 'acct_quota_non_fact',
            summary: 'plain evidence summary survives',
            refID: 'acct_quota_non_fact',
            source: 'quota-runtime',
            blockReason: 'denied',
            windows: [{ remainingPercent: 0, resetAtUnix: 1781600000 }],
            usageTotals: { usedTokens: 999, limitTokens: 1000 },
          },
        ],
        navigation: [{ kind: 'status', label: 'Open status', hash: '#frame=status' }],
      },
    ],
  });

  const quotaCheck = view.checks.find((item) => item.id === 'quota_facts');
  assert.equal(quotaCheck?.evidenceCount, 1);
  assert.equal(quotaCheck?.evidence[0]?.summaryLabel, 'plain evidence summary survives');
  assert.equal(quotaCheck?.evidence[0]?.sourceLabel, 'Quota Runtime');
});

test('doctor route evidence prefers nested typed route payload over conflicting text fields', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'account=acct_wrong auth=auth_wrong',
            summary: 'scope=account reason=wrong text source routeBlocking=false',
            refID: 'model=wrong-model',
            source: 'wrong-source',
            routeEvidence: {
              accountKey: 'acct_route_typed',
              authId: 'auth_route_typed',
              model: 'gpt-5',
              source: 'upstream-error',
              scope: 'model',
              reason: 'typed evidence wins',
              routeBlocking: true,
            },
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.label, 'acct_route_typed');
  assert.equal(routeCheck?.evidence[0]?.targetKey, 'acct_route_typed|auth_route_typed|gpt-5|upstream-error|model');
  assert.equal(routeCheck?.evidence[0]?.accountKey, 'acct_route_typed');
  assert.equal(routeCheck?.evidence[0]?.authId, 'auth_route_typed');
  assert.equal(routeCheck?.evidence[0]?.model, 'gpt-5');
  assert.equal(routeCheck?.evidence[0]?.scope, 'model');
  assert.equal(routeCheck?.evidence[0]?.reasonSummary, 'typed evidence wins');
  assert.equal(routeCheck?.evidence[0]?.routeBlockingLabel, 'Route blocking');
  assert.equal(routeCheck?.evidence[0]?.sourceLabel, '上游错误');
});

test('doctor route evidence uses legacy routeEvidence typed payload before text fallback', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'recent decision',
            summary: 'reason=text fallback should lose',
            refID: 'rd_1',
            source: 'sidecar',
            routeEvidence: {
              accountKey: 'acct_route_direct',
              authId: 'auth_route_direct',
              model: 'gpt-5-mini',
              source: 'sidecar',
              scope: 'account',
              reason: 'legacy routeEvidence typed payload wins',
              routeBlocking: false,
            },
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.label, 'acct_route_direct');
  assert.equal(routeCheck?.evidence[0]?.targetKey, 'acct_route_direct|auth_route_direct|gpt-5-mini|sidecar|account');
  assert.equal(routeCheck?.evidence[0]?.reasonSummary, 'legacy routeEvidence typed payload wins');
  assert.equal(routeCheck?.evidence[0]?.routeBlockingLabel, 'Non-blocking evidence');
  assert.equal(routeCheck?.evidence[0]?.sourceLabel, 'sidecar');
});

test('doctor route evidence does not promote top-level diagnostics fields without nested typed route payload', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'acct_route_direct',
            summary: 'text says routeBlocking=true account=acct_route_direct model=gpt-5-mini',
            refID: 'rd_1',
            source: 'sidecar',
            accountKey: 'acct_route_direct',
            authId: 'auth_route_direct',
            model: 'gpt-5-mini',
            scope: 'account',
            reason: 'top-level diagnostics fields are not the nested droppedReason authority',
            routeBlocking: true,
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.targetKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.accountKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.authId, undefined);
  assert.equal(routeCheck?.evidence[0]?.model, undefined);
  assert.equal(routeCheck?.evidence[0]?.scope, undefined);
  assert.equal(routeCheck?.evidence[0]?.reasonSummary, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeBlockingLabel, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeFallbackState, 'unknown-non-authoritative');
  assert.equal(routeCheck?.evidence[0]?.summaryLabel, 'text says routeBlocking=true account=acct_route_direct model=gpt-5-mini');
});

test('doctor route evidence keeps partial typed identity as fallback only', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: [
          {
            kind: 'route_dropped_reason',
            label: 'typed partial evidence',
            summary: 'partial typed route identity should not become truth',
            refID: 'rd_1',
            source: 'sidecar',
            routeEvidence: {
              accountKey: 'acct_partial_typed',
              authId: 'auth_partial_typed',
              reason: 'missing model/source/scope',
              routeBlocking: true,
            },
          },
        ],
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const routeCheck = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.equal(routeCheck?.evidenceCount, 1);
  assert.equal(routeCheck?.evidence[0]?.targetKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.accountKey, undefined);
  assert.equal(routeCheck?.evidence[0]?.authId, undefined);
  assert.equal(routeCheck?.evidence[0]?.model, undefined);
  assert.equal(routeCheck?.evidence[0]?.scope, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeBlockingLabel, undefined);
  assert.equal(routeCheck?.evidence[0]?.routeFallbackState, 'partial-identity');
  assert.equal(routeCheck?.evidence[0]?.summaryLabel, 'partial typed route identity should not become truth');
});

test('doctor workbench view handles null or missing evidence safely', () => {
  const view = deriveDoctorWorkbenchView({
    generatedAtUnixMs: 1781596800000,
    source: 'sidecar-diagnostics',
    sidecarReady: true,
    status: 'warning',
    checks: [
      {
        id: 'route_guard_dropped_reasons',
        kind: 'route-guard-stale-block',
        title: 'Route guard dropped reasons present',
        status: 'warning',
        reason: 'Sidecar reported route-blocking dropped reasons.',
        repairability: 'read_only',
        authority: 'sidecar',
        confidence: 'medium',
        lastCheckedAtUnixMs: 1781596799000,
        evidence: null,
        navigation: [{ kind: 'route_decisions', label: 'Open route decisions', hash: '#frame=codex&workspace=account-list' }],
      },
    ],
  });

  const check = view.checks.find((item) => item.id === 'route_guard_dropped_reasons');
  assert.ok(check);
  assert.equal(check.evidenceCount, 0);
  assert.deepEqual(check.evidence, []);
});
