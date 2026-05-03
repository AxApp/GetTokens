import type { MutableRefObject } from 'react';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { Translator } from '../model/types';

interface AccountsHeaderProps {
  t: Translator;
  accountCount: number;
  ready: boolean;
  loading: boolean;
  isHeaderActionsMenuOpen: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
  onUploadAccounts: (files: FileList | null) => Promise<void> | void;
  onToggleMenu: () => void;
  onOpenPasteModal: () => void;
  onOpenApiKeyModal: () => void;
  onOpenRotationModal?: () => void;
  onStartCodexOAuth: () => void;
  onRefresh: () => void;
}

export default function AccountsHeader({
  t,
  accountCount,
  ready,
  loading,
  isHeaderActionsMenuOpen,
  fileInputRef,
  headerActionsMenuRef,
  onUploadAccounts,
  onToggleMenu,
  onOpenPasteModal,
  onOpenApiKeyModal,
  onOpenRotationModal,
  onStartCodexOAuth,
  onRefresh,
}: AccountsHeaderProps) {
  const headerImportActions = (
    <>
      <button onClick={onStartCodexOAuth} className="btn-swiss whitespace-nowrap" disabled={!ready || loading}>
        {t('accounts.login_chatgpt')}
      </button>
      <button
        onClick={() => {
          fileInputRef.current?.click();
        }}
        className="btn-swiss whitespace-nowrap"
        disabled={!ready || loading}
      >
        {t('accounts.import_auth_file')}
      </button>
      <button onClick={onOpenPasteModal} className="btn-swiss whitespace-nowrap" disabled={!ready || loading}>
        {t('accounts.paste_auth_file')}
      </button>
      <button onClick={onOpenApiKeyModal} className="btn-swiss whitespace-nowrap">
        {t('accounts.add_codex_api_key')}
      </button>
      {onOpenRotationModal ? (
        <button onClick={onOpenRotationModal} className="btn-swiss whitespace-nowrap" disabled={!ready || loading}>
          {t('accounts.rotation_settings')}
        </button>
      ) : null}
    </>
  );

  return (
    <div className="contents">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        hidden
        onChange={(event) => {
          void onUploadAccounts(event.target.files);
          event.target.value = '';
        }}
      />
      <WorkspacePageHeader
        title={t('accounts.title')}
        subtitle={
          <>
            {t('accounts.subtitle')} / {accountCount} UNITS
          </>
        }
        actions={
          <>
            <button
              onClick={onRefresh}
              className="btn-swiss flex h-11 w-11 items-center justify-center !px-0"
              disabled={!ready || loading}
              title={t('common.refresh')}
            >
              <svg
                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <div ref={headerActionsMenuRef} className="relative">
              <button
                onClick={onToggleMenu}
                className="btn-swiss flex h-11 w-11 items-center justify-center !px-0"
                aria-label="Open account actions menu"
              >
                <span className="flex flex-col gap-1.5">
                  <span className="block h-0.5 w-4 bg-[var(--text-primary)]" />
                  <span className="block h-0.5 w-4 bg-[var(--text-primary)]" />
                  <span className="block h-0.5 w-4 bg-[var(--text-primary)]" />
                </span>
              </button>
              {isHeaderActionsMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-3 flex min-w-[220px] flex-col gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[8px_8px_0_var(--shadow-color)]">
                  {headerImportActions}
                </div>
              ) : null}
            </div>
          </>
        }
      />
    </div>
  );
}
