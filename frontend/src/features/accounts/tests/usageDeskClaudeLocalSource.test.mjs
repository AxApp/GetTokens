import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../../../..');

test('Claude usage desk projected source is wired to Claude local usage bindings', () => {
  const hookSource = fs.readFileSync(
    path.join(repoRoot, 'frontend/src/features/accounts/hooks/useUsageDeskFeature.ts'),
    'utf8',
  );
  const featureSource = fs.readFileSync(
    path.join(repoRoot, 'frontend/src/features/accounts/UsageDeskFeature.tsx'),
    'utf8',
  );
  const appBindings = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appTypes = fs.readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');

  assert.match(hookSource, /GetClaudeLocalUsage/);
  assert.match(hookSource, /RefreshClaudeLocalUsage/);
  assert.match(hookSource, /RebuildClaudeLocalUsage/);
  assert.match(hookSource, /workspace === 'claude'/);
  assert.match(featureSource, /workspace === 'codex' \|\| workspace === 'claude'/);
  assert.match(featureSource, /source === 'observed' \?/);
  assert.doesNotMatch(featureSource, /source === 'observed' \|\| workspace === 'claude'/);
  assert.match(appBindings, /export function GetClaudeLocalUsage\(\)/);
  assert.match(appBindings, /export function RefreshClaudeLocalUsage\(\)/);
  assert.match(appBindings, /export function RebuildClaudeLocalUsage\(\)/);
  assert.match(appTypes, /GetClaudeLocalUsage\(\):Promise<main\.LocalProjectedUsageResponse>/);
  assert.match(appTypes, /RefreshClaudeLocalUsage\(\):Promise<main\.LocalProjectedUsageResponse>/);
  assert.match(appTypes, /RebuildClaudeLocalUsage\(\):Promise<main\.LocalProjectedUsageResponse>/);
});
