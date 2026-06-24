import { createElement, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AccountRecord } from '../../../types';
import type { Translator } from '../model/types';
import { sourceLabel } from '../model/accountPresentation.ts';

interface BuildAccountDeleteOverlayParams {
  t: Translator;
  account: AccountRecord;
  primaryLabel: string;
  density?: 'full' | 'list';
  onCancelDelete: () => void;
  onConfirmDelete: (account: AccountRecord) => void;
}

const accountDeleteOverlayShellClass =
  'flex h-full flex-col overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)]';
const accountDeleteOverlayListShellClass =
  'flex h-full min-h-[5rem] items-center gap-3 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[var(--gt-ink-primary)]';
const accountDeleteOverlayHeaderClass =
  'border-b border-[var(--gt-border-subtle)] bg-[color-mix(in_srgb,var(--gt-status-danger)_7%,var(--gt-surface-muted))] px-4 py-3';
const accountDeleteOverlayIconClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[color-mix(in_srgb,var(--gt-status-danger)_36%,var(--gt-border-subtle))] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)]';
const accountDeleteOverlayEyebrowClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-status-danger)]';
const accountDeleteOverlayTitleClass =
  'mt-1 truncate text-[length:var(--gt-font-size-xl-plus)] font-semibold leading-tight text-[var(--gt-ink-primary)]';
const accountDeleteOverlayListTitleClass =
  'mt-1 truncate text-[length:var(--gt-font-size-lg)] font-semibold leading-tight text-[var(--gt-ink-primary)]';
const accountDeleteOverlayMetaClass =
  'mt-1 truncate font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountDeleteOverlayButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)]';
const accountDeleteOverlayListButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2.5 py-1.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)]';
const accountDeleteOverlayDangerButtonClass =
  'rounded border border-[var(--gt-status-danger)] bg-[var(--gt-status-danger)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-surface-canvas)]';
const accountDeleteOverlayListDangerButtonClass =
  'rounded border border-[var(--gt-status-danger)] bg-[var(--gt-status-danger)] px-2.5 py-1.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-surface-canvas)]';
const accountDeleteOverlayFieldLabelClass =
  'w-[3rem] shrink-0 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountDeleteOverlayFieldValueClass =
  'min-w-0 truncate text-[length:var(--gt-font-size-xs)] font-semibold leading-snug text-[var(--gt-ink-primary)]';

export function buildAccountDeleteOverlay({
  t,
  account,
  primaryLabel,
  density = 'full',
  onCancelDelete,
  onConfirmDelete,
}: BuildAccountDeleteOverlayParams): ReactNode {
  const basicInfoRows = [
    { label: '账号', value: primaryLabel },
    { label: '来源', value: sourceLabel(t, account.credentialSource) },
  ];

  if (density === 'list') {
    return createElement(
      'div',
      {
        className: accountDeleteOverlayListShellClass,
        'data-account-card-delete-overlay': 'true',
        'data-account-card-delete-overlay-density': 'list',
        'data-account-card-ignore-click': 'true',
        onClick: (event: MouseEvent) => event.stopPropagation(),
        onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
      },
      createElement(
        'span',
        {
          className: accountDeleteOverlayIconClass,
        },
        createElement(AlertTriangle, { size: 19, strokeWidth: 3 }),
      ),
      createElement(
        'div',
        { className: 'min-w-0 flex-1' },
        createElement(
          'div',
          { className: accountDeleteOverlayEyebrowClass },
          t('common.confirm_delete'),
        ),
        createElement(
          'div',
          { className: accountDeleteOverlayListTitleClass },
          primaryLabel,
        ),
        createElement(
          'div',
          { className: accountDeleteOverlayMetaClass },
          sourceLabel(t, account.credentialSource),
        ),
      ),
      createElement(
        'div',
        { className: 'flex shrink-0 items-center gap-2', 'data-account-card-delete-overlay-section': 'actions' },
        createElement(
          'button',
          {
            type: 'button',
            onClick: onCancelDelete,
            className: accountDeleteOverlayListButtonClass,
          },
          t('common.cancel'),
        ),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => onConfirmDelete(account),
            className: accountDeleteOverlayListDangerButtonClass,
          },
          t('common.delete'),
        ),
      ),
    );
  }

  return createElement(
    'div',
    {
      className: accountDeleteOverlayShellClass,
      'data-account-card-delete-overlay': 'true',
      'data-account-card-ignore-click': 'true',
      onClick: (event: MouseEvent) => event.stopPropagation(),
      onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
    },
    createElement(
      'div',
      {
        className: accountDeleteOverlayHeaderClass,
        'data-account-card-delete-overlay-section': 'header',
      },
      createElement(
        'div',
        { className: 'flex min-w-0 items-start gap-3' },
        createElement(
          'span',
          {
            className: accountDeleteOverlayIconClass,
          },
          createElement(AlertTriangle, { size: 19, strokeWidth: 3 }),
        ),
        createElement(
          'div',
          { className: 'min-w-0' },
          createElement(
            'div',
            {
              className: accountDeleteOverlayEyebrowClass,
            },
            t('common.confirm_delete'),
          ),
          createElement(
            'div',
            { className: accountDeleteOverlayTitleClass },
            primaryLabel,
          ),
        ),
      ),
    ),
    createElement(
      'div',
      { className: 'flex flex-1 flex-col px-4 py-4', 'data-account-card-delete-overlay-section': 'details' },
      createElement(
        'div',
        { className: 'flex items-center gap-2' },
        createElement('span', { className: 'h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--gt-status-danger)]' }),
        createElement(
          'div',
          { className: 'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]' },
          t('accounts.card_delete'),
        ),
      ),
      createElement('div', { className: 'mt-3 h-px bg-[var(--gt-border-subtle)]' }),
      createElement(
        'div',
        { className: 'grid gap-2 pt-3' },
        basicInfoRows.map((row) =>
          createElement(
            'div',
            {
              key: row.label,
              className:
                'flex items-center gap-3 border-b border-[var(--gt-border-subtle)] pb-2 last:border-b-0 last:pb-0',
            },
            createElement(
              'div',
              { className: accountDeleteOverlayFieldLabelClass },
              row.label,
            ),
            createElement(
              'div',
              { className: accountDeleteOverlayFieldValueClass },
              row.value,
            ),
          ),
        ),
      ),
    ),
    createElement(
      'div',
      {
        className:
          'flex items-center justify-between gap-3 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3',
        'data-account-card-delete-overlay-section': 'actions',
      },
      createElement(
        'button',
        {
          type: 'button',
          onClick: onCancelDelete,
          className: accountDeleteOverlayButtonClass,
        },
        t('common.cancel'),
      ),
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => onConfirmDelete(account),
          className: accountDeleteOverlayDangerButtonClass,
        },
        t('common.delete'),
      ),
    ),
  );
}
