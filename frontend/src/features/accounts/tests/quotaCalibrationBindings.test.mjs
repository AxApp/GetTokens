import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../../../..');

test('quota calibration bridge is exposed through Wails bindings and accounts hook', () => {
  const appJS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appDTS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');
  const hook = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/hooks/useQuotaCalibrations.ts'), 'utf8');

  assert.match(appJS, /export function ListQuotaCalibrations\(arg1\)/);
  assert.match(appJS, /export function AddQuotaCalibration\(arg1\)/);
  assert.match(appJS, /export function RevokeQuotaCalibration\(arg1\)/);
  assert.match(appDTS, /ListQuotaCalibrations\(arg1:string\):Promise<Array<main\.QuotaUsageCalibration>>/);
  assert.match(appDTS, /AddQuotaCalibration\(arg1:main\.QuotaUsageCalibrationInput\):Promise<main\.QuotaUsageCalibration>/);
  assert.match(appDTS, /RevokeQuotaCalibration\(arg1:string\):Promise<main\.QuotaUsageCalibration>/);
  assert.match(models, /export class QuotaUsageCalibration /);
  assert.match(models, /export class QuotaUsageCalibrationInput /);
  assert.match(hook, /ListQuotaCalibrations/);
  assert.match(hook, /AddQuotaCalibration/);
  assert.match(hook, /RevokeQuotaCalibration/);
});

test('quota threshold rule bridge is exposed through Wails bindings and accounts hook', () => {
  const appJS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appDTS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');
  const hook = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/hooks/useQuotaThresholdRules.ts'), 'utf8');

  assert.match(appJS, /export function ListQuotaThresholdRules\(arg1\)/);
  assert.match(appJS, /export function CreateQuotaThresholdRule\(arg1\)/);
  assert.match(appJS, /export function UpdateQuotaThresholdRule\(arg1, arg2\)/);
  assert.match(appJS, /export function DeleteQuotaThresholdRule\(arg1\)/);
  assert.match(appDTS, /ListQuotaThresholdRules\(arg1:string\):Promise<Array<main\.QuotaThresholdRule>>/);
  assert.match(appDTS, /CreateQuotaThresholdRule\(arg1:main\.QuotaThresholdRule\):Promise<Array<main\.QuotaThresholdRule>>/);
  assert.match(appDTS, /UpdateQuotaThresholdRule\(arg1:string,arg2:main\.QuotaThresholdRule\):Promise<Array<main\.QuotaThresholdRule>>/);
  assert.match(appDTS, /DeleteQuotaThresholdRule\(arg1:string\):Promise<void>/);
  assert.match(models, /export class QuotaThresholdRule /);
  assert.match(models, /condition\?: Record<string, any>/);
  assert.match(hook, /ListQuotaThresholdRules/);
  assert.match(hook, /CreateQuotaThresholdRule/);
  assert.match(hook, /UpdateQuotaThresholdRule/);
  assert.match(hook, /DeleteQuotaThresholdRule/);
});

test('budget window definition bridge is exposed through Wails bindings and accounts hook', () => {
  const appJS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appDTS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');
  const hook = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/hooks/useBudgetWindowDefinitions.ts'), 'utf8');
  const panel = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/components/QuotaThresholdRulePanel.tsx'), 'utf8');

  assert.match(appJS, /export function ListBudgetWindowDefinitions\(\)/);
  assert.match(appJS, /export function CreateBudgetWindowDefinition\(arg1\)/);
  assert.match(appJS, /export function UpdateBudgetWindowDefinition\(arg1, arg2\)/);
  assert.match(appJS, /export function DeleteBudgetWindowDefinition\(arg1\)/);
  assert.match(appJS, /export function PreviewBudgetWindowFacts\(arg1\)/);
  assert.match(appDTS, /ListBudgetWindowDefinitions\(\):Promise<Array<main\.BudgetWindowDefinition>>/);
  assert.match(appDTS, /CreateBudgetWindowDefinition\(arg1:main\.BudgetWindowDefinition\):Promise<Array<main\.BudgetWindowDefinition>>/);
  assert.match(appDTS, /UpdateBudgetWindowDefinition\(arg1:string,arg2:main\.BudgetWindowDefinition\):Promise<Array<main\.BudgetWindowDefinition>>/);
  assert.match(appDTS, /DeleteBudgetWindowDefinition\(arg1:string\):Promise<Array<main\.BudgetWindowDefinition>>/);
  assert.match(appDTS, /PreviewBudgetWindowFacts\(arg1:main\.BudgetWindowFactsPreviewRequest\):Promise<Array<main\.QuotaWindowFact>>/);
  assert.match(models, /export class BudgetWindowDefinition /);
  assert.match(models, /export class BudgetWindowFactsPreviewRequest /);
  assert.match(models, /rawUsed\?: number/);
  assert.match(hook, /ListBudgetWindowDefinitions/);
  assert.match(hook, /PreviewBudgetWindowFacts/);
  assert.match(panel, /data-budget-window-definition-panel/);
  assert.match(panel, /data-budget-window-preview-facts/);
  assert.match(panel, /不能显示为绿色安全/);
});

test('route guard simulation bridge preserves trace data surface', () => {
  const appJS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.js'), 'utf8');
  const appDTS = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/main/App.d.ts'), 'utf8');
  const models = readFileSync(path.join(repoRoot, 'frontend/wailsjs/go/models.ts'), 'utf8');
  const types = readFileSync(path.join(repoRoot, 'frontend/src/types.ts'), 'utf8');
  const model = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/model/routeGuardSimulation.ts'), 'utf8');
  const hook = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/hooks/useRouteGuardSimulation.ts'), 'utf8');

  assert.match(appJS, /export function SimulateRouteGuardRule\(arg1\)/);
  assert.match(appDTS, /SimulateRouteGuardRule\(arg1:main\.SimulateRouteGuardRuleRequest\):Promise<main\.SimulationResult>/);
  assert.match(models, /export class ReasonTraceStep /);
  assert.match(models, /data\?: Record<string, any>/);
  assert.match(models, /export class SimulateRouteGuardRuleRequest /);
  assert.match(models, /quotaWindows\?: QuotaWindowFact\[\]/);
  assert.match(models, /export class SimulationResult /);
  assert.match(types, /RouteGuardSimulationResult = main\.SimulationResult/);
  assert.match(model, /SimulationDecision = 'allow' \| 'block' \| 'diagnostic'/);
  assert.match(model, /data\?: Record<string, unknown>/);
  assert.match(model, /quotaWindowFacts\.length > 0 \? quotaWindowFacts : fallbackWindowFact \? \[fallbackWindowFact\] : \[\]/);
  assert.match(hook, /SimulateRouteGuardRule/);
  assert.match(hook, /不能据此认为规则安全/);
});

test('account quota section exposes calibration and threshold rule editors', () => {
  const section = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/components/AccountDetailSections.tsx'), 'utf8');
  const calibrationPanel = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/components/QuotaCalibrationPanel.tsx'), 'utf8');
  const thresholdPanel = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/components/QuotaThresholdRulePanel.tsx'), 'utf8');

  assert.match(section, /QuotaCalibrationPanel/);
  assert.match(section, /QuotaThresholdRulePanel/);
  assert.match(calibrationPanel, /data-account-quota-calibration-panel/);
  assert.match(calibrationPanel, /data-quota-calibration-history/);
  assert.match(calibrationPanel, /addQuotaCalibration/);
  assert.match(calibrationPanel, /revokeQuotaCalibration/);
  assert.match(thresholdPanel, /data-account-quota-threshold-rule-panel/);
  assert.match(thresholdPanel, /data-budget-window-definition-panel/);
  assert.match(thresholdPanel, /高级 DSL JSON/);
  assert.match(thresholdPanel, /Condition AST/);
  assert.match(thresholdPanel, /createQuotaThresholdRule/);
  assert.match(thresholdPanel, /updateQuotaThresholdRule/);
  assert.match(thresholdPanel, /deleteQuotaThresholdRule/);
  assert.match(thresholdPanel, /模拟当前规则/);
  assert.match(thresholdPanel, /data-route-guard-simulation-state/);
  assert.match(thresholdPanel, /Reason trace/);
  assert.match(thresholdPanel, /Diagnostics \/ ignored facts/);
});

test('quota calibration panel uses the quiet workspace shell', () => {
  const panel = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/components/QuotaCalibrationPanel.tsx'), 'utf8');

  assert.match(panel, /const quotaCalibrationPanelClass =/);
  assert.match(panel, /const quotaCalibrationItemClass =/);
  assert.match(panel, /const quotaCalibrationButtonClass =/);
  assert.match(panel, /const quotaCalibrationInputClass =/);
  assert.match(panel, /const quotaCalibrationMetaClass =/);
  assert.match(panel, /const quotaCalibrationErrorClass =/);
  assert.match(panel, /data-account-quota-calibration-panel/);
  assert.match(panel, /data-quota-calibration-item="active"/);
  assert.match(panel, /data-quota-calibration-history/);
  assert.match(panel, /data-quota-calibration-form/);
  assert.match(panel, /--gt-surface-canvas/);
  assert.match(panel, /--gt-surface-muted/);
  assert.match(panel, /--gt-border-subtle/);
  assert.match(panel, /--gt-status-danger/);
  assert.doesNotMatch(panel, /btn-swiss|input-swiss|select-swiss|card-swiss/);
  assert.doesNotMatch(panel, /border-2|border-t-2|border-b-2|border-dashed/);
  assert.doesNotMatch(panel, /bg-\[var\(--bg-(main|surface)\)\]|bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(panel, /color-status-/);
  assert.doesNotMatch(panel, /font-black|\buppercase\b|shadow-hard|shadow-\[/);
  assert.doesNotMatch(panel, /tracking-\[0\.12em\]|tracking-\[0\.16em\]|tracking-\[0\.18em\]/);
});

test('quota threshold rule panel uses the quiet workspace shell', () => {
  const panel = readFileSync(path.join(repoRoot, 'frontend/src/features/accounts/components/QuotaThresholdRulePanel.tsx'), 'utf8');

  assert.match(panel, /const quotaThresholdPanelClass =/);
  assert.match(panel, /const quotaThresholdButtonClass =/);
  assert.match(panel, /const quotaThresholdInputClass =/);
  assert.match(panel, /const quotaThresholdMetaClass =/);
  assert.match(panel, /data-account-quota-threshold-rule-panel/);
  assert.match(panel, /data-budget-window-definition-panel/);
  assert.match(panel, /data-route-guard-simulation-state/);
  assert.match(panel, /--gt-surface-canvas/);
  assert.match(panel, /--gt-surface-muted/);
  assert.match(panel, /--gt-border-subtle/);
  assert.match(panel, /--gt-status-danger/);
  assert.doesNotMatch(panel, /btn-swiss/);
  assert.doesNotMatch(panel, /input-swiss/);
  assert.doesNotMatch(panel, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(panel, /border-t-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(panel, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(panel, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(panel, /font-black/);
  assert.doesNotMatch(panel, /uppercase/);
  assert.doesNotMatch(panel, /tracking-\[0\.12em\]/);
  assert.doesNotMatch(panel, /tracking-\[0\.18em\]/);
});
