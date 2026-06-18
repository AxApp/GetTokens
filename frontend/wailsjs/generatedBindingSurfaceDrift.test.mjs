import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_WAILS_GENERATED_DRIFT_REPORT_PATH,
  GENERATED_BINDING_ROOT,
  WAILS_BUILD_READINESS_COMMAND,
  WAILS_STANDALONE_GENERATE_COMMAND,
  getGeneratedBindingTargets,
} from '../../docs-linhay/scripts/check-wails-generated-drift.mjs';
import { runBindingSurfaceCheck } from '../../docs-linhay/scripts/check-wails-binding-surface.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatedDriftScriptPath = path.join(repoRoot, 'docs-linhay/scripts/check-wails-generated-drift.mjs');

test('generated Wails binding surface stays aligned with root and frontend contracts', () => {
  runBindingSurfaceCheck();
});

test('generated Wails drift smoke uses project wrapper and targets generated files only', () => {
  assert.equal(GENERATED_BINDING_ROOT, 'frontend/wailsjs');
  assert.deepEqual(WAILS_STANDALONE_GENERATE_COMMAND, [
    'bash',
    'scripts/wails-cli.sh',
    'generate',
    'bindings',
  ]);
  assert.deepEqual(WAILS_BUILD_READINESS_COMMAND, ['bash', 'scripts/wails-cli.sh', 'build']);
  assert.equal(DEFAULT_WAILS_GENERATED_DRIFT_REPORT_PATH, '/private/tmp/gettokens-wails-generated-drift-report.json');

  const targets = getGeneratedBindingTargets();
  assert.ok(targets.includes('frontend/wailsjs/go/main/App.js'));
  assert.ok(targets.includes('frontend/wailsjs/go/main/App.d.ts'));
  assert.ok(targets.includes('frontend/wailsjs/go/models.ts'));
  assert.ok(targets.every((target) => target.startsWith('frontend/wailsjs/')));
  assert.ok(targets.every((target) => !target.endsWith('.test.mjs')));
});

test('generated Wails drift smoke emits concise JSON report contract and persists artifact', () => {
  const reportPath = path.join(
    '/private/tmp',
    `gettokens-wails-generated-drift-contract-${process.pid}-${Date.now()}.json`,
  );
  fs.rmSync(reportPath, { force: true });

  const result = spawnSync(process.execPath, [generatedDriftScriptPath, '--report', reportPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.stderr.trim(), '', 'stderr should stay empty so CI can parse stdout JSON directly');
  assert.ok(result.stdout.trim(), 'stdout should contain a JSON report');
  assert.ok(!result.stdout.includes('diff --git'));
  assert.ok(!result.stdout.includes('--- modified'));

  const report = JSON.parse(result.stdout);
  assert.equal(report.generatedRoot, GENERATED_BINDING_ROOT);
  assert.deepEqual(report.wrapperCommand, WAILS_STANDALONE_GENERATE_COMMAND);
  assert.equal(report.standaloneGenerator.commandString, 'bash scripts/wails-cli.sh generate bindings');
  assert.equal(typeof report.standaloneGenerator.available, 'boolean');
  assert.equal(typeof report.standaloneGenerator.terminalBoundary, 'boolean');
  assert.ok(Array.isArray(report.standaloneGenerator.availableGenerateCommands));
  assert.deepEqual(report.readinessAlternative.command, WAILS_BUILD_READINESS_COMMAND);
  assert.equal(report.readinessAlternative.trigger, 'wails-build-or-dev');
  assert.equal(report.readinessAlternative.artifactPath, 'build/bin/GetTokens.app');
  assert.equal(report.surfaceCheck.status, 'pass');
  assert.equal(report.formalApplicationsPathTouched, false);
  assert.equal(report.formalBundleSidecarTouched, false);
  assert.equal(
    report.buildReadiness.buildBundleSidecarPath,
    'build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api',
  );
  assert.equal(report.buildReadiness.buildBundleSidecarManagedByWrapper, true);
  assert.equal(report.buildReadiness.formalBundleSidecarTouched, false);
  assert.equal(report.reportArtifactPath, reportPath);
  assert.equal(typeof report.bindingGenerationAvailable, 'boolean');
  assert.equal(typeof report.unavailableReason, 'string');
  assert.equal(typeof report.restored, 'boolean');
  assert.equal(report.restored, true);
  assert.equal(report.acceptedGeneratedDiff, false);
  assert.ok(Array.isArray(report.changedFiles));
  assert.ok(Array.isArray(report.sideEffectFiles));
  assert.match(report.driftKind, /^(none|generated-drift|wrapper-side-effect)$/);
  assert.match(
    report.exitClassification,
    /^(pass|standalone-generator-unavailable-surface-pass|binding-generation-unavailable|generated-binding-drift-detected|generator-unavailable-with-side-effects|surface-check-failed|build-readiness-pass|build-readiness-failed|build-generated-drift-detected)$/,
  );
  assert.ok(
    report.changedFiles.every(
      (item) =>
        item.path.startsWith('frontend/wailsjs/') &&
        /^(added|deleted|modified)$/.test(item.status),
    ),
  );
  assert.ok(
    report.sideEffectFiles.every(
      (item) =>
        item.path.startsWith('frontend/wailsjs/') &&
        /^(added|deleted|modified)$/.test(item.status),
    ),
  );
  if (!report.bindingGenerationAvailable) {
    assert.ok(
      [
        'standalone-generator-unavailable-surface-pass',
        'binding-generation-unavailable',
        'generator-unavailable-with-side-effects',
      ].includes(report.exitClassification),
    );
  }
  if (report.bindingGenerationAvailable) {
    assert.equal(
      report.exitClassification,
      report.changedFiles.length > 0 ? 'generated-binding-drift-detected' : 'pass',
    );
  }

  assert.ok(fs.existsSync(reportPath), 'report artifact should be written');
  const persistedReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.deepEqual(persistedReport, report);

  assert.equal(
    result.status,
    ['pass', 'standalone-generator-unavailable-surface-pass'].includes(report.exitClassification)
      ? 0
      : 1,
  );
});
