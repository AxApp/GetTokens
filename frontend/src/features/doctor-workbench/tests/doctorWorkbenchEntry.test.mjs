import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildFrameHash,
  isCodexWorkspace,
  readFrameHashState,
  resolveInitialCodexWorkspace,
} from '../../../utils/pagePersistence.ts';
import { deriveDoctorWorkbenchView } from '../model/doctorWorkbench.ts';
import { getDoctorWorkbenchPreviewSnapshot } from '../model/previewData.ts';

test('doctor workbench is parsed as a codex workspace without changing the default workspace', () => {
  assert.equal(isCodexWorkspace('doctor-workbench'), true);
  assert.equal(resolveInitialCodexWorkspace(null), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace('doctor-workbench'), 'doctor-workbench');
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=doctor-workbench'), {
    page: 'codex',
    codexWorkspace: 'doctor-workbench',
  });
  assert.equal(
    buildFrameHash('codex', 'all', 'doctor-workbench', 'codex', 'codex'),
    '#frame=codex&workspace=doctor-workbench',
  );
});

test('doctor preview display model exposes required acceptance fields and navigation hashes', () => {
  const view = deriveDoctorWorkbenchView(getDoctorWorkbenchPreviewSnapshot());
  const byID = Object.fromEntries(view.checks.map((check) => [check.id, check]));

  for (const id of ['applied-not-routeable', 'catalog-visible-no-backing', 'stale-route-guard', 'route_guard_dropped_reasons']) {
    const check = byID[id];
    assert.ok(check, `missing check ${id}`);
    assert.ok(check.status, `missing status ${id}`);
    assert.ok(check.reason, `missing reason ${id}`);
    assert.ok(check.repairability, `missing repairability ${id}`);
    assert.ok(check.evidence.length > 0, `missing evidence ${id}`);
    assert.ok(check.navigation.some((target) => target.hash.startsWith('#')), `missing navigation hash ${id}`);
  }
});

test('doctor feature source file recognizes sidecar diagnostics runtime source', async () => {
  const [modelSource, featureSource, wailsModelsSource, appBindingSource, appBindingTypeSource] = await Promise.all([
    readFile(new URL('../model/doctorWorkbench.ts', import.meta.url), 'utf8'),
    readFile(new URL('../DoctorWorkbenchFeature.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../../wailsjs/go/models.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../../wailsjs/go/main/App.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(modelSource, /'sidecar-diagnostics'/);
  assert.match(modelSource, /routeEvidence\?: Readonly<DoctorRouteEvidencePayload>/);
  assert.match(modelSource, /droppedReason\?: Readonly<DoctorRouteEvidencePayload>/);
  assert.match(wailsModelsSource, /class DoctorRouteEvidencePayload/);
  assert.match(wailsModelsSource, /accountKey\?: string/);
  assert.match(wailsModelsSource, /authId\?: string/);
  assert.match(wailsModelsSource, /routeBlocking\?: boolean/);
  assert.match(wailsModelsSource, /routeEvidence\?: DoctorRouteEvidencePayload/);
  assert.match(wailsModelsSource, /droppedReason\?: DoctorRouteEvidencePayload/);
  assert.match(modelSource, /extractTypedDoctorRouteEvidence/);
  assert.match(modelSource, /deriveOmniRouteWorkbenchProductizationView/);
  assert.match(modelSource, /deriveOmniRouteWorkbenchSafeActionSurface/);
  assert.match(modelSource, /deriveOmniRouteWorkbenchLedgerEntries/);
  assert.match(modelSource, /deriveDoctorWorkbenchCheckFilterOptions/);
  assert.match(modelSource, /deriveDoctorWorkbenchFilteredChecks/);
  assert.match(modelSource, /DoctorWorkbenchCheckFilter/);
  assert.match(modelSource, /OmniRouteWorkbenchSignalKind/);
  assert.match(modelSource, /OmniRouteWorkbenchSignalActionView/);
  assert.match(modelSource, /OmniRouteWorkbenchSafeActionView/);
  assert.match(modelSource, /diagnostics-snapshot/);
  assert.match(modelSource, /route-action-ledger/);
  assert.match(modelSource, /extension-config-ledger/);
  assert.match(modelSource, /buildAccountDetailHashFromEvidence/);
  assert.match(modelSource, /sourceLabel/);
  assert.match(modelSource, /summaryLabel/);
  assert.match(featureSource, /data-omniroute-workbench-summary="true"/);
  assert.match(featureSource, /data-omniroute-workbench-signal=/);
  assert.match(featureSource, /data-omniroute-workbench-signal-action=/);
  assert.match(featureSource, /data-omniroute-workbench-signal-action-kind=/);
  assert.match(featureSource, /data-omniroute-workbench-signal-primary-action=/);
  assert.match(featureSource, /data-omniroute-workbench-action-surface="true"/);
  assert.match(featureSource, /data-omniroute-workbench-action=/);
  assert.match(featureSource, /data-omniroute-workbench-action-status=/);
  assert.match(featureSource, /data-omniroute-workbench-ledger="true"/);
  assert.match(featureSource, /data-omniroute-workbench-ledger-entry=/);
  assert.match(featureSource, /diagnostics \/ route action \/ extension config/);
  assert.match(featureSource, /data-omniroute-workbench-check-filter-surface="true"/);
  assert.match(featureSource, /data-omniroute-workbench-check-filter=/);
  assert.match(featureSource, /data-omniroute-workbench-check-filter-active=/);
  assert.match(featureSource, /Narrow the evidence list without changing sidecar authority/);
  assert.match(featureSource, /previewGetTokensExtensionCodexConfigDryRun/);
  assert.match(featureSource, /deriveGetTokensExtensionCodexConfigDryRunView/);
  assert.match(featureSource, /RunRouteResilienceAction/);
  assert.match(featureSource, /recheck_routeability/);
  assert.match(featureSource, /doctor-workbench:route-recheck/);
  assert.match(featureSource, /source=\$\{view\.source\}/);
  assert.match(featureSource, /item\.sourceLabel/);
  assert.match(featureSource, /item\.summaryLabel/);
  assert.match(featureSource, /data-doctor-route-evidence-target/);
  assert.match(featureSource, /data-doctor-route-evidence-account/);
  assert.match(featureSource, /data-doctor-route-evidence-auth/);
  assert.match(featureSource, /data-doctor-route-evidence-model/);
  assert.match(featureSource, /data-doctor-route-evidence-scope/);
  assert.match(featureSource, /data-doctor-route-evidence-blocking/);
  assert.match(featureSource, /data-doctor-route-evidence-fallback/);
  assert.match(featureSource, /data-doctor-mode="read-only"/);
  assert.match(featureSource, /data-doctor-mutation-surface="none"/);
  assert.match(featureSource, /item\.targetKey/);
  assert.match(featureSource, /item\.accountKey/);
  assert.match(featureSource, /item\.authId/);
  assert.match(featureSource, /item\.model/);
  assert.match(featureSource, /item\.scope/);
  assert.match(featureSource, /item\.routeBlockingLabel/);
  assert.match(featureSource, /item\.routeFallbackState/);
  assert.match(appBindingTypeSource, /GetDoctorSnapshot\(arg1:main\.DoctorSnapshotInput\):Promise<main\.DoctorSnapshot>/);
  assert.match(appBindingTypeSource, /RunRouteResilienceAction\(arg1:main\.RouteResilienceActionInput\):Promise<main\.RouteResilienceActionResult>/);
  assert.match(appBindingSource, /GetDoctorSnapshot/);
  assert.match(appBindingSource, /RunRouteResilienceAction/);
  assert.doesNotMatch(wailsModelsSource, /RepairDoctorSnapshot|ApplyDoctorRepair|MutateDoctorSnapshot/);
  assert.doesNotMatch(appBindingTypeSource, /RepairDoctorSnapshot|ApplyDoctorRepair|MutateDoctorSnapshot/);
  assert.doesNotMatch(appBindingSource, /RepairDoctorSnapshot|ApplyDoctorRepair|MutateDoctorSnapshot/);
  assert.doesNotMatch(featureSource, /PrepareGetTokensExtensionCodexConfigApply|ApplyGetTokensExtensionCodexConfigTransaction/);
});

test('doctor entry is wired to CodexPage and uses Wails runtime before preview fallback', async () => {
  const [codexPageSource, featureSource, sidebarSource] = await Promise.all([
    readFile(new URL('../../../pages/CodexPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../DoctorWorkbenchFeature.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../components/biz/Sidebar.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(codexPageSource, /workspace === 'doctor-workbench'/);
  assert.match(codexPageSource, /<DoctorWorkbenchFeature \/>/);
  assert.match(sidebarSource, /id: 'doctor-workbench'/);
  assert.match(sidebarSource, /label: 'nav\.codex_doctor_workbench'/);
  assert.match(featureSource, /import \{ GetDoctorSnapshot, RunRouteResilienceAction \} from '..\/..\/..\/wailsjs\/go\/main\/App'/);
  assert.match(featureSource, /hasDoctorSnapshotRuntime/);
  assert.match(featureSource, /GetDoctorSnapshot\?: unknown/);
  assert.match(featureSource, /GetDoctorSnapshot\(\{ scope: 'codex', includeEvidence: true, maxEvidencePerCheck: 4 \}\)/);
  assert.match(featureSource, /RunRouteResilienceAction\(main\.RouteResilienceActionInput\.createFrom/);
  assert.match(featureSource, /getDoctorWorkbenchPreviewSnapshot\(\)/);
  assert.match(featureSource, /source=\$\{view\.source\}/);
  assert.match(featureSource, /previewOnly \? 'preview-only' : loadingSource/);
  assert.match(featureSource, /without repair mutations/);
  assert.doesNotMatch(featureSource, /RepairDoctorSnapshot|ApplyDoctorRepair|MutateDoctorSnapshot/);
  assert.doesNotMatch(featureSource, /PrepareGetTokensExtensionCodexConfigApply|ApplyGetTokensExtensionCodexConfigTransaction/);
});

test('doctor workbench uses the quiet workspace shell', async () => {
  const featureSource = await readFile(new URL('../DoctorWorkbenchFeature.tsx', import.meta.url), 'utf8');

  assert.match(featureSource, /const doctorPanelClass = 'rounded border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(featureSource, /const doctorMutedPanelClass = 'rounded border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-muted\)\]/);
  assert.match(featureSource, /shadow-sm/);
  assert.match(featureSource, /--gt-surface-canvas/);
  assert.match(featureSource, /--gt-ink-primary/);
  assert.match(featureSource, /data-doctor-workbench-shell="quiet"/);
  assert.match(featureSource, /data-doctor-workbench-core-acceptance="true"/);
  assert.match(featureSource, /data-doctor-workbench-check-list="true"/);
  assert.doesNotMatch(featureSource, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(featureSource, /shadow-\[[34]px_[34]px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(featureSource, /shadow-\[/);
  assert.doesNotMatch(featureSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(featureSource, /--text-on-accent|--bg-(main|surface|subtle|warning)/);
  assert.doesNotMatch(featureSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(featureSource, /font-black uppercase/);
});
