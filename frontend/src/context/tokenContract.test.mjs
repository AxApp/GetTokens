import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stylePath = resolve(import.meta.dirname, '../style.css');
const css = readFileSync(stylePath, 'utf-8');

function assertTokenExists(token, block, message) {
  const pattern = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`);
  assert.ok(pattern.test(block), message ?? `${token} should exist in block`);
}

// --- Token layers to verify ---

const surfaceTokens = [
  '--gt-surface-canvas',
  '--gt-surface-panel',
  '--gt-surface-raised',
  '--gt-surface-muted',
  '--gt-surface-inverse',
];

const inkTokens = [
  '--gt-ink-primary',
  '--gt-ink-secondary',
  '--gt-ink-muted',
  '--gt-ink-inverse',
  '--gt-ink-disabled',
];

const borderTokens = [
  '--gt-border-subtle',
  '--gt-border-default',
  '--gt-border-strong',
  '--gt-focus-ring',
  '--gt-shadow-panel',
  '--gt-shadow-overlay',
];

const accentStatusTokens = [
  '--gt-accent-primary',
  '--gt-accent-hover',
  '--gt-status-success',
  '--gt-status-warning',
  '--gt-status-danger',
  '--gt-status-info',
];

const radiusTokens = [
  '--gt-radius-xs',
  '--gt-radius-sm',
  '--gt-radius-md',
  '--gt-radius-lg',
  '--gt-radius-pill',
];

const elevationTokens = [
  '--gt-elevation-flat',
  '--gt-elevation-raised-1',
  '--gt-elevation-raised-2',
  '--gt-elevation-raised-3',
];

const typographyTokens = [
  '--gt-font-family-sans',
  '--gt-font-family-mono',
  '--gt-font-size-body',
  '--gt-font-size-section-title',
  '--gt-font-size-page-title',
  '--gt-font-size-metadata',
  '--gt-font-size-number',
  '--gt-font-weight-normal',
  '--gt-font-weight-medium',
  '--gt-font-weight-semibold',
  '--gt-font-weight-bold',
];

// --- Extract CSS blocks ---

function extractBlock(selector) {
  // Simple extraction: find selector, then count braces to find end
  const start = css.indexOf(selector);
  if (start === -1) return '';
  let depth = 0;
  let inBlock = false;
  let blockStart = -1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') {
      if (!inBlock) {
        inBlock = true;
        blockStart = i + 1;
      }
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0 && inBlock) {
        return css.slice(blockStart, i);
      }
    }
  }
  return '';
}

const rootBlock = extractBlock(':root');
const darkBlock = extractBlock('.dark {');
const parchmentLightBlock = extractBlock("[data-theme-preset='parchment-trust-console'] {");
const parchmentDarkBlock = extractBlock(".dark[data-theme-preset='parchment-trust-console'] {");

// --- Tests ---

test(':root contains all surface tokens', () => {
  for (const token of surfaceTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test(':root contains all ink tokens', () => {
  for (const token of inkTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test(':root contains all border/focus/shadow tokens', () => {
  for (const token of borderTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test(':root contains all accent/status tokens', () => {
  for (const token of accentStatusTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test(':root contains all radius tokens', () => {
  for (const token of radiusTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test(':root contains all elevation tokens', () => {
  for (const token of elevationTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test(':root contains all typography tokens', () => {
  for (const token of typographyTokens) {
    assertTokenExists(token, rootBlock, `:root should define ${token}`);
  }
});

test('.dark overrides status tokens for classic dark mode', () => {
  assertTokenExists('--gt-status-success', darkBlock);
  assertTokenExists('--gt-status-warning', darkBlock);
  assertTokenExists('--gt-status-danger', darkBlock);
  assertTokenExists('--gt-status-info', darkBlock);
});

test('.dark overrides elevation tokens for classic dark mode', () => {
  assertTokenExists('--gt-elevation-raised-1', darkBlock);
  assertTokenExists('--gt-elevation-raised-2', darkBlock);
  assertTokenExists('--gt-elevation-raised-3', darkBlock);
});

test('parchment light block contains all surface tokens', () => {
  for (const token of surfaceTokens) {
    assertTokenExists(token, parchmentLightBlock, `parchment light should define ${token}`);
  }
});

test('parchment light block contains all ink tokens', () => {
  for (const token of inkTokens) {
    assertTokenExists(token, parchmentLightBlock, `parchment light should define ${token}`);
  }
});

test('parchment light block contains all border tokens', () => {
  for (const token of borderTokens) {
    assertTokenExists(token, parchmentLightBlock, `parchment light should define ${token}`);
  }
});

test('parchment light block contains all accent/status tokens', () => {
  for (const token of accentStatusTokens) {
    assertTokenExists(token, parchmentLightBlock, `parchment light should define ${token}`);
  }
});

test('parchment dark block contains all surface tokens', () => {
  for (const token of surfaceTokens) {
    assertTokenExists(token, parchmentDarkBlock, `parchment dark should define ${token}`);
  }
});

test('parchment dark block contains all ink tokens', () => {
  for (const token of inkTokens) {
    assertTokenExists(token, parchmentDarkBlock, `parchment dark should define ${token}`);
  }
});

test('parchment dark block contains all border tokens', () => {
  for (const token of borderTokens) {
    assertTokenExists(token, parchmentDarkBlock, `parchment dark should define ${token}`);
  }
});

test('parchment dark block contains all accent/status tokens', () => {
  for (const token of accentStatusTokens) {
    assertTokenExists(token, parchmentDarkBlock, `parchment dark should define ${token}`);
  }
});

test('parchment dark block overrides elevation tokens', () => {
  assertTokenExists('--gt-elevation-raised-1', parchmentDarkBlock);
  assertTokenExists('--gt-elevation-raised-2', parchmentDarkBlock);
  assertTokenExists('--gt-elevation-raised-3', parchmentDarkBlock);
});

test('parchment light border-default matches long-term plan (#e8e6dc)', () => {
  const match = parchmentLightBlock.match(/--gt-border-default:\s*([^;]+)/);
  assert.ok(match, 'should find --gt-border-default');
  assert.equal(match[1].trim(), '#e8e6dc');
});

test('parchment light border-strong matches long-term plan (#d1cfc5)', () => {
  const match = parchmentLightBlock.match(/--gt-border-strong:\s*([^;]+)/);
  assert.ok(match, 'should find --gt-border-strong');
  assert.equal(match[1].trim(), '#d1cfc5');
});

test('parchment light accent-primary matches long-term plan (#c96442)', () => {
  const match = parchmentLightBlock.match(/--gt-accent-primary:\s*([^;]+)/);
  assert.ok(match, 'should find --gt-accent-primary');
  assert.equal(match[1].trim(), '#c96442');
});

test('CSS contains parchment component classes', () => {
  const componentClasses = [
    '.parchment-app-shell',
    '.parchment-toolbar',
    '.parchment-section-card',
    '.parchment-metric-tile',
    '.parchment-status-pill',
    '.parchment-tabs',
    '.parchment-detail-modal-shell',
    '.parchment-settings-row',
  ];
  for (const cls of componentClasses) {
    assert.ok(css.includes(cls), `CSS should contain ${cls}`);
  }
});
