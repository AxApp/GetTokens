import type { main } from '../../../../wailsjs/go/models';
import type { AccountRecord, ApiFormat, CredentialSource } from '../../../types';
import type { AccountUsageSummary } from './accountUsage';
import type { AccountStabilitySummary, QuotaDisplay, Translator } from './types';
import {
  buildChannelRouteDecisionSummary,
  type ChannelRouteDecisionSnapshot,
  buildRouteResilienceEvidenceDigests,
  type RouteResilienceEvidenceDigest,
} from '../../channel-routing/model/channelRouting.ts';
import { formatLabel, formatShortLabel } from './vendorPresetHelpers.ts';

export interface AccountAttributionBadge {
  label: string;
  shortLabel?: string;
  backgroundColor?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
}

function resolveSupportedFormats(provider: string): ApiFormat[] {
  switch (provider.trim().toLowerCase()) {
    case 'codex':
    case 'openai':
      return ['anthropic', 'openai_responses'];
    case 'deepseek':
    case 'zhipu':
    case 'glm':
    case 'kimi':
    case 'moonshot':
    case 'stepfun':
    case 'minimax':
    case 'doubao':
    case 'longcat':
    case 'xiaomimimo':
    case 'mimo':
    case 'bailian':
    case 'dashscope':
    case 'modelscope':
    case 'bailing':
    case 'ling':
    case 'siliconflow':
    case 'openrouter':
    case 'therouter':
      return ['anthropic', 'openai_chat'];
    case 'gemini':
    case 'google':
      return ['gemini_native'];
    case 'copilot':
    case 'github':
      return ['openai_chat'];
    default:
      return ['anthropic'];
  }
}

export function compareAccountRecords(left: AccountRecord, right: AccountRecord) {
  if (left.credentialSource === 'api-key' && right.credentialSource === 'api-key') {
    const leftPriority = Number(left.priority || 0);
    const rightPriority = Number(right.priority || 0);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
  }
  return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
}

export function sourceLabel(t: Translator, source: CredentialSource) {
  return source === 'auth-file' ? t('accounts.source_auth_file') : t('accounts.source_api_key');
}

export function providerLabel(account: AccountRecord) {
  return String(account.provider || 'unknown').trim().toUpperCase();
}

function replaceProviderPlaceholder(template: string, provider: string) {
  return template.replace('{provider}', provider);
}

export function resolveAccountSourceHeading(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.source_api_key_with_provider'), providerLabel(account));
}

export function resolveAccountProviderConfigHeading(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.provider_config_with_provider'), providerLabel(account));
}

export function resolveAccountConfigurationWorkspaceHeading(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.configuration_workspace_with_provider'), providerLabel(account));
}

export function resolveAccountAPIKeyPlainNotice(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.api_key_plain_notice_with_provider'), providerLabel(account));
}

export function resolveLoadedAccountIDs(authFileRecords: AccountRecord[], apiKeyAccounts: AccountRecord[]) {
  return [...authFileRecords.map((account) => account.id), ...apiKeyAccounts.map((account) => account.id)];
}

export function mapBackendAccountRecord(account: main.AccountRecord): AccountRecord {
  const credentialSource = account.credentialSource === 'api-key' ? 'api-key' : 'auth-file';
  let supportedFormats = (account.supportedFormats || []) as AccountRecord['supportedFormats'];

  // If backend returned codex defaults but base URL matches a known vendor, override
  if (credentialSource === 'api-key' && account.provider === 'codex') {
    const inferredProvider = inferProviderFromBaseURL(account.baseUrl);
    if (inferredProvider) {
      account.provider = inferredProvider;
      supportedFormats = resolveSupportedFormats(inferredProvider) as AccountRecord['supportedFormats'];
    }
  }

  return {
    ...account,
    credentialSource,
    supportedFormats,
    formatBaseUrls: (account.formatBaseUrls || {}) as AccountRecord['formatBaseUrls'],
  };
}

function inferProviderFromBaseURL(baseUrl?: string): string | null {
  if (!baseUrl) return null;
  const normalized = baseUrl.toLowerCase();
  if (normalized.includes('deepseek')) return 'deepseek';
  if (normalized.includes('bigmodel') || normalized.includes('zhipu')) return 'zhipu';
  if (normalized.includes('moonshot') || normalized.includes('kimi')) return 'kimi';
  if (normalized.includes('stepfun')) return 'stepfun';
  if (normalized.includes('dashscope') || normalized.includes('bailian')) return 'bailian';
  if (normalized.includes('minimax') || normalized.includes('minimaxi')) return 'minimax';
  if (normalized.includes('volces') || normalized.includes('doubao')) return 'doubao';
  if (normalized.includes('longcat')) return 'longcat';
  if (normalized.includes('xiaomimimo') || normalized.includes('mimo')) return 'xiaomimimo';
  if (normalized.includes('tbox')) return 'bailing';
  if (normalized.includes('openrouter')) return 'openrouter';
  if (normalized.includes('siliconflow')) return 'siliconflow';
  if (normalized.includes('novita')) return 'novita';
  if (normalized.includes('openai.com')) return 'openai';
  if (normalized.includes('groq')) return 'groq';
  if (normalized.includes('together')) return 'together';
  if (normalized.includes('nvidia')) return 'nvidia';
  if (normalized.includes('copilot') || normalized.includes('githubcopilot')) return 'copilot';
  if (normalized.includes('generativelanguage') || normalized.includes('googleapis')) return 'gemini';
  if (normalized.includes('aihubmix')) return 'aihubmix';
  if (normalized.includes('shengsuanyun')) return 'shengsuanyun';
  if (normalized.includes('modelscope')) return 'modelscope';
  if (normalized.includes('modelverse') || normalized.includes('compshare')) return 'compshare';
  if (normalized.includes('therouter')) return 'therouter';
  return null;
}

function accountFailureMessages(account: AccountRecord): string[] {
  return [
    account.runtimeReason,
    account.statusMessage,
    account.rawAuthFile?.statusMessage,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function translate(t: Translator | undefined, key: string, fallback: string) {
  if (!t) {
    return fallback;
  }
  const value = t(key);
  return value && value !== key ? value : fallback;
}

function isUsageLimitReachedText(value: unknown) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }
  return /\busage_limit_reached\b/i.test(text) || /usage limit has been reached/i.test(text);
}

function extractJSONStringField(raw: string, field: string) {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
  return match?.[1]?.trim() || '';
}

function extractJSONNumberField(raw: string, field: string) {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`, 'i'));
  if (!match?.[1]) {
    return 0;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function formatCompactDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  if (totalSeconds <= 0) {
    return '';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

function summarizeUsageLimitReachedReason(rawReason: string, t?: Translator) {
  const summary = translate(t, 'accounts.usage_limit_reached_reason', '用量已达上限，等待额度重置。');
  const planType = extractJSONStringField(rawReason, 'plan_type').toUpperCase();
  const resetsInSeconds = extractJSONNumberField(rawReason, 'resets_in_seconds');
  const duration = formatCompactDuration(resetsInSeconds);
  const resetPart = duration
    ? translate(t, 'accounts.usage_limit_reset_in', '约 {duration} 后重置').replace('{duration}', duration)
    : '';

  return [summary, planType, resetPart].filter(Boolean).join(' · ');
}

function normalizeFailureReason(rawReason: string, t?: Translator) {
  const reason = rawReason.trim();
  if (!reason) {
    return '';
  }
  if (isUsageLimitReachedText(reason)) {
    return summarizeUsageLimitReachedReason(reason, t);
  }
  return reason;
}

function isAccountUsageLimitReached(account: AccountRecord) {
  return accountFailureMessages(account).some(isUsageLimitReachedText);
}

export function resolveAccountFailureReason(account: AccountRecord, t?: Translator) {
  const runtimeStatus = String(account.runtimeStatus || '')
    .trim()
    .toLowerCase();
  if (runtimeStatus === 'degraded' || runtimeStatus === 'applied_not_registered') {
    return normalizeFailureReason(String(account.runtimeReason || account.statusMessage || account.rawAuthFile?.statusMessage || ''), t);
  }
  const status = String(account.status || '')
    .trim()
    .toUpperCase();
  if (status === 'ACTIVE' || status === 'CONFIGURED' || status === 'DISABLED' || status === 'LOCAL') {
    return '';
  }
  return normalizeFailureReason(String(account.statusMessage || account.rawAuthFile?.statusMessage || ''), t);
}

export function buildAccountDetailStatusMessage(account: AccountRecord, t: Translator) {
  const runtimeStatus = String(account.runtimeStatus || '')
    .trim()
    .toLowerCase();
  if (runtimeStatus === 'degraded' || runtimeStatus === 'applied_not_registered') {
    const usageLimitReached = isAccountUsageLimitReached(account);
    return {
      title: usageLimitReached ? t('accounts.status_usage_limit_display') : t('accounts.detail_error_title'),
      body: resolveAccountFailureReason(account, t) || t('accounts.detail_error_fallback'),
      tone: 'danger' as const,
    };
  }

  const status = String(account.localOnly ? 'LOCAL' : account.status || '')
    .trim()
    .toUpperCase();
  if (status === 'ACTIVE' || status === 'CONFIGURED' || status === 'DISABLED' || status === 'LOCAL') {
    return null;
  }

  const usageLimitReached = isAccountUsageLimitReached(account);
  return {
    title: usageLimitReached ? t('accounts.status_usage_limit_display') : t('accounts.detail_error_title'),
    body: resolveAccountFailureReason(account, t) || t('accounts.detail_error_fallback'),
    tone: 'danger' as const,
  };
}

export function resolveAccountStatusTone(account: AccountRecord) {
  const runtimeStatus = String(account.runtimeStatus || '')
    .trim()
    .toLowerCase();
  if (runtimeStatus === 'registered_routeable') {
    return 'positive';
  }
  if (runtimeStatus === 'pending') {
    return 'warning';
  }
  if (runtimeStatus === 'degraded' || runtimeStatus === 'applied_not_registered') {
    return 'danger';
  }

  const status = String(account.localOnly ? 'LOCAL' : account.status || '')
    .trim()
    .toUpperCase();

  if (status === 'ACTIVE' || status === 'CONFIGURED' || status === 'LOCAL') {
    return 'positive';
  }
  if (status === 'DISABLED') {
    return 'warning';
  }
  return 'danger';
}

export function resolveAccountOperationalState(
  account: AccountRecord,
  usageSummary: AccountUsageSummary | undefined,
  quotaDisplay: QuotaDisplay | undefined,
  t: Translator,
) {
  const runtimeStatus = String(account.runtimeStatus || '')
    .trim()
    .toLowerCase();
  const usageLimitReached = isAccountUsageLimitReached(account)
    || isUsageLimitReachedText(quotaDisplay?.degradedReason);
  if (hasAccountOperationalFailure(account, quotaDisplay)) {
    return {
      tone: 'danger' as const,
      label: usageLimitReached ? t('accounts.status_usage_limit_display') : t('accounts.status_error_display'),
    };
  }
  if (runtimeStatus === 'degraded' || runtimeStatus === 'applied_not_registered') {
    return {
      tone: 'danger' as const,
      label: usageLimitReached ? t('accounts.status_usage_limit_display') : t('accounts.status_error_display'),
    };
  }
  if (runtimeStatus === 'pending') {
    return {
      tone: 'warning' as const,
      label: t('accounts.status_waiting_check'),
    };
  }
  if (runtimeStatus === 'registered_routeable') {
    return {
      tone: 'positive' as const,
      label: t('accounts.status_available'),
    };
  }

  const status = String(account.localOnly ? 'LOCAL' : account.status || '')
    .trim()
    .toUpperCase();

  if (status === 'DISABLED') {
    return {
      tone: 'warning' as const,
      label: t('accounts.status_disabled_display'),
    };
  }

  if (status === 'LOCAL') {
    return {
      tone: 'warning' as const,
      label: t('accounts.status_local'),
    };
  }

  if (status !== 'ACTIVE' && status !== 'CONFIGURED') {
    return {
      tone: 'danger' as const,
      label: usageLimitReached ? t('accounts.status_usage_limit_display') : t('accounts.status_error_display'),
    };
  }

  if (usageSummary?.success && usageSummary.success > 0) {
    return {
      tone: 'positive' as const,
      label: t('accounts.status_available'),
    };
  }

  if (account.credentialSource === 'auth-file' && quotaDisplay?.status === 'success') {
    return {
      tone: 'positive' as const,
      label: t('accounts.status_available'),
    };
  }

  if (usageSummary?.hasData && usageSummary.failure > 0) {
    return {
      tone: 'danger' as const,
      label: usageLimitReached ? t('accounts.status_usage_limit_display') : t('accounts.status_error_display'),
    };
  }

  return {
    tone: 'warning' as const,
    label: t('accounts.status_waiting_check'),
  };
}

export function hasAccountOperationalFailure(account: AccountRecord, quotaDisplay: QuotaDisplay | undefined) {
  return account.credentialSource === 'auth-file' && (isQuotaRefreshFailure(quotaDisplay) || isQuotaAuthErrorBlocked(quotaDisplay));
}

function isQuotaRefreshFailure(quotaDisplay: QuotaDisplay | undefined) {
  if (!quotaDisplay?.stale) {
    return false;
  }
  const rawReason = String(quotaDisplay.degradedReason || '').trim();
  if (!rawReason) {
    return false;
  }
  const reason = rawReason.toLowerCase();
  if (
    reason === 'quota runtime status has not been observed yet.'
    || reason === 'quota runtime status has not been observed yet'
  ) {
    return false;
  }
  return true;
}

function isQuotaAuthErrorBlocked(quotaDisplay: QuotaDisplay | undefined) {
  if (!quotaDisplay?.blocked) {
    return false;
  }
  const sourceText = quotaRuntimeBlockText(quotaDisplay);
  return sourceText.includes('auth-error');
}

export function isAccountUnavailable(account: AccountRecord) {
  if (account.disabled || account.rawAuthFile?.unavailable) {
    return true;
  }

  const runtimeStatus = String(account.runtimeStatus || '')
    .trim()
    .toLowerCase();
  if (runtimeStatus === 'degraded' || runtimeStatus === 'applied_not_registered') {
    return true;
  }
  if (runtimeStatus === 'registered_routeable') {
    return false;
  }

  const status = String(account.status || '')
    .trim()
    .toUpperCase();
  return status !== 'ACTIVE' && status !== 'CONFIGURED' && status !== 'LOCAL';
}

export function isCodexReauthEligible(account: AccountRecord, quotaDisplay?: QuotaDisplay) {
  if (account.credentialSource !== 'auth-file') {
    return false;
  }
  if (String(account.provider || '').trim().toLowerCase() !== 'codex') {
    return false;
  }
  if (!String(account.name || '').trim()) {
    return false;
  }
  if (isAccountUsageLimitReached(account)) {
    return false;
  }
  if (isQuotaReauthRequired(quotaDisplay)) {
    return true;
  }

  const status = String(account.status || '')
    .trim()
    .toUpperCase();
  return status !== 'ACTIVE' && status !== 'CONFIGURED' && status !== 'DISABLED' && status !== 'LOCAL';
}

function isQuotaReauthRequired(quotaDisplay: QuotaDisplay | undefined) {
  const reason = [
    quotaDisplay?.degradedReason,
    quotaDisplay?.blockReason,
    ...(quotaDisplay?.sources || []).flatMap((source) => [source.source, source.reason]),
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ').toLowerCase();
  if (!reason) {
    return false;
  }
  return reason.includes('token_invalidated') ||
    reason.includes('invalid_refresh_token') ||
    reason.includes('token_expired') ||
    reason.includes('invalid_grant') ||
    reason.includes('refresh_token_reused') ||
    reason.includes('app_session_terminated') ||
    reason.includes('authentication token has been invalidated') ||
    reason.includes('authentication token is expired') ||
    reason.includes('could not validate your refresh token') ||
    reason.includes('session has ended') ||
    reason.includes('please try signing in again') ||
    reason.includes('please log in again');
}

function quotaRuntimeBlockText(quotaDisplay: QuotaDisplay | undefined) {
  return [
    quotaDisplay?.blockReason,
    ...(quotaDisplay?.sources || []).flatMap((source) => [source.source, source.reason]),
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ').toLowerCase();
}

export function isCodexAuthFile(account: AccountRecord) {
  if (account.credentialSource !== 'auth-file') {
    return false;
  }
  if (!String(account.name || '').trim()) {
    return false;
  }
  return String(account.provider || '').trim().toLowerCase() === 'codex';
}

export function resolveAccountPlanLabel(account: AccountRecord, quotaDisplay: QuotaDisplay) {
  const plan = String(quotaDisplay.planType || account.planType || '')
    .trim()
    .toUpperCase();
  return plan || '';
}

export function buildAccountAttributionBadges(account: AccountRecord, quotaDisplay: QuotaDisplay): AccountAttributionBadge[] {
  const badges: AccountAttributionBadge[] = [];
  const planLabel = resolveAccountPlanLabel(account, quotaDisplay);
  if (planLabel) {
    badges.push({
      label: planLabel,
      backgroundColor: 'color-mix(in_srgb,var(--gt-ink-primary)_6%,transparent)',
    });
  }

  const formats = account.supportedFormats && account.supportedFormats.length > 0
    ? account.supportedFormats
    : ['anthropic' as ApiFormat];
  for (const format of formats) {
    badges.push({ label: formatLabel(format), shortLabel: formatShortLabel(format) });
  }
  return badges;
}

export function resolveAccountPrimaryLabel(account: AccountRecord) {
  if (account.credentialSource === 'auth-file') {
    const primary = String(account.email || account.displayName || '').trim();
    if (primary) {
      return primary;
    }
  }
  return account.displayName;
}

export function buildAccountStabilitySummary(account: AccountRecord, quotaDisplay: QuotaDisplay, t: Translator): AccountStabilitySummary {
  const failureReason = resolveAccountFailureReason(account, t);
  if (failureReason) {
    return {
      title: t('accounts.stability_attention_title'),
      body: failureReason,
      tone: 'warning',
    };
  }

  if (account.disabled) {
    return {
      title: t('accounts.stability_attention_title'),
      body: t('accounts.stability_disabled_body'),
      tone: 'warning',
    };
  }

  if (quotaDisplay.status === 'loading') {
    return {
      title: t('accounts.stability_loading_title'),
      body: t('accounts.quota_syncing'),
      tone: 'neutral',
    };
  }

  if (quotaDisplay.status === 'success' && quotaDisplay.windows.length > 0) {
    return {
      title: t('accounts.stability_ready_title'),
      body: t('accounts.stability_ready_body'),
      tone: 'positive',
    };
  }

  if (quotaDisplay.status === 'error' || quotaDisplay.status === 'empty') {
    return {
      title: t('accounts.stability_pending_title'),
      body: t('accounts.stability_pending_body'),
      tone: 'neutral',
    };
  }

  return {
    title: t('accounts.stability_placeholder_title'),
    body: t('accounts.stability_placeholder_body'),
    tone: 'neutral',
  };
}

export function fallbackAPIKeyDisplayName(apiKey: string) {
  const suffix = apiKey.trim().slice(-4);
  return suffix ? `CODEX API KEY · ${suffix}` : 'CODEX API KEY';
}

export function resolvePlanGroupLabel(account: AccountRecord, quotaDisplay: QuotaDisplay, t: Translator) {
  if (account.credentialSource === 'api-key') {
    return t('accounts.plan_group_api_key');
  }
  const label = resolveAccountPlanLabel(account, quotaDisplay);
  return label || t('accounts.plan_group_none');
}

export function groupProviderLabel(accounts: AccountRecord[]) {
  if (accounts.length === 0) {
    return 'UNKNOWN';
  }
  return providerLabel(accounts[0]);
}

export function planGroupRank(label: string) {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'API KEY') return 5;
  if (normalized === 'PRO') return 0;
  if (normalized === 'PLUS') return 1;
  if (normalized === 'FREE') return 2;
  if (normalized === 'TEAM') return 3;
  if (normalized === 'ENTERPRISE') return 4;
  return 9;
}

export interface AccountRecentRouteDecisionSummary {
  id: string;
  channel: string;
  matchedAs: 'selected' | 'candidate';
  title: string;
  meta: string;
  detail: string;
  unresolved: boolean;
  routeResilienceEvidence?: AccountRouteResilienceEvidence[];
}

export interface AccountRouteResilienceEvidenceDecisionRef {
  decisionID: string;
  recordedAt: string;
  routeBlocking: boolean;
}

export interface AccountRouteResilienceReasonDetail {
  reason: string;
  routeBlocking: boolean;
}

export interface AccountRouteResilienceEvidence extends RouteResilienceEvidenceDigest {
  digestDisplayMode: 'full' | 'reference';
  matchedDecisionID: string;
  matchedRecordedAt: string;
  matchedRouteBlocking: boolean;
  matchedReasonDetails: AccountRouteResilienceReasonDetail[];
  relevantDecisions: AccountRouteResilienceEvidenceDecisionRef[];
  blockingDecisionCount: number;
  observeDecisionCount: number;
}

export function buildAccountRecentRouteDecisionSummaries(
  account: Pick<AccountRecord, 'id'>,
  decisions: ChannelRouteDecisionSnapshot[],
): AccountRecentRouteDecisionSummary[] {
  const accountID = String(account.id || '').trim();
  if (!accountID) {
    return [];
  }

  const matchedDecisions = decisions.filter((decision) => decisionTouchesAccount(decision, accountID));
  const routeResilienceEvidenceByDecisionID = buildAccountRouteResilienceEvidenceByDecisionID(accountID, matchedDecisions);
  const displayedDecisions = matchedDecisions
    .sort((left, right) => String(right.recordedAt || '').localeCompare(String(left.recordedAt || '')))
    .slice(0, 5);
  const seenEvidenceDigestIDs = new Set<string>();

  return displayedDecisions
    .map((decision) => {
      const baseSummary = buildChannelRouteDecisionSummary(decision);
      const matchedAs = String(decision.selectedAccountID || '').trim() === accountID
        || String(decision.selectedAuthID || '').trim() === accountID
        ? 'selected'
        : 'candidate';
      const routeResilienceEvidence = decorateAccountRouteResilienceEvidenceForDisplay(
        routeResilienceEvidenceByDecisionID.get(decision.id) || [],
        seenEvidenceDigestIDs,
      );
      return {
        id: baseSummary.id,
        channel: String(decision.channel || '').trim(),
        matchedAs,
        title: baseSummary.title,
        meta: [
          String(decision.channel || '').trim().toUpperCase() || '',
          matchedAs === 'selected' ? 'selected' : 'candidate',
          baseSummary.meta,
        ].filter(Boolean).join(' · '),
        detail: baseSummary.detail,
        unresolved: baseSummary.unresolved,
        ...(routeResilienceEvidence.length > 0 ? { routeResilienceEvidence } : {}),
      };
    });
}

function decisionTouchesAccount(
  decision: ChannelRouteDecisionSnapshot,
  accountID: string,
) {
  const normalizedAccountID = String(accountID || '').trim();
  if (!normalizedAccountID) {
    return false;
  }
  const selectedAccountID = String(decision.selectedAccountID || '').trim();
  const selectedAuthID = String(decision.selectedAuthID || '').trim();
  if (selectedAccountID === normalizedAccountID || selectedAuthID === normalizedAccountID) {
    return true;
  }
  return (decision.candidates || []).some((candidate) => {
    const candidateAccountID = String(candidate.accountID || '').trim();
    const candidateAuthID = String(candidate.authID || '').trim();
    return candidateAccountID === normalizedAccountID || candidateAuthID === normalizedAccountID;
  });
}

function buildAccountRouteResilienceEvidenceByDecisionID(
  accountID: string,
  decisions: ChannelRouteDecisionSnapshot[],
): Map<string, AccountRouteResilienceEvidence[]> {
  const normalizedAccountID = String(accountID || '').trim();
  if (!normalizedAccountID || decisions.length === 0) {
    return new Map();
  }

  const digests = buildRouteResilienceEvidenceDigests(
    decisions,
    [{ id: normalizedAccountID, label: normalizedAccountID }],
    '',
  ).filter((digest) => digest.accountKey === normalizedAccountID || digest.authId === normalizedAccountID);
  const digestByID = new Map(digests.map((digest) => [digest.id, digest]));
  const decisionByID = new Map(decisions.map((decision) => [decision.id, decision]));
  const digestRefsByID = new Map<string, AccountRouteResilienceEvidenceDecisionRef[]>();
  const decisionDigestsByDecisionID = new Map<string, AccountRouteResilienceEvidence[]>();
  const reasonDetailsByDecisionID = new Map<string, Map<string, AccountRouteResilienceReasonDetail[]>>();
  const evidenceByDecisionID = new Map<string, AccountRouteResilienceEvidence[]>();

  for (const decision of decisions) {
    const decisionDigests = buildAccountRouteResilienceEvidence(normalizedAccountID, decision);
    if (!decisionDigests.length) {
      continue;
    }
    const reasonDetailsByDigestID = buildAccountRouteResilienceReasonDetailsByDigestID(normalizedAccountID, decision);
    decisionDigestsByDecisionID.set(decision.id, decisionDigests);
    reasonDetailsByDecisionID.set(decision.id, reasonDetailsByDigestID);
    for (const digest of decisionDigests) {
      const refs = digestRefsByID.get(digest.id) || [];
      const nextRef = {
        decisionID: String(decision.id || '').trim(),
        recordedAt: String(decision.recordedAt || '').trim(),
        routeBlocking: digest.routeBlocking,
      };
      if (
        !refs.some(
          (ref) =>
            ref.decisionID === nextRef.decisionID
            && ref.recordedAt === nextRef.recordedAt
            && ref.routeBlocking === nextRef.routeBlocking,
        )
      ) {
        refs.push(nextRef);
      }
      digestRefsByID.set(digest.id, refs);
    }
  }

  for (const [decisionID, decisionDigests] of decisionDigestsByDecisionID.entries()) {
    const matchedDecision = decisionByID.get(decisionID);
    const reasonDetailsByDigestID = reasonDetailsByDecisionID.get(decisionID) || new Map();
    evidenceByDecisionID.set(
      decisionID,
      decisionDigests.map((digest) => {
        const relevantDecisions = sortAccountRouteResilienceDecisionRefs(digestRefsByID.get(digest.id) || []);
        const { blockingDecisionCount, observeDecisionCount } =
          summarizeAccountRouteResilienceDecisionCoverage(relevantDecisions);
        return {
          ...(digestByID.get(digest.id) || digest),
          digestDisplayMode: 'full',
          matchedDecisionID: decisionID,
          matchedRecordedAt: String(matchedDecision?.recordedAt || '').trim(),
          matchedRouteBlocking: digest.routeBlocking,
          matchedReasonDetails: reasonDetailsByDigestID.get(digest.id) || [],
          relevantDecisions,
          blockingDecisionCount,
          observeDecisionCount,
        };
      }),
    );
  }

  return evidenceByDecisionID;
}

function decorateAccountRouteResilienceEvidenceForDisplay(
  evidenceList: AccountRouteResilienceEvidence[],
  seenEvidenceDigestIDs: Set<string>,
): AccountRouteResilienceEvidence[] {
  return evidenceList.map((evidence) => {
    const digestDisplayMode = seenEvidenceDigestIDs.has(evidence.id) ? 'reference' : 'full';
    seenEvidenceDigestIDs.add(evidence.id);
    return {
      ...evidence,
      digestDisplayMode,
    };
  });
}

function buildAccountRouteResilienceEvidence(
  accountID: string,
  decision: ChannelRouteDecisionSnapshot,
): AccountRouteResilienceEvidence[] {
  const normalizedAccountID = String(accountID || '').trim();
  if (!normalizedAccountID || !decision.droppedReasons?.length) {
    return [];
  }

  return buildRouteResilienceEvidenceDigests(
    [decision],
    [{ id: normalizedAccountID, label: normalizedAccountID }],
    String(decision.model || '').trim(),
  )
    .filter((digest) => digest.accountKey === normalizedAccountID || digest.authId === normalizedAccountID)
    .map((digest) => ({
      ...digest,
      digestDisplayMode: 'full',
      matchedDecisionID: String(decision.id || '').trim(),
      matchedRecordedAt: String(decision.recordedAt || '').trim(),
      matchedRouteBlocking: digest.routeBlocking,
      matchedReasonDetails: buildAccountRouteResilienceReasonDetailsByDigestID(normalizedAccountID, decision).get(digest.id) || [],
      relevantDecisions: [],
      blockingDecisionCount: digest.routeBlocking ? 1 : 0,
      observeDecisionCount: digest.routeBlocking ? 0 : 1,
    }));
}

function buildAccountRouteResilienceReasonDetailsByDigestID(
  accountID: string,
  decision: ChannelRouteDecisionSnapshot,
): Map<string, AccountRouteResilienceReasonDetail[]> {
  const normalizedAccountID = String(accountID || '').trim();
  const detailsByDigestID = new Map<string, AccountRouteResilienceReasonDetail[]>();
  if (!normalizedAccountID || !decision.droppedReasons?.length) {
    return detailsByDigestID;
  }

  for (const droppedReason of decision.droppedReasons) {
    const accountKey = String(droppedReason.accountID || '').trim();
    const authId = String(droppedReason.authID || '').trim();
    if (accountKey !== normalizedAccountID && authId !== normalizedAccountID) {
      continue;
    }
    const model = String(droppedReason.model || decision.model || '').trim();
    const source = String(droppedReason.source || '').trim();
    const scope = String(droppedReason.scope || '').trim();
    const digestID = [accountKey, authId, model, source, scope].join('|');
    const details = detailsByDigestID.get(digestID) || [];
    details.push({
      reason: String(droppedReason.reason || '').trim() || 'reason:unknown',
      routeBlocking: droppedReason.routeBlocking !== false,
    });
    detailsByDigestID.set(digestID, details);
  }

  return detailsByDigestID;
}

function sortAccountRouteResilienceDecisionRefs(
  refs: AccountRouteResilienceEvidenceDecisionRef[],
): AccountRouteResilienceEvidenceDecisionRef[] {
  return [...refs].sort((left, right) => {
    const recordedAtDiff = String(right.recordedAt || '').localeCompare(String(left.recordedAt || ''));
    if (recordedAtDiff !== 0) {
      return recordedAtDiff;
    }
    return String(right.decisionID || '').localeCompare(String(left.decisionID || ''));
  });
}

function summarizeAccountRouteResilienceDecisionCoverage(
  refs: AccountRouteResilienceEvidenceDecisionRef[],
) {
  let blockingDecisionCount = 0;
  let observeDecisionCount = 0;
  for (const ref of refs) {
    if (ref.routeBlocking) {
      blockingDecisionCount += 1;
    } else {
      observeDecisionCount += 1;
    }
  }
  return {
    blockingDecisionCount,
    observeDecisionCount,
  };
}
