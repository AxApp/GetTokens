import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildAccountDeleteOverlay } from '../components/accountDeleteOverlay.ts';

const t = (key) => key;

test('buildAccountDeleteOverlay renders a full-card delete overlay', () => {
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

  assert.match(markup, /data-account-card-delete-overlay="true"/);
  assert.match(markup, /flex h-full flex-col overflow-hidden border-2 border-\[color-mix\(in_srgb,var\(--color-status-danger\)_50%,var\(--border-color\)\)\]/);
  assert.match(markup, /bg-\[linear-gradient\(180deg,color-mix\(in_srgb,white_72%,var\(--bg-main\)\)_0%,color-mix\(in_srgb,var\(--bg-main\)_84%,white\)_100%\)\]/);
  assert.match(markup, /backdrop-blur-\[14px\]/);
  assert.match(markup, /text-\[length:var\(--font-size-ui-xl-plus\)\] font-black italic/);
  assert.match(markup, /flex flex-1 flex-col px-4 py-4/);
  assert.match(markup, /mt-3 h-px bg-\[color-mix\(in_srgb,var\(--border-color\)_66%,transparent\)\]/);
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
  assert.match(markup, /flex h-full min-h-\[5rem\] items-center gap-3/);
  assert.match(markup, /flex shrink-0 items-center gap-2/);
  assert.match(markup, /common\.cancel/);
  assert.match(markup, /common\.delete/);
  assert.doesNotMatch(markup, /border-t-2 border-\[color-mix\(in_srgb,var\(--text-primary\)_58%,var\(--border-color\)\)\]/);
  assert.doesNotMatch(markup, /grid gap-2 pt-3/);
});

test('buildAccountDeleteOverlay keeps compact mode delete actions inside the card', () => {
  const markup = renderToStaticMarkup(
    buildAccountDeleteOverlay({
      t,
      density: 'compact',
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
  assert.match(markup, /data-account-card-delete-overlay-density="compact"/);
  assert.match(markup, /flex h-full min-h-\[10rem\] flex-col/);
  assert.match(markup, /flex shrink-0 items-center justify-between gap-2/);
  assert.match(markup, /common\.cancel/);
  assert.match(markup, /common\.delete/);
  assert.doesNotMatch(markup, /text-\[length:var\(--font-size-ui-xl-plus\)\]/);
  assert.doesNotMatch(markup, /px-4 py-4/);
});

test('AttributionCard positions delete overlays across the full account card frame', () => {
  const source = readFileSync(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /const overlayFrameClass =/);
  assert.match(source, /absolute -inset-y-0\.5 -left-1\.5 -right-0\.5 z-20/);
  assert.match(source, /absolute -inset-y-0\.5 -left-2 -right-0\.5 z-20/);
  assert.match(source, /\{overlay \? <div className=\{overlayFrameClass\}>\{overlay\}<\/div> : null\}/);
});
