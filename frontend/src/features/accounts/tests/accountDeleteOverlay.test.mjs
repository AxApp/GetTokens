import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildAccountDeleteOverlay } from '../components/accountDeleteOverlay.ts';

const t = (key) => key;

test('buildAccountDeleteOverlay renders a full-card delete overlay', () => {
  const source = readFileSync(new URL('../components/accountDeleteOverlay.ts', import.meta.url), 'utf8');
  const markup = renderToStaticMarkup(
    buildAccountDeleteOverlay({
      t,
      account: {
        id: 'auth-file:team-codex-auth.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'Codex Primary Workbench',
        status: 'active',
        email: 'team-codex@example.com',
        planType: 'Pro',
        name: 'team-codex-auth.json',
        baseUrl: 'https://api.openai.com/v1',
        supportedFormats: ['openai_chat', 'openai_responses'],
      },
      primaryLabel: 'Codex Primary Workbench',
      onCancelDelete: () => undefined,
      onConfirmDelete: () => undefined,
    }),
  );

  assert.match(source, /const accountDeleteOverlayShellClass =/);
  assert.match(source, /const accountDeleteOverlayListShellClass =/);
  assert.match(source, /const accountDeleteOverlayButtonClass =/);
  assert.match(source, /const accountDeleteOverlayDangerButtonClass =/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.match(markup, /data-account-card-delete-overlay="true"/);
  assert.match(markup, /data-account-card-delete-overlay-section="header"/);
  assert.match(markup, /data-account-card-delete-overlay-section="details"/);
  assert.match(markup, /data-account-card-delete-overlay-section="actions"/);
  assert.match(markup, /flex h-full flex-col overflow-hidden rounded-md border border-\[var\(--gt-border-subtle\)\]/);
  assert.match(markup, /bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(markup, /text-\[var\(--gt-status-danger\)\]/);
  assert.match(markup, /text-\[length:var\(--font-size-ui-xl-plus\)\] font-semibold/);
  assert.match(markup, /flex flex-1 flex-col px-4 py-4/);
  assert.match(markup, /mt-3 h-px bg-\[var\(--gt-border-subtle\)\]/);
  assert.match(markup, /grid gap-2 pt-3/);
  assert.match(markup, /grid gap-2/);
  assert.match(markup, /flex items-center justify-between gap-3/);
  assert.match(markup, /accounts\.source_auth_file/);
  assert.match(markup, /common\.confirm_delete/);
  assert.match(markup, /common\.delete/);
  assert.match(markup, /accounts\.card_delete/);
  assert.doesNotMatch(markup, /本地凭据引用/);
  assert.doesNotMatch(markup, /关闭此账号的后续路由使用/);
  assert.doesNotMatch(markup, /grid gap-3 border border-\[color-mix\(in_srgb,var\(--color-status-danger\)_18%,var\(--border-color\)\)\]/);
  assert.doesNotMatch(markup, /grid grid-cols-\[3rem_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(markup, /max-w-\[18rem\]/);
  assert.doesNotMatch(markup, /text-center/);
  assert.doesNotMatch(source, /btn-swiss|input-swiss|select-swiss|card-swiss/);
  assert.doesNotMatch(source, /border-2|border-t-2|border-b-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /shadow-hard|shadow-\[/);
  assert.doesNotMatch(source, /backdrop-blur/);
});

test('buildAccountDeleteOverlay keeps list mode delete actions visible', () => {
  const markup = renderToStaticMarkup(
    buildAccountDeleteOverlay({
      t,
      density: 'list',
      account: {
        id: 'auth-file:team-codex-auth.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'Codex Primary Workbench',
        status: 'active',
        email: 'team-codex@example.com',
        planType: 'Pro',
        name: 'team-codex-auth.json',
        baseUrl: 'https://api.openai.com/v1',
        supportedFormats: ['openai_chat', 'openai_responses'],
      },
      primaryLabel: 'Codex Primary Workbench',
      onCancelDelete: () => undefined,
      onConfirmDelete: () => undefined,
    }),
  );

  assert.match(markup, /data-account-card-delete-overlay="true"/);
  assert.match(markup, /data-account-card-delete-overlay-density="list"/);
  assert.match(markup, /flex h-full min-h-\[5rem\] items-center gap-3 overflow-hidden rounded-md border border-\[var\(--gt-border-subtle\)\]/);
  assert.match(markup, /data-account-card-delete-overlay-section="actions"/);
  assert.match(markup, /flex shrink-0 items-center gap-2/);
  assert.match(markup, /common\.cancel/);
  assert.match(markup, /common\.delete/);
  assert.doesNotMatch(markup, /border-t-2 border-\[color-mix\(in_srgb,var\(--text-primary\)_58%,var\(--border-color\)\)\]/);
  assert.doesNotMatch(markup, /grid gap-2 pt-3/);
});

test('AttributionCard positions delete overlays across the full account card frame', () => {
  const source = readFileSync(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /const overlayFrameClass =/);
  assert.match(source, /absolute -inset-y-0\.5 -left-1\.5 -right-0\.5 z-20/);
  assert.match(source, /absolute -inset-y-0\.5 -left-2 -right-0\.5 z-20/);
  assert.match(source, /\{overlay \? <div className=\{overlayFrameClass\}>\{overlay\}<\/div> : null\}/);
});
