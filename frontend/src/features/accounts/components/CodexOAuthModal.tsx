import { useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import { buildCodexOAuthDialogHint, buildCodexOAuthDialogTitle } from '../model/accountOAuth';
import type { Translator } from '../model/types';

interface CodexOAuthModalProps {
  t: Translator;
  existingName?: string | null;
  url: string;
  onClose: () => void;
  onOpenInBrowser: () => void;
  onCopyUrl?: (url: string) => Promise<void> | void;
  initialCopyState?: 'idle' | 'success' | 'error';
}

const codexOAuthModalHeaderClass =
  'grid gap-1';
const codexOAuthModalEyebrowClass =
  'text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexOAuthModalTitleClass =
  'text-[length:var(--gt-font-size-lg)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const codexOAuthModalHintClass =
  'text-[length:var(--gt-font-size-md-compact)] font-normal leading-relaxed text-[var(--gt-ink-secondary)]';
const codexOAuthModalFooterClass =
  'flex flex-wrap items-center justify-end gap-2';
const codexOAuthModalButtonClass =
  'inline-flex h-9 items-center justify-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)]';
const codexOAuthModalPrimaryButtonClass =
  'inline-flex h-9 items-center justify-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-ink-primary)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-surface-canvas)] transition hover:opacity-90';
const codexOAuthModalLabelClass =
  'text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexOAuthModalUrlClass =
  'break-all rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 font-mono text-[length:var(--gt-font-size-md-compact)] leading-relaxed text-[var(--gt-ink-primary)]';
const codexOAuthModalStatusBaseClass =
  'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal';
const codexOAuthModalStatusToneClass = {
  success: 'text-[var(--gt-status-success)]',
  error: 'text-[var(--gt-status-danger)]',
} satisfies Record<'success' | 'error', string>;

export default function CodexOAuthModal({
  t,
  existingName,
  url,
  onClose,
  onOpenInBrowser,
  onCopyUrl,
  initialCopyState = 'idle',
}: CodexOAuthModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(initialCopyState);

  async function handleCopy() {
    try {
      if (onCopyUrl) {
        await onCopyUrl(url);
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <ModalFrame
      onClose={onClose}
      size="md"
      portal
      coverViewport
      zIndexClassName="z-[70]"
      ariaLabel={buildCodexOAuthDialogTitle(t, existingName)}
      header={
        <div data-codex-oauth-dialog-header="quiet" className={codexOAuthModalHeaderClass}>
          <div className={codexOAuthModalEyebrowClass}>
            {t('accounts.login_chatgpt')}
          </div>
          <h3 className={codexOAuthModalTitleClass}>
            {buildCodexOAuthDialogTitle(t, existingName)}
          </h3>
        </div>
      }
      headerClassName="px-6 py-4"
      bodyClassName="space-y-4 p-6"
      footerClassName="sm:!justify-end"
      footer={
        <div className={codexOAuthModalFooterClass}>
          <button onClick={onClose} className={codexOAuthModalButtonClass}>
            {t('common.close')}
          </button>
          <button onClick={() => void handleCopy()} className={codexOAuthModalButtonClass}>
            {t('accounts.oauth_dialog_copy_url')}
          </button>
          <button onClick={onOpenInBrowser} className={codexOAuthModalPrimaryButtonClass}>
            {t('accounts.oauth_dialog_open_url')}
          </button>
        </div>
      }
    >
      <p className={codexOAuthModalHintClass}>
        {buildCodexOAuthDialogHint(t, existingName)}
      </p>
      <div className="space-y-2">
        <div className={codexOAuthModalLabelClass}>
          {t('accounts.oauth_dialog_url_label')}
        </div>
        <div data-codex-oauth-dialog-url="quiet" className={codexOAuthModalUrlClass}>
          {url}
        </div>
        {copyState !== 'idle' ? (
          <div
            data-codex-oauth-dialog-copy-state={copyState}
            className={`${codexOAuthModalStatusBaseClass} ${codexOAuthModalStatusToneClass[copyState]}`}
          >
            {copyState === 'success' ? t('accounts.oauth_dialog_copy_success') : t('accounts.oauth_dialog_copy_failed')}
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}
