import type { MutableRefObject } from 'react';
import { ClipboardPaste, KeyRound, LogIn, Menu, Plus, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { Translator } from '../model/types';
import {
  ACCOUNT_HEADER_MENU_ICON_CLASS,
  ACCOUNT_HEADER_MENU_ITEM_CLASS,
  ACCOUNT_HEADER_MENU_LABEL_CLASS,
  ACCOUNT_HEADER_MENU_PANEL_CLASS,
  ACCOUNT_HEADER_MENU_SEPARATOR_CLASS,
  buildAccountsHeaderMenuItems,
  type AccountHeaderMenuIcon,
} from './accountHeaderMenu';

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
  onOpenUnifiedCompose?: () => void;
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
  onOpenUnifiedCompose,
}: AccountsHeaderProps) {
  const headerActionsMenuItems = buildAccountsHeaderMenuItems({
    ready,
    loading,
    includeUnifiedCompose: Boolean(onOpenUnifiedCompose),
    includeRotationSettings: Boolean(onOpenRotationModal),
  });

  function closeMenu() {
    if (isHeaderActionsMenuOpen) {
      onToggleMenu();
    }
  }

  function handleMenuAction(action: () => void) {
    closeMenu();
    action();
  }

  function renderMenuIcon(icon: AccountHeaderMenuIcon) {
    switch (icon) {
      case 'plus':
        return <Plus className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'log-in':
        return <LogIn className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'upload':
        return <Upload className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'clipboard-paste':
        return <ClipboardPaste className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'key-round':
        return <KeyRound className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'rotate-ccw':
        return <RotateCcw className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      default:
        return null;
    }
  }

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
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} strokeWidth={3} />
            </button>
            <div ref={headerActionsMenuRef} className="relative">
              <button
                onClick={onToggleMenu}
                className="btn-swiss flex h-11 w-11 items-center justify-center !px-0"
                aria-label={t('accounts.header_actions_menu')}
                aria-expanded={isHeaderActionsMenuOpen}
                aria-haspopup="menu"
              >
                <Menu className="h-5 w-5" strokeWidth={3} />
              </button>
              {isHeaderActionsMenuOpen ? (
                <div className={ACCOUNT_HEADER_MENU_PANEL_CLASS}>
                  <div className="grid gap-1">
                    {headerActionsMenuItems.map((item) => (
                      <div key={item.id} className="grid gap-1">
                        {item.dividerBefore ? <div className={ACCOUNT_HEADER_MENU_SEPARATOR_CLASS} /> : null}
                        <button
                          type="button"
                          onClick={() => {
                            if (item.id === 'unified-compose') {
                              handleMenuAction(() => {
                                onOpenUnifiedCompose?.();
                              });
                              return;
                            }

                            if (item.id === 'chatgpt-login') {
                              handleMenuAction(() => {
                                onStartCodexOAuth();
                              });
                              return;
                            }

                            if (item.id === 'import-auth-file') {
                              handleMenuAction(() => {
                                fileInputRef.current?.click();
                              });
                              return;
                            }

                            if (item.id === 'paste-auth-file') {
                              handleMenuAction(() => {
                                onOpenPasteModal();
                              });
                              return;
                            }

                            if (item.id === 'codex-api-key') {
                              handleMenuAction(() => {
                                onOpenApiKeyModal();
                              });
                              return;
                            }

                            if (item.id === 'rotation-settings') {
                              handleMenuAction(() => {
                                onOpenRotationModal?.();
                              });
                            }
                          }}
                          disabled={item.disabled}
                          className={`${ACCOUNT_HEADER_MENU_ITEM_CLASS} ${item.emphasis ? 'bg-[var(--bg-surface)]' : ''}`}
                          data-account-header-menu-item={item.id}
                        >
                          {renderMenuIcon(item.icon)}
                          <span className={ACCOUNT_HEADER_MENU_LABEL_CLASS}>{t(item.labelKey)}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        }
      />
    </div>
  );
}
