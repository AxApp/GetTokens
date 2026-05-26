export type AccountHeaderMenuIcon = 'plus' | 'log-in' | 'upload' | 'clipboard-paste' | 'key-round' | 'rotate-ccw';

export interface AccountHeaderMenuItem {
  id: 'unified-compose' | 'chatgpt-login' | 'import-auth-file' | 'paste-auth-file' | 'codex-api-key' | 'rotation-settings';
  labelKey: string;
  icon: AccountHeaderMenuIcon;
  disabled: boolean;
  dividerBefore?: boolean;
  emphasis?: boolean;
}

export interface BuildAccountHeaderMenuItemsOptions {
  ready: boolean;
  loading: boolean;
  includeUnifiedCompose: boolean;
  includeRotationSettings: boolean;
}

export const ACCOUNT_HEADER_MENU_PANEL_CLASS =
  'absolute right-0 top-full z-20 mt-3 w-[19rem] border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[8px_8px_0_var(--shadow-color)]';

export const ACCOUNT_HEADER_MENU_ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-3 border-0 bg-transparent px-3 py-2.5 text-left text-[length:var(--font-size-ui-md)] font-black uppercase leading-snug tracking-[0.08em] text-[var(--text-primary)] transition-[background-color,transform] hover:bg-[var(--bg-surface)] focus-visible:bg-[var(--bg-surface)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45';

export const ACCOUNT_HEADER_MENU_ICON_CLASS = 'h-5 w-5 shrink-0 text-[var(--text-muted)]';
export const ACCOUNT_HEADER_MENU_LABEL_CLASS = 'min-w-0 flex-1 truncate';
export const ACCOUNT_HEADER_MENU_SEPARATOR_CLASS = 'mx-2 my-1 h-px bg-[var(--border-color)]';

export function buildAccountsHeaderMenuItems({
  ready,
  loading,
  includeUnifiedCompose,
  includeRotationSettings,
}: BuildAccountHeaderMenuItemsOptions): AccountHeaderMenuItem[] {
  const importDisabled = !ready || loading;
  const items: AccountHeaderMenuItem[] = [];

  if (includeUnifiedCompose) {
    items.push({
      id: 'unified-compose',
      labelKey: 'accounts.add_account',
      icon: 'plus',
      disabled: false,
      emphasis: true,
    });
  }

  items.push(
    {
      id: 'chatgpt-login',
      labelKey: 'accounts.login_chatgpt',
      icon: 'log-in',
      disabled: importDisabled,
      dividerBefore: includeUnifiedCompose,
    },
    {
      id: 'import-auth-file',
      labelKey: 'accounts.import_auth_file',
      icon: 'upload',
      disabled: importDisabled,
    },
    {
      id: 'paste-auth-file',
      labelKey: 'accounts.paste_auth_file',
      icon: 'clipboard-paste',
      disabled: importDisabled,
    },
    {
      id: 'codex-api-key',
      labelKey: 'accounts.add_codex_api_key',
      icon: 'key-round',
      disabled: false,
    },
  );

  if (includeRotationSettings) {
    items.push({
      id: 'rotation-settings',
      labelKey: 'accounts.rotation_settings',
      icon: 'rotate-ccw',
      disabled: importDisabled,
      dividerBefore: true,
    });
  }

  return items;
}
