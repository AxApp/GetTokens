import { type CodexAccountSourceKind, type CodexRoutePolicyRowMode } from '../model/codexAccountList';

export function sourceKindLabel(t: (key: string) => string, sourceKind: CodexAccountSourceKind) {
  if (sourceKind === 'codex-auth-file') {
    return t('codex.account_list_source_auth_file');
  }
  if (sourceKind === 'codex-api-key') {
    return t('codex.account_list_source_api_key');
  }
  return t('codex.account_list_source_openai_compatible');
}

export function routePolicyModeLabel(t: (key: string) => string, mode: CodexRoutePolicyRowMode) {
  if (mode === 'allow') {
    return t('codex.account_list_policy_mode_allow');
  }
  if (mode === 'deny') {
    return t('codex.account_list_policy_mode_deny');
  }
  if (mode === 'blocked') {
    return t('codex.account_list_policy_mode_blocked');
  }
  return t('codex.account_list_policy_mode_default');
}

export function buildEndpointLabel(row: { baseUrl: string; provider: string; prefix?: string; keySuffix?: string }) {
  return [
    row.baseUrl || row.provider,
    row.prefix,
    row.keySuffix ? `****${row.keySuffix}` : '',
  ].filter(Boolean).join(' / ');
}
