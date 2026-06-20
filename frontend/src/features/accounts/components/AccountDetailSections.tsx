import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AccountRecord, ApiFormat, BillingDisplay } from '../../../types';
import type { main } from '../../../../wailsjs/go/models';
import {
  ConsumeOpenAIQuotaResetCredit,
  GetOpenAIQuotaResetCredit,
} from '../../../../wailsjs/go/main/App';
import { useI18n } from '../../../context/I18nContext';
import { toErrorMessage } from '../../../utils/error';
import {
  buildBillingCurlSetupGuide,
  buildBillingCurlTemplate,
  buildQuotaCurlSetupGuide,
  buildQuotaCurlTemplate,
  buildVendorCredentialFields,
  buildVendorCurlVariableFields,
  resolveManagementBaseUrl,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import {
  buildProxyURLFromNode,
  readStoredProxyNodes,
  type ProxyNodeRecord,
} from '../../proxy-pool/model.ts';
import {
  buildAccountProxyRouteDraft,
  formatAccountProxySummary,
  type AccountProxyRouteDraft,
} from '../model/accountProxyRoute.ts';
import { buildQuotaDisplay, normalizeQuotaTestDisplay, selectQuotaWindows } from '../model/accountQuota';
import type { AccountRouteResilienceEvidence } from '../model/accountPresentation';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { CodexQuotaState, QuotaDisplay } from '../model/types';
import { formatLabel } from '../model/vendorPresetHelpers';
import type { VendorCredentialField } from '../model/vendorPresets';
import { QuotaBars } from './CardSections';
import { QuotaCalibrationPanel } from './QuotaCalibrationPanel';
import { QuotaThresholdRulePanel } from './QuotaThresholdRulePanel';
import {
  AccountDetailEvidenceGrid,
  AccountDetailEmptyState,
  AccountDetailStatCell,
  AccountDetailStatGrid,
  AccountDetailPill,
  AccountDetailSection,
  type AccountDetailSectionSpan,
} from './AccountDetailPrimitives';
import { AccountProxyRouteEditor } from './AccountProxyRouteSection';
import {
  AccountCurlEditorModal,
  buildBillingCurlTemplates,
  buildCurlVariables,
  buildQuotaCurlTemplates,
} from './AccountCurlEditorModal';

export interface APIKeyVerifyState {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastVerifiedAt: number | null;
}

export interface AccountDetailHeaderProps {
  account: AccountRecord;
  usageSummary?: AccountUsageSummary;
  onRename?: (nextName: string) => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
}

export interface AccountCredentialVerifySectionProps {
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  span?: AccountDetailSectionSpan;
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
  onProxyValidityChange?: (message: string) => void;
}

interface VerifyConnectionPanelProps {
  draft: ApiKeyConfigDraft;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
}

type AccountQuotaLayoutMode = 'split' | 'stack';
type OpenAIQuotaResetModalStatus = 'confirm' | 'loading' | 'success' | 'error';

export interface AccountQuotaSectionProps {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  quotaState?: CodexQuotaState;
  quotaDisplay?: QuotaDisplay;
  readOnlyScripts?: boolean;
  editorOpen?: boolean;
  onOpenEditor?: () => void;
  onCloseEditor?: () => void;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<any>;
  topBorder?: boolean;
  headerDivider?: boolean;
  layoutMode?: AccountQuotaLayoutMode;
}

interface OpenAIQuotaResetModalState {
  open: boolean;
  status: OpenAIQuotaResetModalStatus;
  message: string;
  result?: main.OpenAIQuotaResetConsumeResult;
}

export interface AccountBillingSectionProps {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  liveBilling?: BillingDisplay;
  readOnlyScripts?: boolean;
  editorOpen?: boolean;
  onOpenEditor?: () => void;
  onCloseEditor?: () => void;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<any>;
  topBorder?: boolean;
  headerDivider?: boolean;
}

export interface AccountDetailFooterProps {
  isApiKey: boolean;
  configDirty: boolean;
  rateLimitDirty?: boolean;
  missingFields: string[];
  savingConfig: boolean;
  onClose: () => void;
  onSaveConfig: () => void;
}

const DEFAULT_VERIFY_MODEL = 'gpt-5.4-mini';
const CAPABILITY_ENDPOINTS: Array<{ format: ApiFormat; label: string; hint: string }> = [
  { format: 'openai_chat', label: 'OpenAI', hint: 'Chat' },
  { format: 'openai_responses', label: 'Codex', hint: 'Responses' },
  { format: 'anthropic', label: 'Anthropic', hint: 'Messages' },
];

const accountDetailHeaderShellClass =
  'grid min-w-0 grid-cols-[10.5rem_minmax(0,1fr)] rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const accountDetailHeaderRailClass =
  'flex min-w-0 items-center border-r border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3';
const accountDetailHeaderTypeClass =
  'w-full min-w-0 text-left text-base font-semibold italic leading-tight tracking-normal text-[var(--text-primary)]';
const accountDetailHeaderPillClass =
  '!min-h-0 !border !border-[var(--gt-border-subtle)] !bg-[var(--gt-surface-muted)] !py-1 !text-[length:var(--font-size-ui-2xs)] !font-semibold !text-[var(--text-primary)]';
const accountDetailHeaderPrimaryPillClass =
  '!min-h-0 !border !border-[var(--text-primary)] !bg-[var(--text-primary)] !py-1 !text-[length:var(--font-size-ui-2xs)] !font-semibold !text-[var(--gt-surface-canvas)]';
const accountDetailHeaderDescriptionClass =
  'flex min-w-0 items-center pl-0.5 font-mono text-[length:var(--font-size-ui-xs)] font-semibold leading-tight text-[var(--text-muted)]';
const accountDetailRuntimeMetaLabelClass =
  'font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailRuntimeMetaSmallClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailRuntimeDecisionTitleClass =
  'min-w-0 truncate font-mono text-[length:var(--font-size-ui-sm)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailRuntimeDecisionMetaClass =
  'mt-1 min-w-0 truncate font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailRuntimeDecisionDetailClass =
  'mt-1 text-[length:var(--font-size-ui-xs)] font-medium leading-5 text-[var(--text-secondary)]';
const accountDetailRuntimeEvidenceClass =
  'grid gap-2 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2';
const accountDetailRuntimeReasonDetailClass =
  'grid gap-1 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center';
const accountDetailRuntimeDecisionClass = (unresolved: boolean) =>
  `border px-3 py-2 ${
    unresolved
      ? 'border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_6%,var(--gt-surface-muted))]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]'
  }`;
const accountDetailCredentialPaneDividerClass =
  'grid min-w-0 content-start gap-4 border-t border-[var(--gt-border-subtle)] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0';
const accountDetailCredentialSectionTitleClass =
  'text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailCredentialMetaLabelClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailCredentialSubheadingClass =
  'mt-1 text-[length:var(--font-size-ui-xs)] font-semibold italic tracking-normal text-[var(--text-primary)]';
const accountDetailCredentialPillClass =
  '!min-h-0 !border !border-[var(--gt-border-subtle)] !bg-[var(--gt-surface-muted)] !py-1 !text-[length:var(--font-size-ui-2xs)] !font-semibold !text-[var(--text-primary)]';
const accountDetailCredentialFieldLabelClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailCredentialHelpClass =
  'text-[length:var(--font-size-ui-2xs)] font-medium leading-relaxed text-[var(--text-muted)]';
const accountDetailCredentialInputClass =
  'min-w-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)]';
const accountDetailCredentialButtonClass =
  'shrink-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--font-size-ui-2xs)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50';
const accountDetailCredentialPrimaryButtonClass =
  'rounded border border-[var(--text-primary)] bg-[var(--text-primary)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--gt-surface-canvas)] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const accountDetailCredentialMenuClass =
  'absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const accountDetailCredentialMenuItemClass = (active: boolean) =>
  `block w-full px-3 py-1.5 text-left text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal transition-colors ${
    active
      ? 'bg-[var(--text-primary)] text-[var(--gt-surface-canvas)]'
      : 'text-[var(--text-primary)] hover:bg-[var(--gt-surface-muted)]'
  }`;
const accountDetailCredentialStatusClass = (status?: APIKeyVerifyState['status']) =>
  `text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal ${
    status === 'success'
      ? 'text-[var(--gt-status-success)]'
      : status === 'error'
        ? 'text-[var(--gt-status-danger)]'
        : 'text-[var(--text-muted)]'
  }`;
const accountDetailResourcePaneDividerClass =
  'grid min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 self-stretch border-t border-[var(--gt-border-subtle)] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0';
const accountDetailResourcePaneCompactClass =
  'grid min-w-0 content-start gap-3 border-t border-[var(--gt-border-subtle)] pt-3';
const accountDetailResourceScriptCardClass =
  'grid h-full min-h-[8.75rem] content-start gap-3 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const accountDetailResourceCompactCardClass =
  'grid gap-3 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const accountDetailResourceButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--font-size-ui-2xs)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50';
const accountDetailResourcePrimaryButtonClass =
  'rounded border border-[var(--text-primary)] bg-[var(--text-primary)] px-3 py-2 text-[length:var(--font-size-ui-2xs)] font-semibold text-[var(--gt-surface-canvas)] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const accountDetailResourceHeadingClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailResourcePanelClass =
  'grid gap-2 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const accountDetailResourcePanelValueClass =
  'mt-1 text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]';
const accountDetailResourceHelpClass =
  'text-[length:var(--font-size-ui-xs)] font-medium leading-relaxed text-[var(--text-muted)]';
const accountDetailResourceEmptyScriptClass =
  'border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-4 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]';
const accountDetailResourceDataRowClass =
  'grid gap-2 border-y border-[var(--gt-border-subtle)] py-2 md:grid-cols-3';
const accountDetailResourceMessageClass = (tone: 'neutral' | 'success' | 'danger') =>
  `text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal ${
    tone === 'success'
      ? 'text-[var(--gt-status-success)]'
      : tone === 'danger'
        ? 'text-[var(--gt-status-danger)]'
        : 'text-[var(--text-muted)]'
  }`;
const accountDetailResourceKvLabelClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailResourceKvValueClass =
  'mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailQuotaResetModalOverlayClass =
  'fixed inset-0 z-[1000] grid place-items-center bg-black/35 px-6 py-8 backdrop-blur-[18px]';
const accountDetailQuotaResetModalPanelClass =
  'relative grid w-full max-w-[38rem] overflow-hidden rounded border border-[var(--gt-border-subtle)] bg-[color-mix(in_srgb,var(--gt-surface-canvas)_78%,transparent)] shadow-lg backdrop-blur-2xl';
const accountDetailQuotaResetHeroClass =
  'relative h-36 overflow-hidden border-b border-white/40';
const accountDetailQuotaResetHeroMarkClass =
  'absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded border border-white/40 bg-[linear-gradient(150deg,rgba(171,149,255,0.8),rgba(36,65,255,0.88))] font-mono text-3xl font-semibold text-white shadow-lg backdrop-blur-md';
const accountDetailQuotaResetCloseButtonClass =
  'absolute right-4 top-4 grid h-10 w-10 place-items-center rounded border border-white/55 bg-white/45 text-xl font-semibold text-[var(--text-primary)] shadow-lg backdrop-blur-xl transition-colors hover:bg-white/65';
const accountDetailQuotaResetBodyClass =
  'grid gap-5 bg-white/35 px-8 py-7 text-center backdrop-blur-xl';
const accountDetailQuotaResetTitleClass =
  'text-xl font-semibold italic leading-tight tracking-normal text-[var(--text-primary)]';
const accountDetailQuotaResetDescriptionClass =
  'mx-auto max-w-[28rem] text-[length:var(--font-size-ui-sm)] font-medium leading-relaxed text-[var(--text-muted)]';
const accountDetailQuotaResetResultClass =
  'grid gap-2 border border-[var(--gt-border-subtle)] bg-[color-mix(in_srgb,var(--gt-surface-muted)_78%,transparent)] p-4 text-left font-mono text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)] backdrop-blur-xl';
const accountDetailQuotaResetErrorClass =
  'border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] p-4 text-left text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--gt-status-danger)] backdrop-blur-xl';
const accountDetailQuotaResetPrimaryButtonClass =
  'h-12 rounded border border-[var(--text-primary)] bg-[var(--text-primary)] px-4 text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--gt-surface-canvas)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const accountDetailQuotaResetSecondaryButtonClass =
  'h-12 rounded border border-[var(--gt-border-subtle)] bg-[color-mix(in_srgb,var(--gt-surface-muted)_72%,transparent)] px-4 text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)]';
const accountDetailFooterStatusClass =
  'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailFooterActionsClass = 'flex items-center gap-2';
const accountDetailFooterButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)]';
const accountDetailFooterPrimaryButtonClass =
  'rounded border border-[var(--text-primary)] bg-[var(--text-primary)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--gt-surface-canvas)] transition-colors disabled:cursor-not-allowed disabled:opacity-45';

export function AccountDetailHeader({
  account,
}: AccountDetailHeaderProps) {
  const accountTypeLabel = resolveAccountHeaderTypeLabel(account);
  const credentialLabel = account.credentialSource === 'auth-file'
    ? 'Database OAuth'
    : account.provider === 'codex'
      ? 'Codex Key'
      : 'API Key';
  const routeLabel = account.proxyUrl ? 'Proxy Node' : 'Default Route';
  const balanceLabel = account.credentialSource === 'auth-file' ? 'Provider' : 'Configured';
  const description = account.credentialSource === 'auth-file'
    ? 'Database-managed OAuth account · config preview/apply · provider managed quota'
    : account.provider === 'codex'
      ? 'Codex API key account · prefix · short-message verification · quota/billing scripts'
      : 'API Key provider · custom headers · model mapping · short-message verification';

  return (
    <div data-account-detail-header="quiet" className={accountDetailHeaderShellClass}>
      <div data-account-detail-header-account-type="true" className={accountDetailHeaderRailClass}>
        <div className={accountDetailHeaderTypeClass}>
          <span className="block whitespace-normal break-words [overflow-wrap:break-word]">{accountTypeLabel}</span>
        </div>
      </div>

      <div className="grid min-w-0 content-center gap-1 px-2.5 py-2">
        <div data-account-detail-header-chips="true" className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <AccountDetailPill className={accountDetailHeaderPrimaryPillClass}>类型: {account.credentialSource === 'auth-file' ? 'Codex Auth-file / OAuth' : account.provider === 'codex' ? 'Codex API Key' : 'OpenAI-compatible'}</AccountDetailPill>
          <AccountDetailPill className={accountDetailHeaderPillClass}>凭据: {credentialLabel}</AccountDetailPill>
          <AccountDetailPill className={accountDetailHeaderPillClass}>验证: Short Message</AccountDetailPill>
          <AccountDetailPill className={accountDetailHeaderPillClass}>路由: {routeLabel}</AccountDetailPill>
          <AccountDetailPill className={accountDetailHeaderPillClass}>余额/额度: {balanceLabel}</AccountDetailPill>
        </div>
        <div data-account-detail-header-description="true" className={accountDetailHeaderDescriptionClass}>
          <span className="truncate">{description}</span>
        </div>
      </div>
    </div>
  );
}

function resolveAccountHeaderTypeLabel(account: AccountRecord) {
  if (account.credentialSource === 'auth-file') {
    return 'CODEX OAUTH';
  }
  if (account.provider === 'codex' || account.accountKind === 'codex-api-key') {
    return 'CODEX API KEY';
  }
  return 'OPENAI COMPATIBLE';
}

export function AccountRuntimeRouteSection({
  account,
  routeDecisions = [],
  span,
}: {
  account: AccountRecord;
  routeDecisions?: Array<{
    id: string;
    channel: string;
    matchedAs: 'selected' | 'candidate';
    title: string;
    meta: string;
    detail: string;
    unresolved: boolean;
    routeResilienceEvidence?: AccountRouteResilienceEvidence[];
  }>;
  span?: AccountDetailSectionSpan;
}) {
  const runtimeStatus = String(account.runtimeStatus || '').trim().toLowerCase();
  const runtimeReason = String(account.runtimeReason || '').trim();
  const runtimeFailureClass = String(account.runtimeFailureClass || '').trim().toLowerCase();
  const registeredModelCount = Number.isFinite(account.registeredModelCount) ? Number(account.registeredModelCount) : 0;
  const runtimeRepairOutcome = String(account.runtimeRepairOutcome || '').trim().toLowerCase();
  const runtimeRepairAction = String(account.runtimeRepairAction || '').trim().toLowerCase();
  const runtimeRepairTriggerStatus = String(account.runtimeRepairTriggerStatus || '').trim().toLowerCase();
  const runtimeRepairTriggerClass = String(account.runtimeRepairTriggerClass || '').trim().toLowerCase();
  const runtimeRepairTriggerReason = String(account.runtimeRepairTriggerReason || '').trim();
  const lastRuntimeRepairAtUnixMs = Number.isFinite(account.lastRuntimeRepairAtUnixMs)
    ? Number(account.lastRuntimeRepairAtUnixMs)
    : 0;
  const hasRuntimeEvidence = Boolean(
    runtimeStatus
    || account.routeable !== undefined
    || runtimeReason
    || runtimeFailureClass
    || account.registeredModelCount !== undefined
    || runtimeRepairOutcome
    || runtimeRepairTriggerClass
    || runtimeRepairTriggerReason,
  );
  const routeStatusLabel = resolveRuntimeRouteStatusLabel(runtimeStatus, account.routeable === true);
  const routeStatusTone = resolveRuntimeRouteStatusTone(runtimeStatus, account.routeable === true);
  const requestableLabel = account.routeable === true ? 'YES' : runtimeStatus === 'pending' ? 'WAIT' : 'NO';
  const repairRows = buildRuntimeRepairRows({
    runtimeRepairOutcome,
    runtimeRepairAction,
    runtimeRepairTriggerStatus,
    runtimeRepairTriggerClass,
    runtimeRepairTriggerReason,
    lastRuntimeRepairAtUnixMs,
  });
  const detailRows = [
    {
      label: 'runtime_status',
      value: runtimeStatus || 'unknown',
      title: runtimeStatus || 'unknown',
    },
    {
      label: 'routeable',
      value: account.routeable === true ? 'true' : account.routeable === false ? 'false' : 'unknown',
      title: account.routeable === true ? 'true' : account.routeable === false ? 'false' : 'unknown',
    },
    ...(runtimeFailureClass
      ? [{
          label: 'Failure Class',
          value: runtimeFailureClass,
          title: runtimeFailureClass,
        }]
      : []),
    ...(runtimeReason
      ? [{
          label: 'runtime_reason',
          value: runtimeReason,
          title: runtimeReason,
        }]
      : []),
    {
      label: 'account_status',
      value: String(account.status || '').trim().toUpperCase() || 'UNKNOWN',
      title: String(account.status || '').trim().toUpperCase() || 'UNKNOWN',
    },
  ];

  return (
    <AccountDetailSection
      componentName="AccountRuntimeRouteSection"
      eyebrow="Runtime"
      title="运行态路由"
      span={span}
      bandActionDivider={false}
      actions={<AccountDetailPill tone={routeStatusTone}>{routeStatusLabel}</AccountDetailPill>}
    >
      {hasRuntimeEvidence ? (
        <div data-account-runtime-route-layout="summary" className="grid gap-4">
          <AccountDetailStatGrid columns={3}>
            <AccountDetailStatCell
              label="Routeability"
              value={routeStatusLabel}
              meta={runtimeStatus || 'unknown'}
            />
            <AccountDetailStatCell
              label="Registered Models"
              value={registeredModelCount > 0 ? String(registeredModelCount) : '—'}
              meta={registeredModelCount > 0 ? `${registeredModelCount} synced` : 'runtime registry empty'}
            />
            <AccountDetailStatCell
              label="Requestable"
              value={requestableLabel}
              meta={account.disabled ? 'disabled in store' : 'sidecar candidate eligibility'}
            />
          </AccountDetailStatGrid>
          <div data-account-runtime-route-evidence="detail">
            <AccountDetailEvidenceGrid rows={detailRows} />
          </div>
          {repairRows.length > 0 ? (
            <div data-account-runtime-route-repair="diagnostics" className="grid gap-2">
              <div className={accountDetailRuntimeMetaLabelClass}>
                Bounded Reconcile
              </div>
              <AccountDetailEvidenceGrid rows={repairRows} />
            </div>
          ) : null}
          {routeDecisions.length > 0 ? (
            <div data-account-runtime-route-decisions="recent" className="grid gap-2">
              <div className={accountDetailRuntimeMetaLabelClass}>
                最近真实路由
              </div>
              {routeDecisions.map((decision) => (
                <div
                  key={decision.id}
                  data-account-runtime-route-decision={decision.matchedAs}
                  className={accountDetailRuntimeDecisionClass(decision.unresolved)}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className={accountDetailRuntimeDecisionTitleClass}>
                      {decision.title}
                    </div>
                    <AccountDetailPill tone={decision.unresolved ? 'danger' : 'neutral'} className="!min-h-0 !py-0.5 !text-[length:var(--font-size-ui-2xs)]">
                      {decision.matchedAs === 'selected' ? '命中' : '候选'}
                    </AccountDetailPill>
                  </div>
                  {decision.meta ? (
                    <div className={accountDetailRuntimeDecisionMetaClass}>
                      {decision.meta}
                    </div>
                  ) : null}
                  {decision.detail ? (
                    <div className={accountDetailRuntimeDecisionDetailClass}>
                      {decision.detail}
                    </div>
                  ) : null}
                  {decision.routeResilienceEvidence?.length ? (
                    <div data-account-runtime-route-resilience="evidence" className="mt-2 grid gap-2">
                      {decision.routeResilienceEvidence.map((evidence) => (
                        <RuntimeRouteResilienceEvidenceMarker key={evidence.id} evidence={evidence} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <AccountDetailEmptyState>
          暂无 sidecar 运行态路由诊断
        </AccountDetailEmptyState>
      )}
    </AccountDetailSection>
  );
}

function resolveRuntimeRouteStatusLabel(runtimeStatus: string, routeable: boolean) {
  switch (runtimeStatus) {
    case 'registered_routeable':
      return routeable ? 'ROUTEABLE' : 'REGISTERED';
    case 'pending':
      return 'PENDING';
    case 'applied_not_registered':
      return 'NOT REGISTERED';
    case 'degraded':
      return 'DEGRADED';
    default:
      return routeable ? 'ROUTEABLE' : 'UNKNOWN';
  }
}

function resolveRuntimeRouteStatusTone(runtimeStatus: string, routeable: boolean): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (runtimeStatus) {
    case 'registered_routeable':
      return 'success';
    case 'pending':
      return 'warning';
    case 'applied_not_registered':
    case 'degraded':
      return 'danger';
    default:
      return routeable ? 'success' : 'neutral';
  }
}

function buildRuntimeRepairRows({
  runtimeRepairOutcome,
  runtimeRepairAction,
  runtimeRepairTriggerStatus,
  runtimeRepairTriggerClass,
  runtimeRepairTriggerReason,
  lastRuntimeRepairAtUnixMs,
}: {
  runtimeRepairOutcome: string;
  runtimeRepairAction: string;
  runtimeRepairTriggerStatus: string;
  runtimeRepairTriggerClass: string;
  runtimeRepairTriggerReason: string;
  lastRuntimeRepairAtUnixMs: number;
}) {
  const rows: Array<{ label: string; value: string; title: string }> = [];
  if (runtimeRepairOutcome) {
    rows.push({
      label: 'Repair Outcome',
      value: runtimeRepairOutcome.toUpperCase(),
      title: runtimeRepairOutcome,
    });
  }
  if (runtimeRepairAction) {
    rows.push({
      label: 'Repair Action',
      value: runtimeRepairAction,
      title: runtimeRepairAction,
    });
  }
  if (runtimeRepairTriggerStatus) {
    rows.push({
      label: 'Repair Trigger',
      value: runtimeRepairTriggerStatus,
      title: runtimeRepairTriggerStatus,
    });
  }
  if (runtimeRepairTriggerClass) {
    rows.push({
      label: 'Trigger Class',
      value: runtimeRepairTriggerClass,
      title: runtimeRepairTriggerClass,
    });
  }
  if (runtimeRepairTriggerReason) {
    rows.push({
      label: 'Trigger Reason',
      value: runtimeRepairTriggerReason,
      title: runtimeRepairTriggerReason,
    });
  }
  if (lastRuntimeRepairAtUnixMs > 0) {
    rows.push({
      label: 'Repair At',
      value: formatRuntimeRepairTimestamp(lastRuntimeRepairAtUnixMs),
      title: String(lastRuntimeRepairAtUnixMs),
    });
  }
  return rows;
}

function formatRuntimeRepairTimestamp(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('zh-CN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function RuntimeRouteResilienceEvidenceMarker({
  evidence,
}: {
  evidence: AccountRouteResilienceEvidence;
}) {
  const sourceScopeModelLabel = [
    evidence.sourceLabel || evidence.source || '未知 source',
    evidence.scope || 'scope-unknown',
    evidence.model ? `model:${evidence.model}` : 'model:unknown',
  ].join(' / ');

  return (
    <div
      data-account-runtime-route-resilience-marker={evidence.digestDisplayMode}
      className={accountDetailRuntimeEvidenceClass}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className={accountDetailRuntimeMetaLabelClass}>
          Route Resilience Evidence
        </div>
        <AccountDetailPill
          tone={evidence.matchedRouteBlocking ? 'danger' : 'neutral'}
          className="!min-h-0 !py-0.5 !text-[length:var(--font-size-ui-2xs)]"
        >
          {evidence.digestDisplayMode === 'reference'
            ? evidence.matchedRouteBlocking ? 'REF BLOCKING' : 'REF OBSERVE'
            : evidence.matchedRouteBlocking ? 'BLOCKING' : 'OBSERVE'}
        </AccountDetailPill>
      </div>
      <AccountDetailEvidenceGrid
        rows={evidence.digestDisplayMode === 'reference'
          ? [
              {
                label: 'Stable Target ID',
                value: evidence.id,
                title: evidence.id,
              },
              {
                label: 'This Decision',
                value: formatRouteResilienceCurrentDecisionLabel(evidence),
                title: buildRouteResilienceCurrentDecisionTitle(evidence),
              },
              {
                label: 'Digest Coverage',
                value: formatRouteResilienceCoverageLabel(evidence),
                title: buildRouteResilienceCoverageTitle(evidence),
              },
              {
                label: 'Digest Above',
                value: formatRouteResilienceReferenceLabel(evidence),
                title: buildRouteResilienceLatestEvidenceTitle(evidence),
              },
            ]
          : [
              {
                label: 'Stable Target ID',
                value: evidence.id,
                title: evidence.id,
              },
              {
                label: 'Latest Evidence',
                value: formatRouteResilienceLatestEvidenceLabel(evidence),
                title: buildRouteResilienceLatestEvidenceTitle(evidence),
              },
              {
                label: 'This Decision',
                value: formatRouteResilienceCurrentDecisionLabel(evidence),
                title: buildRouteResilienceCurrentDecisionTitle(evidence),
              },
              {
                label: 'First Seen',
                value: formatRouteResilienceObservedAt(evidence.firstObservedAt),
                title: buildRouteResilienceObservedTitle(evidence.firstObservedAt, evidence.firstObservedDecisionID),
              },
              {
                label: 'Last Seen',
                value: formatRouteResilienceObservedAt(evidence.lastObservedAt),
                title: buildRouteResilienceObservedTitle(evidence.lastObservedAt, evidence.lastObservedDecisionID),
              },
              {
                label: 'Relevant Decisions',
                value: formatRouteResilienceRelevantDecisionsLabel(evidence),
                title: buildRouteResilienceRelevantDecisionsTitle(evidence),
              },
              {
                label: 'Digest Coverage',
                value: formatRouteResilienceCoverageLabel(evidence),
                title: buildRouteResilienceCoverageTitle(evidence),
              },
              {
                label: 'Reason Summary',
                value: evidence.reasonSummary || '—',
                title: evidence.reasonSummary || '—',
              },
              {
                label: 'Source / Scope / Model',
                value: sourceScopeModelLabel,
                title: [evidence.source, evidence.scope, evidence.model].filter(Boolean).join(' / ') || sourceScopeModelLabel,
              },
            ]}
      />
      {evidence.matchedReasonDetails?.length ? (
        <div data-account-runtime-route-reason-details="current-decision" className="grid gap-1">
          <div className={accountDetailRuntimeMetaSmallClass}>
            Reason Details
          </div>
          <div className="grid gap-1">
            {evidence.matchedReasonDetails.map((reasonDetail, index) => (
              <div
                key={`${reasonDetail.reason}-${reasonDetail.routeBlocking ? 'blocking' : 'observe'}-${index}`}
                data-account-runtime-route-reason-detail={reasonDetail.routeBlocking ? 'blocking' : 'observe'}
                className={accountDetailRuntimeReasonDetailClass}
              >
                <AccountDetailPill
                  tone={reasonDetail.routeBlocking ? 'danger' : 'neutral'}
                  className="!min-h-0 w-fit !py-0.5 !text-[length:var(--font-size-ui-2xs)]"
                >
                  {reasonDetail.routeBlocking ? 'BLOCKING' : 'OBSERVE'}
                </AccountDetailPill>
                <div
                  className="min-w-0 truncate text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)]"
                  title={formatRouteResilienceReasonDetailTitle(reasonDetail.reason, reasonDetail.routeBlocking)}
                >
                  {reasonDetail.reason || 'reason:unknown'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatRouteResilienceLatestEvidenceLabel(evidence: AccountRouteResilienceEvidence) {
  const decisionLabel = String(evidence.decisionID || '').trim() || 'decision:unknown';
  const recordedAtLabel = formatRouteResilienceObservedAt(evidence.recordedAt);
  return `${decisionLabel} · ${recordedAtLabel}`;
}

function buildRouteResilienceLatestEvidenceTitle(evidence: AccountRouteResilienceEvidence) {
  return [
    String(evidence.decisionID || '').trim() || 'decision:unknown',
    String(evidence.recordedAt || '').trim() || 'recordedAt:unknown',
  ].join(' · ');
}

function buildRouteResilienceObservedTitle(recordedAt: string, decisionID: string) {
  return [
    String(recordedAt || '').trim() || 'unknown',
    String(decisionID || '').trim() || 'decision:unknown',
  ].join(' · ');
}

function formatRouteResilienceCurrentDecisionLabel(evidence: AccountRouteResilienceEvidence) {
  const decisionLabel = String(evidence.matchedDecisionID || '').trim() || 'decision:unknown';
  const recordedAtLabel = formatRouteResilienceObservedAt(evidence.matchedRecordedAt);
  return `${decisionLabel} · ${recordedAtLabel}`;
}

function buildRouteResilienceCurrentDecisionTitle(evidence: AccountRouteResilienceEvidence) {
  return buildRouteResilienceObservedTitle(evidence.matchedRecordedAt, evidence.matchedDecisionID);
}

function formatRouteResilienceReferenceLabel(evidence: AccountRouteResilienceEvidence) {
  const relatedDecisionCount = evidence.relevantDecisions?.length || 0;
  if (relatedDecisionCount <= 1) {
    return '当前 decision 独占 digest；无需重复完整 metadata';
  }
  return `共享 digest · 共 ${relatedDecisionCount} 条相关 decision；完整 metadata 已在更近 decision 展示`;
}

function formatRouteResilienceRelevantDecisionsLabel(evidence: AccountRouteResilienceEvidence) {
  if (!evidence.relevantDecisions?.length) {
    return '—';
  }
  return evidence.relevantDecisions
    .map((decision) => `${decision.decisionID || 'decision:unknown'} @ ${formatRouteResilienceObservedAt(decision.recordedAt)}`)
    .join(' / ');
}

function buildRouteResilienceRelevantDecisionsTitle(evidence: AccountRouteResilienceEvidence) {
  if (!evidence.relevantDecisions?.length) {
    return '—';
  }
  return evidence.relevantDecisions
    .map((decision) => buildRouteResilienceObservedTitle(decision.recordedAt, decision.decisionID))
    .join(' / ');
}

function formatRouteResilienceCoverageLabel(evidence: AccountRouteResilienceEvidence) {
  const totalDecisionCount = evidence.relevantDecisions?.length || 0;
  if (totalDecisionCount <= 0) {
    return '—';
  }
  return `${totalDecisionCount} decisions · ${evidence.blockingDecisionCount} blocking / ${evidence.observeDecisionCount} observe`;
}

function buildRouteResilienceCoverageTitle(evidence: AccountRouteResilienceEvidence) {
  const totalDecisionCount = evidence.relevantDecisions?.length || 0;
  if (totalDecisionCount <= 0) {
    return '—';
  }
  return [
    `total:${totalDecisionCount}`,
    `blocking:${evidence.blockingDecisionCount}`,
    `observe:${evidence.observeDecisionCount}`,
  ].join(' · ');
}

function formatRouteResilienceReasonDetailTitle(reason: string, routeBlocking: boolean) {
  return [
    routeBlocking ? 'BLOCKING' : 'OBSERVE',
    String(reason || '').trim() || 'reason:unknown',
  ].join(' · ');
}

function formatRouteResilienceObservedAt(value: string) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '—';
  }
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return normalizedValue;
  }
  return parsed.toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

export function AccountCredentialVerifySection({
  draft,
  setDraft,
  verifyState,
  modelNames,
  span,
  onVerify,
  onProxyValidityChange,
}: AccountCredentialVerifySectionProps) {
  const credentialFields = useMemo(
    () => buildVendorCredentialFields({ displayName: '', provider: '', baseUrl: draft.baseUrl }),
    [draft.baseUrl],
  );

  return (
    <AccountDetailSection
      componentName="AccountCredentialVerifySection"
      eyebrow="API Key"
      title="凭据与验证"
      span={span}
    >
      <div data-account-credential-verify-layout="quiet-split" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div data-account-credential-left-pane="credential-connection" className="grid content-start gap-4 lg:pr-4">
          <section data-account-credential-list-item="credential" className="grid content-start gap-3">
            <div className={accountDetailCredentialSectionTitleClass}>
              账号凭据
            </div>
            <div data-account-credential-fields="balanced-grid" className="grid gap-3">
              <CredentialInputField
                label="账号名称"
                value={draft.label}
                onChange={(value) => setDraft((prev) => ({ ...prev, label: value }))}
              />
              <CredentialInputField
                label="API 密钥"
                value={draft.apiKey}
                onChange={(value) => setDraft((prev) => ({ ...prev, apiKey: value }))}
                onCopy={() => void navigator.clipboard.writeText(draft.apiKey)}
              />
              <CredentialInputField
                label="默认基础 URL"
                value={draft.baseUrl}
                onChange={(value) => setDraft((prev) => ({ ...prev, baseUrl: value }))}
                onCopy={() => void navigator.clipboard.writeText(draft.baseUrl)}
              />
              <CredentialInputField
                label="前缀"
                value={draft.prefix}
                placeholder="/v1"
                onChange={(value) => setDraft((prev) => ({ ...prev, prefix: value }))}
              />
              {credentialFields.map((field) => (
                <VendorCredentialInputField
                  key={field.id}
                  field={field}
                  draft={draft}
                  onChange={(value) => setDraft((prev) => writeDraftCredentialField(prev, field.id, value))}
                />
              ))}
            </div>
          </section>

          <VerifyConnectionPanel
            draft={draft}
            verifyState={verifyState}
            modelNames={modelNames}
            onVerify={onVerify}
          />
        </div>

        <div data-account-credential-right-pane="route" className={accountDetailCredentialPaneDividerClass}>
          <CapabilityEndpointsPanel draft={draft} setDraft={setDraft} />

          <CredentialProxyRoutePanel
            proxyUrl={draft.proxyUrl}
            onProxyUrlChange={(nextProxyURL) => setDraft((prev) => ({ ...prev, proxyUrl: nextProxyURL }))}
            onValidityChange={onProxyValidityChange}
          />
        </div>
      </div>
    </AccountDetailSection>
  );
}

function CapabilityEndpointsPanel({
  draft,
  setDraft,
}: {
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
}) {
  return (
    <section data-account-credential-list-item="capability-endpoints" className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div>
          <div className={accountDetailCredentialMetaLabelClass}>
            ENDPOINTS
          </div>
          <div className={accountDetailCredentialSubheadingClass}>
            协议端点
          </div>
          <p className="mt-2 max-w-[42rem] text-[length:var(--font-size-ui-2xs)] font-medium leading-relaxed text-[var(--text-muted)]">
            留空使用默认基础 URL。
          </p>
        </div>
        <AccountDetailPill className={accountDetailCredentialPillClass}>
          {CAPABILITY_ENDPOINTS.length} 端
        </AccountDetailPill>
      </div>

      <div className="grid gap-2">
        {CAPABILITY_ENDPOINTS.map((endpoint) => (
          <CredentialInputField
            key={endpoint.format}
            label={endpoint.label}
            value={draft.formatBaseUrls[endpoint.format] ?? ''}
            placeholder={draft.baseUrl || 'https://relay.example.com/v1'}
            help={endpoint.hint}
            onChange={(value) => {
              setDraft((prev) => ({
                ...prev,
                formatBaseUrls: {
                  ...prev.formatBaseUrls,
                  [endpoint.format]: value,
                },
              }));
            }}
            onCopy={
              draft.formatBaseUrls[endpoint.format]
                ? () => void navigator.clipboard.writeText(draft.formatBaseUrls[endpoint.format] ?? '')
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

function CredentialProxyRoutePanel({
  proxyUrl,
  onProxyUrlChange,
  onValidityChange,
}: {
  proxyUrl?: string;
  onProxyUrlChange?: (proxyUrl: string) => void;
  onValidityChange?: (message: string) => void;
}) {
  const { t } = useI18n();
  const [storedProxyNodes, setStoredProxyNodes] = useState<ProxyNodeRecord[]>(() => readCredentialProxyNodes());
  const [draft, setDraft] = useState<AccountProxyRouteDraft>(() =>
    buildAccountProxyRouteDraft({ id: 'account-credential-proxy-route', proxyUrl }, storedProxyNodes),
  );

  useEffect(() => {
    setDraft(buildAccountProxyRouteDraft({ id: 'account-credential-proxy-route', proxyUrl }, storedProxyNodes));
  }, [storedProxyNodes, proxyUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    function refreshProxyNodes() {
      setStoredProxyNodes(readCredentialProxyNodes());
    }
    window.addEventListener('storage', refreshProxyNodes);
    window.addEventListener('focus', refreshProxyNodes);
    return () => {
      window.removeEventListener('storage', refreshProxyNodes);
      window.removeEventListener('focus', refreshProxyNodes);
    };
  }, []);

  const proxyOptions = useMemo(
    () =>
      storedProxyNodes
        .map((node) => ({
          node,
          proxyUrl: buildProxyURLFromNode(node),
        }))
        .sort((a, b) => {
          if (a.node.status !== b.node.status) {
            return a.node.status === 'available' ? -1 : 1;
          }
          return a.node.latencyMs - b.node.latencyMs;
        }),
    [storedProxyNodes],
  );
  const summary = useMemo(() => formatAccountProxySummary(draft.proxyUrl, storedProxyNodes), [draft.proxyUrl, storedProxyNodes]);
  const customMissing = draft.mode === 'custom' && !draft.proxyUrl.trim();
  const hasDetachedCurrentURL = Boolean(
    draft.proxyUrl && !proxyOptions.some((item) => item.proxyUrl === draft.proxyUrl),
  );

  useEffect(() => {
    onValidityChange?.(customMissing ? t('accounts.proxy_route_invalid') : '');
  }, [customMissing, onValidityChange, t]);

  function commitDraft(nextDraft: AccountProxyRouteDraft, shouldCommitURL: boolean) {
    setDraft(nextDraft);
    if (shouldCommitURL) {
      onProxyUrlChange?.(nextDraft.proxyUrl);
    }
  }

  function selectProxy(nextProxyURL: string) {
    const selected = proxyOptions.find((item) => item.proxyUrl === nextProxyURL);
    commitDraft(
      {
        mode: 'custom',
        proxyNodeID: selected?.node.id || '',
        proxyUrl: nextProxyURL,
      },
      true,
    );
  }

  return (
    <section data-account-credential-list-item="proxy-route" className="grid gap-3 pt-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div>
          <div className={accountDetailCredentialMetaLabelClass}>
            ROUTE
          </div>
          <div className={accountDetailCredentialSubheadingClass}>
            {t('accounts.proxy_route_title')}
          </div>
        </div>
        <AccountDetailPill className={accountDetailCredentialPillClass}>
          {summary.label}
        </AccountDetailPill>
      </div>

      <AccountProxyRouteEditor
        draft={draft}
        proxyOptions={proxyOptions}
        hasDetachedCurrentURL={hasDetachedCurrentURL}
        onProxySelect={selectProxy}
      />
    </section>
  );
}

function readCredentialProxyNodes(): ProxyNodeRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return readStoredProxyNodes(window.localStorage);
}

function VendorCredentialInputField({
  field,
  draft,
  onChange,
}: {
  field: VendorCredentialField;
  draft: ApiKeyConfigDraft;
  onChange: (value: string) => void;
}) {
  return (
    <CredentialInputField
      label={field.label}
      value={readDraftCredentialField(draft, field.id)}
      placeholder={field.placeholder}
      onChange={onChange}
      secret={field.secret}
      help={field.help}
    />
  );
}

function readDraftCredentialField(draft: ApiKeyConfigDraft, fieldID: VendorCredentialField['id']) {
  if (fieldID === 'platformCookie') {
    return draft.platformCookie ?? draft.curlVariables?.platformCookie ?? '';
  }
  return draft.curlVariables?.[fieldID] ?? '';
}

function writeDraftCredentialField(draft: ApiKeyConfigDraft, fieldID: VendorCredentialField['id'], value: string): ApiKeyConfigDraft {
  const nextVariables = { ...(draft.curlVariables ?? {}), [fieldID]: value };
  if (fieldID === 'platformCookie') {
    return { ...draft, platformCookie: value, curlVariables: nextVariables };
  }
  return { ...draft, curlVariables: nextVariables };
}

function CredentialInputField({
  label,
  value,
  placeholder,
  onChange,
  onCopy,
  secret: _secret,
  help,
  className = 'md:col-span-12',
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCopy?: () => void;
  secret?: boolean;
  help?: string;
  className?: string;
}) {
  return (
    <label data-account-credential-field="plaintext" className={`grid min-w-0 gap-1.5 ${className}`}>
      <span
        data-account-credential-field-label="above"
        className={accountDetailCredentialFieldLabelClass}
      >
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${accountDetailCredentialInputClass} flex-1`}
        />
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className={accountDetailCredentialButtonClass}
          >
            复制
          </button>
        ) : null}
      </div>
      {help ? (
        <span className={accountDetailCredentialHelpClass}>
          {help}
        </span>
      ) : null}
    </label>
  );
}

function VerifyConnectionPanel({
  draft,
  verifyState,
  modelNames,
  onVerify,
}: VerifyConnectionPanelProps) {
  const [verifyModel, setVerifyModel] = useState(DEFAULT_VERIFY_MODEL);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelMenuMode, setModelMenuMode] = useState<'all' | 'custom'>('all');

  useEffect(() => {
    if (verifyState?.model) {
      setVerifyModel(verifyState.model);
    }
  }, [verifyState?.model]);

  const displayedModelNames = useMemo(() => {
    if (!modelNames || modelNames.length === 0) return [];
    if (modelMenuMode === 'all') return modelNames;
    return modelNames.filter((name) => name.toLowerCase().includes(verifyModel.toLowerCase()));
  }, [modelMenuMode, modelNames, verifyModel]);

  const vs = verifyState ?? {
    model: verifyModel,
    status: 'idle' as const,
    message: '',
    lastVerifiedAt: null,
  };

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    }
    if (isModelMenuOpen) {
      window.addEventListener('mousedown', handlePointerDown);
      return () => window.removeEventListener('mousedown', handlePointerDown);
    }
  }, [isModelMenuOpen]);

  return (
    <section data-account-credential-list-item="connection" className="grid gap-3 border-t border-[var(--gt-border-subtle)] pt-4">
      <div className={accountDetailCredentialSectionTitleClass}>
        连通验证
      </div>
      {vs.lastVerifiedAt ? (
        <div className="text-[length:var(--font-size-ui-2xs)] font-medium tracking-normal text-[var(--text-muted)]">
          上次发送：{new Date(vs.lastVerifiedAt).toLocaleString()}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={modelMenuRef} className="relative flex-1">
          <div className="flex items-center gap-2">
            <input
              value={verifyModel}
              onChange={(event) => {
                setVerifyModel(event.target.value);
                setModelMenuMode('custom');
              }}
              onFocus={() => setIsModelMenuOpen(true)}
              className={`${accountDetailCredentialInputClass} flex-1`}
              placeholder={DEFAULT_VERIFY_MODEL}
            />
            {modelNames && modelNames.length > 0 ? (
              <button type="button" onClick={() => setIsModelMenuOpen((prev) => !prev)} className={accountDetailCredentialButtonClass}>
                ▼
              </button>
            ) : null}
          </div>
          {isModelMenuOpen && displayedModelNames.length > 0 ? (
            <div className={accountDetailCredentialMenuClass}>
              {displayedModelNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setVerifyModel(name);
                    setIsModelMenuOpen(false);
                  }}
                  className={accountDetailCredentialMenuItemClass(verifyModel === name)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => onVerify?.({ apiKey: draft.apiKey, baseUrl: draft.baseUrl, model: verifyModel })}
          disabled={vs.status === 'loading'}
          className={`${accountDetailCredentialPrimaryButtonClass} whitespace-nowrap`}
        >
          {vs.status === 'loading' ? '发送中...' : '发送验证'}
        </button>
      </div>

      {vs.status !== 'idle' ? (
        <div className={accountDetailCredentialStatusClass(vs.status)}>
          {vs.status === 'loading' ? 'sending short message…' : vs.message}
        </div>
      ) : null}
    </section>
  );
}

export function AccountQuotaSection({
  account,
  draft,
  setDraft,
  quotaState,
  quotaDisplay,
  readOnlyScripts = false,
  editorOpen: routedEditorOpen,
  onOpenEditor,
  onCloseEditor,
  onTestQuotaCurl,
  topBorder = true,
  headerDivider = true,
  layoutMode = 'split',
}: AccountQuotaSectionProps) {
  const { t } = useI18n();
  const [localEditorOpen, setLocalEditorOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [resetInfo, setResetInfo] = useState<main.OpenAIQuotaResetCreditInfo | null>(null);
  const [resetQueryStatus, setResetQueryStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetQueryMessage, setResetQueryMessage] = useState('');
  const [resetQuotaState, setResetQuotaState] = useState<CodexQuotaState | undefined>();
  const [resetModal, setResetModal] = useState<OpenAIQuotaResetModalState>({
    open: false,
    status: 'confirm',
    message: '',
  });
  const isOpenAIAuthFileQuotaReset = account.credentialSource === 'auth-file' && (account.accountKind === 'auth-file' || account.provider === 'codex');
  const effectiveQuotaState = resetQuotaState ?? quotaState;
  const liveWindows = effectiveQuotaState?.quota ? selectQuotaWindows(effectiveQuotaState.quota) : [];
  const runtimeQuotaDisplay = useMemo(() => buildQuotaDisplay({
    ...account,
    quotaEnabled: draft.quotaEnabled,
    quotaCurl: draft.quotaCurl,
    billingEnabled: draft.billingEnabled,
    billingCurl: draft.billingCurl,
  }, effectiveQuotaState), [account, draft.quotaEnabled, draft.quotaCurl, draft.billingEnabled, draft.billingCurl, effectiveQuotaState]);
  const testQuotaDisplay = useMemo(() => normalizeQuotaTestDisplay(testResult), [testResult]);
  const visibleQuotaDisplay = quotaDisplay?.windows?.length
    ? quotaDisplay
    : runtimeQuotaDisplay.windows.length
      ? runtimeQuotaDisplay
      : testQuotaDisplay;
  const visibleQuotaSource = quotaDisplay?.windows?.length || runtimeQuotaDisplay.windows.length ? 'runtime' : testQuotaDisplay ? 'test' : 'empty';
  const visibleQuotaWindows = visibleQuotaDisplay?.windows ?? [];
  const managementBaseUrl = useMemo(
    () => resolveManagementBaseUrl({ baseUrl: draft.baseUrl, formatBaseUrls: draft.formatBaseUrls }),
    [draft.baseUrl, draft.formatBaseUrls],
  );
  const quotaTemplate = useMemo(
    () => buildQuotaCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: managementBaseUrl,
    }),
    [account.displayName, account.provider, managementBaseUrl],
  );
  const quotaTemplates = useMemo(
    () => buildQuotaCurlTemplates(managementBaseUrl, quotaTemplate),
    [managementBaseUrl, quotaTemplate],
  );
  const quotaSetupGuide = useMemo(
    () => buildQuotaCurlSetupGuide({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: managementBaseUrl,
    }),
    [account.displayName, account.provider, managementBaseUrl],
  );
  const quotaCurlVariableFields = useMemo(
    () => buildVendorCurlVariableFields({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: managementBaseUrl,
    }),
    [account.displayName, account.provider, managementBaseUrl],
  );
  const editorOpen = routedEditorOpen ?? localEditorOpen;
  const hasQuotaScript = draft.quotaCurl.trim().length > 0;
  const quotaLayoutClassName = layoutMode === 'split'
    ? 'grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
    : 'grid min-w-0 gap-3';
  const quotaScriptPaneClassName = layoutMode === 'split'
    ? accountDetailResourcePaneDividerClass
    : accountDetailResourcePaneCompactClass;
  const quotaScriptCardClassName = layoutMode === 'split'
    ? accountDetailResourceScriptCardClass
    : accountDetailResourceCompactCardClass;

  function openEditor() {
    if (onOpenEditor) {
      onOpenEditor();
      return;
    }
    setLocalEditorOpen(true);
  }

  function closeEditor() {
    if (onCloseEditor) {
      onCloseEditor();
      return;
    }
    setLocalEditorOpen(false);
  }

  useEffect(() => {
    setTestStatus('idle');
    setTestMessage('');
    setTestResult(null);
    setResetInfo(null);
    setResetQueryStatus('idle');
    setResetQueryMessage('');
    setResetQuotaState(undefined);
    setResetModal({ open: false, status: 'confirm', message: '' });
  }, [account.id]);

  async function runQuotaTest() {
    if (!onTestQuotaCurl || !draft.quotaCurl.trim()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const result = await onTestQuotaCurl({
        apiKey: draft.apiKey,
        baseUrl: managementBaseUrl,
        prefix: draft.prefix,
        quotaCurl: draft.quotaCurl.trim(),
        platformCookie: (draft.platformCookie ?? "").trim(),
        curlVariables: draft.curlVariables,
      });
      setTestResult(result);
      setTestStatus('success');
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  async function queryOpenAIQuotaResetCredit() {
    if (!isOpenAIAuthFileQuotaReset || !account.quotaKey) return;
    setResetQueryStatus('loading');
    setResetQueryMessage('');
    try {
      const result = await GetOpenAIQuotaResetCredit(account.quotaKey);
      setResetInfo(result);
      setResetQuotaState(result.quotaState ? { status: 'success', quota: result.quotaState } : undefined);
      setResetQueryStatus('success');
    } catch (error) {
      setResetQueryMessage(toErrorMessage(error));
      setResetQueryStatus('error');
    }
  }

  function openResetConfirmation() {
    if (!resetCreditKnown || (resetInfo?.availableCount ?? 0) <= 0) {
      return;
    }
    setResetModal({ open: true, status: 'confirm', message: '' });
  }

  async function confirmOpenAIQuotaReset() {
    if (!account.quotaKey) return;
    if (!resetCreditKnown || (resetInfo?.availableCount ?? 0) <= 0) {
      setResetModal({
        open: true,
        status: 'error',
        message: '没有可用重置次数，请先查询最新重置次数。',
      });
      return;
    }
    setResetModal({ open: true, status: 'loading', message: '正在重置额度窗口...' });
    try {
      const result = await ConsumeOpenAIQuotaResetCredit(account.quotaKey);
      setResetInfo({
        accountKey: result.accountKey,
        status: result.status,
        availableCount: result.availableCount,
        planType: result.planType,
        fetchedAt: result.fetchedAt,
        quotaState: result.quotaState,
      } as main.OpenAIQuotaResetCreditInfo);
      setResetQuotaState(result.quotaState ? { status: 'success', quota: result.quotaState } : undefined);
      setResetQueryStatus('success');
      setResetQueryMessage('');
      setResetModal({
        open: true,
        status: 'success',
        message: '重置成功，已刷新最新额度状态。',
        result,
      });
    } catch (error) {
      setResetModal({
        open: true,
        status: 'error',
        message: toErrorMessage(error),
      });
    }
  }

  const resetCreditKnown = typeof resetInfo?.availableCount === 'number';
  const resetCreditAvailable = resetCreditKnown && (resetInfo?.availableCount ?? 0) > 0;
  const resetCreditLabel = resetCreditKnown ? String(resetInfo?.availableCount ?? 0) + ' 次可用' : '未查询';
  const quotaActions = (
    isOpenAIAuthFileQuotaReset ? (
      <>
        <button
          type="button"
          onClick={queryOpenAIQuotaResetCredit}
          disabled={resetQueryStatus === 'loading' || !account.quotaKey}
          className={accountDetailResourceButtonClass}
        >
          {resetQueryStatus === 'loading' ? '查询中...' : '查询重置次数'}
        </button>
        <button
          type="button"
          onClick={openResetConfirmation}
          disabled={!account.quotaKey || resetQueryStatus === 'loading' || !resetCreditAvailable}
          title={resetCreditAvailable ? '消耗 1 次 OpenAI reset credit' : resetCreditKnown ? '无可用重置次数' : '请先查询重置次数'}
          className={accountDetailResourcePrimaryButtonClass}
        >
          重置额度窗口
        </button>
      </>
    ) : readOnlyScripts ? null : <>
      {hasQuotaScript ? (
        <button type="button" onClick={openEditor} className={accountDetailResourceButtonClass}>
          编辑脚本
        </button>
      ) : null}
      <button
        type="button"
        onClick={runQuotaTest}
        disabled={testStatus === 'loading' || !hasQuotaScript || !onTestQuotaCurl}
        className={accountDetailResourceButtonClass}
      >
        {testStatus === 'loading' ? '测试中...' : '测试'}
      </button>
      {!hasQuotaScript ? (
        <button
          type="button"
          onClick={openEditor}
          className={accountDetailResourceButtonClass}
        >
          添加
        </button>
      ) : null}
    </>
  );

  return (
    <AccountDetailSection
      componentName="AccountQuotaSection"
      eyebrow="Quota"
      title="额度追踪"
      meta={visibleQuotaSource === 'runtime' ? `实时 ${visibleQuotaWindows.length || liveWindows.length} 个窗口` : testQuotaDisplay ? `测试 ${testQuotaDisplay.windows.length} 个窗口` : undefined}
      actions={quotaActions}
      topBorder={topBorder}
      headerDivider={headerDivider}
    >

      <div data-account-quota-layout={layoutMode} className={quotaLayoutClassName}>
        <div data-account-quota-pane="windows" className="grid min-w-0 content-start gap-3">
          {isOpenAIAuthFileQuotaReset ? (
            <div data-openai-quota-reset-credit-panel="true" className={accountDetailResourcePanelClass}>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={accountDetailResourceHeadingClass}>
                    RESET CREDITS
                  </div>
                  <div className={accountDetailResourcePanelValueClass}>
                    {resetCreditLabel}
                  </div>
                </div>
                <AccountDetailPill tone={resetQueryStatus === 'error' ? 'danger' : resetQueryStatus === 'success' ? 'success' : 'neutral'}>
                  {resetQueryStatus === 'loading' ? 'LOADING' : resetQueryStatus === 'success' ? 'LIVE' : resetQueryStatus === 'error' ? 'ERROR' : 'READY'}
                </AccountDetailPill>
              </div>
              <div className={accountDetailResourceHelpClass}>
                {resetQueryStatus === 'error'
                  ? resetQueryMessage
                  : resetInfo
                    ? '获取时间 ' + formatUnixSecondsLabel(resetInfo.fetchedAt) + ' · ' + (resetInfo.planType || account.planType || 'unknown')
                    : '查询后会显示剩余重置次数。点击重置会先二次确认，确认后结果会留在同一个弹框内。'}
              </div>
            </div>
          ) : null}

          {visibleQuotaWindows.length > 0 ? (
            <div className="grid gap-2">
              <div className={accountDetailResourceHeadingClass}>
                {visibleQuotaSource === 'test' ? 'QUOTA (TEST)' : 'QUOTA'}
              </div>
              {visibleQuotaDisplay ? <QuotaBars quotaDisplay={visibleQuotaDisplay} t={t} showDivider={false} /> : null}
            </div>
          ) : (
            <AccountDetailEmptyState className="!border-0 !bg-transparent px-0 py-4 text-left !text-[length:var(--font-size-ui-xs)]">
              {readOnlyScripts
                ? '暂无额度数据'
                : hasQuotaScript ? '暂无额度数据，可测试额度脚本确认接口返回' : '暂无额度脚本，添加后可测试并展示额度'}
            </AccountDetailEmptyState>
          )}

          {!readOnlyScripts && visibleQuotaWindows.length > 0 ? (
            <>
              <QuotaThresholdRulePanel accountKey={account.id} windows={visibleQuotaWindows} />
              <QuotaCalibrationPanel accountKey={account.id} windows={visibleQuotaWindows} />
            </>
          ) : null}

          {testStatus === 'success' && testResult ? (
            <div className={accountDetailResourceMessageClass('success')}>
              OK - {testResult.planType ?? 'quota'} {testResult.windows?.length ? `${testResult.windows.length} windows` : ''}
            </div>
          ) : null}
          {testStatus === 'error' ? (
            <div className={accountDetailResourceMessageClass('danger')}>{testMessage}</div>
          ) : null}
        </div>

        {isOpenAIAuthFileQuotaReset ? null : <aside data-account-quota-pane="script" className={quotaScriptPaneClassName}>
          <div className={accountDetailResourceHeadingClass}>
            SCRIPT
          </div>
          {hasQuotaScript ? (
            <div className={quotaScriptCardClassName}>
              <div
                data-account-quota-script-preview="two-line"
                className="line-clamp-2 min-h-[2.75rem] overflow-hidden break-all font-mono text-[length:var(--font-size-ui-xs)] leading-[1.35rem] text-[var(--text-muted)]"
                title={draft.quotaCurl || undefined}
              >
                {draft.quotaCurl || '未配置额度脚本'}
              </div>
            </div>
          ) : (
            <div className={accountDetailResourceEmptyScriptClass}>
              暂无额度脚本
            </div>
          )}
        </aside>}
      </div>

      {resetModal.open ? (
        <OpenAIQuotaResetConfirmationModal
          status={resetModal.status}
          message={resetModal.message}
          result={resetModal.result}
          availableCount={resetInfo?.availableCount}
          onConfirm={confirmOpenAIQuotaReset}
          onRetry={confirmOpenAIQuotaReset}
          onClose={() => setResetModal({ open: false, status: 'confirm', message: '' })}
        />
      ) : null}

      {editorOpen ? (
        <AccountCurlEditorModal
          title="额度脚本"
          value={draft.quotaCurl}
          enabled={draft.quotaEnabled}
          variables={buildCurlVariables({ ...draft, baseUrl: managementBaseUrl }, quotaCurlVariableFields)}
          templates={quotaTemplates}
          placeholder='curl -sS "{{baseUrl}}/usage" -H "Authorization: Bearer {{apiKey}}"'
          setupGuide={quotaSetupGuide}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, quotaCurl: value }))}
          onEnabledChange={(enabled) => setDraft((prev) => ({ ...prev, quotaEnabled: enabled }))}
          onApplyTemplate={(template) => setDraft((prev) => ({ ...prev, quotaCurl: template, quotaEnabled: true }))}
          onClose={closeEditor}
        />
      ) : null}
    </AccountDetailSection>
  );
}

function OpenAIQuotaResetConfirmationModal({
  status,
  message,
  result,
  availableCount,
  onConfirm,
  onRetry,
  onClose,
}: {
  status: OpenAIQuotaResetModalStatus;
  message: string;
  result?: main.OpenAIQuotaResetConsumeResult;
  availableCount?: number;
  onConfirm: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const resetStatus = status;
  const knownCount = typeof availableCount === 'number';
  const description = resetStatus === 'confirm'
    ? '重置速率限制后，继续不间断地工作。你还有 ' + (knownCount ? String(availableCount) : '未知') + ' 次重置 可用。'
    : resetStatus === 'loading'
      ? message || '正在向 sidecar 请求重置额度窗口...'
      : resetStatus === 'success'
        ? message || '重置成功。'
        : message || '重置失败。';
  const title = resetStatus === 'confirm'
    ? '要重置你的使用量吗?'
    : resetStatus === 'loading'
      ? '正在重置使用量'
      : resetStatus === 'success'
        ? '重置成功'
        : '重置失败';

  return (
    <div data-openai-quota-reset-modal={resetStatus} className={accountDetailQuotaResetModalOverlayClass}>
      <style>{`
        @keyframes openaiQuotaResetGradient {
          0% { background-position: 0% 50%, 78% 52%, 0% 50%; transform: scale(1); }
          50% { background-position: 100% 50%, 40% 44%, 100% 50%; transform: scale(1.035); }
          100% { background-position: 0% 50%, 78% 52%, 0% 50%; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-openai-quota-reset-gradient] { animation: none !important; transform: none !important; }
        }
      `}</style>
      <div className={accountDetailQuotaResetModalPanelClass}>
        <div className={accountDetailQuotaResetHeroClass}>
          <div
            data-openai-quota-reset-gradient="dynamic"
            className="absolute -inset-5 animate-[openaiQuotaResetGradient_14s_ease-in-out_infinite] bg-[radial-gradient(circle_at_63%_58%,rgba(182,239,0,0.98)_0,rgba(120,137,0,0.82)_20%,transparent_34%),radial-gradient(circle_at_77%_60%,rgba(255,167,38,0.96)_0,rgba(255,171,46,0.78)_24%,transparent_40%),linear-gradient(120deg,rgba(69,199,237,0.94)_0%,rgba(188,198,255,0.88)_48%,rgba(231,182,255,0.9)_100%)] bg-[length:165%_165%,150%_150%,180%_180%] blur-[1px]"
          />
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[3px]" />
          <div className="absolute inset-0 opacity-45 [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.58)_0_1px,transparent_1px_44px)]" />
          <div className={accountDetailQuotaResetHeroMarkClass}>
            ›_
          </div>
          <button
            type="button"
            onClick={onClose}
            className={accountDetailQuotaResetCloseButtonClass}
            aria-label="关闭重置弹框"
          >
            ×
          </button>
        </div>
        <div className={accountDetailQuotaResetBodyClass}>
          <div className="grid gap-3">
            <h3 className={accountDetailQuotaResetTitleClass}>{title}</h3>
            <p className={accountDetailQuotaResetDescriptionClass}>{description}</p>
          </div>
          {resetStatus === 'success' && result ? (
            <div className={accountDetailQuotaResetResultClass}>
              <div>Windows reset: {result.windowsReset}</div>
              <div>Credit: {result.credit?.status || result.code || 'redeemed'}</div>
              <div>Redeemed at: {result.credit?.redeemedAt || '—'}</div>
              <div>Remaining: {result.availableCount}</div>
              <div>Quota refresh: {result.postResetRefreshStatus || 'unknown'}</div>
            </div>
          ) : null}
          {resetStatus === 'error' ? (
            <div className={accountDetailQuotaResetErrorClass}>
              {message}
            </div>
          ) : null}
          <div className="grid gap-3">
            {resetStatus === 'confirm' ? (
              <button type="button" onClick={onConfirm} className={accountDetailQuotaResetPrimaryButtonClass}>
                确认重置使用次数
              </button>
            ) : resetStatus === 'loading' ? (
              <button type="button" disabled className={accountDetailQuotaResetPrimaryButtonClass}>
                重置中...
              </button>
            ) : resetStatus === 'success' ? (
              <button type="button" onClick={onClose} className={accountDetailQuotaResetPrimaryButtonClass}>
                完成
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={onClose} className={accountDetailQuotaResetSecondaryButtonClass}>
                  关闭
                </button>
                <button type="button" onClick={onRetry} className={accountDetailQuotaResetPrimaryButtonClass}>
                  重试
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatUnixSecondsLabel(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return '—';
  }
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}

export function AccountBillingSection({
  account,
  draft,
  setDraft,
  liveBilling,
  readOnlyScripts = false,
  editorOpen: routedEditorOpen,
  onOpenEditor,
  onCloseEditor,
  onTestBillingCurl,
  topBorder = true,
  headerDivider = true,
}: AccountBillingSectionProps) {
  const [localEditorOpen, setLocalEditorOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testBilling, setTestBilling] = useState<BillingDisplay | undefined>(undefined);
  const managementBaseUrl = useMemo(
    () => resolveManagementBaseUrl({ baseUrl: draft.baseUrl, formatBaseUrls: draft.formatBaseUrls }),
    [draft.baseUrl, draft.formatBaseUrls],
  );
  const billingTemplate = useMemo(
    () => buildBillingCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: managementBaseUrl,
    }),
    [account.displayName, account.provider, managementBaseUrl],
  );
  const billingTemplates = useMemo(
    () => buildBillingCurlTemplates(managementBaseUrl, billingTemplate),
    [billingTemplate, managementBaseUrl],
  );
  const billingSetupGuide = useMemo(
    () => buildBillingCurlSetupGuide({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: managementBaseUrl,
    }),
    [account.displayName, account.provider, managementBaseUrl],
  );
  const billingCurlVariableFields = useMemo(
    () => buildVendorCurlVariableFields({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: managementBaseUrl,
    }),
    [account.displayName, account.provider, managementBaseUrl],
  );
  const editorOpen = routedEditorOpen ?? localEditorOpen;
  const hasBillingScript = draft.billingCurl.trim().length > 0;
  const liveBalances = liveBilling?.isAvailable ? liveBilling.balances : [];

  function openEditor() {
    if (onOpenEditor) {
      onOpenEditor();
      return;
    }
    setLocalEditorOpen(true);
  }

  function closeEditor() {
    if (onCloseEditor) {
      onCloseEditor();
      return;
    }
    setLocalEditorOpen(false);
  }

  useEffect(() => {
    setTestStatus('idle');
    setTestMessage('');
    setTestBilling(undefined);
  }, [account.id]);

  async function runBillingTest() {
    if (!onTestBillingCurl || !draft.billingCurl.trim()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const result = await onTestBillingCurl({
        apiKey: draft.apiKey,
        baseUrl: managementBaseUrl,
        prefix: draft.prefix,
        billingCurl: draft.billingCurl.trim(),
        platformCookie: (draft.platformCookie ?? "").trim(),
        curlVariables: draft.curlVariables,
      });
      const nextBilling = normalizeBillingDisplay(result);
      setTestBilling(nextBilling);
      setTestStatus('success');
      if (!nextBilling) {
        setTestMessage('余额接口未返回余额数据');
      }
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  const billingActions = (
    readOnlyScripts ? null : <>
      {hasBillingScript ? (
        <button type="button" onClick={openEditor} className={accountDetailResourceButtonClass}>
          编辑脚本
        </button>
      ) : null}
      <button
        type="button"
        onClick={runBillingTest}
        disabled={testStatus === 'loading' || !hasBillingScript || !onTestBillingCurl}
        className={accountDetailResourceButtonClass}
      >
        {testStatus === 'loading' ? '测试中...' : '测试余额'}
      </button>
      {!hasBillingScript ? (
        <button
          type="button"
          onClick={openEditor}
          className={accountDetailResourceButtonClass}
        >
          添加
        </button>
      ) : null}
    </>
  );

  return (
    <AccountDetailSection
      componentName="AccountBillingSection"
      eyebrow="Billing"
      title="余额"
      meta={liveBilling ? '实时余额已就绪' : undefined}
      actions={billingActions}
      topBorder={topBorder}
      headerDivider={headerDivider}
    >

      {liveBalances.length > 0 ? (
        <div className="grid gap-2 content-start">
          <div className={accountDetailResourceHeadingClass}>
            BALANCE
          </div>
          {liveBalances.map((balance, index) => (
            <div key={`${balance.currency}-${index}`} className={accountDetailResourceDataRowClass}>
              <RuntimeKV label="Total" value={`${balance.totalBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Granted" value={`${balance.grantedBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Topped Up" value={`${balance.toppedUpBalance} ${balance.currency}`.trim()} />
            </div>
          ))}
        </div>
      ) : (
        <AccountDetailEmptyState className="!border-0 !bg-transparent px-0 py-4 text-left !text-[length:var(--font-size-ui-xs)]">
          {readOnlyScripts
            ? '暂无余额数据'
            : hasBillingScript ? '暂无余额数据，可测试余额脚本确认接口返回' : '暂无余额脚本，添加后可测试并展示余额'}
        </AccountDetailEmptyState>
      )}

      {hasBillingScript ? (
        <div className={accountDetailResourceCompactCardClass}>
          <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-muted)]" title={draft.billingCurl || undefined}>
            {draft.billingCurl || '未配置余额脚本'}
          </div>
        </div>
      ) : null}

      {testStatus === 'success' && testBilling ? (
        <div className="grid gap-2 content-start">
          <div className={accountDetailResourceHeadingClass}>
            BALANCE (TEST)
          </div>
          {testBilling.balances.map((balance, index) => (
            <div key={`${balance.currency}-${index}`} className={accountDetailResourceDataRowClass}>
              <RuntimeKV label="Total" value={`${balance.totalBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Granted" value={`${balance.grantedBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Topped Up" value={`${balance.toppedUpBalance} ${balance.currency}`.trim()} />
            </div>
          ))}
        </div>
      ) : null}
      {testStatus === 'success' && testMessage ? (
        <div className={accountDetailResourceMessageClass('neutral')}>{testMessage}</div>
      ) : null}
      {testStatus === 'error' ? (
        <div className={accountDetailResourceMessageClass('danger')}>{testMessage}</div>
      ) : null}

      {editorOpen ? (
        <AccountCurlEditorModal
          title="余额脚本"
          value={draft.billingCurl}
          enabled={draft.billingEnabled}
          variables={buildCurlVariables({ ...draft, baseUrl: managementBaseUrl }, billingCurlVariableFields)}
          templates={billingTemplates}
          placeholder={billingTemplate || 'curl -sS "{{baseUrl}}/billing" -H "Authorization: Bearer {{apiKey}}"'}
          setupGuide={billingSetupGuide}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, billingCurl: value }))}
          onEnabledChange={(enabled) => setDraft((prev) => ({ ...prev, billingEnabled: enabled }))}
          onApplyTemplate={(template) => setDraft((prev) => ({ ...prev, billingCurl: template, billingEnabled: true }))}
          onClose={closeEditor}
        />
      ) : null}
    </AccountDetailSection>
  );
}

function RuntimeKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className={accountDetailResourceKvLabelClass}>
        {label}
      </div>
      <div className={accountDetailResourceKvValueClass}>
        {value}
      </div>
    </div>
  );
}

export function AccountDetailFooter({
  isApiKey,
  configDirty,
  rateLimitDirty = false,
  missingFields,
  savingConfig,
  onClose,
  onSaveConfig,
}: AccountDetailFooterProps) {
  const { t } = useI18n();
  const hasDirtyChanges = configDirty || rateLimitDirty;
  const dirtyMessage = configDirty && rateLimitDirty
    ? '账号配置 / 路由守卫有未保存改动'
    : configDirty
      ? '账号配置有未保存改动'
      : rateLimitDirty
        ? t('accounts.rate_limit_dirty')
        : '';

  return (
    <>
      <div
        data-account-detail-footer-status="single-line"
        className={accountDetailFooterStatusClass}
      >
        {isApiKey && missingFields.length > 0
          ? `缺少：${missingFields.join(', ')}`
          : dirtyMessage}
      </div>
      <div data-account-detail-footer-actions className={accountDetailFooterActionsClass}>
        <button onClick={onClose} className={accountDetailFooterButtonClass}>
          {t('common.close')}
        </button>
        {isApiKey || rateLimitDirty ? (
          <button
            onClick={onSaveConfig}
            disabled={!hasDirtyChanges || missingFields.length > 0 || savingConfig}
            className={accountDetailFooterPrimaryButtonClass}
          >
            {savingConfig ? '保存中...' : '保存改动'}
          </button>
        ) : null}
      </div>
    </>
  );
}

function normalizeBillingDisplay(result: any): BillingDisplay | undefined {
  if (!result?.isAvailable || !Array.isArray(result.balanceInfos) || result.balanceInfos.length === 0) {
    return undefined;
  }
  return {
    isAvailable: true,
    balances: result.balanceInfos.map((info: any) => ({
      currency: info?.currency ?? '',
      totalBalance: info?.totalBalance ?? '0',
      grantedBalance: info?.grantedBalance ?? '0',
      toppedUpBalance: info?.toppedUpBalance ?? '0',
    })),
  };
}
