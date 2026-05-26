import { createElement, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AccountRecord } from '../../../types';
import type { Translator } from '../model/types';
import { sourceLabel } from '../model/accountPresentation.ts';

interface BuildAccountDeleteOverlayParams {
  t: Translator;
  account: AccountRecord;
  primaryLabel: string;
  density?: 'full' | 'compact' | 'list';
  onCancelDelete: () => void;
  onConfirmDelete: (account: AccountRecord) => void;
}

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

  if (density === 'compact') {
    return createElement(
      'div',
      {
        className:
          'flex h-full min-h-[10rem] flex-col overflow-hidden border-2 border-[color-mix(in_srgb,var(--color-status-danger)_50%,var(--border-color))] bg-[linear-gradient(180deg,color-mix(in_srgb,white_74%,var(--bg-main))_0%,color-mix(in_srgb,var(--bg-main)_88%,white)_100%)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_78%,transparent),0_12px_32px_color-mix(in_srgb,var(--shadow-color)_18%,transparent)] backdrop-blur-[14px]',
        'data-account-card-delete-overlay': 'true',
        'data-account-card-delete-overlay-density': 'compact',
        'data-account-card-ignore-click': 'true',
        onClick: (event: MouseEvent) => event.stopPropagation(),
        onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
      },
      createElement(
        'div',
        {
          className:
            'flex min-w-0 items-center gap-2 border-b-2 border-[color-mix(in_srgb,var(--color-status-danger)_28%,var(--border-color))] px-3 py-2',
        },
        createElement(
          'span',
          {
            className:
              'flex h-8 w-8 shrink-0 items-center justify-center border border-[color-mix(in_srgb,var(--color-status-danger)_36%,var(--border-color))] bg-[color-mix(in_srgb,white_72%,transparent)] text-[var(--color-status-danger)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_90%,transparent)]',
          },
          createElement(AlertTriangle, { size: 16, strokeWidth: 3 }),
        ),
        createElement(
          'div',
          { className: 'min-w-0' },
          createElement(
            'div',
            { className: 'font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--color-status-danger)]' },
            t('common.confirm_delete'),
          ),
          createElement(
            'div',
            { className: 'mt-0.5 truncate text-[length:var(--font-size-ui-lg)] font-black italic leading-tight text-[var(--text-primary)]' },
            primaryLabel,
          ),
        ),
      ),
      createElement(
        'div',
        { className: 'flex flex-1 flex-col px-3 py-2' },
        createElement(
          'div',
          { className: 'flex items-center gap-2' },
          createElement('span', { className: 'h-2 w-2 shrink-0 bg-[var(--color-status-danger)]' }),
          createElement(
            'div',
            { className: 'text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--color-status-danger)]' },
            t('accounts.card_delete'),
          ),
        ),
        createElement('div', { className: 'mt-2 h-px bg-[color-mix(in_srgb,var(--border-color)_60%,transparent)]' }),
        createElement(
          'div',
          { className: 'grid gap-1.5 pt-2' },
          basicInfoRows.map((row) =>
            createElement(
              'div',
              {
                key: row.label,
                className:
                  'flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--border-color)_48%,transparent)] pb-1.5 last:border-b-0 last:pb-0',
              },
              createElement(
                'div',
                { className: 'w-[2.75rem] shrink-0 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]' },
                row.label,
              ),
              createElement(
                'div',
                { className: 'min-w-0 truncate text-[length:var(--font-size-ui-2xs)] font-black leading-snug text-[var(--text-primary)]' },
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
            'flex shrink-0 items-center justify-between gap-2 border-t-2 border-[color-mix(in_srgb,var(--text-primary)_54%,var(--border-color))] px-3 py-2',
        },
        createElement(
          'button',
          {
            type: 'button',
            onClick: onCancelDelete,
            className: 'btn-swiss !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)]',
          },
          t('common.cancel'),
        ),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => onConfirmDelete(account),
            className:
              'btn-swiss !border-[var(--color-status-danger)] !bg-[var(--color-status-danger)] !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)] !text-white',
          },
          t('common.delete'),
        ),
      ),
    );
  }

  if (density === 'list') {
    return createElement(
      'div',
      {
        className:
          'flex h-full min-h-[5rem] items-center gap-3 overflow-hidden border-2 border-[color-mix(in_srgb,var(--color-status-danger)_50%,var(--border-color))] bg-[linear-gradient(180deg,color-mix(in_srgb,white_74%,var(--bg-main))_0%,color-mix(in_srgb,var(--bg-main)_88%,white)_100%)] px-3 py-2 shadow-[inset_0_1px_0_color-mix(in_srgb,white_78%,transparent),0_10px_28px_color-mix(in_srgb,var(--shadow-color)_18%,transparent)] backdrop-blur-[14px]',
        'data-account-card-delete-overlay': 'true',
        'data-account-card-delete-overlay-density': 'list',
        'data-account-card-ignore-click': 'true',
        onClick: (event: MouseEvent) => event.stopPropagation(),
        onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
      },
      createElement(
        'span',
        {
          className:
            'flex h-10 w-10 shrink-0 items-center justify-center border border-[color-mix(in_srgb,var(--color-status-danger)_36%,var(--border-color))] bg-[color-mix(in_srgb,white_72%,transparent)] text-[var(--color-status-danger)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_90%,transparent)]',
        },
        createElement(AlertTriangle, { size: 19, strokeWidth: 3 }),
      ),
      createElement(
        'div',
        { className: 'min-w-0 flex-1' },
        createElement(
          'div',
          { className: 'font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--color-status-danger)]' },
          t('common.confirm_delete'),
        ),
        createElement(
          'div',
          { className: 'mt-1 truncate text-[length:var(--font-size-ui-lg)] font-black italic leading-tight text-[var(--text-primary)]' },
          primaryLabel,
        ),
        createElement(
          'div',
          { className: 'mt-1 truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]' },
          sourceLabel(t, account.credentialSource),
        ),
      ),
      createElement(
        'div',
        { className: 'flex shrink-0 items-center gap-2' },
        createElement(
          'button',
          {
            type: 'button',
            onClick: onCancelDelete,
            className: 'btn-swiss !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)]',
          },
          t('common.cancel'),
        ),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => onConfirmDelete(account),
            className:
              'btn-swiss !border-[var(--color-status-danger)] !bg-[var(--color-status-danger)] !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)] !text-white',
          },
          t('common.delete'),
        ),
      ),
    );
  }

  return createElement(
    'div',
    {
      className:
        'flex h-full flex-col overflow-hidden border-2 border-[color-mix(in_srgb,var(--color-status-danger)_50%,var(--border-color))] bg-[linear-gradient(180deg,color-mix(in_srgb,white_72%,var(--bg-main))_0%,color-mix(in_srgb,var(--bg-main)_84%,white)_100%)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_78%,transparent),0_18px_44px_color-mix(in_srgb,var(--shadow-color)_22%,transparent)] backdrop-blur-[14px]',
      'data-account-card-delete-overlay': 'true',
      'data-account-card-ignore-click': 'true',
      onClick: (event: MouseEvent) => event.stopPropagation(),
      onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
    },
    createElement(
      'div',
      {
        className:
          'border-b-2 border-[color-mix(in_srgb,var(--color-status-danger)_28%,var(--border-color))] bg-[linear-gradient(180deg,color-mix(in_srgb,white_86%,transparent)_0%,color-mix(in_srgb,var(--bg-main)_86%,white)_100%)] px-4 py-3 shadow-[inset_0_1px_0_color-mix(in_srgb,white_86%,transparent)]',
      },
      createElement(
        'div',
        { className: 'flex min-w-0 items-start gap-3' },
        createElement(
          'span',
          {
            className:
              'flex h-10 w-10 shrink-0 items-center justify-center border border-[color-mix(in_srgb,var(--color-status-danger)_36%,var(--border-color))] bg-[color-mix(in_srgb,white_72%,transparent)] text-[var(--color-status-danger)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_90%,transparent)]',
          },
          createElement(AlertTriangle, { size: 19, strokeWidth: 3 }),
        ),
        createElement(
          'div',
          { className: 'min-w-0' },
          createElement(
            'div',
            {
              className:
                'font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--color-status-danger)]',
            },
            t('common.confirm_delete'),
          ),
          createElement(
            'div',
            { className: 'mt-1 truncate text-[length:var(--font-size-ui-xl-plus)] font-black italic leading-tight text-[var(--text-primary)]' },
            primaryLabel,
          ),
        ),
      ),
    ),
    createElement(
      'div',
      { className: 'flex flex-1 flex-col px-4 py-4' },
      createElement(
        'div',
        { className: 'flex items-center gap-2' },
        createElement('span', { className: 'h-2.5 w-2.5 shrink-0 bg-[var(--color-status-danger)]' }),
        createElement(
          'div',
          { className: 'text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.14em] text-[var(--color-status-danger)]' },
          t('accounts.card_delete'),
        ),
      ),
      createElement('div', { className: 'mt-3 h-px bg-[color-mix(in_srgb,var(--border-color)_66%,transparent)]' }),
      createElement(
        'div',
        { className: 'grid gap-2 pt-3' },
        basicInfoRows.map((row) =>
          createElement(
            'div',
            {
              key: row.label,
              className:
                'flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--border-color)_56%,transparent)] pb-2 last:border-b-0 last:pb-0',
            },
            createElement(
              'div',
              { className: 'w-[3rem] shrink-0 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]' },
              row.label,
            ),
            createElement(
              'div',
              { className: 'min-w-0 truncate text-[length:var(--font-size-ui-xs)] font-black leading-snug text-[var(--text-primary)]' },
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
          'flex items-center justify-between gap-3 border-t-2 border-[color-mix(in_srgb,var(--text-primary)_58%,var(--border-color))] bg-[linear-gradient(180deg,color-mix(in_srgb,white_82%,transparent)_0%,color-mix(in_srgb,var(--bg-main)_92%,white)_100%)] px-4 py-3 shadow-[0_-1px_0_color-mix(in_srgb,white_82%,transparent)]',
      },
      createElement(
        'button',
        {
          type: 'button',
          onClick: onCancelDelete,
          className: 'btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)]',
        },
        t('common.cancel'),
      ),
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => onConfirmDelete(account),
          className:
            'btn-swiss !border-[var(--color-status-danger)] !bg-[var(--color-status-danger)] !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] !text-white',
        },
        t('common.delete'),
      ),
    ),
  );
}
