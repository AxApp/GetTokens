export type AccountHeaderMenuIcon = 'plus' | 'log-in' | 'upload' | 'key-round' | 'rotate-ccw';

export interface AccountHeaderMenuItem {
  id: 'unified-compose' | 'chatgpt-login' | 'account-import' | 'codex-api-key' | 'rotation-settings';
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
  'absolute right-0 top-full z-20 mt-2 w-[19rem] rounded-lg border p-2';
export const ACCOUNT_HEADER_MENU_PANEL_STYLE = {
  borderColor: 'var(--gt-border-subtle)',
  backgroundColor: 'var(--gt-surface-raised)',
  boxShadow: 'var(--gt-elevation-raised-2)',
} as const;

export const ACCOUNT_HEADER_MENU_ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-left text-[length:var(--gt-font-size-md)] font-medium leading-snug text-[var(--gt-ink-primary)] transition-[background-color] hover:bg-[var(--gt-surface-muted)] focus-visible:bg-[var(--gt-surface-muted)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45';

export const ACCOUNT_HEADER_MENU_ICON_CLASS = 'h-5 w-5 shrink-0 text-[var(--gt-ink-muted)]';
export const ACCOUNT_HEADER_MENU_LABEL_CLASS = 'min-w-0 flex-1 truncate';
export const ACCOUNT_HEADER_MENU_SEPARATOR_CLASS = 'mx-2 my-1 h-px bg-[var(--gt-border-subtle)]';

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
      id: 'account-import',
      labelKey: 'accounts.import_accounts',
      icon: 'upload',
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
